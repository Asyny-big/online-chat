package ru.govchat.app.domain.repository

import kotlinx.coroutines.flow.Flow
import ru.govchat.app.domain.model.CallJoinParticipant
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.GroupCallStartResult
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
    suspend fun startGroupCall(chatId: String, type: String): Result<GroupCallStartResult>
    suspend fun joinGroupCall(chatId: String, callId: String): Result<List<CallJoinParticipant>>
    suspend fun leaveGroupCall(callId: String): Result<Unit>
    suspend fun loadWebRtcConfig(): Result<WebRtcConfig>
    suspend fun loadLiveKitToken(room: String, identity: String): Result<String>
    fun sendCallSignal(callId: String, targetUserId: String, signal: CallSignalPayload)
    fun sendGroupCallSignal(callId: String, targetUserId: String, signal: CallSignalPayload)
    suspend fun sendAttachmentMessage(
        chatId: String,
        attachmentUri: String,
        onProgress: (Int) -> Unit
    ): Result<ChatMessage>
    suspend fun markMessagesRead(chatId: String, messageIds: List<String>)
    suspend fun getCurrentUser(): Result<UserProfile>
    suspend fun searchUserByPhone(phone: String): Result<UserProfile?>
    suspend fun createChat(userId: String): Result<ChatPreview>
    suspend fun createGroupChat(name: String, participantIds: List<String>): Result<ChatPreview>
    suspend fun getChatParticipants(chatId: String): Result<List<UserProfile>>
    fun startTyping(chatId: String)
    fun stopTyping(chatId: String)
    suspend fun joinChat(chatId: String)
    suspend fun connectRealtime()
    suspend fun disconnectRealtime()
    fun observeRealtimeEvents(): Flow<RealtimeEvent>
}
