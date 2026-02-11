package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.repository.ChatRepository

class SendTextMessageUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(chatId: String, text: String): Result<ChatMessage> {
        return chatRepository.sendTextMessage(chatId = chatId, text = text)
    }
}
