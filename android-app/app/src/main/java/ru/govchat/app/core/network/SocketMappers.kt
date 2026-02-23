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
                sizeBytes = it.optLong("size").takeIf { size -> size > 0L },
                durationMs = when {
                    it.has("durationMs") -> it.optLong("durationMs").takeIf { duration -> duration > 0L }
                    it.has("duration") -> it.optLong("duration").takeIf { duration -> duration > 0L }?.times(1000)
                    else -> null
                }
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
        "voice" -> "Ãîëîñîâîå ñîîáùåíèå"
        "video_note" -> "Âèäåî-êðóæîê"
        "audio" -> "ðŸŽ¤ Ð“Ð¾Ð»Ð¾ÑÐ¾Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ"
        "image" -> "ðŸ“· Ð˜Ð·Ð¾Ð±Ñ€Ð°Ð¶ÐµÐ½Ð¸Ðµ"
        "video" -> "ðŸŽ¥ Ð’Ð¸Ð´ÐµÐ¾"
        "file" -> "ðŸ“Ž Ð¤Ð°Ð¹Ð»"
        else -> lastMessage?.optString("text").takeIf { !it.isNullOrBlank() } ?: "ÐÐµÑ‚ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹"
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
            ?: "Ð§Ð°Ñ‚",
        subtitle = subtitle,
        avatarUrl = optString("displayAvatar").takeIf { it.isNotBlank() },
        peerUserId = resolvePeerUserId(type = type, participants = participants),
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
        "file" -> MessageType.File
        "system" -> MessageType.System
        else -> MessageType.Text
    }
}

