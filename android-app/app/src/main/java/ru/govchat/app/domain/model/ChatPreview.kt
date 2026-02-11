package ru.govchat.app.domain.model

data class ChatPreview(
    val id: String,
    val type: ChatType,
    val title: String,
    val subtitle: String,
    val avatarUrl: String?,
    val isOnline: Boolean,
    val unreadCount: Int,
    val participantCount: Int,
    val updatedAtMillis: Long
)

enum class ChatType {
    PRIVATE,
    GROUP,
    UNKNOWN
}

