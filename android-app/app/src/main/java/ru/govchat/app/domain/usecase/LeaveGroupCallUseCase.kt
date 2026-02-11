package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.repository.ChatRepository

class LeaveGroupCallUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(callId: String): Result<Unit> {
        return chatRepository.leaveGroupCall(callId = callId)
    }
}
