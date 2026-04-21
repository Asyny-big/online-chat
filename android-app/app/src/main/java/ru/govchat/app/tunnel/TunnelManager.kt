package ru.govchat.app.tunnel

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.govchat.app.BuildConfig
import ru.govchat.app.tunnel.core.InvisibleVpnService
import ru.govchat.app.tunnel.data.ServerManager
import ru.govchat.app.tunnel.network.NetworkStateTracker
import ru.govchat.app.tunnel.worker.ConfigUpdateWorker
import java.util.concurrent.TimeUnit

data class TunnelDiagnosticsSnapshot(
    val networkLabel: String = "Неизвестная сеть",
    val isConnected: Boolean = false,
    val isRestrictedNetwork: Boolean = false,
    val isTunnelRunning: Boolean = false,
    val isVpnPermissionRequired: Boolean = false,
    val stageLabel: String = "Инициализация",
    val lastEvent: String = "Запуск диагностики",
    val cachedServerCount: Int = 0,
    val lastFetchParsedCount: Int? = null,
    val lastConfigAttemptAtMillis: Long? = null,
    val lastConfigSuccessAtMillis: Long? = null,
    val lastTunnelStartAtMillis: Long? = null,
    val lastTunnelStopAtMillis: Long? = null,
    val lastError: String? = null,
    val lastCacheReadError: String? = null,
    val lastResponseSizeBytes: Int? = null,
    val isBackendReachable: Boolean? = null,
    val isPublicInternetReachable: Boolean? = null,
    val lastProbeSummary: String = "Проверка сети ещё не запускалась",
    val configSourceUrl: String = BuildConfig.TUNNEL_CONFIG_URL
)

private data class NetworkStateDecision(
    val isConnected: Boolean,
    val isRestricted: Boolean,
    val networkLabel: String,
    val backendReachable: Boolean?,
    val publicInternetReachable: Boolean?,
    val probeSummary: String,
    val probeError: String?
)

class TunnelManager private constructor(private val context: Context) {

    private val applicationContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val networkStateTracker = NetworkStateTracker(applicationContext)
    private val serverManager = ServerManager(applicationContext)
    
    private var isTracking = false
    private var isVpnRunning = false
    private var pendingTunnelStart = false
    private val _vpnPermissionRequired = MutableStateFlow(false)
    val vpnPermissionRequired: StateFlow<Boolean> = _vpnPermissionRequired
    private val _isRestrictedNetworkState = MutableStateFlow(false)
    val isRestrictedNetworkState: StateFlow<Boolean> = _isRestrictedNetworkState
    private val _isTunnelRunningState = MutableStateFlow(false)
    val isTunnelRunningState: StateFlow<Boolean> = _isTunnelRunningState
    private val _diagnostics = MutableStateFlow(
        TunnelDiagnosticsSnapshot(
            cachedServerCount = serverManager.getCacheStats().cachedServerCount,
            lastFetchParsedCount = serverManager.getCacheStats().lastFetchParsedCount,
            lastConfigAttemptAtMillis = serverManager.getCacheStats().lastFetchAttemptAtMillis,
            lastConfigSuccessAtMillis = serverManager.getCacheStats().lastSuccessfulFetchAtMillis,
            lastError = serverManager.getCacheStats().lastFetchError,
            lastCacheReadError = serverManager.getCacheStats().lastReadError,
            lastResponseSizeBytes = serverManager.getCacheStats().lastResponseSizeBytes,
            isBackendReachable = networkStateTracker.isBackendReachable.value,
            isPublicInternetReachable = networkStateTracker.isPublicInternetReachable.value,
            lastProbeSummary = networkStateTracker.lastProbeSummary.value,
            configSourceUrl = serverManager.getCacheStats().sourceUrl
        )
    )
    val diagnostics: StateFlow<TunnelDiagnosticsSnapshot> = _diagnostics

    companion object {
        private const val TAG = "TunnelManager"

        @Volatile
        private var instance: TunnelManager? = null

        fun getInstance(context: Context): TunnelManager {
            return instance ?: synchronized(this) {
                instance ?: TunnelManager(context).also { instance = it }
            }
        }
    }

    fun initialize() {
        if (isTracking) return
        isTracking = true

        Log.i(TAG, "Initializing TunnelManager...")
        updateDiagnostics {
            it.copy(
                stageLabel = "Инициализация",
                lastEvent = "Мониторинг сети и tunnel-статуса включён",
                lastError = it.lastError
            )
        }
        
        networkStateTracker.startTracking()

        // Observe network state to decide whether to start or stop VPN
        networkStateTracker.isConnected
            .combine(networkStateTracker.isRestrictedNetwork) { isConnected, isRestricted ->
                Pair(isConnected, isRestricted)
            }
            .combine(networkStateTracker.networkLabel) { (isConnected, isRestricted), networkLabel ->
                Triple(isConnected, isRestricted, networkLabel)
            }
            .combine(networkStateTracker.isBackendReachable) { (isConnected, isRestricted, networkLabel), backendReachable ->
                NetworkStateDecision(
                    isConnected = isConnected,
                    isRestricted = isRestricted,
                    networkLabel = networkLabel,
                    backendReachable = backendReachable,
                    publicInternetReachable = networkStateTracker.isPublicInternetReachable.value,
                    probeSummary = networkStateTracker.lastProbeSummary.value,
                    probeError = networkStateTracker.lastProbeError.value
                )
            }
            .onEach { decision ->
                handleNetworkStateChange(decision)
            }
            .launchIn(scope)

        scheduleConfigUpdate()
    }

    private suspend fun handleNetworkStateChange(decision: NetworkStateDecision) {
        _isRestrictedNetworkState.value = decision.isRestricted
        updateDiagnostics {
            it.copy(
                isConnected = decision.isConnected,
                isRestrictedNetwork = decision.isRestricted,
                networkLabel = decision.networkLabel,
                isBackendReachable = decision.backendReachable,
                isPublicInternetReachable = decision.publicInternetReachable,
                lastProbeSummary = decision.probeSummary,
                lastError = it.lastError ?: decision.probeError
            )
        }

        if (!decision.isConnected) {
            Log.d(TAG, "No network connection. Stopping VPN if running.")
            stopTunnel()
            updateDiagnostics {
                it.copy(
                    stageLabel = "Нет подключения",
                    lastEvent = "Интернет недоступен, tunnel остановлен",
                    isVpnPermissionRequired = false
                )
            }
            return
        }

        if (decision.isRestricted) {
            Log.d(TAG, "Restricted network detected. Checking cache...")
            updateDiagnostics {
                it.copy(
                    stageLabel = "Мобильная сеть",
                    lastEvent = decision.probeSummary,
                    isVpnPermissionRequired = _vpnPermissionRequired.value
                )
            }
            if (serverManager.hasCachedServers()) {
                Log.d(TAG, "Starting VPN tunnel.")
                updateDiagnostics {
                    it.copy(
                        stageLabel = "Подготовка VPN",
                        lastEvent = "Кэш найден, запускаю sing-box"
                    )
                }
                startTunnel()
            } else {
                Log.w(TAG, "Restricted network, but no cached servers found! Attempting to fetch config anyway...")
                updateDiagnostics {
                    it.copy(
                        stageLabel = "Загрузка конфигов",
                        lastEvent = "Кэша нет, пытаюсь загрузить VLESS-конфиги с GitHub",
                        lastError = null
                    )
                }
                val success = serverManager.fetchAndCacheServers()
                if (success) {
                    Log.i(TAG, "Config fetched successfully on restricted network. Starting VPN.")
                    updateDiagnostics {
                        it.copy(
                            stageLabel = "Подготовка VPN",
                            lastEvent = "Конфиги загружены, запускаю sing-box",
                            lastError = null
                        )
                    }
                    startTunnel()
                } else {
                    Log.e(TAG, "Failed to fetch config on restricted network. Cannot connect. (DEAD END)")
                    updateDiagnostics {
                        it.copy(
                            stageLabel = "Ошибка конфигов",
                            lastEvent = "Не удалось получить конфиги на мобильной сети",
                            lastError = serverManager.getCacheStats().lastFetchError
                                ?: "Нет кэша и GitHub-источник недоступен"
                        )
                    }
                }
            }
        } else {
            Log.d(TAG, "Unrestricted network detected.")
            updateDiagnostics {
                it.copy(
                    stageLabel = if (decision.networkLabel == "Мобильная сеть") {
                        "Мобильная сеть без VPN"
                    } else {
                        "Свободная сеть"
                    },
                    lastEvent = decision.probeSummary,
                    lastError = decision.probeError
                )
            }
            if (!serverManager.hasCachedServers()) {
                Log.d(TAG, "First time on unrestricted network. Fetching config...")
                updateDiagnostics {
                    it.copy(
                        stageLabel = "Обновление кэша",
                        lastEvent = "Загружаю VLESS-конфиги по Wi-Fi",
                        lastError = null
                    )
                }
                val success = serverManager.fetchAndCacheServers()
                if (success) {
                    Log.i(TAG, "Config fetched and cached successfully.")
                    updateDiagnostics {
                        it.copy(
                            stageLabel = "Кэш готов",
                            lastEvent = "Конфиги успешно обновлены",
                            lastError = null
                        )
                    }
                } else {
                    Log.e(TAG, "Failed to fetch initial config.")
                    updateDiagnostics {
                        it.copy(
                            stageLabel = "Ошибка обновления кэша",
                            lastEvent = "Не удалось обновить список серверов",
                            lastError = serverManager.getCacheStats().lastFetchError ?: "Ошибка загрузки конфигов"
                        )
                    }
                }
            }
            
            // If we are on unrestricted network, we might not need VPN.
            stopTunnel()
            updateDiagnostics {
                it.copy(
                    stageLabel = "Wi-Fi без VPN",
                    lastEvent = if (it.cachedServerCount > 0) {
                        "Приложение работает напрямую, кэш серверов доступен"
                    } else {
                        "Приложение работает напрямую, кэш серверов пока пуст"
                    },
                    lastError = serverManager.getCacheStats().lastFetchError
                )
            }
        }
    }

    private fun startTunnel() {
        if (isVpnRunning) return
        if (VpnService.prepare(applicationContext) != null) {
            pendingTunnelStart = true
            _vpnPermissionRequired.value = true
            Log.w(TAG, "VPN permission has not been granted yet")
            updateDiagnostics {
                it.copy(
                    isVpnPermissionRequired = true,
                    stageLabel = "Ожидание разрешения",
                    lastEvent = "Android ожидает подтверждение на запуск VPN"
                )
            }
            return
        }

        val intent = Intent(applicationContext, InvisibleVpnService::class.java).apply {
            action = InvisibleVpnService.ACTION_START
        }
        updateDiagnostics {
            it.copy(
                isVpnPermissionRequired = false,
                stageLabel = "Запуск VPN",
                lastEvent = "Запускаю сервис VPN и sing-box",
                lastError = null
            )
        }
        ContextCompat.startForegroundService(applicationContext, intent)
    }

    private fun stopTunnel() {
        if (!isVpnRunning) return
        val intent = Intent(applicationContext, InvisibleVpnService::class.java).apply {
            action = InvisibleVpnService.ACTION_STOP
        }
        updateDiagnostics {
            it.copy(
                stageLabel = "Остановка VPN",
                lastEvent = "Останавливаю VPN-сервис"
            )
        }
        ContextCompat.startForegroundService(applicationContext, intent)
    }
    
    fun restartTunnel() {
        stopTunnel()
        // Simple delay to ensure previous instance is cleaned up, in production use proper binding/callbacks
        scope.launch {
            delay(1000)
            startTunnel()
        }
    }

    fun isTunnelActive() = isVpnRunning

    fun onVpnPermissionResult(granted: Boolean) {
        _vpnPermissionRequired.value = false
        val shouldStartTunnel = pendingTunnelStart
        pendingTunnelStart = false

        if (!granted) {
            Log.w(TAG, "VPN permission request was denied")
            updateDiagnostics {
                it.copy(
                    isVpnPermissionRequired = false,
                    stageLabel = "VPN не запущен",
                    lastEvent = "Пользователь отклонил системный запрос VPN",
                    lastError = "Разрешение Android на VPN не выдано"
                )
            }
            return
        }

        if (shouldStartTunnel) {
            Log.i(TAG, "VPN permission granted. Resuming tunnel start.")
            updateDiagnostics {
                it.copy(
                    isVpnPermissionRequired = false,
                    stageLabel = "Разрешение получено",
                    lastEvent = "Системное разрешение VPN получено, продолжаю запуск",
                    lastError = null
                )
            }
            startTunnel()
        }
    }

    fun markTunnelRunning(isRunning: Boolean) {
        isVpnRunning = isRunning
        _isTunnelRunningState.value = isRunning
        if (isRunning) {
            pendingTunnelStart = false
            _vpnPermissionRequired.value = false
        }
        updateDiagnostics { current ->
            current.copy(
                isTunnelRunning = isRunning,
                isVpnPermissionRequired = _vpnPermissionRequired.value,
                stageLabel = when {
                    isRunning -> "VPN активен"
                    current.lastError != null -> "Ошибка VPN"
                    current.isRestrictedNetwork -> "VPN остановлен"
                    current.isConnected -> "Wi-Fi без VPN"
                    else -> "Нет подключения"
                },
                lastEvent = when {
                    isRunning -> "Туннель поднят, трафик GovChat идёт через sing-box"
                    current.lastError != null -> current.lastEvent
                    current.isRestrictedNetwork -> "VPN остановлен в ограниченной сети"
                    current.isConnected -> "VPN остановлен, приложение работает напрямую"
                    else -> "VPN остановлен из-за отсутствия сети"
                },
                lastTunnelStartAtMillis = if (isRunning) System.currentTimeMillis() else current.lastTunnelStartAtMillis,
                lastTunnelStopAtMillis = if (isRunning) current.lastTunnelStopAtMillis else System.currentTimeMillis()
            )
        }
    }

    fun reportTunnelEvent(message: String) {
        Log.i(TAG, message)
        updateDiagnostics {
            it.copy(lastEvent = message)
        }
    }

    fun reportTunnelFailure(message: String) {
        Log.e(TAG, message)
        updateDiagnostics {
            it.copy(
                stageLabel = "Ошибка VPN",
                lastEvent = message,
                lastError = message,
                isVpnPermissionRequired = false
            )
        }
    }

    private fun scheduleConfigUpdate() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodicWork = PeriodicWorkRequestBuilder<ConfigUpdateWorker>(12, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            ConfigUpdateWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodicWork
        )
    }

    private fun updateDiagnostics(transform: (TunnelDiagnosticsSnapshot) -> TunnelDiagnosticsSnapshot) {
        _diagnostics.update { current ->
            val stats = serverManager.getCacheStats()
            val updated = transform(current)
            updated.copy(
                cachedServerCount = stats.cachedServerCount,
                lastFetchParsedCount = stats.lastFetchParsedCount,
                lastConfigAttemptAtMillis = stats.lastFetchAttemptAtMillis,
                lastConfigSuccessAtMillis = stats.lastSuccessfulFetchAtMillis,
                lastCacheReadError = stats.lastReadError,
                lastResponseSizeBytes = stats.lastResponseSizeBytes,
                isBackendReachable = updated.isBackendReachable,
                isPublicInternetReachable = updated.isPublicInternetReachable,
                lastProbeSummary = updated.lastProbeSummary,
                configSourceUrl = stats.sourceUrl,
                isTunnelRunning = isVpnRunning,
                isVpnPermissionRequired = _vpnPermissionRequired.value,
                lastError = updated.lastError ?: stats.lastFetchError ?: stats.lastReadError
            )
        }
    }
}
