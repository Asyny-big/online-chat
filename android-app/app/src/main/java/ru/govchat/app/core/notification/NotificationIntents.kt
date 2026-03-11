package ru.govchat.app.core.notification

import android.content.Intent
import java.util.UUID

data class NotificationCommand(
    val eventId: String,
    val action: String,
    val chatId: String?,
    val chatName: String?,
    val callId: String?,
    val callType: String?,
    val isGroupCall: Boolean,
    val initiatorId: String?,
    val initiatorName: String?,
    val initiatorAvatarUrl: String?,
    val participantCount: Int
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
    const val EXTRA_INITIATOR_AVATAR_URL = "extra_notification_initiator_avatar_url"
    const val EXTRA_PARTICIPANT_COUNT = "extra_notification_participant_count"

    fun incomingCallCommand(
        callId: String,
        chatId: String,
        chatName: String,
        callType: String,
        isGroupCall: Boolean,
        initiatorId: String,
        initiatorName: String,
        initiatorAvatarUrl: String? = null,
        participantCount: Int = 0,
        action: String = ACTION_OPEN_CALL,
        eventId: String = newEventId()
    ): NotificationCommand {
        return NotificationCommand(
            eventId = eventId,
            action = action,
            chatId = chatId,
            chatName = chatName,
            callId = callId,
            callType = callType,
            isGroupCall = isGroupCall,
            initiatorId = initiatorId,
            initiatorName = initiatorName,
            initiatorAvatarUrl = initiatorAvatarUrl,
            participantCount = participantCount
        )
    }

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
        initiatorAvatarUrl: String? = null,
        participantCount: Int = 0,
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
        intent.putExtra(EXTRA_INITIATOR_AVATAR_URL, initiatorAvatarUrl)
        intent.putExtra(EXTRA_PARTICIPANT_COUNT, participantCount)
        return intent
    }

    fun addCommandExtras(intent: Intent, command: NotificationCommand): Intent {
        return addCommandExtras(
            intent = intent,
            action = command.action,
            chatId = command.chatId,
            chatName = command.chatName,
            callId = command.callId,
            callType = command.callType,
            isGroupCall = command.isGroupCall,
            initiatorId = command.initiatorId,
            initiatorName = command.initiatorName,
            initiatorAvatarUrl = command.initiatorAvatarUrl,
            participantCount = command.participantCount,
            eventId = command.eventId
        )
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
            ).ifBlank { null },
            initiatorAvatarUrl = readExtra(
                intent,
                EXTRA_INITIATOR_AVATAR_URL,
                "initiatorAvatarUrl",
                "initiator_avatar_url",
                "avatarUrl",
                "avatar_url"
            ).ifBlank { null },
            participantCount = intent.getIntExtra(EXTRA_PARTICIPANT_COUNT, 0).takeIf { it > 0 }
                ?: readExtra(intent, "participantCount", "participant_count").toIntOrNull()
                ?: 0
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
