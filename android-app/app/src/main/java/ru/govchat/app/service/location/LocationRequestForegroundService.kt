package ru.govchat.app.service.location

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import ru.govchat.app.GovChatApp
import ru.govchat.app.MainActivity
import ru.govchat.app.R
import ru.govchat.app.core.location.LocationFailure
import ru.govchat.app.core.location.OnDemandLocationClient
import ru.govchat.app.core.notification.NotificationChannels

class LocationRequestForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var locationClient: OnDemandLocationClient

    override fun onCreate() {
        super.onCreate()
        locationClient = OnDemandLocationClient(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != ACTION_HANDLE_REQUEST) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val requestId = intent.getStringExtra(EXTRA_REQUEST_ID).orEmpty()
        val requesterUserId = intent.getStringExtra(EXTRA_REQUESTER_USER_ID).orEmpty()
        val requesterName = intent.getStringExtra(EXTRA_REQUESTER_NAME).orEmpty().ifBlank { "Контакт" }
        val chatId = intent.getStringExtra(EXTRA_CHAT_ID).orEmpty()
        if (requestId.isBlank() || requesterUserId.isBlank()) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        startLocationForeground(requesterName = requesterName, chatId = chatId)
        serviceScope.launch {
            handleRequest(
                startId = startId,
                requestId = requestId,
                requesterUserId = requesterUserId,
                requesterName = requesterName,
                chatId = chatId
            )
        }
        return START_NOT_STICKY
    }

    private suspend fun handleRequest(
        startId: Int,
        requestId: String,
        requesterUserId: String,
        requesterName: String,
        chatId: String
    ) {
        val container = (application as GovChatApp).container
        val chatRepository = container.chatRepository

        try {
            val autoReplyEnabled = container.sessionStorage.getLocationAutoReplyEnabled()
            if (!autoReplyEnabled) {
                showActionNotification(
                    title = "Запрос геолокации",
                    text = "$requesterName запрашивает ваше местоположение. Откройте приложение и подтвердите доступ.",
                    chatId = chatId,
                    openLocationSettings = false
                )
                stopSelf(startId)
                return
            }

            if (!locationClient.hasLocationPermission()) {
                chatRepository.submitLocationFailure(
                    requestId = requestId,
                    code = "LOCATION_PERMISSION_DENIED",
                    error = "Android location permission is missing"
                )
                showActionNotification(
                    title = "Нет доступа к геолокации",
                    text = "Откройте приложение и разрешите доступ к геолокации для автоматической отправки.",
                    chatId = chatId,
                    openLocationSettings = false
                )
                stopSelf(startId)
                return
            }

            if (!locationClient.hasBackgroundLocationPermission()) {
                showActionNotification(
                    title = "Нужен фоновый доступ",
                    text = "Разрешите приложению доступ к геолокации в фоне, чтобы местоположение отправлялось без открытия приложения.",
                    chatId = chatId,
                    openLocationSettings = false
                )
                chatRepository.submitLocationFailure(
                    requestId = requestId,
                    code = "LOCATION_UNAVAILABLE",
                    error = "Background location permission is missing"
                )
                stopSelf(startId)
                return
            }

            if (!locationClient.isLocationEnabled()) {
                chatRepository.submitLocationFailure(
                    requestId = requestId,
                    code = "LOCATION_SERVICES_DISABLED",
                    error = "Device location services are disabled"
                )
                showActionNotification(
                    title = "Включите геолокацию",
                    text = "Без системной геолокации приложение не может отправить ваше местоположение.",
                    chatId = chatId,
                    openLocationSettings = true
                )
                stopSelf(startId)
                return
            }

            locationClient.getCurrentLocation()
                .onSuccess { location ->
                    serviceScope.launch {
                        chatRepository.submitLocationResponse(requestId = requestId, location = location)
                    }
                }
                .onFailure { error ->
                    val failureCode = when ((error as? LocationFailure)?.code) {
                        "DEVICE_LOCATION_PERMISSION_DENIED" -> "LOCATION_PERMISSION_DENIED"
                        "DEVICE_LOCATION_DISABLED" -> "LOCATION_SERVICES_DISABLED"
                        "DEVICE_LOCATION_LOW_ACCURACY" -> "LOCATION_ACCURACY_TOO_LOW"
                        else -> "LOCATION_UNAVAILABLE"
                    }
                    chatRepository.submitLocationFailure(
                        requestId = requestId,
                        code = failureCode,
                        error = error.message
                    )
                    if (failureCode == "LOCATION_SERVICES_DISABLED") {
                        showActionNotification(
                            title = "Включите геолокацию",
                            text = "Приложение не может получить координаты, пока системная геолокация выключена.",
                            chatId = chatId,
                            openLocationSettings = true
                        )
                    }
                }
        } catch (error: Throwable) {
            Log.e(TAG, "Location background request failed requestId=$requestId", error)
        } finally {
            stopSelf(startId)
        }
    }

    private fun startLocationForeground(requesterName: String, chatId: String) {
        val notification = buildNotification(
            title = "Отправка геолокации",
            text = "Отправляем местоположение по запросу $requesterName",
            chatId = chatId,
            openLocationSettings = false
        )
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }.onFailure { error ->
            Log.e(TAG, "Failed to start location foreground service", error)
            stopSelf()
        }
    }

    private fun showActionNotification(
        title: String,
        text: String,
        chatId: String,
        openLocationSettings: Boolean
    ) {
        val manager = androidx.core.app.NotificationManagerCompat.from(this)
        manager.notify(
            ACTION_NOTIFICATION_ID,
            buildNotification(
                title = title,
                text = text,
                chatId = chatId,
                openLocationSettings = openLocationSettings
            ).also {
                stopForeground(STOP_FOREGROUND_REMOVE)
            }
        )
    }

    private fun buildNotification(
        title: String,
        text: String,
        chatId: String,
        openLocationSettings: Boolean
    ): Notification {
        val intent = if (openLocationSettings) {
            Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        } else {
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                if (chatId.isNotBlank()) {
                    putExtra("chatId", chatId)
                    putExtra("eventType", "LOCATION_REQUEST")
                }
            }
        }
        val contentIntent = PendingIntent.getActivity(
            this,
            if (openLocationSettings) REQUEST_CODE_LOCATION_SETTINGS else REQUEST_CODE_OPEN_APP,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, NotificationChannels.LOCATION_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(contentIntent)
            .setOngoing(!openLocationSettings)
            .setAutoCancel(openLocationSettings)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "LocationRequestFGS"
        private const val NOTIFICATION_ID = 1101
        private const val ACTION_NOTIFICATION_ID = 1102
        private const val REQUEST_CODE_OPEN_APP = 301
        private const val REQUEST_CODE_LOCATION_SETTINGS = 302

        private const val ACTION_HANDLE_REQUEST = "ru.govchat.app.location.HANDLE_REQUEST"
        private const val EXTRA_REQUEST_ID = "extra_request_id"
        private const val EXTRA_REQUESTER_USER_ID = "extra_requester_user_id"
        private const val EXTRA_REQUESTER_NAME = "extra_requester_name"
        private const val EXTRA_CHAT_ID = "extra_chat_id"

        fun start(
            context: Context,
            requestId: String,
            requesterUserId: String,
            requesterName: String,
            chatId: String
        ) {
            val intent = Intent(context, LocationRequestForegroundService::class.java).apply {
                action = ACTION_HANDLE_REQUEST
                putExtra(EXTRA_REQUEST_ID, requestId)
                putExtra(EXTRA_REQUESTER_USER_ID, requesterUserId)
                putExtra(EXTRA_REQUESTER_NAME, requesterName)
                putExtra(EXTRA_CHAT_ID, chatId)
            }
            runCatching {
                ContextCompat.startForegroundService(context, intent)
            }.onFailure { error ->
                Log.e(TAG, "Unable to request location foreground service start", error)
            }
        }
    }
}
