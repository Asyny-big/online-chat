package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.repository.ChatRepository

class EditMessageUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(
        messageId: String,
        text: String,
        expectedRevision: Int? = null,
        expectedUpdatedAtMillis: Long? = null
    ): Result<ChatMessage> {
        return chatRepository.editMessage(
            messageId = messageId,
            text = text,
            expectedRevision = expectedRevision,
            expectedUpdatedAtMillis = expectedUpdatedAtMillis
        )
    }
}
