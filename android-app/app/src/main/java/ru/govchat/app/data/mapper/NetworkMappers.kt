package ru.govchat.app.data.mapper

import org.json.JSONObject
import ru.govchat.app.core.network.AttachmentDto
import ru.govchat.app.core.network.ChatDto
import ru.govchat.app.core.network.IceServerDto
import ru.govchat.app.core.network.MeDto
import ru.govchat.app.core.network.MessageDto
import ru.govchat.app.core.network.ReadByDto
import ru.govchat.app.core.network.UserDto
import ru.govchat.app.core.network.WebRtcIceConfigDto
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.ChatType
import ru.govchat.app.domain.model.MessageAttachment
import ru.govchat.app.domain.model.MessageType
import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.model.WebRtcConfig
import ru.govchat.app.domain.model.WebRtcIceServer
import java.time.Instant

fun UserDto.toDomain(): UserProfile {
    return UserProfile(
        id = id.orEmpty(),
        name = name,
        phone = phone,
        avatarUrl = avatarUrl
    )
}

fun MeDto.toDomain(): UserProfile {
    return UserProfile(
        id = id,
        name = name,
        phone = phone,
        avatarUrl = avatar
    )
}

fun ChatDto.toDomain(): ChatPreview {
    val type = when (type.lowercase()) {
        "private" -> ChatType.PRIVATE
        "group" -> ChatType.GROUP
        else -> ChatType.UNKNOWN
    }

    val lastMessageText = lastMessage.toDisplayText()
    val participantSize = participantCount ?: participants.size

    return ChatPreview(
        id = id,
        type = type,
        title = displayName ?: name ?: "Чат",
        subtitle = lastMessageText,
        avatarUrl = displayAvatar,
        peerUserId = resolvePeerUserId(),
        isOnline = displayStatus == "online",
        unreadCount = unreadCount ?: 0,
        participantCount = participantSize,
        updatedAtMillis = updatedAt.toEpochMillisOrZero()
    )
}

fun ChatDto.toParticipantsDomain(): List<UserProfile> {
    return participants
        .mapNotNull { it.user.toUserProfileOrNull() }
        .filter { it.id.isNotBlank() }
        .distinctBy { it.id }
}

fun MessageDto.toDomain(chatIdFallback: String): ChatMessage {
    val senderId = sender?.id.orEmpty()
    val senderName = sender?.name.orEmpty()
    val readBy = readBy.extractReadByIds()

    return ChatMessage(
        id = id,
        chatId = chat.takeUnless { it.isNullOrBlank() } ?: chatIdFallback,
        senderId = senderId,
        senderName = senderName,
        type = type.toMessageType(),
        text = text,
        attachment = attachment.toDomain(),
        readByUserIds = readBy,
        createdAtMillis = createdAt.toEpochMillisOrZero()
    )
}

fun WebRtcIceConfigDto.toDomain(): WebRtcConfig {
    return WebRtcConfig(
        iceServers = iceServers.map { it.toDomain() }.filter { it.urls.isNotEmpty() },
        iceCandidatePoolSize = iceCandidatePoolSize
    )
}

private fun ru.govchat.app.core.network.LastMessageDto?.toDisplayText(): String {
    if (this == null) return "Нет сообщений"
    return when (type.orEmpty()) {
        "audio" -> "🎤 Голосовое сообщение"
        "image" -> "📷 Изображение"
        "video" -> "🎥 Видео"
        "file" -> "📎 Файл"
        else -> text?.takeIf { it.isNotBlank() } ?: "Сообщение"
    }
}

private fun String?.toEpochMillisOrZero(): Long {
    return runCatching { Instant.parse(this).toEpochMilli() }.getOrDefault(0L)
}

private fun IceServerDto.toDomain(): WebRtcIceServer {
    val normalizedUrls = when (val raw = urls) {
        is String -> listOf(raw)
        is List<*> -> raw.mapNotNull { it as? String }
        else -> emptyList()
    }.map { it.trim() }.filter { it.isNotBlank() }

    return WebRtcIceServer(
        urls = normalizedUrls,
        username = username?.takeIf { it.isNotBlank() },
        credential = credential?.takeIf { it.isNotBlank() }
    )
}

private fun AttachmentDto?.toDomain(): MessageAttachment? {
    if (this?.url.isNullOrBlank()) return null
    return MessageAttachment(
        url = this!!.url.orEmpty(),
        originalName = originalName.orEmpty(),
        mimeType = mimeType,
        sizeBytes = size
    )
}

private fun ChatDto.resolvePeerUserId(): String? {
    if (type.lowercase() != "private") return null

    val participantsResolved = participants.mapNotNull { participant ->
        val user = participant.user ?: return@mapNotNull null
        when (user) {
            is Map<*, *> -> {
                val id = (user["_id"] as? String) ?: (user["id"] as? String)
                val name = (user["name"] as? String).orEmpty()
                id?.takeIf { it.isNotBlank() }?.let { ParticipantSnapshot(id = it, name = name) }
            }

            is JSONObject -> {
                val id = user.optString("_id").takeIf { it.isNotBlank() }
                    ?: user.optString("id").takeIf { it.isNotBlank() }
                val name = user.optString("name")
                id?.let { ParticipantSnapshot(id = it, name = name) }
            }

            is String -> user.takeIf { it.isNotBlank() }?.let { ParticipantSnapshot(id = it, name = "") }
            else -> null
        }
    }

    if (participantsResolved.isEmpty()) return null
    val display = displayName.orEmpty()
    if (display.isNotBlank()) {
        participantsResolved.firstOrNull { it.name == display }?.let { return it.id }
    }
    return participantsResolved.first().id
}

private data class ParticipantSnapshot(
    val id: String,
    val name: String
)

fun String.toMessageType(): MessageType {
    return when (lowercase()) {
        "image" -> MessageType.Image
        "video" -> MessageType.Video
        "audio" -> MessageType.Audio
        "file" -> MessageType.File
        "system" -> MessageType.System
        else -> MessageType.Text
    }
}

private fun List<ReadByDto>.extractReadByIds(): Set<String> {
    return mapNotNull { item ->
        when (val rawUser = item.user) {
            is String -> rawUser
            is Map<*, *> -> rawUser["_id"] as? String ?: rawUser["id"] as? String
            is JSONObject -> rawUser.optString("_id").takeIf { it.isNotBlank() }
            else -> null
        }
    }.toSet()
}

private fun Any?.toUserProfileOrNull(): UserProfile? {
    return when (this) {
        is Map<*, *> -> {
            val id = (this["_id"] as? String) ?: (this["id"] as? String) ?: return null
            val name = (this["name"] as? String).orEmpty()
            val phone = (this["phone"] as? String).orEmpty()
            val avatarUrl = (this["avatarUrl"] as? String)
                ?: (this["avatar"] as? String)
            UserProfile(
                id = id,
                name = name,
                phone = phone,
                avatarUrl = avatarUrl
            )
        }

        is JSONObject -> {
            val id = optString("_id").takeIf { it.isNotBlank() }
                ?: optString("id").takeIf { it.isNotBlank() }
                ?: return null
            UserProfile(
                id = id,
                name = optString("name"),
                phone = optString("phone"),
                avatarUrl = optString("avatarUrl").takeIf { it.isNotBlank() }
                    ?: optString("avatar").takeIf { it.isNotBlank() }
            )
        }

        else -> null
    }
}
