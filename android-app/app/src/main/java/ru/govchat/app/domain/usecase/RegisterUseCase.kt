package ru.govchat.app.domain.usecase

import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.repository.AuthRepository

class RegisterUseCase(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(phone: String, name: String, password: String): Result<UserProfile> {
        return authRepository.register(phone = phone, name = name, password = password)
    }
}
