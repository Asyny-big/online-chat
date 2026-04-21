package ru.govchat.app.tunnel.core

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.io.IOException

class InvisibleVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val singBoxRunner = SingBoxRunner.getInstance()

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
        return START_STICKY
    }

    private fun startTunnel() {
        if (vpnInterface != null) return
        startForeground(NOTIFICATION_ID, createNotification())

        try {
            val builder = Builder()
                .setSession("App Secure Tunnel")
                .setMtu(9000)
                .addAddress("172.19.0.1", 30)
                .addAddress("fdfe:dcba:9876::1", 126)
                .addDnsServer("1.1.1.1")
                .addDnsServer("8.8.8.8")
                .addRoute("0.0.0.0", 0)
                .addRoute("::", 0)
                .addAllowedApplication(applicationContext.packageName)
                .setBlocking(true)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.allowBypass()
            }

            vpnInterface = builder.establish()

            vpnInterface?.let { fd ->
                val configJson = ConfigBuilder.buildConfig(applicationContext)
                singBoxRunner.start(fd.fd, configJson)
            } ?: run {
                Log.e(TAG, "Failed to create VPN interface")
                stopSelf()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error starting VPN", e)
            stopTunnel()
        }
    }

    private fun stopTunnel() {
        serviceScope.cancel()
        singBoxRunner.stop()
        try {
            vpnInterface?.close()
        } catch (e: IOException) {
            Log.e(TAG, "Error closing interface", e)
        }
        vpnInterface = null
        stopForeground(true)
        stopSelf()
    }

    private fun createNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Защищенное соединение",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Оптимизация соединения")
            .setContentText("Приложение настраивает защищенный маршрут...")
            // Replace with your actual app icon if needed, e.g. R.mipmap.ic_launcher
            .setSmallIcon(android.R.drawable.ic_secure)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopTunnel()
    }

    override fun onRevoke() {
        super.onRevoke()
        stopTunnel()
    }
}
