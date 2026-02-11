package ru.govchat.app.domain.model

sealed interface RealtimeEvent {
    data object SocketConnected : RealtimeEvent
    data object SocketDisconnected : RealtimeEvent
    data class UserStatusChanged(val userId: String, val status: String) : RealtimeEvent
    data class MessageCreated(val chatId: String, val message: ChatMessage) : RealtimeEvent
    data class MessagesRead(
        val chatId: String,
        val userId: String,
        val messageIds: List<String>
    ) : RealtimeEvent
    data class TypingUpdated(
        val chatId: String,
        val userId: String,
        val userName: String,
        val isTyping: Boolean
    ) : RealtimeEvent
    data class ChatCreated(val chat: ChatPreview) : RealtimeEvent
    data class ChatDeleted(val chatId: String) : RealtimeEvent
    data class MessageDeleted(val chatId: String, val messageId: String) : RealtimeEvent
    data class IncomingCall(
        val callId: String,
        val chatId: String,
        val chatName: String,
        val type: String,
        val initiatorId: String,
        val initiatorName: String,
        val initiatorAvatarUrl: String?,
        val isGroup: Boolean,
        val participantCount: Int = 0
    ) : RealtimeEvent
    data class CallParticipantJoined(
        val callId: String,
        val userId: String,
        val userName: String
    ) : RealtimeEvent
    data class CallParticipantLeft(
        val callId: String,
        val userId: String,
        val callEnded: Boolean
    ) : RealtimeEvent
    data class CallEnded(
        val callId: String,
        val reason: String
    ) : RealtimeEvent
    data class GroupCallStarted(
        val callId: String,
        val chatId: String,
        val type: String,
        val participantCount: Int
    ) : RealtimeEvent
    data class GroupCallUpdated(
        val callId: String,
        val chatId: String,
        val participantCount: Int
    ) : RealtimeEvent
    data class GroupCallEnded(
        val callId: String,
        val chatId: String,
        val reason: String
    ) : RealtimeEvent
    data class CallSignalReceived(
        val callId: String,
        val fromUserId: String,
        val signal: CallSignalPayload
    ) : RealtimeEvent
}

