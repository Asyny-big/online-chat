package ru.govchat.app.core.network

import com.squareup.moshi.Json
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface GovChatApi {

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @GET("me")
    suspend fun getMe(): MeDto

    @GET("chats")
    suspend fun getChats(): List<ChatDto>

    @POST("me/device-token")
    suspend fun registerDeviceToken(@Body request: DeviceTokenRequest): ApiSuccessResponse
}

data class LoginRequest(
    val phone: String,
    val password: String
)

data class AuthResponse(
    val token: String,
    val user: UserDto
)

data class UserDto(
    @Json(name = "_id") val id: String? = null,
    val name: String,
    val phone: String,
    val avatarUrl: String? = null
)

data class MeDto(
    @Json(name = "id") val id: String,
    val name: String,
    val phone: String,
    val avatar: String? = null
)

data class ChatDto(
    @Json(name = "_id") val id: String,
    val type: String,
    val name: String? = null,
    val displayName: String? = null,
    val displayAvatar: String? = null,
    val displayStatus: String? = null,
    val lastMessage: LastMessageDto? = null
)

data class LastMessageDto(
    val text: String? = null,
    val createdAt: String? = null
)

data class DeviceTokenRequest(
    val token: String,
    val platform: String = "android"
)

data class ApiSuccessResponse(
    val success: Boolean = true
)

