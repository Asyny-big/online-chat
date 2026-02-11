package ru.govchat.app.domain.repository

import kotlinx.coroutines.flow.Flow
import ru.govchat.app.domain.model.CallJoinParticipant
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.RealtimeEvent
import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.model.WebRtcConfig

interface ChatRepository {
    suspend fun loadDialogs(): Result<List<ChatPreview>>
    suspend fun loadMessages(chatId: String): Result<List<ChatMessage>>
    suspend fun sendTextMessage(chatId: String, text: String): Result<ChatMessage>
    suspend fun startCall(chatId: String, type: String): Result<String>
    suspend fun acceptCall(callId: String): Result<Unit>
    suspend fun declineCall(callId: String): Result<Unit>
    suspend fun leaveCall(callId: String): Result<Unit>
    suspend fun startGroupCall(chatId: String, type: String): Result<String>
    suspend fun joinGroupCall(chatId: String, callId: String): Result<List<CallJoinParticipant>>
    suspend fun leaveGroupCall(callId: String): Result<Unit>
    suspend fun loadWebRtcConfig(): Result<WebRtcConfig>
    fun sendCallSignal(callId: String, targetUserId: String, signal: CallSignalPayload)
    suspend fun sendAttachmentMessage(
        chatId: String,
        attachmentUri: String,
        onProgress: (Int) -> Unit
    ): Result<ChatMessage>
    suspend fun markMessagesRead(chatId: String, messageIds: List<String>)
    suspend fun getCurrentUser(): Result<UserProfile>
    suspend fun searchUserByPhone(phone: String): Result<UserProfile?>
    suspend fun createChat(userId: String): Result<ChatPreview>
    fun startTyping(chatId: String)
    fun stopTyping(chatId: String)
    suspend fun joinChat(chatId: String)
    suspend fun connectRealtime()
    suspend fun disconnectRealtime()
    fun observeRealtimeEvents(): Flow<RealtimeEvent>
}

