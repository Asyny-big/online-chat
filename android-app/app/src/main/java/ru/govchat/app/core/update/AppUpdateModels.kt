package ru.govchat.app.core.update

import android.content.Intent
import androidx.annotation.VisibleForTesting
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.network.AndroidAppUpdateDto

data class AppUpdateInfo(
    val latestVersion: String,
    val latestVersionCode: Long,
    val minSupportedVersion: String,
    val minSupportedVersionCode: Long,
    val forceUpdate: Boolean,
    val apkUrl: String,
    val changelog: List<String> = emptyList(),
    val apkSha256: String? = null,
    val signingCertSha256: List<String> = emptyList()
)

enum class AppUpdateAvailability {
    Unknown,
    UpToDate,
    Optional,
    Mandatory
}

enum class AppUpdateTransferPhase {
    Idle,
    Downloading,
    Verifying,
    ReadyToInstall,
    Installing,
    Error
}

data class AppUpdateUiState(
    val currentVersionName: String = BuildConfig.VERSION_NAME,
    val currentVersionCode: Long = BuildConfig.VERSION_CODE.toLong(),
    val info: AppUpdateInfo? = null,
    val availability: AppUpdateAvailability = AppUpdateAvailability.Unknown,
    val isChecking: Boolean = false,
    val transferPhase: AppUpdateTransferPhase = AppUpdateTransferPhase.Idle,
    val showPrompt: Boolean = false,
    val progressPercent: Int? = null,
    val downloadedBytes: Long = 0L,
    val totalBytes: Long? = null,
    val errorMessage: String? = null,
    val installPermissionRequired: Boolean = false
) {
    val isUpdateAvailable: Boolean
        get() = availability == AppUpdateAvailability.Optional || availability == AppUpdateAvailability.Mandatory

    val isMandatory: Boolean
        get() = availability == AppUpdateAvailability.Mandatory

    val shouldShowModal: Boolean
        get() = isMandatory ||
            showPrompt ||
            transferPhase == AppUpdateTransferPhase.Downloading ||
            transferPhase == AppUpdateTransferPhase.Verifying ||
            transferPhase == AppUpdateTransferPhase.ReadyToInstall ||
            transferPhase == AppUpdateTransferPhase.Installing

    val canStartUpdate: Boolean
        get() = isUpdateAvailable &&
            transferPhase != AppUpdateTransferPhase.Downloading &&
            transferPhase != AppUpdateTransferPhase.Verifying &&
            transferPhase != AppUpdateTransferPhase.Installing

    val canPostpone: Boolean
        get() = availability == AppUpdateAvailability.Optional &&
            transferPhase == AppUpdateTransferPhase.Idle &&
            !isChecking

    val statusLabel: String
        get() = when {
            isChecking -> "Проверка обновления"
            transferPhase == AppUpdateTransferPhase.Downloading -> "Загрузка обновления"
            transferPhase == AppUpdateTransferPhase.Verifying -> "Проверка файла"
            transferPhase == AppUpdateTransferPhase.ReadyToInstall -> "Готово к установке"
            transferPhase == AppUpdateTransferPhase.Installing -> "Установка запущена"
            availability == AppUpdateAvailability.Mandatory -> "Требуется обновление"
            availability == AppUpdateAvailability.Optional -> "Доступно обновление"
            availability == AppUpdateAvailability.UpToDate -> "Актуальная версия"
            else -> "Статус неизвестен"
        }
}

sealed interface AppUpdateAction {
    data class OpenUnknownSourcesSettings(val intent: Intent) : AppUpdateAction
    data class LaunchInstaller(val intent: Intent) : AppUpdateAction
}

data class PersistedAppUpdateDownload(
    val downloadId: Long,
    val versionCode: Long,
    val apkPath: String
)

data class PersistedPendingInstall(
    val versionCode: Long,
    val apkPath: String
)

data class AppUpdateDownloadSnapshot(
    val status: Int,
    val reason: Int,
    val bytesDownloaded: Long,
    val totalBytes: Long,
    val localUri: String?
)

internal fun AndroidAppUpdateDto.toDomain(): AppUpdateInfo {
    val latestCode = latestVersionCode ?: parseVersionCodeFallback(latestVersion)
    val minCode = minSupportedVersionCode ?: parseVersionCodeFallback(minSupportedVersion)
    return AppUpdateInfo(
        latestVersion = latestVersion,
        latestVersionCode = latestCode,
        minSupportedVersion = minSupportedVersion,
        minSupportedVersionCode = minCode,
        forceUpdate = forceUpdate,
        apkUrl = apkUrl,
        changelog = changelog.orEmpty().mapNotNull { item ->
            item.trim().takeIf { it.isNotBlank() }
        },
        apkSha256 = apkSha256?.trim()?.lowercase()?.takeIf { it.isNotBlank() },
        signingCertSha256 = signingCertSha256.orEmpty().mapNotNull { item ->
            item.trim().lowercase().takeIf { it.isNotBlank() }
        }
    )
}

internal fun resolveAvailability(
    info: AppUpdateInfo,
    currentVersionCode: Long = BuildConfig.VERSION_CODE.toLong()
): AppUpdateAvailability {
    return when {
        currentVersionCode < info.minSupportedVersionCode -> AppUpdateAvailability.Mandatory
        currentVersionCode < info.latestVersionCode -> {
            if (info.forceUpdate) AppUpdateAvailability.Mandatory else AppUpdateAvailability.Optional
        }

        else -> AppUpdateAvailability.UpToDate
    }
}

@VisibleForTesting
internal fun parseVersionCodeFallback(version: String): Long {
    val parts = version
        .split('.', '-', '_')
        .mapNotNull { token -> token.trim().toLongOrNull() }
        .take(4)

    if (parts.isEmpty()) return 0L

    var result = 0L
    parts.forEach { part ->
        result = (result * 1_000L) + part.coerceIn(0L, 999L)
    }
    return result
}
