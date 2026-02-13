package ru.govchat.app.service.call

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import ru.govchat.app.MainActivity
import ru.govchat.app.R
import ru.govchat.app.core.notification.NotificationChannels

class CallForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startCallForeground(intent)
            ACTION_STOP -> stopCallForeground()
        }
        return START_NOT_STICKY
    }

    private fun startCallForeground(intent: Intent) {
        val remoteName = intent.getStringExtra(EXTRA_REMOTE_NAME).orEmpty().ifBlank { "Contact" }
        val callType = intent.getStringExtra(EXTRA_CALL_TYPE).orEmpty().ifBlank { "audio" }
        val isScreenShareActive = intent.getBooleanExtra(EXTRA_SCREEN_SHARE_ACTIVE, false)
        val typeLabel = when {
            callType == "video" && isScreenShareActive -> "Video call - Screen share"
            callType == "video" -> "Video call"
            else -> "Audio call"
        }
        val notification = buildNotification(
            title = getString(R.string.call_service_notification_title),
            text = "$typeLabel with $remoteName"
        )

        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                var foregroundType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                val hasCameraPermission = ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED
                if (callType == "video" && hasCameraPermission) {
                    foregroundType = foregroundType or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                }
                if (isScreenShareActive) {
                    foregroundType = foregroundType or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                }
                startForeground(NOTIFICATION_ID, notification, foregroundType)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }.onFailure { error ->
            Log.e(TAG, "Failed to start call foreground service", error)
            stopSelf()
        }
    }

    private fun stopCallForeground() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun buildNotification(title: String, text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            REQUEST_CODE_OPEN_APP,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, NotificationChannels.CALLS_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setContentIntent(openIntent)
            .build()
    }

    companion object {
        private const val REQUEST_CODE_OPEN_APP = 10
        private const val NOTIFICATION_ID = 1001
        private const val TAG = "CallForegroundService"

        const val ACTION_START = "ru.govchat.app.call.START"
        const val ACTION_STOP = "ru.govchat.app.call.STOP"
        const val EXTRA_REMOTE_NAME = "extra_remote_name"
        const val EXTRA_CALL_TYPE = "extra_call_type"
        const val EXTRA_SCREEN_SHARE_ACTIVE = "extra_screen_share_active"

        fun start(
            context: Context,
            remoteName: String,
            callType: String,
            isScreenShareActive: Boolean = false
        ) {
            val intent = Intent(context, CallForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_REMOTE_NAME, remoteName)
                putExtra(EXTRA_CALL_TYPE, callType)
                putExtra(EXTRA_SCREEN_SHARE_ACTIVE, isScreenShareActive)
            }
            runCatching {
                ContextCompat.startForegroundService(context, intent)
            }.onFailure { error ->
                Log.e(TAG, "Unable to request call foreground service start", error)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, CallForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            runCatching {
                context.startService(intent)
            }.onFailure { error ->
                Log.e(TAG, "Unable to request call foreground service stop", error)
            }
        }
    }
}
