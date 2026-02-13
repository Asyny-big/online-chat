package ru.govchat.app.data.repository

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.flow.Flow
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import org.json.JSONObject
import retrofit2.HttpException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import ru.govchat.app.core.network.GovChatApi
import ru.govchat.app.core.network.SocketGateway
import ru.govchat.app.core.network.UriUploadRequestBody
import ru.govchat.app.core.network.CreateGroupChatRequest
import ru.govchat.app.core.storage.SessionStorage
import ru.govchat.app.data.mapper.toDomain
import ru.govchat.app.data.mapper.toParticipantsDomain
import ru.govchat.app.domain.model.CallJoinParticipant
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.GroupCallStartResult
import ru.govchat.app.domain.model.RealtimeEvent
import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.model.WebRtcConfig
import ru.govchat.app.domain.repository.ChatRepository

class ChatRepositoryImpl(
    private val appContext: Context,
    private val api: GovChatApi,
    private val socketGateway: SocketGateway,
    private val sessionStorage: SessionStorage
) : ChatRepository {

    override suspend fun loadDialogs(): Result<List<ChatPreview>> {
        return runAuthorized {
            api.getChats().map { it.toDomain() }
        }
    }

    override suspend fun loadMessages(chatId: String): Result<List<ChatMessage>> {
        return runAuthorized {
            api.getMessages(chatId = chatId).map { it.toDomain(chatIdFallback = chatId) }
        }
    }

    override suspend fun sendTextMessage(chatId: String, text: String): Result<ChatMessage> {
        return runCatching {
            withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                socketGateway.sendTextMessage(chatId = chatId, text = text)
                    .getOrThrow()
            }
        }.recoverCatching { error ->
            throw when (error) {
                is TimeoutCancellationException -> IllegalStateException("Таймаут отправки сообщения")
                else -> error
            }
        }
    }

    override suspend fun startCall(chatId: String, type: String): Result<String> {
        return runCatching {
            withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                socketGateway.startCall(chatId = chatId, type = type).getOrThrow()
            }
        }.recoverCatching { error ->
            throw when (error) {
                is TimeoutCancellationException -> IllegalStateException("Call start timeout")
                else -> error
            }
        }
    }

    override suspend fun acceptCall(callId: String): Result<Unit> {
        return runCatching {
            withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                socketGateway.acceptCall(callId = callId).getOrThrow()
            }
        }.recoverCatching { error ->
            throw when (error) {
                is TimeoutCancellationException -> IllegalStateException("Call accept timeout")
                else -> error
            }
        }
    }

    override suspend fun declineCall(callId: String): Result<Unit> {
        return socketGateway.declineCall(callId = callId)
    }

    override suspend fun leaveCall(callId: String): Result<Unit> {
        return runCatching {
            withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                socketGateway.leaveCall(callId = callId).getOrThrow()
            }
        }.recoverCatching { error ->
            throw when (error) {
                is TimeoutCancellationException -> IllegalStateException("Call leave timeout")
                else -> error
            }
        }
    }

    override suspend fun startGroupCall(chatId: String, type: String): Result<GroupCallStartResult> {
        return runCatching {
            withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                socketGateway.startGroupCall(chatId = chatId, type = type).getOrThrow()
            }
        }.recoverCatching { error ->
            throw when (error) {
                is TimeoutCancellationException -> IllegalStateException("Group call start timeout")
                else -> error
            }
        }
    }

    override suspend fun joinGroupCall(
        chatId: String,
        callId: String
    ): Result<List<CallJoinParticipant>> {
        return runCatching {
            withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                socketGateway.joinGroupCall(chatId = chatId, callId = callId).getOrThrow()
            }
        }.recoverCatching { error ->
            throw when (error) {
                is TimeoutCancellationException -> IllegalStateException("Group call join timeout")
                else -> error
            }
        }
    }

    override suspend fun leaveGroupCall(callId: String): Result<Unit> {
        return runCatching {
            withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                socketGateway.leaveGroupCall(callId = callId).getOrThrow()
            }
        }.recoverCatching { error ->
            throw when (error) {
                is TimeoutCancellationException -> IllegalStateException("Group call leave timeout")
                else -> error
            }
        }
    }

    override suspend fun loadWebRtcConfig(): Result<WebRtcConfig> {
        return runAuthorized {
            api.getWebRtcIceConfig().toDomain()
        }
    }

    override suspend fun loadLiveKitToken(room: String, identity: String): Result<String> {
        return runAuthorized {
            val token = api.getLiveKitToken(room = room, identity = identity).token
            token.takeIf { it.isNotBlank() }
                ?: throw IllegalStateException("LiveKit token is empty")
        }
    }

    override fun sendCallSignal(callId: String, targetUserId: String, signal: CallSignalPayload) {
        socketGateway.sendCallSignal(
            callId = callId,
            targetUserId = targetUserId,
            signal = signal
        )
    }

    override fun sendGroupCallSignal(callId: String, targetUserId: String, signal: CallSignalPayload) {
        socketGateway.sendGroupCallSignal(
            callId = callId,
            targetUserId = targetUserId,
            signal = signal
        )
    }

    override suspend fun sendAttachmentMessage(
        chatId: String,
        attachmentUri: String,
        onProgress: (Int) -> Unit
    ): Result<ChatMessage> {
        val uri = runCatching { Uri.parse(attachmentUri) }.getOrNull()
            ?: return Result.failure(IllegalArgumentException("Не удалось открыть файл"))

        val meta = resolveAttachmentMeta(uri)
            ?: return Result.failure(IllegalArgumentException("Не удалось прочитать файл"))

        if (meta.sizeBytes != null && meta.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
            return Result.failure(IllegalArgumentException("Максимальный размер файла: 20 МБ"))
        }

        onProgress(0)

        val uploadResult = runAuthorized {
            val requestBody = UriUploadRequestBody(
                contentResolver = appContext.contentResolver,
                uri = uri,
                mediaType = meta.mimeType?.toMediaTypeOrNull(),
                contentLength = meta.sizeBytes ?: -1L
            ) { written, total ->
                if (total > 0L) {
                    val progress = ((written * 100) / total).toInt().coerceIn(0, 100)
                    onProgress(progress)
                }
            }

            val part = MultipartBody.Part.createFormData(
                "file",
                meta.fileName,
                requestBody
            )
            api.uploadFile(part)
        }

        return uploadResult.fold(
            onSuccess = { upload ->
                onProgress(100)
                val messageType = resolveMessageType(mimeType = meta.mimeType, fileName = meta.fileName)
                val attachment = JSONObject()
                    .put("url", upload.url)
                    .put("originalName", upload.originalName)
                    .put("mimeType", upload.mimeType ?: meta.mimeType)
                    .put("size", upload.size ?: meta.sizeBytes ?: 0L)

                runCatching {
                    withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                        socketGateway.sendAttachmentMessage(
                            chatId = chatId,
                            type = messageType,
                            attachment = attachment
                        ).getOrThrow()
                    }
                }.recoverCatching { error ->
                    throw when (error) {
                        is TimeoutCancellationException -> IllegalStateException("Таймаут отправки вложения")
                        else -> error
                    }
                }
            },
            onFailure = { Result.failure(it) }
        )
    }

    override suspend fun markMessagesRead(chatId: String, messageIds: List<String>) {
        socketGateway.markMessagesRead(chatId = chatId, messageIds = messageIds)
    }

    override suspend fun getCurrentUser(): Result<UserProfile> {
        return runAuthorized {
            val profile = api.getMe().toDomain()
            if (profile.id.isNotBlank()) {
                sessionStorage.saveUserId(profile.id)
            }
            profile
        }
    }

    override suspend fun searchUserByPhone(phone: String): Result<UserProfile?> {
        return runCatching {
            val dto = api.searchByPhone(phone)
            dto?.toDomain()
        }.recoverCatching { error ->
            if (error is HttpException && error.code() == 404) {
                null
            } else {
                throw error
            }
        }
    }

    override suspend fun createChat(userId: String): Result<ChatPreview> {
        return runAuthorized {
            val dto = api.createPrivateChat(
                ru.govchat.app.core.network.CreateChatRequest(userId = userId)
            )
            dto.toDomain()
        }
    }

    override suspend fun createGroupChat(name: String, participantIds: List<String>): Result<ChatPreview> {
        return runAuthorized {
            val dto = api.createGroupChat(
                CreateGroupChatRequest(
                    name = name,
                    participantIds = participantIds
                )
            )
            dto.toDomain()
        }
    }

    override suspend fun getChatParticipants(chatId: String): Result<List<UserProfile>> {
        return runAuthorized {
            api.getChat(chatId).toParticipantsDomain()
        }
    }

    override fun startTyping(chatId: String) {
        socketGateway.startTyping(chatId)
    }

    override fun stopTyping(chatId: String) {
        socketGateway.stopTyping(chatId)
    }

    override suspend fun joinChat(chatId: String) {
        socketGateway.joinChat(chatId = chatId)
    }

    override suspend fun connectRealtime() {
        val token = sessionStorage.awaitToken()
        if (token.isNullOrBlank()) return
        socketGateway.connect(token)
    }

    override suspend fun disconnectRealtime() {
        socketGateway.disconnect()
    }

    override fun observeRealtimeEvents(): Flow<RealtimeEvent> = socketGateway.events

    private suspend fun <T> runAuthorized(block: suspend () -> T): Result<T> {
        return runCatching { block() }.onFailure { error ->
            if (error is HttpException && error.code() == 401) {
                sessionStorage.clearToken()
                socketGateway.disconnect()
            }
        }
    }

    private fun resolveAttachmentMeta(uri: Uri): LocalAttachmentMeta? {
        var fileName: String? = null
        var sizeBytes: Long? = null

        appContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIndex >= 0) {
                    fileName = cursor.getString(nameIndex)
                }
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                    sizeBytes = cursor.getLong(sizeIndex)
                }
            }
        }

        if (sizeBytes == null || sizeBytes <= 0L) {
            sizeBytes = runCatching {
                appContext.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
                    descriptor.length.takeIf { it > 0L }
                }
            }.getOrNull()
        }

        val fallbackName = "attachment_${System.currentTimeMillis()}"
        val mimeType = appContext.contentResolver.getType(uri)

        return LocalAttachmentMeta(
            fileName = fileName?.takeIf { it.isNotBlank() } ?: fallbackName,
            mimeType = mimeType,
            sizeBytes = sizeBytes
        )
    }

    private fun resolveMessageType(mimeType: String?, fileName: String): String {
        val safeMime = mimeType.orEmpty().lowercase()
        if (safeMime.startsWith("image/")) return "image"
        if (safeMime.startsWith("video/")) return "video"
        if (safeMime.startsWith("audio/")) return "audio"

        val extension = fileName.substringAfterLast('.', "").lowercase()
        if (extension in IMAGE_EXTENSIONS) return "image"
        if (extension in VIDEO_EXTENSIONS) return "video"
        if (extension in AUDIO_EXTENSIONS) return "audio"

        return "file"
    }

    private data class LocalAttachmentMeta(
        val fileName: String,
        val mimeType: String?,
        val sizeBytes: Long?
    )

    private companion object {
        const val MAX_ATTACHMENT_SIZE_BYTES = 20L * 1024L * 1024L
        const val SOCKET_SEND_TIMEOUT_MS = 20_000L

        val IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg")
        val VIDEO_EXTENSIONS = setOf("mp4", "webm", "mov", "avi", "mkv", "m4v")
        val AUDIO_EXTENSIONS = setOf("mp3", "ogg", "wav", "m4a", "aac", "webm")
    }
}
