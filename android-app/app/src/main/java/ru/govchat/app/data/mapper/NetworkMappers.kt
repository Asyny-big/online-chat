package ru.govchat.app.data.mapper

import ru.govchat.app.core.network.ChatDto
import ru.govchat.app.core.network.MeDto
import ru.govchat.app.core.network.UserDto
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.UserProfile

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
    return ChatPreview(
        id = id,
        title = displayName ?: name ?: "Untitled chat",
        subtitle = lastMessage?.text?.takeIf { it.isNotBlank() } ?: "No messages yet",
        avatarUrl = displayAvatar,
        isOnline = displayStatus == "online"
    )
}
