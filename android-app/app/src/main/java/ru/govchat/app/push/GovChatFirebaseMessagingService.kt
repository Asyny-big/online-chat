package ru.govchat.app.push

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import ru.govchat.app.GovChatApp
import ru.govchat.app.MainActivity
import ru.govchat.app.R
import ru.govchat.app.core.notification.IncomingCallNotifications
import ru.govchat.app.core.notification.NotificationChannels

class GovChatFirebaseMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        val app = application as GovChatApp
        serviceScope.launch {
            app.container.deviceRepository.onNewToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val payload = message.data
        val eventType = payload["eventType"].orEmpty()
        val title = payload["title"].orEmpty()
        val body = payload["body"].orEmpty()

        when (eventType) {
            "incoming_call" -> showNotification(
                notificationId = 2001,
                channelId = NotificationChannels.CALLS_CHANNEL_ID,
                title = title.ifBlank { getString(R.string.push_call_title) },
                body = body.ifBlank { getString(R.string.push_call_body) },
                callStyle = true
            )

            "incoming_group_call" -> showNotification(
                notificationId = 2003,
                channelId = NotificationChannels.CALLS_CHANNEL_ID,
                title = title.ifBlank { getString(R.string.push_group_call_title) },
                body = body.ifBlank { getString(R.string.push_call_body) },
                callStyle = true
            )

            else -> showNotification(
                notificationId = 2002,
                channelId = NotificationChannels.MESSAGES_CHANNEL_ID,
                title = title.ifBlank { getString(R.string.push_message_title) },
                body = body.ifBlank { getString(R.string.push_message_body) },
                callStyle = false
            )
        }
    }

    @SuppressLint("MissingPermission")
    private fun showNotification(
        notificationId: Int,
        channelId: String,
        title: String,
        body: String,
        callStyle: Boolean
    ) {
        val openAppIntent = PendingIntent.getActivity(
            this,
            notificationId,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(IncomingCallNotifications.EXTRA_CALL_ID, notificationId.toString())
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(if (callStyle) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
            .setCategory(if (callStyle) NotificationCompat.CATEGORY_CALL else NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(openAppIntent).apply {
                if (callStyle) {
                    setFullScreenIntent(openAppIntent, true)
                }
            }.build()

        val manager = NotificationManagerCompat.from(this)
        if (!manager.areNotificationsEnabled()) return
        manager.notify(notificationId, notification)
    }
}

