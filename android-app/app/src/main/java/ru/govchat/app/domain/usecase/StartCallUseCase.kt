package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.repository.ChatRepository

class StartCallUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(chatId: String, type: String): Result<String> {
        return chatRepository.startCall(chatId = chatId, type = type)
    }
}
