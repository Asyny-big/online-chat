package ru.govchat.app.data.repository

import retrofit2.HttpException
import ru.govchat.app.core.network.GovChatApi
import ru.govchat.app.core.network.LoginRequest
import ru.govchat.app.core.storage.SessionStorage
import ru.govchat.app.data.mapper.toDomain
import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.domain.repository.AuthRepository

class AuthRepositoryImpl(
    private val api: GovChatApi,
    private val sessionStorage: SessionStorage
) : AuthRepository {

    override val tokenFlow = sessionStorage.tokenFlow

    override suspend fun login(phone: String, password: String): Result<UserProfile> {
        return runCatching {
            val response = api.login(
                request = LoginRequest(
                    phone = phone.trim(),
                    password = password
                )
            )

            sessionStorage.saveToken(response.token)
            response.user.toDomain()
        }
    }

    override suspend fun checkSession(): Result<UserProfile> {
        val token = sessionStorage.awaitToken()
        if (token.isNullOrBlank()) {
            return Result.failure(IllegalStateException("No JWT token"))
        }

        return runCatching {
            api.getMe().toDomain()
        }.onFailure { error ->
            if (error is HttpException && error.code() == 401) {
                sessionStorage.clearToken()
            }
        }
    }

    override suspend fun logout() {
        sessionStorage.clearToken()
    }
}

