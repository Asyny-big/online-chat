package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.repository.ChatRepository

class LeaveCallUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(callId: String): Result<Unit> {
        return chatRepository.leaveCall(callId = callId)
    }
}
