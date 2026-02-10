package ru.govchat.app.push

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
                title = title.ifBlank { getString(R.string.push_call_title) },
                body = body.ifBlank { getString(R.string.push_call_body) }
            )

            else -> showNotification(
                notificationId = 2002,
                title = title.ifBlank { getString(R.string.push_message_title) },
                body = body.ifBlank { getString(R.string.push_message_body) }
            )
        }
    }

    private fun showNotification(notificationId: Int, title: String, body: String) {
        val openAppIntent = PendingIntent.getActivity(
            this,
            notificationId,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, NotificationChannels.MESSAGES_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openAppIntent)
            .build()

        NotificationManagerCompat.from(this).notify(notificationId, notification)
    }
}

