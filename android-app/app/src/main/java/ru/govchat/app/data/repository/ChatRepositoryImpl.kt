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
import ru.govchat.app.core.network.EditMessageRequest
import ru.govchat.app.core.network.extractApiErrorInfo
import ru.govchat.app.core.storage.SessionStorage
import ru.govchat.app.core.location.DeviceLocation
import ru.govchat.app.core.network.LocationPermissionUpdateRequest
import ru.govchat.app.core.network.LocationFailureRequest
import ru.govchat.app.core.network.LocationRequestCreateRequest
import ru.govchat.app.core.network.LocationResponseRequest
import ru.govchat.app.data.mapper.toDomain
import ru.govchat.app.data.mapper.toParticipantsDomain
import ru.govchat.app.domain.model.AttachmentType
import ru.govchat.app.domain.model.CallJoinParticipant
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.GroupCallStartResult
import ru.govchat.app.domain.model.RealtimeEvent
import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.model.WebRtcConfig
import ru.govchat.app.domain.repository.ChatRepository
import java.io.File
import java.time.Instant

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

    override suspend fun loadMessages(
        chatId: String,
        beforeMillis: Long?,
        limit: Int
    ): Result<List<ChatMessage>> {
        return runAuthorized {
            val beforeIso = beforeMillis?.let { Instant.ofEpochMilli(it).toString() }
            api.getMessages(
                chatId = chatId,
                before = beforeIso,
                limit = limit
            ).map { it.toDomain(chatIdFallback = chatId) }
        }
    }

    override suspend fun editMessage(
        messageId: String,
        text: String,
        expectedRevision: Int?,
        expectedUpdatedAtMillis: Long?
    ): Result<ChatMessage> {
        return runAuthorized {
            api.editMessage(
                messageId = messageId,
                request = EditMessageRequest(
                    text = text,
                    expectedRevision = expectedRevision,
                    expectedUpdatedAt = expectedUpdatedAtMillis?.takeIf { it > 0L }?.let { millis ->
                        Instant.ofEpochMilli(millis).toString()
                    }
                )
            ).message?.toDomain(chatIdFallback = "")
                ?: throw IllegalStateException("Server did not return edited message")
        }
    }

    override suspend fun deleteMessage(
        messageId: String,
        expectedRevision: Int?,
        expectedUpdatedAtMillis: Long?
    ): Result<ChatMessage> {
        return runAuthorized {
            api.deleteMessage(
                messageId = messageId,
                expectedRevision = expectedRevision,
                expectedUpdatedAt = expectedUpdatedAtMillis?.takeIf { it > 0L }?.let { millis ->
                    Instant.ofEpochMilli(millis).toString()
                }
            ).message?.toDomain(chatIdFallback = "")
                ?: throw IllegalStateException("Server did not return deleted message")
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
                is TimeoutCancellationException -> IllegalStateException("РўР°Р№РјР°СѓС‚ РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ")
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
        attachmentType: AttachmentType?,
        durationMs: Long?,
        onProgress: (Int) -> Unit
    ): Result<ChatMessage> {
        val uri = runCatching { Uri.parse(attachmentUri) }.getOrNull()
            ?: return Result.failure(IllegalArgumentException("Unable to open file"))
        val meta = resolveAttachmentMeta(uri)
            ?: return Result.failure(IllegalArgumentException("Unable to resolve file metadata"))
        val measuredSizeBytes = meta.sizeBytes ?: measureSizeWithCap(uri, MAX_ATTACHMENT_SIZE_BYTES + 1L)
        if (measuredSizeBytes <= 0L) {
            return Result.failure(IllegalArgumentException("File is empty"))
        }
        if (measuredSizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
            return Result.failure(IllegalArgumentException("Maximum file size is 100 MB"))
        }
        val effectiveType = attachmentType ?: resolveMessageType(mimeType = meta.mimeType, fileName = meta.fileName)
        if (!isMimeCompatible(effectiveType, meta.mimeType, meta.fileName)) {
            return Result.failure(
                IllegalArgumentException("MIME type does not match attachment type: ${effectiveType.socketValue}")
            )
        }
        onProgress(0)
        val uploadResult = runAuthorized {
            val requestBody = UriUploadRequestBody(
                contentResolver = appContext.contentResolver,
                uri = uri,
                mediaType = meta.mimeType?.toMediaTypeOrNull(),
                contentLength = measuredSizeBytes
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
                val attachment = JSONObject()
                    .put("url", upload.url)
                    .put("originalName", upload.originalName)
                    .put("mimeType", upload.mimeType ?: meta.mimeType)
                    .put("size", upload.size ?: measuredSizeBytes)
                durationMs?.takeIf { it > 0L }?.let { safeDuration ->
                    attachment.put("durationMs", safeDuration)
                }
                runCatching {
                    withTimeout(SOCKET_SEND_TIMEOUT_MS) {
                        socketGateway.sendAttachmentMessage(
                            chatId = chatId,
                            type = effectiveType.socketValue,
                            attachment = attachment
                        ).getOrThrow()
                    }
                }.recoverCatching { error ->
                    throw when (error) {
                        is TimeoutCancellationException -> IllegalStateException("Attachment send timeout")
                        else -> error
                    }
                }
            },
            onFailure = { error ->
                if (error is HttpException && error.code() == HTTP_PAYLOAD_TOO_LARGE) {
                    Result.failure(IllegalStateException("Payload too large (413)"))
                } else {
                    Result.failure(error)
                }
            }
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
        return runAuthorized {
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

    override suspend fun requestLocation(chatId: String, targetUserId: String): Result<Unit> {
        return runAuthorized {
            api.requestLocation(
                LocationRequestCreateRequest(
                    chatId = chatId,
                    targetUserId = targetUserId
                )
            )
            Unit
        }.recoverCatching { error ->
            throw translateLocationRequestError(error)
        }
    }

    override suspend fun canPeerRequestLocation(targetUserId: String): Result<Boolean> {
        return runAuthorized {
            api.getLocationPermissionStatus(targetUserId).targetCanRequestMe
        }
    }

    override suspend fun setLocationPermission(allowedUserId: String, enabled: Boolean): Result<Unit> {
        return runAuthorized {
            api.setLocationPermission(
                allowedUserId = allowedUserId,
                request = LocationPermissionUpdateRequest(enabled = enabled)
            )
            Unit
        }.recoverCatching { error ->
            throw translateLocationPermissionError(error)
        }
    }

    override suspend fun submitLocationResponse(requestId: String, location: DeviceLocation): Result<Unit> {
        return runAuthorized {
            api.submitLocationResponse(
                requestId = requestId,
                request = LocationResponseRequest(
                    latitude = location.latitude,
                    longitude = location.longitude,
                    accuracyMeters = location.accuracyMeters,
                    altitudeMeters = location.altitudeMeters,
                    headingDegrees = location.headingDegrees,
                    speedMetersPerSecond = location.speedMetersPerSecond,
                    provider = location.provider,
                    capturedAt = location.capturedAt
                )
            )
            Unit
        }.recoverCatching { error ->
            throw translateLocationRequestError(error)
        }
    }

    override suspend fun submitLocationFailure(requestId: String, code: String, error: String?): Result<Unit> {
        return runAuthorized {
            api.submitLocationFailure(
                requestId = requestId,
                request = LocationFailureRequest(code = code, error = error)
            )
            Unit
        }.recoverCatching { throwable ->
            throw translateLocationRequestError(throwable)
        }
    }

    override fun respondToLocationRequest(requestId: String, location: DeviceLocation) {
        socketGateway.respondToLocationRequest(requestId = requestId, location = location)
    }

    override fun failLocationRequest(requestId: String, code: String) {
        socketGateway.failLocationRequest(requestId = requestId, code = code)
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
        if (uri.scheme.equals("file", ignoreCase = true)) {
            val file = runCatching { uri.path?.let(::File) }.getOrNull() ?: return null
            if (!file.exists() || !file.isFile) return null
            val extension = file.extension.lowercase()
            val mimeType = resolveMimeTypeFromExtension(extension)
            return LocalAttachmentMeta(
                fileName = file.name.takeIf { it.isNotBlank() } ?: "attachment_${System.currentTimeMillis()}",
                mimeType = mimeType,
                sizeBytes = file.length().takeIf { it > 0L }
            )
        }

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
        val resolvedFileName = fileName?.takeIf { it.isNotBlank() } ?: fallbackName
        val mimeType = appContext.contentResolver.getType(uri)
            ?.let(::normalizeMimeType)
            ?: resolveMimeTypeFromExtension(resolvedFileName.substringAfterLast('.', "").lowercase())

        return LocalAttachmentMeta(
            fileName = resolvedFileName,
            mimeType = mimeType,
            sizeBytes = sizeBytes
        )
    }

    private fun resolveMessageType(mimeType: String?, fileName: String): AttachmentType {
        val safeMime = mimeType.orEmpty().lowercase()
        if (safeMime.startsWith("image/")) return AttachmentType.Image
        if (safeMime.startsWith("video/")) return AttachmentType.Video
        if (safeMime.startsWith("audio/")) return AttachmentType.Audio

        val extension = fileName.substringAfterLast('.', "").lowercase()
        if (extension in IMAGE_EXTENSIONS) return AttachmentType.Image
        if (extension in VIDEO_EXTENSIONS) return AttachmentType.Video
        if (extension in AUDIO_EXTENSIONS) return AttachmentType.Audio

        return AttachmentType.File
    }

    private fun isMimeCompatible(
        attachmentType: AttachmentType,
        mimeType: String?,
        fileName: String
    ): Boolean {
        val normalizedMime = mimeType?.lowercase().orEmpty()
        val extension = fileName.substringAfterLast('.', "").lowercase()
        return when (attachmentType) {
            AttachmentType.Image -> normalizedMime.startsWith("image/") || extension in IMAGE_EXTENSIONS
            AttachmentType.Video -> normalizedMime.startsWith("video/") || extension in VIDEO_EXTENSIONS
            AttachmentType.Audio -> normalizedMime.startsWith("audio/") || extension in AUDIO_EXTENSIONS
            AttachmentType.File -> true
            AttachmentType.Voice -> normalizedMime.startsWith("audio/") || extension in AUDIO_EXTENSIONS
            AttachmentType.VideoNote -> normalizedMime.startsWith("video/") || extension in VIDEO_EXTENSIONS
        }
    }

    private fun measureSizeWithCap(uri: Uri, capBytes: Long): Long {
        return runCatching {
            appContext.contentResolver.openInputStream(uri)?.use { input ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                var total = 0L
                while (true) {
                    val read = input.read(buffer)
                    if (read <= 0) break
                    total += read
                    if (total > capBytes) {
                        total = capBytes
                        break
                    }
                }
                total
            } ?: -1L
        }.getOrElse { -1L }
    }

    private fun resolveMimeTypeFromExtension(extension: String): String? {
        if (extension.isBlank()) return null
        return when (extension) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "bmp" -> "image/bmp"
            "svg" -> "image/svg+xml"
            "mp4", "m4v" -> "video/mp4"
            "webm" -> "video/webm"
            "mov" -> "video/quicktime"
            "avi" -> "video/x-msvideo"
            "mkv" -> "video/x-matroska"
            "mp3" -> "audio/mpeg"
            "ogg", "oga" -> "audio/ogg"
            "opus" -> "audio/opus"
            "wav" -> "audio/wav"
            "m4a" -> "audio/mp4"
            "aac" -> "audio/aac"
            else -> when {
                extension in IMAGE_EXTENSIONS -> "image/$extension"
                extension in VIDEO_EXTENSIONS -> "video/$extension"
                extension in AUDIO_EXTENSIONS -> "audio/$extension"
                else -> null
            }
        }
    }

    private fun normalizeMimeType(mimeType: String): String {
        return when (mimeType.trim().lowercase()) {
            "audio/m4a", "audio/x-m4a" -> "audio/mp4"
            "audio/mp3", "audio/x-mp3" -> "audio/mpeg"
            "audio/x-wav" -> "audio/wav"
            "audio/oga" -> "audio/ogg"
            else -> mimeType
        }
    }

    private data class LocalAttachmentMeta(
        val fileName: String,
        val mimeType: String?,
        val sizeBytes: Long?
    )

    private fun translateLocationRequestError(error: Throwable): Throwable {
        if (error !is HttpException) return error
        val info = error.extractApiErrorInfo()
        val message = when (info.code) {
            "LOCATION_PERMISSION_DENIED" -> "Пользователь не разрешил вам запрашивать геолокацию"
            "LOCATION_TARGET_OFFLINE" -> "Пользователь оффлайн или Android-клиент недоступен"
            "LOCATION_REQUEST_CONFLICT" -> "Запрос уже отправлен. Дождитесь ответа пользователя"
            "LOCATION_RATE_LIMIT" -> "Подождите перед следующим запросом"
            else -> info.message
        }
        return IllegalStateException(message ?: "Не удалось запросить местоположение")
    }

    private fun translateLocationPermissionError(error: Throwable): Throwable {
        if (error !is HttpException) return error
        val info = error.extractApiErrorInfo()
        return IllegalStateException(info.message ?: "Не удалось обновить доступ к геолокации")
    }

    private companion object {
        const val MAX_ATTACHMENT_SIZE_BYTES = 100L * 1024L * 1024L
        const val SOCKET_SEND_TIMEOUT_MS = 20_000L
        const val HTTP_PAYLOAD_TOO_LARGE = 413

        val IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg")
        val VIDEO_EXTENSIONS = setOf("mp4", "webm", "mov", "avi", "mkv", "m4v")
        val AUDIO_EXTENSIONS = setOf("mp3", "ogg", "wav", "m4a", "aac", "webm")
    }
}

