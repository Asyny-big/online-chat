package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.repository.ChatRepository

class LoadChatsUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(): Result<List<ChatPreview>> {
        return chatRepository.loadDialogs()
    }
}

