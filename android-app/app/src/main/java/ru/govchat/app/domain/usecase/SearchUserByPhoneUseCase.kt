package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.repository.ChatRepository

class SearchUserByPhoneUseCase(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(phone: String): Result<UserProfile?> {
        return chatRepository.searchUserByPhone(phone)
    }
}
