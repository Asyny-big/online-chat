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
import kotlinx.coroutines.Job
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
    private val _isSocketConnected = MutableStateFlow(false)
    private var socketDisconnectedAtMillis: Long? = null
    private var socketFallbackJob: Job? = null
    private var socketFallbackActive = false
    private var lastDecision: NetworkStateDecision? = null
    private val _diagnostics = MutableStateFlow(
        TunnelDiagnosticsSnapshot(
            networkLabel = networkStateTracker.networkLabel.value,
            isConnected = networkStateTracker.isConnected.value,
            isRestrictedNetwork = networkStateTracker.isRestrictedNetwork.value,
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
        private const val NETWORK_LABEL_CELLULAR = "Мобильная сеть"
        private const val NETWORK_LABEL_WIFI = "Wi-Fi"
        private const val NETWORK_LABEL_VPN = "VPN"
        private const val SOCKET_FALLBACK_GRACE_MS = 12_000L

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
        lastDecision = decision
        val isCellularNetwork = decision.networkLabel == NETWORK_LABEL_CELLULAR
        val isCellularProbePending = isCellularNetwork &&
            decision.backendReachable == null &&
            !isVpnRunning
        val shouldUseTunnel = decision.isRestricted ||
            (isCellularNetwork && decision.backendReachable == false) ||
            (isCellularNetwork && socketFallbackActive)
        if (decision.networkLabel != NETWORK_LABEL_CELLULAR) {
            // Reset fallback state when leaving cellular (Wi-Fi/VPN/none).
            cancelSocketFallbackTimer()
            socketFallbackActive = false
        }

        _isRestrictedNetworkState.value = shouldUseTunnel
        updateDiagnostics {
            it.copy(
                isConnected = decision.isConnected,
                isRestrictedNetwork = shouldUseTunnel,
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

        if (isCellularProbePending) {
            Log.d(TAG, "Cellular reachability probe is still pending. Waiting before choosing direct/VPN path.")
            updateDiagnostics {
                it.copy(
                    stageLabel = NETWORK_LABEL_CELLULAR,
                    lastEvent = decision.probeSummary,
                    isVpnPermissionRequired = _vpnPermissionRequired.value,
                    lastError = decision.probeError
                )
            }
            return
        }

        if (shouldUseTunnel) {
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
                Log.w(TAG, "Restricted network, but no cached servers found. Waiting for Wi-Fi bootstrap.")
                updateDiagnostics {
                    it.copy(
                        stageLabel = "Нет кэша VPN",
                        lastEvent = "Для первого запуска VPN нужен Wi-Fi: кэш VLESS ещё пуст",
                        lastError = "Нет сохранённых VLESS-конфигов. Подключите Wi-Fi один раз, чтобы загрузить кэш."
                    )
                }
            }
        } else {
            Log.d(TAG, "Unrestricted network detected.")
            if (decision.networkLabel == NETWORK_LABEL_VPN && isVpnRunning) {
                updateDiagnostics {
                    it.copy(
                        stageLabel = "VPN активен",
                        lastEvent = "Приложение работает через встроенный VPN",
                        lastError = null
                    )
                }
                return
            }

            updateDiagnostics {
                it.copy(
                    stageLabel = if (decision.networkLabel == NETWORK_LABEL_CELLULAR) {
                        "Мобильная сеть без VPN"
                    } else {
                        "Свободная сеть"
                    },
                    lastEvent = decision.probeSummary,
                    lastError = decision.probeError
                )
            }
            if (!serverManager.hasCachedServers()) {
                if (decision.networkLabel == NETWORK_LABEL_WIFI) {
                    Log.d(TAG, "First time on Wi-Fi. Fetching config...")
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
                } else {
                    Log.d(TAG, "Skipping initial config fetch outside Wi-Fi.")
                    updateDiagnostics {
                        it.copy(
                            stageLabel = "Ожидание Wi-Fi",
                            lastEvent = "Первичная загрузка VLESS-конфигов выполняется только по Wi-Fi",
                            lastError = null
                        )
                    }
                }
            }
            
            // Direct networks do not need the app VPN; the VPN network itself is handled above.
            stopTunnel()
            updateDiagnostics {
                it.copy(
                    stageLabel = directNetworkStageLabel(it.networkLabel),
                    lastEvent = when {
                        it.cachedServerCount > 0 ->
                            "Приложение работает напрямую, кэш серверов доступен"
                        it.networkLabel == NETWORK_LABEL_WIFI ->
                            "Приложение работает напрямую, кэш серверов пока пуст"
                        else ->
                            "Приложение работает напрямую, кэш VPN пуст; первая загрузка только по Wi-Fi"
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
                    current.isConnected -> directNetworkStageLabel(current.networkLabel)
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

    private fun directNetworkStageLabel(networkLabel: String): String {
        return when (networkLabel) {
            NETWORK_LABEL_CELLULAR -> "Мобильная сеть без VPN"
            NETWORK_LABEL_WIFI -> "Wi-Fi без VPN"
            NETWORK_LABEL_VPN -> "VPN"
            "Ethernet" -> "Ethernet без VPN"
            else -> "Прямое подключение"
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

    /**
     * Called by realtime layer (SocketGateway/MainViewModel) whenever the WebSocket
     * to the backend connects or disconnects. We use this as a secondary signal to
     * detect whitelist mobile networks: in some carriers /api/ping (HTTP/HTTPS)
     * is reachable because the host is whitelisted, but socket.io / WebSocket
     * upgrades are blocked. In that case the basic reachability probe says
     * "VPN не нужен" but the user actually has no realtime working — we still
     * need to bring up the in-app VPN.
     */
    fun setSocketConnected(connected: Boolean) {
        val previous = _isSocketConnected.value
        _isSocketConnected.value = connected
        if (connected) {
            socketDisconnectedAtMillis = null
            cancelSocketFallbackTimer()
            if (socketFallbackActive) {
                socketFallbackActive = false
                Log.i(TAG, "Realtime socket recovered. Clearing socket-fallback flag.")
                updateDiagnostics {
                    it.copy(
                        lastEvent = "Сокет realtime поднялся, фоновое наблюдение продолжается"
                    )
                }
            }
            return
        }

        if (previous) {
            socketDisconnectedAtMillis = System.currentTimeMillis()
        }
        scheduleSocketFallbackCheck()
    }

    private fun scheduleSocketFallbackCheck() {
        if (socketFallbackJob?.isActive == true) return
        if (socketFallbackActive) return
        val networkLabel = lastDecision?.networkLabel ?: return
        if (networkLabel != NETWORK_LABEL_CELLULAR) return
        if (isVpnRunning) return

        socketFallbackJob = scope.launch {
            delay(SOCKET_FALLBACK_GRACE_MS)
            evaluateSocketFallback()
        }
    }

    private fun evaluateSocketFallback() {
        val decision = lastDecision ?: return
        if (decision.networkLabel != NETWORK_LABEL_CELLULAR) return
        if (_isSocketConnected.value) return
        if (isVpnRunning) return
        if (!serverManager.hasCachedServers()) {
            updateDiagnostics {
                it.copy(
                    stageLabel = "Сокет не поднимается",
                    lastEvent = "Сокет realtime молчит ${SOCKET_FALLBACK_GRACE_MS / 1000} с, но кэш VPN пуст. Подключите Wi-Fi один раз, чтобы скачать конфиги.",
                    lastError = "Realtime недоступен на мобильной сети, нужен VPN, но кэш VLESS-конфигов пуст."
                )
            }
            return
        }
        Log.w(
            TAG,
            "Cellular socket has been silent for >${SOCKET_FALLBACK_GRACE_MS / 1000}s while " +
                "backend HTTP is reachable=${decision.backendReachable}. Forcing in-app VPN."
        )
        socketFallbackActive = true
        _isRestrictedNetworkState.value = true
        updateDiagnostics {
            it.copy(
                isRestrictedNetwork = true,
                stageLabel = "Сокет молчит → поднимаю VPN",
                lastEvent = "Сервер доступен по HTTP, но realtime-сокет не подключается ${SOCKET_FALLBACK_GRACE_MS / 1000} с. Включаю встроенный VPN автоматически.",
                lastError = null
            )
        }
        startTunnel()
    }

    private fun cancelSocketFallbackTimer() {
        socketFallbackJob?.cancel()
        socketFallbackJob = null
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
