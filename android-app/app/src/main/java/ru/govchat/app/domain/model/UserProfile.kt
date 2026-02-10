package ru.govchat.app.domain.model

data class UserProfile(
    val id: String,
    val name: String,
    val phone: String,
    val avatarUrl: String?
)

