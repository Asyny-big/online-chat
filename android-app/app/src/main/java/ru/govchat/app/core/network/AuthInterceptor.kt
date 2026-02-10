package ru.govchat.app.core.network

import okhttp3.Interceptor
import okhttp3.Response
import kotlinx.coroutines.runBlocking
import ru.govchat.app.core.storage.SessionStorage

class AuthInterceptor(
    private val sessionStorage: SessionStorage
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val requestBuilder = chain.request().newBuilder()
        val token = sessionStorage.currentToken() ?: runBlocking { sessionStorage.awaitToken() }

        if (!token.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }
}
