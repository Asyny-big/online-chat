package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.CallJoinParticipant
import ru.govchat.app.domain.repository.ChatRepository

class JoinGroupCallUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(chatId: String, callId: String): Result<List<CallJoinParticipant>> {
        return chatRepository.joinGroupCall(chatId = chatId, callId = callId)
    }
}
