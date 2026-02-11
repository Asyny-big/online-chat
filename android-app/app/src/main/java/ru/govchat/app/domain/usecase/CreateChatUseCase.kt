package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.repository.ChatRepository

class CreateChatUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(userId: String): Result<ChatPreview> {
        return chatRepository.createChat(userId)
    }
}
