package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.repository.ChatRepository

class SendAttachmentMessageUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(
        chatId: String,
        attachmentUri: String,
        onProgress: (Int) -> Unit
    ): Result<ChatMessage> {
        return chatRepository.sendAttachmentMessage(
            chatId = chatId,
            attachmentUri = attachmentUri,
            onProgress = onProgress
        )
    }
}
