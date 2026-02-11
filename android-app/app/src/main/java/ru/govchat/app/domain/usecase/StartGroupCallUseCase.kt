package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.repository.ChatRepository

class StartGroupCallUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(chatId: String, type: String): Result<String> {
        return chatRepository.startGroupCall(chatId = chatId, type = type)
    }
}
