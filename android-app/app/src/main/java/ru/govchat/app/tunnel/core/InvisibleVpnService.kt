package ru.govchat.app.tunnel.core

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.VpnService
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.ParcelFileDescriptor
import android.os.Process
import android.util.Log
import androidx.core.app.NotificationCompat
import io.nekohasekai.libbox.InterfaceUpdateListener
import io.nekohasekai.libbox.NetworkInterfaceIterator
import io.nekohasekai.libbox.Notification as LibboxNotification
import io.nekohasekai.libbox.PlatformInterface
import io.nekohasekai.libbox.RoutePrefix
import io.nekohasekai.libbox.RoutePrefixIterator
import io.nekohasekai.libbox.TunOptions
import io.nekohasekai.libbox.WIFIState
import ru.govchat.app.tunnel.TunnelManager
import java.io.IOException

class InvisibleVpnService : VpnService(), PlatformInterface {

    private var vpnInterface: ParcelFileDescriptor? = null
    private val singBoxRunner = SingBoxRunner.getInstance()
    private var stopRequested = false

    companion object {
        const val ACTION_START = "ru.govchat.app.START_VPN"
        const val ACTION_STOP = "ru.govchat.app.STOP_VPN"
        private const val NOTIFICATION_ID = 10101
        private const val CHANNEL_ID = "tunnel_channel"
        private const val TAG = "InvisibleVpnService"
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startTunnel()
            ACTION_STOP -> stopTunnel()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        val binder = super.onBind(intent)
        return binder
    }

    private fun startTunnel() {
        if (singBoxRunner.isRunning()) {
            Log.w(TAG, "VPN tunnel is already running")
            TunnelManager.getInstance(applicationContext).reportTunnelEvent("VPN уже активен, повторный запуск пропущен")
            return
        }

        stopRequested = false
        try {
            startTunnelForeground()
            TunnelManager.getInstance(applicationContext).reportTunnelEvent("Сервис VPN запущен, собираю конфиг sing-box")
            val configResult = ConfigBuilder.buildConfigResult(applicationContext)
            TunnelManager.getInstance(applicationContext).reportTunnelEvent(configResult.userSummary())
            singBoxRunner.start(applicationContext, configResult.configJson, this)
            TunnelManager.getInstance(applicationContext).markTunnelRunning(true)
            TunnelManager.getInstance(applicationContext)
                .reportTunnelEvent("sing-box запущен, журнал ошибок: ${singBoxRunner.stderrLogPath()}")
            Log.i(TAG, "VPN tunnel started. stderr=${singBoxRunner.stderrLogPath()}")
        } catch (error: Throwable) {
            Log.e(TAG, "Error starting VPN tunnel", error)
            TunnelManager.getInstance(applicationContext).reportTunnelFailure(
                "Не удалось запустить VPN: ${error.message ?: error.javaClass.simpleName}"
            )
            stopTunnel()
        }
    }

    private fun startTunnelForeground() {
        val notification = createNotification()
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }.onFailure { error ->
            Log.e(TAG, "Failed to start VPN foreground service", error)
            throw error
        }
    }

    private fun stopTunnel() {
        if (stopRequested) return
        stopRequested = true

        singBoxRunner.stop()
        TunnelManager.getInstance(applicationContext).markTunnelRunning(false)

        try {
            vpnInterface?.close()
        } catch (error: IOException) {
            Log.e(TAG, "Error closing VPN interface", error)
        } finally {
            vpnInterface = null
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
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
        stopTunnel()
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
        protect(fd)
    }

    override fun clearDNSCache() = Unit

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

    override fun includeAllNetworks(): Boolean = false

    override fun openTun(options: TunOptions): Int {
        if (prepare(this) != null) {
            error("android: missing vpn permission")
        }

        val mtu = options.mtu.coerceIn(1280, 1500)
        val builder = Builder()
            .setSession("GovChat Secure Tunnel")
            .setMtu(mtu)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            builder.setBlocking(true)
            builder.setMetered(false)
            builder.allowBypass()
        }

        val hasInet4 = addAddresses(builder, options.inet4Address)
        val hasInet6 = addAddresses(builder, options.inet6Address)

        if (options.autoRoute) {
            val dnsAddress = runCatching { options.dnsServerAddress.value }.getOrNull()
            if (!dnsAddress.isNullOrBlank()) {
                builder.addDnsServer(dnsAddress)
            }

            addRoutes(builder, options.inet4RouteAddress, "0.0.0.0", hasInet4)
            addRoutes(builder, options.inet6RouteAddress, "::", hasInet6)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                excludeRoutes(builder, options.inet4RouteExcludeAddress)
                excludeRoutes(builder, options.inet6RouteExcludeAddress)
            }
        }

        try {
            builder.addAllowedApplication(packageName)
        } catch (error: PackageManager.NameNotFoundException) {
            Log.e(TAG, "Failed to configure split tunneling for package $packageName", error)
        }

        runCatching { vpnInterface?.close() }
            .onFailure { error -> Log.w(TAG, "Failed to close previous VPN interface", error) }
        vpnInterface = builder.establish()
            ?: error("android: failed to establish VPN interface")

        Log.i(
            TAG,
            "openTun established. fd=${vpnInterface!!.fd}, mtu=$mtu, autoRoute=${options.autoRoute}, strictRoute=${options.strictRoute}"
        )
        return vpnInterface!!.fd
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

    override fun sendNotification(notification: LibboxNotification) {
        Log.i(TAG, "sing-box notification: ${notification.title} ${notification.body}")
        TunnelManager.getInstance(applicationContext).reportTunnelEvent(
            listOf(notification.title, notification.body)
                .filter { it.isNotBlank() }
                .joinToString(" • ")
                .ifBlank { "sing-box отправил системное уведомление" }
        )
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
        Log.i("sing-box", message)
        if (message.contains("error", ignoreCase = true) || message.contains("failed", ignoreCase = true)) {
            TunnelManager.getInstance(applicationContext).reportTunnelFailure(message)
        }
    }

    private fun addAddresses(builder: Builder, iterator: RoutePrefixIterator): Boolean {
        var hasItems = false
        while (iterator.hasNext()) {
            hasItems = true
            val prefix = iterator.next()
            builder.addAddress(prefix.address(), prefix.prefix())
        }
        return hasItems
    }

    private fun addRoutes(
        builder: Builder,
        iterator: RoutePrefixIterator,
        fallbackAddress: String,
        hasAddressFamily: Boolean
    ) {
        if (iterator.hasNext()) {
            while (iterator.hasNext()) {
                val prefix = iterator.next()
                builder.addRoute(prefix.address(), prefix.prefix())
            }
            return
        }

        if (hasAddressFamily) {
            builder.addRoute(fallbackAddress, 0)
        }
    }

    private fun excludeRoutes(builder: Builder, iterator: RoutePrefixIterator) {
        while (iterator.hasNext()) {
            val prefix = iterator.next()
            runCatching {
                builder.excludeRoute(
                    android.net.IpPrefix(
                        java.net.InetAddress.getByName(prefix.address()),
                        prefix.prefix()
                    )
                )
            }.onFailure { error ->
                Log.w(TAG, "Failed to exclude route ${prefix.address()}/${prefix.prefix()}", error)
            }
        }
    }

    private object EmptyNetworkInterfaceIterator : NetworkInterfaceIterator {
        override fun hasNext(): Boolean = false
        override fun next(): io.nekohasekai.libbox.NetworkInterface {
            throw NoSuchElementException("No network interface data exposed")
        }
    }
}
