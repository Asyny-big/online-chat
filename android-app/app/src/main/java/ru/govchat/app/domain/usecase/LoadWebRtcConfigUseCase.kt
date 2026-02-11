package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.WebRtcConfig
import ru.govchat.app.domain.repository.ChatRepository

class LoadWebRtcConfigUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(): Result<WebRtcConfig> {
        return chatRepository.loadWebRtcConfig()
    }
}
