package ru.govchat.app.core.network

import org.json.JSONArray
import org.json.JSONObject
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.ChatType
import ru.govchat.app.domain.model.MessageAttachment
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
                sizeBytes = it.optLong("size").takeIf { size -> size > 0L }
            )
        }
    }

    val readByIds = parseReadByIds(optJSONArray("readBy"))

    return ChatMessage(
        id = messageId,
        chatId = chatId,
        senderId = senderId,
        senderName = senderName,
        type = optString("type", "text").toSocketMessageType(),
        text = optString("text"),
        attachment = attachment,
        readByUserIds = readByIds,
        createdAtMillis = optString("createdAt").toEpochMillisOrZero()
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
        "audio" -> "🎤 Голосовое сообщение"
        "image" -> "📷 Изображение"
        "video" -> "🎥 Видео"
        "file" -> "📎 Файл"
        else -> lastMessage?.optString("text").takeIf { !it.isNullOrBlank() } ?: "Нет сообщений"
    }

    val participants = optJSONArray("participants")
    val participantCount = optInt("participantCount").takeIf { it > 0 } ?: (participants?.length() ?: 0)

    return ChatPreview(
        id = chatId,
        type = type,
        title = optString("displayName")
            .takeIf { it.isNotBlank() }
            ?: optString("name").takeIf { it.isNotBlank() }
            ?: "Чат",
        subtitle = subtitle,
        avatarUrl = optString("displayAvatar").takeIf { it.isNotBlank() },
        isOnline = optString("displayStatus") == "online",
        unreadCount = 0,
        participantCount = participantCount,
        updatedAtMillis = optString("updatedAt").toEpochMillisOrZero()
    )
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

private fun String?.toEpochMillisOrZero(): Long {
    return runCatching { Instant.parse(this).toEpochMilli() }.getOrDefault(0L)
}

private fun String.toSocketMessageType(): MessageType {
    return when (lowercase()) {
        "image" -> MessageType.Image
        "video" -> MessageType.Video
        "audio" -> MessageType.Audio
        "file" -> MessageType.File
        "system" -> MessageType.System
        else -> MessageType.Text
    }
}
