package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.repository.AuthRepository

class LoginUseCase(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(phone: String, password: String): Result<UserProfile> {
        return authRepository.login(phone, password)
    }
}

