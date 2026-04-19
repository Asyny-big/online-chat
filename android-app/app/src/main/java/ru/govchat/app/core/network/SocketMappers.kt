package ru.govchat.app.core.network

import org.json.JSONArray
import org.json.JSONObject
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.ChatType
import ru.govchat.app.domain.model.MessageAttachment
import ru.govchat.app.domain.model.MessageLocation
import ru.govchat.app.domain.model.MessageType
import java.time.Instant

internal fun JSONObject.toSocketMessage(chatIdHint: String = ""): ChatMessage? {
    val messageId = optString("_id").takeIf { it.isNotBlank() } ?: return null
    val senderObject = optJSONObject("sender")
    val senderId = senderObject?.optString("_id")
        ?.takeIf { it.isNotBlank() }
        ?: optString("sender").takeIf { it.isNotBlank() }
        ?: return null

    val senderName = senderObject?.optString("name").orEmpty()
    val chatId = optString("chat").takeIf { it.isNotBlank() } ?: chatIdHint
    if (chatId.isBlank()) return null

    val attachmentObject = optJSONObject("attachment")
    val attachment = attachmentObject?.let {
        val url = it.optString("url")
        if (url.isBlank()) {
            null
        } else {
            MessageAttachment(
                url = url,
                originalName = it.optString("originalName"),
                mimeType = it.optString("mimeType").takeIf { value -> value.isNotBlank() },
                sizeBytes = it.optLong("size").takeIf { size -> size > 0L },
                durationMs = when {
                    it.has("durationMs") -> it.optLong("durationMs").takeIf { duration -> duration > 0L }
                    it.has("duration") -> it.optLong("duration").takeIf { duration -> duration > 0L }?.times(1000)
                    else -> null
                },
                thumbnailUrl = listOf(
                    it.optString("thumbnailUrl"),
                    it.optString("thumbnail"),
                    it.optString("previewUrl"),
                    it.optString("preview")
                ).firstOrNull { value -> value.isNotBlank() }
            )
        }
    }

    val readByIds = parseReadByIds(optJSONArray("readBy"))
    val location = optJSONObject("location")?.toSocketLocation(createdAtFallback = optString("createdAt"))

    return ChatMessage(
        id = messageId,
        chatId = chatId,
        senderId = senderId,
        senderName = senderName,
        type = optString("type", "text").toSocketMessageType(),
        text = optString("text"),
        attachment = attachment,
        location = location,
        readByUserIds = readByIds,
        createdAtMillis = optString("createdAt").toEpochMillisOrZero(),
        updatedAtMillis = optString("updatedAt").toEpochMillisOrZero().takeIf { it > 0L },
        revision = optInt("revision", 0).coerceAtLeast(0),
        edited = optBoolean("edited"),
        editedAtMillis = optString("editedAt").toEpochMillisOrZero().takeIf { it > 0L },
        deleted = optBoolean("deleted"),
        deletedForUserIds = parseDeletedForIds(optJSONArray("deletedFor"))
    )
}

internal fun JSONObject.toSocketChatPreview(): ChatPreview? {
    val chatId = optString("_id").takeIf { it.isNotBlank() } ?: return null
    val typeRaw = optString("type")
    val type = when (typeRaw.lowercase()) {
        "private" -> ChatType.PRIVATE
        "group" -> ChatType.GROUP
        else -> ChatType.UNKNOWN
    }
    val lastMessage = optJSONObject("lastMessage")

    val subtitle = when (lastMessage?.optString("type").orEmpty()) {
        "voice" -> "Голосовое сообщение"
        "video_note" -> "Видео-кружок"
        "audio" -> "🎤 Голосовое сообщение"
        "image" -> "📷 Изображение"
        "video" -> "🎥 Видео"
        "location" -> "Местоположение"
        "file" -> "📎 Файл"
        else -> lastMessage?.optString("text").takeIf { !it.isNullOrBlank() } ?: "Нет сообщений"
    }

    val participants = optJSONArray("participants")
    val participantCount = optInt("participantCount").takeIf { it > 0 } ?: (participants?.length() ?: 0)
    val unreadCount = optInt("unreadCount", 0).coerceAtLeast(0)

    return ChatPreview(
        id = chatId,
        type = type,
        title = optString("displayName")
            .takeIf { it.isNotBlank() }
            ?: optString("name").takeIf { it.isNotBlank() }
            ?: "Чат",
        subtitle = subtitle,
        avatarUrl = optString("displayAvatar").takeIf { it.isNotBlank() },
        peerUserId = optString("peerUserId").takeIf { it.isNotBlank() }
            ?: resolvePeerUserId(type = type, participants = participants),
        isAiChat = optBoolean("isAiChat"),
        isOnline = optString("displayStatus") == "online",
        unreadCount = unreadCount,
        participantCount = participantCount,
        updatedAtMillis = optString("updatedAt").toEpochMillisOrZero()
    )
}

private fun resolvePeerUserId(type: ChatType, participants: JSONArray?): String? {
    if (type != ChatType.PRIVATE || participants == null) return null
    for (index in 0 until participants.length()) {
        val participant = participants.optJSONObject(index) ?: continue
        val user = participant.opt("user")
        val id = when (user) {
            is JSONObject -> user.optString("_id").takeIf { it.isNotBlank() }
                ?: user.optString("id").takeIf { it.isNotBlank() }

            is String -> user.takeIf { it.isNotBlank() }
            else -> null
        }
        if (!id.isNullOrBlank()) return id
    }
    return null
}

private fun parseReadByIds(readBy: JSONArray?): Set<String> {
    if (readBy == null) return emptySet()
    val result = LinkedHashSet<String>()
    for (index in 0 until readBy.length()) {
        val element = readBy.opt(index)
        when (element) {
            is JSONObject -> {
                val userElement = element.opt("user")
                when (userElement) {
                    is String -> if (userElement.isNotBlank()) result.add(userElement)
                    is JSONObject -> {
                        val id = userElement.optString("_id")
                        if (id.isNotBlank()) result.add(id)
                    }
                }
            }

            is String -> if (element.isNotBlank()) result.add(element)
        }
    }
    return result
}

private fun JSONObject.toSocketLocation(createdAtFallback: String): MessageLocation? {
    val latitude = optDouble("latitude", Double.NaN)
    val longitude = optDouble("longitude", Double.NaN)
    if (!latitude.isFinite() || !longitude.isFinite()) return null
    if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return null

    return MessageLocation(
        latitude = latitude,
        longitude = longitude,
        accuracyMeters = optDouble("accuracyMeters", 0.0),
        capturedAtMillis = optString("capturedAt").ifBlank { createdAtFallback }.toEpochMillisOrZero(),
        provider = optString("provider").takeIf { it.isNotBlank() }
    )
}

private fun parseDeletedForIds(deletedFor: JSONArray?): Set<String> {
    if (deletedFor == null) return emptySet()
    val result = LinkedHashSet<String>()
    for (index in 0 until deletedFor.length()) {
        val value = deletedFor.optString(index)
        if (value.isNotBlank()) {
            result.add(value)
        }
    }
    return result
}

private fun String?.toEpochMillisOrZero(): Long {
    return runCatching { Instant.parse(this).toEpochMilli() }.getOrDefault(0L)
}

private fun String.toSocketMessageType(): MessageType {
    return when (lowercase()) {
        "image" -> MessageType.Image
        "video" -> MessageType.Video
        "audio" -> MessageType.Audio
        "voice" -> MessageType.Voice
        "video_note" -> MessageType.VideoNote
        "location" -> MessageType.Location
        "file" -> MessageType.File
        "system" -> MessageType.System
        else -> MessageType.Text
    }
}
