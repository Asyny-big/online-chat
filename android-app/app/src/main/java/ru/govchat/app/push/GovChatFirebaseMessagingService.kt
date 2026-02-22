package ru.govchat.app.push

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
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

        val eventTypeRaw = payload.read("eventType", "event_type", "type")
        val eventType = eventTypeRaw.lowercase()
        val receiveTimestampMs = System.currentTimeMillis()
        val pushTraceId = payload.read("pushTraceId", "push_trace_id")
        val sentTimestampMs = payload.read("pushSentAt", "push_sent_at").toLongOrNull()
            ?: message.sentTime.takeIf { it > 0L }
        val deliveryDelayMs = sentTimestampMs?.let { receiveTimestampMs - it }

        Log.i(
            TAG,
            "FCM received traceId=${pushTraceId.ifBlank { "n/a" }} eventType=$eventTypeRaw " +
                "priority=${priorityName(message.originalPriority)}/${priorityName(message.priority)} " +
                "sentAtMs=${sentTimestampMs ?: -1} receivedAtMs=$receiveTimestampMs delayMs=${deliveryDelayMs ?: -1} " +
                "messageId=${message.messageId ?: "n/a"}"
        )

        val isIncomingCallEvent = eventType == "incoming_call" ||
            eventType == "incoming_group_call" ||
            eventType == "incoming_call_notification" ||
            eventTypeRaw.equals("INCOMING_CALL", ignoreCase = true)
        val isCallCancellationEvent = eventType == "call_cancelled" ||
            eventType == "call_canceled" ||
            eventType == "call_ended" ||
            eventType == "call_end" ||
            eventType == "cancel_call" ||
            eventType == "call_declined" ||
            eventType == "group_call_ended" ||
            eventTypeRaw.equals("CALL_CANCELLED", ignoreCase = true) ||
            eventTypeRaw.equals("CALL_ENDED", ignoreCase = true)

        if (shouldSkipNotificationForCurrentUser(payload, eventType)) {
            Log.i(TAG, "FCM skipped traceId=${pushTraceId.ifBlank { "n/a" }} reason=self_or_other_recipient")
            return
        }

        val title = payload.read("title")
        val body = payload.read("body", "text", "message")

        when {
            isCallCancellationEvent -> {
                val callId = payload.read("callId", "call_id", "roomId", "room_id")
                if (callId.isNotBlank()) {
                    IncomingCallNotifications.cancel(this, callId)
                    Log.i(TAG, "Incoming call notification cancelled traceId=${pushTraceId.ifBlank { "n/a" }} callId=$callId")
                }
            }

            isIncomingCallEvent -> {
                val callId = payload.read("callId", "call_id", "roomId", "room_id").ifBlank {
                    "call-${System.currentTimeMillis()}"
                }
                val chatId = payload.read("chatId", "chat_id")
                val chatName = payload.read("chatName", "chat_name")
                val initiatorName = payload.read("initiatorName", "initiator_name", "senderName", "sender_name")
                    .ifBlank { body }
                    .ifBlank { getString(R.string.push_call_body) }
                val initiatorId = payload.read("initiatorId", "initiator_id", "senderId", "sender_id")
                val callType = payload.read("callType", "call_type").ifBlank {
                    val rawType = payload.read("type").lowercase()
                    if (rawType == "audio" || rawType == "video") rawType else "audio"
                }
                val isGroup = eventType == "incoming_group_call" ||
                    payload.readBoolean("isGroup", "is_group", "isGroupCall", "is_group_call")

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
                Log.i(TAG, "Incoming call notification shown traceId=${pushTraceId.ifBlank { "n/a" }} callId=$callId")
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
                Log.i(
                    TAG,
                    "Message notification shown traceId=${pushTraceId.ifBlank { "n/a" }} " +
                        "chatId=$chatId messageId=$messageId"
                )
            }
        }
    }

    override fun onDeletedMessages() {
        Log.w(TAG, "FCM deleted pending messages on server (possible long offline or burst traffic)")
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
        if (!manager.areNotificationsEnabled()) {
            Log.w(TAG, "Notifications disabled at system level; message push will not be visible")
            return
        }

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

    private fun shouldSkipNotificationForCurrentUser(
        payload: Map<String, String>,
        eventType: String
    ): Boolean {
        val app = application as? GovChatApp ?: return false
        val currentUserId = runBlocking { app.container.sessionStorage.getUserId().orEmpty() }
        if (currentUserId.isBlank()) return false

        val recipientId = payload.read(
            "recipientId",
            "recipient_id",
            "targetUserId",
            "target_user_id",
            "toUserId",
            "to_user_id",
            "userId",
            "user_id"
        )
        if (recipientId.isNotBlank() && recipientId != currentUserId) {
            return true
        }

        val actorId = when (eventType) {
            "incoming_call", "incoming_group_call", "incoming_call_notification" -> payload.read(
                "initiatorId",
                "initiator_id",
                "senderId",
                "sender_id"
            )
            else -> payload.read(
                "senderId",
                "sender_id",
                "fromUserId",
                "from_user_id"
            )
        }

        return actorId.isNotBlank() && actorId == currentUserId
    }

    private companion object {
        private const val TAG = "GovChatFCM"
        const val MESSAGE_NOTIFICATION_BASE_ID = 20_000
    }

    private fun priorityName(priority: Int): String = when (priority) {
        RemoteMessage.PRIORITY_HIGH -> "HIGH"
        RemoteMessage.PRIORITY_NORMAL -> "NORMAL"
        else -> "UNKNOWN($priority)"
    }
}
