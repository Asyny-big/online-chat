package ru.govchat.app.domain.model

data class ChatPreview(
    val id: String,
    val title: String,
    val subtitle: String,
    val avatarUrl: String?,
    val isOnline: Boolean
)

