package ru.govchat.app.domain.repository

import kotlinx.coroutines.flow.Flow
import ru.govchat.app.domain.model.UserProfile

interface AuthRepository {
    val tokenFlow: Flow<String?>

    suspend fun login(phone: String, password: String): Result<UserProfile>
    suspend fun checkSession(): Result<UserProfile>
    suspend fun logout()
}

