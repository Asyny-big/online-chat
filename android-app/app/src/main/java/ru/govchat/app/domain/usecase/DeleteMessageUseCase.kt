package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.repository.ChatRepository

class DeleteMessageUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(
        messageId: String,
        expectedRevision: Int? = null,
        expectedUpdatedAtMillis: Long? = null
    ): Result<ChatMessage> {
        return chatRepository.deleteMessage(
            messageId = messageId,
            expectedRevision = expectedRevision,
            expectedUpdatedAtMillis = expectedUpdatedAtMillis
        )
    }
}
