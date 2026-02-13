package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.repository.ChatRepository
import ru.govchat.app.domain.model.GroupCallStartResult

class StartGroupCallUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(chatId: String, type: String): Result<GroupCallStartResult> {
        return chatRepository.startGroupCall(chatId = chatId, type = type)
    }
}
