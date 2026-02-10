package ru.govchat.app.domain.model

sealed interface RealtimeEvent {
    data object SocketConnected : RealtimeEvent
    data object SocketDisconnected : RealtimeEvent
    data class UserStatusChanged(val userId: String, val status: String) : RealtimeEvent
    data class MessageCreated(val chatId: String) : RealtimeEvent
    data class IncomingCall(
        val callId: String,
        val chatId: String,
        val type: String,
        val initiatorName: String
    ) : RealtimeEvent
}

