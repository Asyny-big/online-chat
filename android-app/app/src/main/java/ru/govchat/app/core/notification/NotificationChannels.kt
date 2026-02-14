package ru.govchat.app.core.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.content.Context
import android.content.Intent
import android.os.Build
import ru.govchat.app.R
import java.util.UUID

object NotificationChannels {
    const val CALLS_CHANNEL_ID = "govchat_calls_active"
    const val INCOMING_CALLS_CHANNEL_ID = "govchat_calls_incoming_v3"
    const val MESSAGES_CHANNEL_ID = "govchat_messages"

    fun ensureCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(NotificationManager::class.java)

        val activeCallsChannel = NotificationChannel(
            CALLS_CHANNEL_ID,
            context.getString(R.string.notifications_channel_calls),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.notifications_channel_calls_desc)
            setShowBadge(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            enableVibration(false)
            setSound(null, null)
        }

        val incomingCallsChannel = NotificationChannel(
            INCOMING_CALLS_CHANNEL_ID,
            context.getString(R.string.notifications_channel_incoming_calls),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.notifications_channel_incoming_calls_desc)
            setShowBadge(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0L, 1000L, 700L, 1000L)
            val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            setSound(ringtoneUri, audioAttributes)
        }

        val messagesChannel = NotificationChannel(
            MESSAGES_CHANNEL_ID,
            context.getString(R.string.notifications_channel_messages),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.notifications_channel_messages_desc)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
        }

        manager.createNotificationChannel(activeCallsChannel)
        manager.createNotificationChannel(incomingCallsChannel)
        manager.createNotificationChannel(messagesChannel)
    }
}

data class NotificationCommand(
    val eventId: String,
    val action: String,
    val chatId: String?,
    val chatName: String?,
    val callId: String?,
    val callType: String?,
    val isGroupCall: Boolean,
    val initiatorId: String?,
    val initiatorName: String?
)

object NotificationIntents {
    const val ACTION_OPEN_CHAT = "open_chat"
    const val ACTION_OPEN_CALL = "open_call"
    const val ACTION_ACCEPT_CALL = "accept_call"
    const val ACTION_DECLINE_CALL = "decline_call"

    const val EXTRA_EVENT_ID = "extra_notification_event_id"
    const val EXTRA_ACTION = "extra_notification_action"
    const val EXTRA_CHAT_ID = "extra_notification_chat_id"
    const val EXTRA_CHAT_NAME = "extra_notification_chat_name"
    const val EXTRA_CALL_ID = "extra_notification_call_id"
    const val EXTRA_CALL_TYPE = "extra_notification_call_type"
    const val EXTRA_IS_GROUP_CALL = "extra_notification_is_group_call"
    const val EXTRA_INITIATOR_ID = "extra_notification_initiator_id"
    const val EXTRA_INITIATOR_NAME = "extra_notification_initiator_name"

    fun addCommandExtras(
        intent: Intent,
        action: String,
        chatId: String? = null,
        chatName: String? = null,
        callId: String? = null,
        callType: String? = null,
        isGroupCall: Boolean = false,
        initiatorId: String? = null,
        initiatorName: String? = null,
        eventId: String = newEventId()
    ): Intent {
        intent.putExtra(EXTRA_EVENT_ID, eventId)
        intent.putExtra(EXTRA_ACTION, action)
        intent.putExtra(EXTRA_CHAT_ID, chatId)
        intent.putExtra(EXTRA_CHAT_NAME, chatName)
        intent.putExtra(EXTRA_CALL_ID, callId)
        intent.putExtra(EXTRA_CALL_TYPE, callType)
        intent.putExtra(EXTRA_IS_GROUP_CALL, isGroupCall)
        intent.putExtra(EXTRA_INITIATOR_ID, initiatorId)
        intent.putExtra(EXTRA_INITIATOR_NAME, initiatorName)
        return intent
    }

    fun toCommand(intent: Intent?): NotificationCommand? {
        if (intent == null) return null
        val explicitAction = intent.getStringExtra(EXTRA_ACTION).orEmpty()
        val fallbackEventType = readExtra(intent, "eventType", "event_type")
        val hasPushData = fallbackEventType.isNotBlank() ||
            readExtra(intent, "chatId", "chat_id", "callId", "call_id", "messageId", "message_id", "google.message_id")
                .isNotBlank()
        if (explicitAction.isBlank() && !hasPushData) return null
        val action = explicitAction.ifBlank {
            when (fallbackEventType) {
                "incoming_call", "incoming_group_call", "INCOMING_CALL" -> ACTION_OPEN_CALL
                else -> ACTION_OPEN_CHAT
            }
        }

        val rawGroup = readExtra(intent, "isGroup", "is_group").lowercase()

        return NotificationCommand(
            eventId = readExtra(intent, EXTRA_EVENT_ID, "google.message_id", "messageId", "message_id")
                .ifBlank { newEventId() },
            action = action,
            chatId = readExtra(intent, EXTRA_CHAT_ID, "chatId", "chat_id").ifBlank { null },
            chatName = readExtra(intent, EXTRA_CHAT_NAME, "chatName", "chat_name").ifBlank { null },
            callId = readExtra(intent, EXTRA_CALL_ID, "callId", "call_id").ifBlank { null },
            callType = readExtra(intent, EXTRA_CALL_TYPE, "type", "callType", "call_type").ifBlank { null },
            isGroupCall = intent.getBooleanExtra(EXTRA_IS_GROUP_CALL, false) ||
                fallbackEventType == "incoming_group_call" ||
                fallbackEventType == "INCOMING_CALL" &&
                (readExtra(intent, "isGroupCall", "is_group_call", "isGroup", "is_group").lowercase() in setOf("true", "1")) ||
                rawGroup == "true" || rawGroup == "1",
            initiatorId = readExtra(intent, EXTRA_INITIATOR_ID, "initiatorId", "initiator_id").ifBlank { null },
            initiatorName = readExtra(
                intent,
                EXTRA_INITIATOR_NAME,
                "initiatorName",
                "initiator_name",
                "senderName",
                "sender_name"
            ).ifBlank { null }
        )
    }

    fun newEventId(): String = UUID.randomUUID().toString()

    private fun readExtra(intent: Intent, vararg keys: String): String {
        keys.forEach { key ->
            val value = intent.getStringExtra(key)
            if (!value.isNullOrBlank()) return value
        }
        return ""
    }
}

