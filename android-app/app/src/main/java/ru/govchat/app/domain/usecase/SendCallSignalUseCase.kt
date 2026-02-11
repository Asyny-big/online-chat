package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.repository.ChatRepository

class SendCallSignalUseCase(
    private val chatRepository: ChatRepository
) {
    operator fun invoke(callId: String, targetUserId: String, signal: CallSignalPayload) {
        chatRepository.sendCallSignal(
            callId = callId,
            targetUserId = targetUserId,
            signal = signal
        )
    }
}
