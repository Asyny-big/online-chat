package ru.govchat.app.tunnel.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import ru.govchat.app.BuildConfig
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import javax.net.ssl.SSLException

class NetworkStateTracker(private val context: Context) {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _isRestrictedNetwork = MutableStateFlow(false)
    val isRestrictedNetwork: StateFlow<Boolean> = _isRestrictedNetwork

    private val _isConnected = MutableStateFlow(true)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _networkLabel = MutableStateFlow("Неизвестная сеть")
    val networkLabel: StateFlow<String> = _networkLabel

    private val _isBackendReachable = MutableStateFlow<Boolean?>(null)
    val isBackendReachable: StateFlow<Boolean?> = _isBackendReachable

    private val _isPublicInternetReachable = MutableStateFlow<Boolean?>(null)
    val isPublicInternetReachable: StateFlow<Boolean?> = _isPublicInternetReachable

    private val _lastProbeSummary = MutableStateFlow("Проверка доступности ещё не запускалась")
    val lastProbeSummary: StateFlow<String> = _lastProbeSummary

    private val _lastProbeError = MutableStateFlow<String?>(null)
    val lastProbeError: StateFlow<String?> = _lastProbeError

    private var probeJob: Job? = null
    private var lostNetworkJob: Job? = null
    private var activeProbeNetwork: Network? = null
    private var probeGeneration = 0

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runCatching {
                cancelLostNetworkCheck()
                _isConnected.value = true
                updateNetworkState(network)
            }.onFailure { error ->
                handleCallbackError("onAvailable", error)
            }
        }

        override fun onLost(network: Network) {
            runCatching {
                cancelLostNetworkCheck()
                val activeNetwork = connectivityManager.activeNetwork
                if (activeNetwork != null && activeNetwork != network) {
                    Log.d(TAG, "Network lost=$network, refreshing current active network=$activeNetwork")
                    updateNetworkState(activeNetwork)
                    return
                }

                scheduleLostNetworkCheck(network)
            }.onFailure { error ->
                handleCallbackError("onLost", error)
            }
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            runCatching {
                cancelLostNetworkCheck()
                updateNetworkState(network, networkCapabilities)
            }.onFailure { error ->
                handleCallbackError("onCapabilitiesChanged", error)
            }
        }
    }

    fun startTracking() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        runCatching {
            connectivityManager.registerNetworkCallback(request, networkCallback)
        }.onFailure { error ->
            _lastProbeError.value = error.message ?: error.javaClass.simpleName
            _lastProbeSummary.value = "Не удалось включить мониторинг сети"
            Log.e(TAG, "Failed to register network callback", error)
        }

        val activeNetwork = connectivityManager.activeNetwork
        if (activeNetwork != null) {
            _isConnected.value = true
            updateNetworkState(activeNetwork)
        } else {
            _isConnected.value = false
            _networkLabel.value = "Нет сети"
            _lastProbeSummary.value = "Нет активного подключения"
        }
    }

    fun stopTracking() {
        probeJob?.cancel()
        lostNetworkJob?.cancel()
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (error: Exception) {
            Log.e(TAG, "Error unregistering callback", error)
        }
    }

    private fun updateNetworkState(
        network: Network,
        capabilities: NetworkCapabilities? = null
    ) {
        val caps = capabilities ?: connectivityManager.getNetworkCapabilities(network) ?: return
        val transport = resolveTransport(caps)

        _isConnected.value = true
        _networkLabel.value = transport.label
        _lastProbeSummary.value = "Проверяю доступность сети: ${transport.label.lowercase()}"
        Log.d(
            TAG,
            "Network state changed. network=$network transport=${transport.label} " +
                "validated=${caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)}"
        )
        scheduleReachabilityProbe(network, transport)
    }

    private fun scheduleReachabilityProbe(network: Network, transport: TransportKind) {
        if (activeProbeNetwork == network && probeJob?.isActive == true) {
            Log.d(TAG, "Reachability probe already active for network=$network, keeping original debounce")
            return
        }

        probeJob?.cancel()
        activeProbeNetwork = network
        val generation = ++probeGeneration
        probeJob = scope.launch {
            try {
                _lastProbeSummary.value =
                    "Проверяю ${transport.label.lowercase()}: жду стабилизации сети…"

                val result = withTimeoutOrNull(PROBE_STABILIZATION_TIMEOUT_MS) {
                    delay(PROBE_DEBOUNCE_MS)
                    probeReachability(network, transport)
                } ?: ProbeResult(
                    backendReachable = false,
                    publicInternetReachable = false,
                    lastError = "Таймаут проверки сети ${PROBE_STABILIZATION_TIMEOUT_MS / 1000} с",
                    backendFailureKind = ProbeFailureKind.Timeout
                )

                if (generation != probeGeneration) return@launch
                applyProbeResult(transport, result)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                Log.e(TAG, "Reachability probe failed", error)
                if (generation == probeGeneration) {
                    applyProbeResult(
                        transport = transport,
                        result = ProbeResult(
                            backendReachable = false,
                            publicInternetReachable = false,
                            lastError = error.message ?: error.javaClass.simpleName,
                            backendFailureKind = ProbeFailureKind.Other
                        )
                    )
                }
            } finally {
                if (generation == probeGeneration) {
                    activeProbeNetwork = null
                }
            }
        }
    }

    private fun applyProbeResult(transport: TransportKind, result: ProbeResult) {
        _isBackendReachable.value = result.backendReachable
        _isPublicInternetReachable.value = result.publicInternetReachable
        _lastProbeError.value = result.lastError

        val backendBlockedByCarrier = result.backendFailureKind in setOf(
            ProbeFailureKind.Dns,
            ProbeFailureKind.Timeout,
            ProbeFailureKind.Connection,
            ProbeFailureKind.Ssl
        )

        val restricted = transport == TransportKind.Cellular &&
            !result.backendReachable &&
            (result.publicInternetReachable || backendBlockedByCarrier)

        _isRestrictedNetwork.value = restricted
        _lastProbeSummary.value = when {
            result.backendReachable && transport == TransportKind.Cellular ->
                "Сервер доступен через мобильную сеть, VPN не нужен"
            result.backendReachable ->
                "Сервер доступен напрямую, VPN не нужен"
            restricted && result.backendFailureKind == ProbeFailureKind.Dns ->
                "DNS ${backendHostLabel()} недоступен в мобильной сети, запускаю VPN"
            restricted && result.backendFailureKind == ProbeFailureKind.Timeout ->
                "Проверка мобильной сети истекла, запускаю VPN"
            restricted ->
                "Сервер недоступен в мобильной сети, VPN нужен"
            result.publicInternetReachable ->
                "Интернет работает, но сервер не ответил"
            else ->
                "Интернет нестабилен или сеть ещё переключается"
        }

        Log.i(
            TAG,
            "Probe completed. network=${transport.label} backend=${result.backendReachable} " +
                "public=${result.publicInternetReachable} restricted=$restricted " +
                "backendFailure=${result.backendFailureKind} error=${result.lastError}"
        )
    }

    private suspend fun probeReachability(
        network: Network,
        transport: TransportKind
    ): ProbeResult {
        var backendReachable = false
        var publicInternetReachable = false
        var lastError: String? = null
        var backendFailureKind = ProbeFailureKind.None
        val backendHost = backendHostLabel()
        val networkLabel = transport.label.lowercase()

        repeat(PROBE_ATTEMPTS) { attempt ->
            val attemptLabel = "${attempt + 1}/$PROBE_ATTEMPTS"

            _lastProbeSummary.value =
                "Проверяю $networkLabel ($attemptLabel): пингую $backendHost…"

            val backend = probeUrl(
                network = network,
                url = buildBackendPingUrl(),
                successCodes = 200..299
            )
            backendReachable = backend.isSuccess
            backendFailureKind = if (backend.isSuccess) ProbeFailureKind.None else backend.failureKind
            if (backendReachable) {
                _lastProbeSummary.value =
                    "Сервер $backendHost ответил с попытки $attemptLabel"
                return ProbeResult(
                    backendReachable = true,
                    publicInternetReachable = true,
                    lastError = null,
                    backendFailureKind = ProbeFailureKind.None
                )
            }

            val backendFailureLabel = humanFailureLabel(backend.failureKind)
            _lastProbeSummary.value =
                "$backendHost не отвечает ($attemptLabel, $backendFailureLabel), проверяю публичный интернет…"

            val publicProbe = probeUrl(
                network = network,
                url = PUBLIC_PROBE_URL,
                successCodes = 200..299
            )
            publicInternetReachable = publicProbe.isSuccess
            lastError = backend.error ?: publicProbe.error

            if (attempt < PROBE_ATTEMPTS - 1) {
                _lastProbeSummary.value = if (publicProbe.isSuccess) {
                    "$backendHost не доступен ($backendFailureLabel), интернет работает; жду перед попыткой ${attempt + 2}/$PROBE_ATTEMPTS…"
                } else {
                    "Сеть нестабильна ($backendFailureLabel); жду перед попыткой ${attempt + 2}/$PROBE_ATTEMPTS…"
                }
                delay(PROBE_RETRY_DELAY_MS)
            }
        }

        return ProbeResult(
            backendReachable = backendReachable,
            publicInternetReachable = publicInternetReachable,
            lastError = lastError,
            backendFailureKind = backendFailureKind
        )
    }

    private fun humanFailureLabel(kind: ProbeFailureKind): String {
        return when (kind) {
            ProbeFailureKind.Dns -> "DNS заблокирован"
            ProbeFailureKind.Timeout -> "таймаут"
            ProbeFailureKind.Connection -> "соединение отклонено"
            ProbeFailureKind.Ssl -> "ошибка TLS"
            ProbeFailureKind.Http -> "ошибка HTTP"
            ProbeFailureKind.Other -> "сетевая ошибка"
            ProbeFailureKind.None -> "нет ошибок"
        }
    }

    private fun probeUrl(
        network: Network,
        url: String,
        successCodes: IntRange
    ): ProbeAttempt {
        var connection: HttpURLConnection? = null
        return try {
            connection = network.openConnection(URL(url)) as HttpURLConnection
            connection.connectTimeout = PROBE_TIMEOUT_MS
            connection.readTimeout = PROBE_TIMEOUT_MS
            connection.instanceFollowRedirects = true
            connection.requestMethod = "GET"
            connection.setRequestProperty("User-Agent", "GovChat-ReachabilityProbe/${BuildConfig.VERSION_NAME}")
            connection.connect()
            val responseCode = connection.responseCode
            ProbeAttempt(
                isSuccess = responseCode in successCodes,
                error = if (responseCode in successCodes) null else "HTTP $responseCode for $url",
                failureKind = if (responseCode in successCodes) ProbeFailureKind.None else ProbeFailureKind.Http
            )
        } catch (error: Exception) {
            ProbeAttempt(
                isSuccess = false,
                error = error.message ?: error.javaClass.simpleName,
                failureKind = classifyProbeFailure(error)
            )
        } finally {
            connection?.disconnect()
        }
    }

    private fun classifyProbeFailure(error: Exception): ProbeFailureKind {
        val message = error.message.orEmpty()
        return when {
            error is UnknownHostException ||
                message.contains("Unable to resolve host", ignoreCase = true) ||
                message.contains("No address associated with hostname", ignoreCase = true) ->
                ProbeFailureKind.Dns
            error is SocketTimeoutException ->
                ProbeFailureKind.Timeout
            error is SSLException ->
                ProbeFailureKind.Ssl
            message.contains("failed to connect", ignoreCase = true) ||
                message.contains("connection refused", ignoreCase = true) ||
                message.contains("network is unreachable", ignoreCase = true) ||
                message.contains("econn", ignoreCase = true) ->
                ProbeFailureKind.Connection
            else ->
                ProbeFailureKind.Other
        }
    }

    private fun buildBackendPingUrl(): String {
        val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')
        return "$baseUrl/ping"
    }

    private fun backendHostLabel(): String {
        return runCatching { URL(buildBackendPingUrl()).host }
            .getOrDefault("сервер")
            .ifBlank { "сервер" }
    }

    private fun resolveTransport(capabilities: NetworkCapabilities): TransportKind {
        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> TransportKind.Vpn
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> TransportKind.Cellular
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> TransportKind.Wifi
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> TransportKind.Ethernet
            else -> TransportKind.Other
        }
    }

    private fun clearActiveNetwork(summary: String) {
        probeJob?.cancel()
        lostNetworkJob?.cancel()
        activeProbeNetwork = null
        probeGeneration += 1
        _isConnected.value = false
        _isRestrictedNetwork.value = false
        _networkLabel.value = "Нет сети"
        _isBackendReachable.value = null
        _isPublicInternetReachable.value = null
        _lastProbeSummary.value = summary
        _lastProbeError.value = null
        Log.i(TAG, summary)
    }

    private fun scheduleLostNetworkCheck(lostNetwork: Network) {
        lostNetworkJob?.cancel()
        lostNetworkJob = scope.launch {
            _lastProbeSummary.value = "Сеть переключается, перепроверяю активное подключение…"
            delay(LOST_NETWORK_GRACE_MS)

            val activeNetwork = connectivityManager.activeNetwork
            if (activeNetwork != null) {
                Log.i(TAG, "Recovered active network after loss=$lostNetwork -> active=$activeNetwork")
                updateNetworkState(activeNetwork)
                return@launch
            }

            Log.w(TAG, "No active network after grace timeout. lost=$lostNetwork")
            clearActiveNetwork("Нет активного подключения")
        }
    }

    private fun cancelLostNetworkCheck() {
        lostNetworkJob?.cancel()
        lostNetworkJob = null
    }

    private fun handleCallbackError(callbackName: String, error: Throwable) {
        if (error is CancellationException) throw error
        val message = error.message ?: error.javaClass.simpleName
        _lastProbeError.value = message
        _lastProbeSummary.value = "Ошибка мониторинга сети: $callbackName"
        Log.e(TAG, "Network callback $callbackName failed", error)
    }

    private data class ProbeResult(
        val backendReachable: Boolean,
        val publicInternetReachable: Boolean,
        val lastError: String?,
        val backendFailureKind: ProbeFailureKind
    )

    private data class ProbeAttempt(
        val isSuccess: Boolean,
        val error: String?,
        val failureKind: ProbeFailureKind
    )

    private enum class ProbeFailureKind {
        None,
        Dns,
        Timeout,
        Connection,
        Ssl,
        Http,
        Other
    }

    private enum class TransportKind(val label: String) {
        Vpn("VPN"),
        Cellular("Мобильная сеть"),
        Wifi("Wi-Fi"),
        Ethernet("Ethernet"),
        Other("Другая сеть")
    }

    private companion object {
        private const val TAG = "NetworkStateTracker"
        private const val PROBE_TIMEOUT_MS = 2_000
        private const val PROBE_ATTEMPTS = 2
        private const val PROBE_DEBOUNCE_MS = 1_500L
        private const val PROBE_RETRY_DELAY_MS = 1_000L
        private const val PROBE_STABILIZATION_TIMEOUT_MS = 9_000L
        private const val LOST_NETWORK_GRACE_MS = 2_500L
        private const val PUBLIC_PROBE_URL = "https://cp.cloudflare.com/generate_204"
    }
}
