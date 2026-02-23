package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.repository.ChatRepository

class CreateGroupChatUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(name: String, participantIds: List<String>): Result<ChatPreview> {
        return chatRepository.createGroupChat(name = name, participantIds = participantIds)
    }
}
