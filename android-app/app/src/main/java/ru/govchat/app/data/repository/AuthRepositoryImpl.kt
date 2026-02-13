package ru.govchat.app.data.repository

import retrofit2.HttpException
import ru.govchat.app.core.network.extractMessageField
import ru.govchat.app.core.network.DeviceUnregisterRequest
import ru.govchat.app.core.network.GovChatApi
import ru.govchat.app.core.network.LoginRequest
import ru.govchat.app.core.network.RegisterRequest
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
            val user = response.user.toDomain()
            if (user.id.isNotBlank()) {
                sessionStorage.saveUserId(user.id)
            }
            user
        }.recoverCatching { throwable ->
            throw toWebAuthError(throwable)
        }
    }

    override suspend fun register(phone: String, name: String, password: String): Result<UserProfile> {
        return runCatching {
            val response = api.register(
                request = RegisterRequest(
                    phone = phone.trim(),
                    name = name.trim(),
                    password = password
                )
            )

            sessionStorage.saveToken(response.token)
            val user = response.user.toDomain()
            if (user.id.isNotBlank()) {
                sessionStorage.saveUserId(user.id)
            }
            user
        }.recoverCatching { throwable ->
            throw toWebAuthError(throwable)
        }
    }

    override suspend fun checkSession(): Result<UserProfile> {
        val token = sessionStorage.awaitToken()
        if (token.isNullOrBlank()) {
            return Result.failure(IllegalStateException("No JWT token"))
        }

        return runCatching {
            val me = api.getMe().toDomain()
            if (me.id.isNotBlank()) {
                sessionStorage.saveUserId(me.id)
            }
            me
        }.onFailure { error ->
            if (error is HttpException && error.code() == 401) {
                sessionStorage.clearToken()
            }
        }
    }

    override suspend fun logout() {
        val fcmToken = sessionStorage.getCurrentFcmToken()
        if (!fcmToken.isNullOrBlank()) {
            runCatching {
                api.unregisterDeviceToken(
                    request = DeviceUnregisterRequest(token = fcmToken)
                )
            }
        }
        sessionStorage.clearToken()
    }

    private fun toWebAuthError(error: Throwable): Throwable {
        if (error is HttpException) {
            val messageFromField = error.extractMessageField()
            return IllegalStateException(messageFromField ?: "Ошибка авторизации")
        }
        return IllegalStateException("Ошибка авторизации")
    }
}

