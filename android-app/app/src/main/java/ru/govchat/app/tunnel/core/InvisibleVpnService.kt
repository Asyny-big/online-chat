package ru.govchat.app.tunnel.core

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.ParcelFileDescriptor
import android.os.Process
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import libbox.InterfaceUpdateListener
import libbox.NetworkInterface
import libbox.NetworkInterfaceIterator
import libbox.PlatformInterface
import libbox.TunOptions
import libbox.WIFIState
import ru.govchat.app.tunnel.TunnelManager
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger

class InvisibleVpnService : VpnService(), PlatformInterface {

    private var vpnInterface: ParcelFileDescriptor? = null
    private val singBoxRunner = SingBoxRunner.getInstance()
    private var stopRequested = false
    private var startRequested = false
    private var foregroundStarted = false
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var startJob: Job? = null
    private val protectedSocketLogCount = AtomicInteger(0)
    private var underlyingNetworkCallback: ConnectivityManager.NetworkCallback? = null
    // Tags of VLESS proxies whose URLTest probe result has already been reported
    // to TunnelManager. Prevents double-counting when sing-box prints the same
    // "unavailable" line multiple times across re-tests.
    private val countedProbeTags = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

    companion object {
        const val ACTION_START = "ru.govchat.app.START_VPN"
        const val ACTION_STOP = "ru.govchat.app.STOP_VPN"
        private const val NOTIFICATION_ID = 10101
        private const val CHANNEL_ID = "tunnel_channel"
        private const val TAG = "InvisibleVpnService"
        private const val TUN_MTU = 1280
        private const val TUN_IPV4_ADDRESS = "172.19.0.1"
        private const val TUN_IPV4_PREFIX = 30
        private const val TUN_IPV6_ADDRESS = "fdfe:dcba:9876::1"
        private const val TUN_IPV6_PREFIX = 126
        private const val TUN_DNS_SERVER = "172.19.0.2"
        private const val PROTECTED_SOCKET_LOG_LIMIT = 8
        private val ANSI_ESCAPE_REGEX = Regex("\u001B\\[[;\\d]*m")
        // Patterns for parsing sing-box URLTest log output. Examples:
        //   outbound/urltest[proxy]: outbound proxy-7 unavailable: dial tcp ...
        //   ERROR[0001] [2055237127 26ms] outbound/urltest[proxy]: dial tcp ...
        //   outbound/urltest[proxy]: selected proxy-3
        private val URL_TEST_UNAVAILABLE_REGEX =
            Regex("outbound/urltest\\[[^\\]]+]:\\s+outbound\\s+(proxy-\\d+)\\s+unavailable")
        private val URL_TEST_ALIVE_REGEX =
            Regex("outbound/urltest\\[[^\\]]+]:\\s+outbound\\s+(proxy-\\d+)\\s+available")
        private val URL_TEST_SELECTED_REGEX =
            Regex("outbound/urltest\\[[^\\]]+]:\\s+selected\\s+(proxy-\\d+)")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            when (intent?.action) {
                ACTION_START -> startTunnel()
                ACTION_STOP -> stopTunnel()
            }
        } catch (error: Throwable) {
            Log.e(TAG, "Unhandled VPN service command failure", error)
            TunnelManager.getInstance(applicationContext).reportTunnelFailure(
                "Критическая ошибка VPN-сервиса: ${error.message ?: error.javaClass.simpleName}"
            )
            runCatching { stopTunnel() }
                .onFailure { cleanupError -> Log.e(TAG, "Failed to clean up after command failure", cleanupError) }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        val binder = super.onBind(intent)
        return binder
    }

    private fun startTunnel() {
        if (startRequested || singBoxRunner.isRunning()) {
            Log.w(TAG, "VPN tunnel is already running")
            TunnelManager.getInstance(applicationContext).reportTunnelEvent("VPN уже активен, повторный запуск пропущен")
            return
        }

        // Reset URLTest progress tracking so the next sing-box run starts with
        // a clean counter and is not influenced by stale tag dedup state.
        countedProbeTags.clear()
        protectedSocketLogCount.set(0)

        startRequested = true
        stopRequested = false
        val tunnelManager = TunnelManager.getInstance(applicationContext)
        try {
            startTunnelForeground()
        } catch (error: Throwable) {
            handleTunnelStartFailure(tunnelManager, error)
            return
        }

        startJob?.cancel()
        startJob = serviceScope.launch {
            try {
                tunnelManager.reportTunnelEvent("Сервис VPN запущен, собираю конфиг sing-box…")

                val configResult = try {
                    withContext(Dispatchers.Default) {
                        ConfigBuilder.buildConfigResult(applicationContext)
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    tunnelManager.reportTunnelFailure(
                        "Не удалось собрать конфиг sing-box: ${error.message ?: error.javaClass.simpleName}"
                    )
                    throw error
                }
                tunnelManager.reportTunnelEvent(configResult.userSummary())
                if (configResult.warnings.isNotEmpty()) {
                    tunnelManager.reportTunnelEvent(
                        "Предупреждения парсера: ${configResult.warnings.take(2).joinToString(" | ")}"
                    )
                }

                tunnelManager.reportTunnelEvent("Запускаю sing-box (валидация конфига и handshake)…")
                withContext(Dispatchers.IO) {
                    singBoxRunner.validateConfig(applicationContext, configResult.configJson)
                }
                tunnelManager.reportTunnelEvent("Конфиг sing-box валиден, запускаю VPN-движок…")
                tunnelManager.reportTunnelEvent(
                    "Создаю TUN-интерфейс Android и запускаю libbox. Лог: ${singBoxRunner.stderrLogPath()}"
                )
                withContext(Dispatchers.IO) {
                    singBoxRunner.start(
                        applicationContext,
                        configResult.configJson,
                        this@InvisibleVpnService,
                        validateConfig = false
                    )
                }
                tunnelManager.markTunnelRunning(true)
                tunnelManager.reportTunnelEvent(
                    "sing-box запущен, жду первый handshake. Лог: ${singBoxRunner.stderrLogPath()}"
                )
                Log.i(TAG, "VPN tunnel started. stderr=${singBoxRunner.stderrLogPath()}")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                handleTunnelStartFailure(tunnelManager, error)
            }
        }
    }

    private fun handleTunnelStartFailure(tunnelManager: TunnelManager, error: Throwable) {
        val message = buildTunnelStartFailureMessage(error)
        Log.e(TAG, "Error starting VPN tunnel", error)
        tunnelManager.markTunnelStartFinishedWithoutRunning(message)
        runCatching { stopTunnel(cancelStartJob = false) }
            .onFailure { cleanupError -> Log.e(TAG, "Failed to clean up after VPN start failure", cleanupError) }
    }

    private fun buildTunnelStartFailureMessage(error: Throwable): String {
        val reason = error.message ?: error.javaClass.simpleName
        val stderrTail = singBoxRunner.stderrLogTail(maxChars = 1800)
        return if (stderrTail.isNullOrBlank()) {
            "Не удалось запустить VPN: $reason. Лог sing-box: ${singBoxRunner.stderrLogPath() ?: "недоступен"}"
        } else {
            "Не удалось запустить VPN: $reason\nsing-box: $stderrTail"
        }
    }

    private fun startTunnelForeground() {
        val notification = createNotification()
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            foregroundStarted = true
        }.onFailure { error ->
            Log.e(TAG, "Failed to start VPN foreground service", error)
            throw error
        }
    }

    private fun stopTunnel(cancelStartJob: Boolean = true) {
        if (stopRequested) return
        stopRequested = true
        startRequested = false
        val pendingStartJob = startJob
        startJob = null
        if (cancelStartJob) {
            pendingStartJob?.cancel()
        }

        unregisterUnderlyingNetworkCallback()
        runCatching { singBoxRunner.stop() }
            .onFailure { error -> Log.e(TAG, "Error stopping sing-box", error) }
        TunnelManager.getInstance(applicationContext).markTunnelRunning(false)

        runCatching {
            vpnInterface?.close()
        }.onFailure { error ->
            Log.e(TAG, "Error closing VPN interface", error)
        }.also {
            vpnInterface = null
        }

        if (foregroundStarted) {
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
            }.onFailure { error ->
                Log.e(TAG, "Error stopping VPN foreground state", error)
            }
            foregroundStarted = false
        }

        runCatching { stopSelf() }
            .onFailure { error -> Log.e(TAG, "Error stopping VPN service", error) }
        TunnelManager.getInstance(applicationContext).reportTunnelEvent("Сервис VPN остановлен")
        Log.i(TAG, "VPN tunnel stopped")
    }

    private fun createNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Secure tunnel",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Secure tunnel active")
            .setContentText("GovChat is routing app traffic through sing-box")
            .setSmallIcon(android.R.drawable.ic_secure)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onDestroy() {
        runCatching { stopTunnel() }
            .onFailure { error -> Log.e(TAG, "Error while destroying VPN service", error) }
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onRevoke() {
        Log.w(TAG, "VPN permission revoked by the system")
        TunnelManager.getInstance(applicationContext)
            .reportTunnelFailure("Android отозвал разрешение на VPN")
        stopTunnel()
        super.onRevoke()
    }

    override fun autoDetectInterfaceControl(fd: Int) {
        if (protect(fd)) {
            val logIndex = protectedSocketLogCount.getAndIncrement()
            if (logIndex < PROTECTED_SOCKET_LOG_LIMIT) {
                Log.d(TAG, "Protected sing-box outbound fd=$fd")
            }
        } else {
            Log.w(TAG, "protect(fd=$fd) returned false")
        }
    }

    override fun clearDNSCache() {
        // Best-effort hint: when sing-box flushes DNS state we also drop any cached
        // entries the JVM may hold so subsequent OkHttp/Java networking requests
        // re-resolve hostnames through the freshly recovered tunnel.
        runCatching { java.net.InetAddress.getByName("localhost") }
        Log.d(TAG, "clearDNSCache hook triggered")
    }

    override fun closeDefaultInterfaceMonitor(listener: InterfaceUpdateListener) = Unit

    override fun findConnectionOwner(
        ipProtocol: Int,
        sourceAddress: String,
        sourcePort: Int,
        destinationAddress: String,
        destinationPort: Int
    ): Int {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return Process.INVALID_UID
        }

        val connectivityManager =
            getSystemService(ConnectivityManager::class.java) ?: return Process.INVALID_UID

        return runCatching {
            connectivityManager.getConnectionOwnerUid(
                ipProtocol,
                java.net.InetSocketAddress(sourceAddress, sourcePort),
                java.net.InetSocketAddress(destinationAddress, destinationPort)
            )
        }.getOrElse { error ->
            Log.w(TAG, "Unable to resolve connection owner", error)
            Process.INVALID_UID
        }
    }

    override fun getInterfaces(): NetworkInterfaceIterator {
        return EmptyNetworkInterfaceIterator
    }

    override fun openTun(options: TunOptions): Int {
        Log.i(TAG, "openTun callback received, dispatching worker")
        val latch = CountDownLatch(1)
        var fd: Int? = null
        var failure: Throwable? = null

        Thread({
            try {
                fd = openTunOnWorker()
            } catch (error: Throwable) {
                failure = error
            } finally {
                latch.countDown()
            }
        }, "GovChatOpenTun").start()

        try {
            latch.await()
        } catch (error: InterruptedException) {
            Thread.currentThread().interrupt()
            throw error
        }

        failure?.let { throw it }
        return fd ?: error("android: VPN interface fd is unavailable")
    }

    private fun openTunOnWorker(): Int {
        Log.i(TAG, "openTun worker started")
        if (prepare(this) != null) {
            error("android: missing vpn permission")
        }

        try {
            val builder = Builder()
                .setSession("GovChat Secure Tunnel")
                .setMtu(TUN_MTU)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setMetered(false)
            }

            builder.addAddress(TUN_IPV4_ADDRESS, TUN_IPV4_PREFIX)
            builder.addAddress(TUN_IPV6_ADDRESS, TUN_IPV6_PREFIX)
            builder.addDnsServer(TUN_DNS_SERVER)
            builder.addRoute("0.0.0.0", 0)
            builder.addRoute("::", 0)

            try {
                builder.addAllowedApplication(packageName)
            } catch (error: PackageManager.NameNotFoundException) {
                Log.e(TAG, "Failed to configure split tunneling for package $packageName", error)
            }

            runCatching { vpnInterface?.close() }
                .onFailure { error -> Log.w(TAG, "Failed to close previous VPN interface", error) }

            vpnInterface = builder.establish()
                ?: error("android: failed to establish VPN interface")

            val fd = vpnInterface?.fd ?: error("android: VPN interface fd is unavailable")
            Log.i(
                TAG,
                "openTun established. fd=$fd, mtu=$TUN_MTU, dns=$TUN_DNS_SERVER"
            )
            // Inform Android about the underlying physical network so capability
            // propagation, metering, and connectivity callbacks behave correctly
            // for our VPN. Without this, the VPN network may not advertise
            // NET_CAPABILITY_INTERNET and apps that observe ConnectivityManager
            // may believe the device has no internet.
            registerUnderlyingNetworkCallback()
            return fd
        } catch (error: Throwable) {
            Log.e(TAG, "openTun failed", error)
            TunnelManager.getInstance(applicationContext).reportTunnelFailure(
                "Не удалось открыть TUN-интерфейс: ${error.message ?: error.javaClass.simpleName}"
            )
            throw error
        }
    }

    override fun packageNameByUid(uid: Int): String {
        return packageManager.getPackagesForUid(uid)?.firstOrNull().orEmpty()
    }

    @SuppressLint("MissingPermission")
    override fun readWIFIState(): WIFIState? {
        val wifiManager = applicationContext.getSystemService(WIFI_SERVICE) as? WifiManager ?: return null
        @Suppress("DEPRECATION")
        val wifiInfo = wifiManager.connectionInfo ?: return null
        var ssid = wifiInfo.ssid ?: return null
        if (ssid == "<unknown ssid>") {
            ssid = ""
        } else if (ssid.startsWith("\"") && ssid.endsWith("\"")) {
            ssid = ssid.substring(1, ssid.length - 1)
        }
        return WIFIState(ssid, wifiInfo.bssid.orEmpty())
    }

    override fun startDefaultInterfaceMonitor(listener: InterfaceUpdateListener) = Unit

    override fun uidByPackageName(packageName: String): Int {
        return runCatching {
            packageManager.getApplicationInfo(packageName, 0).uid
        }.getOrElse { error ->
            Log.w(TAG, "uidByPackageName failed for $packageName", error)
            Process.INVALID_UID
        }
    }

    override fun underNetworkExtension(): Boolean = false

    override fun usePlatformAutoDetectInterfaceControl(): Boolean = true

    override fun usePlatformDefaultInterfaceMonitor(): Boolean = false

    override fun usePlatformInterfaceGetter(): Boolean = false

    override fun useProcFS(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q

    override fun writeLog(message: String) {
        val cleanMessage = ANSI_ESCAPE_REGEX.replace(message, "")
        Log.i("sing-box", cleanMessage)
        // Detect URLTest probe results so the UI can render warmup progress
        // ("проверено N из M, живых K"). sing-box does not expose a structured
        // callback for this in the version we bundle, so we parse log lines.
        captureUrlTestProgress(cleanMessage)
        if (isTransientUrlTestFailure(cleanMessage)) {
            return
        }
        if (isReportableSingBoxFailure(cleanMessage)) {
            TunnelManager.getInstance(applicationContext).reportTunnelFailure(cleanMessage)
        }
    }

    private fun captureUrlTestProgress(message: String) {
        val unavailableMatch = URL_TEST_UNAVAILABLE_REGEX.find(message)
        if (unavailableMatch != null) {
            val tag = unavailableMatch.groupValues[1].trim()
            if (tag.isNotEmpty() && countedProbeTags.add(tag)) {
                TunnelManager.getInstance(applicationContext).reportProxyProbeResult(tag, alive = false)
            }
            return
        }
        val aliveMatch = URL_TEST_ALIVE_REGEX.find(message)
        if (aliveMatch != null) {
            val tag = aliveMatch.groupValues[1].trim()
            if (tag.isNotEmpty() && countedProbeTags.add(tag)) {
                TunnelManager.getInstance(applicationContext).reportProxyProbeResult(tag, alive = true)
            }
            return
        }
        val selectedMatch = URL_TEST_SELECTED_REGEX.find(message)
        if (selectedMatch != null) {
            val tag = selectedMatch.groupValues[1].trim()
            if (tag.isNotEmpty()) {
                if (countedProbeTags.add(tag)) {
                    TunnelManager.getInstance(applicationContext).reportProxyProbeResult(tag, alive = true)
                }
            }
        }
    }

    private fun isReportableSingBoxFailure(message: String): Boolean {
        val trimmedMessage = message.trimStart()
        if (trimmedMessage.startsWith("FATAL[", ignoreCase = true) ||
            trimmedMessage.startsWith("PANIC[", ignoreCase = true)
        ) {
            return true
        }
        if (!trimmedMessage.startsWith("ERROR[", ignoreCase = true)) {
            return false
        }
        if (isRecoverableSingBoxRuntimeFailure(trimmedMessage)) {
            return false
        }
        return !TunnelManager.getInstance(applicationContext).isTunnelActive()
    }

    private fun isRecoverableSingBoxRuntimeFailure(message: String): Boolean {
        return message.contains("dns: exchange failed", ignoreCase = true) ||
            message.contains("outbound/urltest", ignoreCase = true) ||
            message.contains("context deadline exceeded", ignoreCase = true) ||
            message.contains("connection reset by peer", ignoreCase = true) ||
            message.contains("context canceled", ignoreCase = true) ||
            message.contains("i/o timeout", ignoreCase = true)
    }

    private fun isTransientUrlTestFailure(message: String): Boolean {
        return message.contains("outbound/urltest", ignoreCase = true) &&
            (
                message.contains("context deadline exceeded", ignoreCase = true) ||
                    message.contains("i/o timeout", ignoreCase = true) ||
                    message.contains("connection refused", ignoreCase = true) ||
                    message.contains("connection reset by peer", ignoreCase = true) ||
                    message.contains("context canceled", ignoreCase = true)
                )
    }

    private fun registerUnderlyingNetworkCallback() {
        if (underlyingNetworkCallback != null) return
        val connectivityManager = getSystemService(ConnectivityManager::class.java) ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
            .build()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                applyUnderlyingNetwork(network)
            }

            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                applyUnderlyingNetwork(network)
            }

            override fun onLost(network: Network) {
                runCatching { setUnderlyingNetworks(null) }
                    .onFailure { error -> Log.w(TAG, "Failed to clear underlying networks", error) }
            }
        }
        runCatching {
            connectivityManager.registerNetworkCallback(request, callback)
            underlyingNetworkCallback = callback
            // Seed the underlying network immediately if one is already available so we
            // don't rely solely on future callbacks while VPN is being negotiated.
            connectivityManager.activeNetwork?.let { applyUnderlyingNetwork(it) }
        }.onFailure { error ->
            Log.w(TAG, "Failed to register underlying network callback", error)
            underlyingNetworkCallback = null
        }
    }

    private fun unregisterUnderlyingNetworkCallback() {
        val callback = underlyingNetworkCallback ?: return
        underlyingNetworkCallback = null
        val connectivityManager = getSystemService(ConnectivityManager::class.java) ?: return
        runCatching { connectivityManager.unregisterNetworkCallback(callback) }
            .onFailure { error -> Log.w(TAG, "Failed to unregister underlying network callback", error) }
        runCatching { setUnderlyingNetworks(null) }
            .onFailure { error -> Log.w(TAG, "Failed to clear underlying networks on stop", error) }
    }

    private fun applyUnderlyingNetwork(network: Network) {
        runCatching { setUnderlyingNetworks(arrayOf(network)) }
            .onFailure { error -> Log.w(TAG, "Failed to set underlying networks", error) }
    }

    private object EmptyNetworkInterfaceIterator : NetworkInterfaceIterator {
        override fun hasNext(): Boolean = false
        override fun next(): NetworkInterface {
            throw NoSuchElementException("No network interface data exposed")
        }
    }
}
