package ru.govchat.app.core.update

import android.app.DownloadManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.network.GovChatApi
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class AppUpdateManager(
    private val applicationScope: CoroutineScope,
    private val api: GovChatApi,
    private val storage: AppUpdateStorage,
    private val downloader: AppUpdateDownloadManager,
    private val verifier: AppUpdateIntegrityVerifier,
    private val installer: AppUpdateInstaller
) {
    private val mutableState = MutableStateFlow(AppUpdateUiState())
    val state: StateFlow<AppUpdateUiState> = mutableState.asStateFlow()

    private val mutableActions = MutableSharedFlow<AppUpdateAction>(extraBufferCapacity = 4)
    val actions = mutableActions.asSharedFlow()

    private val started = AtomicBoolean(false)
    private var skippedVersionCode: Long? = null
    private var activeDownload: PersistedAppUpdateDownload? = null
    private var pendingInstall: PersistedPendingInstall? = null
    private var downloadPollingJob: Job? = null
    private var resumeDownloadAfterInstallPermission = false

    fun start() {
        if (!started.compareAndSet(false, true)) return

        applicationScope.launch {
            skippedVersionCode = storage.readSkippedVersionCode()
            activeDownload = storage.readActiveDownload()
            pendingInstall = storage.readPendingInstall()?.takeIf { File(it.apkPath).exists() }
            if (pendingInstall == null) {
                storage.clearPendingInstall()
            }
            if (activeDownload != null) {
                mutableState.update {
                    it.copy(
                        transferPhase = AppUpdateTransferPhase.Downloading,
                        showPrompt = true
                    )
                }
                observeDownload(activeDownload ?: return@launch)
            } else if (pendingInstall != null) {
                mutableState.update {
                    it.copy(
                        transferPhase = AppUpdateTransferPhase.ReadyToInstall,
                        showPrompt = true
                    )
                }
            }
            checkForUpdates(forceRefresh = false)
        }
    }

    fun checkForUpdates(forceRefresh: Boolean = true) {
        applicationScope.launch {
            mutableState.update { it.copy(isChecking = true, errorMessage = null) }
            runCatching { api.getAndroidAppUpdate().toDomain() }
                .onSuccess { info ->
                    applyUpdateInfo(info, forceRefresh = forceRefresh)
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            isChecking = false,
                            errorMessage = if (forceRefresh) {
                                error.message ?: "Не удалось проверить наличие обновления"
                            } else {
                                it.errorMessage
                            }
                        )
                    }
                }
        }
    }

    fun postponeCurrentUpdate() {
        val info = mutableState.value.info ?: return
        if (resolveAvailability(info) != AppUpdateAvailability.Optional) return

        applicationScope.launch {
            skippedVersionCode = info.latestVersionCode
            storage.saveSkippedVersionCode(info.latestVersionCode)
            mutableState.update {
                it.copy(
                    showPrompt = false,
                    errorMessage = null
                )
            }
        }
    }

    fun startUpdate() {
        val info = mutableState.value.info ?: return
        if (!mutableState.value.canStartUpdate) return

        applicationScope.launch {
            if (!installer.canRequestPackageInstalls()) {
                resumeDownloadAfterInstallPermission = true
                mutableState.update {
                    it.copy(
                        installPermissionRequired = true,
                        showPrompt = true
                    )
                }
                mutableActions.emit(
                    AppUpdateAction.OpenUnknownSourcesSettings(installer.unknownSourcesSettingsIntent())
                )
                return@launch
            }

            mutableState.update {
                it.copy(
                    installPermissionRequired = false,
                    showPrompt = true,
                    errorMessage = null
                )
            }
            storage.clearSkippedVersionCode()
            skippedVersionCode = null

            val currentDownload = activeDownload
            if (currentDownload != null && currentDownload.versionCode == info.latestVersionCode) {
                observeDownload(currentDownload)
                return@launch
            }

            currentDownload?.let { stale ->
                downloader.remove(stale.downloadId)
                storage.clearActiveDownload()
            }

            downloader.enqueue(info)
                .onSuccess { download ->
                    activeDownload = download
                    storage.saveActiveDownload(
                        downloadId = download.downloadId,
                        versionCode = download.versionCode,
                        apkPath = download.apkPath
                    )
                    mutableState.update {
                        it.copy(
                            transferPhase = AppUpdateTransferPhase.Downloading,
                            progressPercent = 0,
                            downloadedBytes = 0L,
                            totalBytes = null,
                            errorMessage = null
                        )
                    }
                    observeDownload(download)
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            transferPhase = AppUpdateTransferPhase.Error,
                            errorMessage = error.message ?: "Не удалось начать загрузку обновления"
                        )
                    }
                }
        }
    }

    fun retryAfterError() {
        val current = mutableState.value
        if (current.transferPhase == AppUpdateTransferPhase.Error) {
            startUpdate()
        } else {
            checkForUpdates(forceRefresh = true)
        }
    }

    fun onHostResumed() {
        applicationScope.launch {
            if (resumeDownloadAfterInstallPermission && installer.canRequestPackageInstalls()) {
                resumeDownloadAfterInstallPermission = false
                startUpdate()
                return@launch
            }

            mutableState.value.info?.let { info ->
                val availability = resolveAvailability(info)
                if (
                    mutableState.value.transferPhase == AppUpdateTransferPhase.Installing &&
                    BuildConfig.VERSION_CODE.toLong() < info.latestVersionCode
                ) {
                    mutableState.update {
                        it.copy(
                            transferPhase = AppUpdateTransferPhase.Idle,
                            showPrompt = availability == AppUpdateAvailability.Mandatory,
                            errorMessage = if (availability == AppUpdateAvailability.Mandatory) {
                                "Установка обновления не завершена"
                            } else {
                                null
                            }
                        )
                    }
                }
            }

            if (pendingInstall != null) {
                launchInstallerIfReady()
            }
        }
    }

    private fun applyUpdateInfo(info: AppUpdateInfo, forceRefresh: Boolean) {
        val availability = resolveAvailability(info)
        val shouldShowPrompt = when (availability) {
            AppUpdateAvailability.Mandatory -> true
            AppUpdateAvailability.Optional -> skippedVersionCode != info.latestVersionCode || forceRefresh
            else -> false
        }

        mutableState.update { current ->
            current.copy(
                info = info,
                availability = availability,
                isChecking = false,
                showPrompt = shouldShowPrompt || current.shouldShowModal,
                errorMessage = current.errorMessage?.takeIf { current.transferPhase == AppUpdateTransferPhase.Error }
            )
        }

        pendingInstall?.let { pending ->
            if (pending.versionCode == info.latestVersionCode) {
                mutableState.update {
                    it.copy(
                        transferPhase = AppUpdateTransferPhase.ReadyToInstall,
                        showPrompt = true
                    )
                }
                applicationScope.launch {
                    launchInstallerIfReady()
                }
            }
        }
    }

    private fun observeDownload(download: PersistedAppUpdateDownload) {
        downloadPollingJob?.cancel()
        downloadPollingJob = applicationScope.launch {
            while (true) {
                val snapshot = downloader.query(download.downloadId)
                if (snapshot == null) {
                    handleDownloadFailure("Загрузка обновления не найдена")
                    break
                }

                when (snapshot.status) {
                    DownloadManager.STATUS_PENDING,
                    DownloadManager.STATUS_PAUSED,
                    DownloadManager.STATUS_RUNNING -> {
                        activeDownload = download
                        val total = snapshot.totalBytes.takeIf { it > 0L }
                        val progress = if (total != null) {
                            ((snapshot.bytesDownloaded * 100L) / total).toInt().coerceIn(0, 100)
                        } else {
                            null
                        }
                        mutableState.update {
                            it.copy(
                                transferPhase = AppUpdateTransferPhase.Downloading,
                                showPrompt = true,
                                progressPercent = progress,
                                downloadedBytes = snapshot.bytesDownloaded,
                                totalBytes = total,
                                errorMessage = null
                            )
                        }
                    }

                    DownloadManager.STATUS_SUCCESSFUL -> {
                        handleDownloadCompleted(download, snapshot)
                        break
                    }

                    DownloadManager.STATUS_FAILED -> {
                        handleDownloadFailure(downloadFailureMessage(snapshot.reason))
                        break
                    }
                }

                delay(DOWNLOAD_POLL_INTERVAL_MS)
            }
        }
    }

    private suspend fun handleDownloadCompleted(
        download: PersistedAppUpdateDownload,
        snapshot: AppUpdateDownloadSnapshot
    ) {
        mutableState.update {
            it.copy(
                transferPhase = AppUpdateTransferPhase.Verifying,
                progressPercent = 100,
                downloadedBytes = snapshot.bytesDownloaded,
                totalBytes = snapshot.totalBytes.takeIf { size -> size > 0L },
                errorMessage = null
            )
        }

        val file = File(download.apkPath)
        val info = mutableState.value.info
        if (info == null) {
            handleDownloadFailure("Не удалось восстановить метаданные обновления")
            return
        }

        verifier.verify(file, info)
            .onSuccess {
                activeDownload = null
                storage.clearActiveDownload()
                pendingInstall = PersistedPendingInstall(
                    versionCode = download.versionCode,
                    apkPath = file.absolutePath
                )
                storage.savePendingInstall(download.versionCode, file.absolutePath)
                mutableState.update {
                    it.copy(
                        transferPhase = AppUpdateTransferPhase.ReadyToInstall,
                        showPrompt = true,
                        progressPercent = 100,
                        errorMessage = null
                    )
                }
                launchInstallerIfReady()
            }
            .onFailure { error ->
                handleDownloadFailure(error.message ?: "Проверка APK не пройдена")
            }
    }

    private suspend fun launchInstallerIfReady() {
        val pending = pendingInstall ?: return
        val file = File(pending.apkPath)
        if (!file.exists()) {
            storage.clearPendingInstall()
            pendingInstall = null
            mutableState.update {
                it.copy(
                    transferPhase = AppUpdateTransferPhase.Error,
                    errorMessage = "Файл обновления был удалён"
                )
            }
            return
        }

        if (!installer.canRequestPackageInstalls()) {
            mutableState.update {
                it.copy(
                    transferPhase = AppUpdateTransferPhase.ReadyToInstall,
                    installPermissionRequired = true,
                    showPrompt = true
                )
            }
            mutableActions.emit(
                AppUpdateAction.OpenUnknownSourcesSettings(installer.unknownSourcesSettingsIntent())
            )
            return
        }

        mutableState.update {
            it.copy(
                transferPhase = AppUpdateTransferPhase.Installing,
                installPermissionRequired = false,
                showPrompt = true,
                errorMessage = null
            )
        }
        mutableActions.emit(
            AppUpdateAction.LaunchInstaller(installer.installIntent(file))
        )
    }

    private suspend fun handleDownloadFailure(message: String) {
        activeDownload?.let { downloader.remove(it.downloadId) }
        activeDownload = null
        storage.clearActiveDownload()
        mutableState.update {
            it.copy(
                transferPhase = AppUpdateTransferPhase.Error,
                progressPercent = null,
                downloadedBytes = 0L,
                totalBytes = null,
                errorMessage = message,
                showPrompt = true
            )
        }
    }

    private fun downloadFailureMessage(reason: Int): String {
        return when (reason) {
            DownloadManager.ERROR_CANNOT_RESUME -> "Не удалось продолжить загрузку обновления"
            DownloadManager.ERROR_DEVICE_NOT_FOUND -> "Хранилище устройства недоступно"
            DownloadManager.ERROR_FILE_ALREADY_EXISTS -> "Файл обновления уже существует"
            DownloadManager.ERROR_FILE_ERROR -> "Ошибка записи файла обновления"
            DownloadManager.ERROR_HTTP_DATA_ERROR -> "Ошибка передачи данных при загрузке"
            DownloadManager.ERROR_INSUFFICIENT_SPACE -> "Недостаточно места для обновления"
            DownloadManager.ERROR_TOO_MANY_REDIRECTS -> "Слишком много перенаправлений при загрузке"
            DownloadManager.ERROR_UNHANDLED_HTTP_CODE -> "Сервер вернул неподдерживаемый код ответа"
            DownloadManager.ERROR_UNKNOWN -> "Неизвестная ошибка загрузки обновления"
            else -> "Не удалось загрузить обновление"
        }
    }

    private companion object {
        private const val DOWNLOAD_POLL_INTERVAL_MS = 750L
    }
}
