package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.repository.ChatRepository

class LoadMessagesUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(
        chatId: String,
        beforeMillis: Long? = null,
        limit: Int = 30
    ): Result<List<ChatMessage>> {
        return chatRepository.loadMessages(
            chatId = chatId,
            beforeMillis = beforeMillis,
            limit = limit
        )
    }
}
