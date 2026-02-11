package ru.govchat.app.domain.model

data class TypingUser(
    val chatId: String,
    val userId: String,
    val userName: String
)
