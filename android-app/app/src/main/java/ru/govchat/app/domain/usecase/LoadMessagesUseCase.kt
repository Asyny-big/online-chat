package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.repository.ChatRepository

class LoadMessagesUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(chatId: String): Result<List<ChatMessage>> {
        return chatRepository.loadMessages(chatId)
    }
}
