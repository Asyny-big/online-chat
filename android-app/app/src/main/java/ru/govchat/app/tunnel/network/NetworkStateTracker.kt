package ru.govchat.app.tunnel.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
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

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            _isConnected.value = true
            updateNetworkState(network)
        }

        override fun onLost(network: Network) {
            if (network != connectivityManager.activeNetwork) return

            probeJob?.cancel()
            _isConnected.value = false
            _isRestrictedNetwork.value = false
            _networkLabel.value = "Нет сети"
            _isBackendReachable.value = null
            _isPublicInternetReachable.value = null
            _lastProbeSummary.value = "Нет активного подключения"
            _lastProbeError.value = null
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            updateNetworkState(network, networkCapabilities)
        }
    }

    fun startTracking() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)

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
        scheduleReachabilityProbe(network, transport)
    }

    private fun scheduleReachabilityProbe(network: Network, transport: TransportKind) {
        probeJob?.cancel()
        probeJob = scope.launch {
            delay(PROBE_DEBOUNCE_MS)

            val result = probeReachability(network)
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
    }

    private suspend fun probeReachability(network: Network): ProbeResult {
        var backendReachable = false
        var publicInternetReachable = false
        var lastError: String? = null
        var backendFailureKind = ProbeFailureKind.None

        repeat(PROBE_ATTEMPTS) { attempt ->
            val backend = probeUrl(
                network = network,
                url = buildBackendPingUrl(),
                successCodes = 200..299
            )
            backendReachable = backend.isSuccess
            backendFailureKind = if (backend.isSuccess) ProbeFailureKind.None else backend.failureKind
            if (backendReachable) {
                return ProbeResult(
                    backendReachable = true,
                    publicInternetReachable = true,
                    lastError = null,
                    backendFailureKind = ProbeFailureKind.None
                )
            }

            val publicProbe = probeUrl(
                network = network,
                url = PUBLIC_PROBE_URL,
                successCodes = 200..299
            )
            publicInternetReachable = publicProbe.isSuccess
            lastError = backend.error ?: publicProbe.error

            if (attempt < PROBE_ATTEMPTS - 1) {
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
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> TransportKind.Cellular
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> TransportKind.Wifi
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> TransportKind.Ethernet
            else -> TransportKind.Other
        }
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
        Cellular("Мобильная сеть"),
        Wifi("Wi-Fi"),
        Ethernet("Ethernet"),
        Other("Другая сеть")
    }

    private companion object {
        private const val TAG = "NetworkStateTracker"
        private const val PROBE_TIMEOUT_MS = 2_500
        private const val PROBE_ATTEMPTS = 3
        private const val PROBE_DEBOUNCE_MS = 1_500L
        private const val PROBE_RETRY_DELAY_MS = 1_500L
        private const val PUBLIC_PROBE_URL = "https://cp.cloudflare.com/generate_204"
    }
}
