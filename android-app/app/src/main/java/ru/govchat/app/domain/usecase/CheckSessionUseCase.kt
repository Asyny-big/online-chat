package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.repository.AuthRepository

class CheckSessionUseCase(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(): Result<UserProfile> {
        return authRepository.checkSession()
    }
}

