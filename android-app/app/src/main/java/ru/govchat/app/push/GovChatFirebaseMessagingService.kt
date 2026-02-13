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
import ru.govchat.app.core.notification.NotificationIntents

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
        if (payload.isEmpty()) return

        val eventType = payload.read("eventType", "event_type")
        val title = payload.read("title")
        val body = payload.read("body", "text", "message")

        when (eventType) {
            "incoming_call", "incoming_group_call" -> {
                val callId = payload.read("callId", "call_id").ifBlank {
                    "call-${System.currentTimeMillis()}"
                }
                val chatId = payload.read("chatId", "chat_id")
                val chatName = payload.read("chatName", "chat_name")
                val initiatorName = payload.read("initiatorName", "initiator_name", "senderName", "sender_name")
                    .ifBlank { body }
                    .ifBlank { getString(R.string.push_call_body) }
                val initiatorId = payload.read("initiatorId", "initiator_id", "senderId", "sender_id")
                val callType = payload.read("type", "callType", "call_type").ifBlank { "audio" }
                val isGroup = eventType == "incoming_group_call" || payload.readBoolean("isGroup", "is_group")

                IncomingCallNotifications.show(
                    context = this,
                    callId = callId,
                    chatId = chatId,
                    chatName = chatName.ifBlank { title.ifBlank { "GovChat" } },
                    initiatorName = initiatorName,
                    isGroup = isGroup,
                    callType = callType,
                    initiatorId = initiatorId
                )
            }

            else -> {
                val chatId = payload.read("chatId", "chat_id")
                val chatName = payload.read("chatName", "chat_name")
                val messageId = payload.read("messageId", "message_id")
                showMessageNotification(
                    chatId = chatId,
                    chatName = chatName,
                    messageId = messageId,
                    title = title.ifBlank { getString(R.string.push_message_title) },
                    body = body.ifBlank { getString(R.string.push_message_body) }
                )
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun showMessageNotification(
        chatId: String,
        chatName: String,
        messageId: String,
        title: String,
        body: String
    ) {
        val openIntent = PendingIntent.getActivity(
            this,
            (chatId + "|" + messageId).hashCode(),
            NotificationIntents.addCommandExtras(
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                action = NotificationIntents.ACTION_OPEN_CHAT,
                chatId = chatId.ifBlank { null },
                chatName = chatName.ifBlank { null }
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, NotificationChannels.MESSAGES_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(openIntent)
            .build()

        val manager = NotificationManagerCompat.from(this)
        if (!manager.areNotificationsEnabled()) return

        val stableId = (chatId.ifBlank { messageId.ifBlank { NotificationIntents.newEventId() } }).hashCode()
        manager.notify(MESSAGE_NOTIFICATION_BASE_ID + stableId, notification)
    }

    private fun Map<String, String>.read(vararg keys: String): String {
        keys.forEach { key ->
            val value = this[key]
            if (!value.isNullOrBlank()) return value
        }
        return ""
    }

    private fun Map<String, String>.readBoolean(vararg keys: String): Boolean {
        val raw = read(*keys).lowercase()
        return raw == "true" || raw == "1"
    }

    private companion object {
        const val MESSAGE_NOTIFICATION_BASE_ID = 20_000
    }
}
