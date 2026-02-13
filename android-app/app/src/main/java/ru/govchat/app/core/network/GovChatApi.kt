package ru.govchat.app.core.network

import com.squareup.moshi.Json
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface GovChatApi {

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse

    @GET("me")
    suspend fun getMe(): MeDto

    @GET("chats")
    suspend fun getChats(): List<ChatDto>

    @GET("chats/{chatId}")
    suspend fun getChat(@Path("chatId") chatId: String): ChatDto

    @GET("messages/{chatId}")
    suspend fun getMessages(@Path("chatId") chatId: String): List<MessageDto>

    @GET("webrtc/ice")
    suspend fun getWebRtcIceConfig(): WebRtcIceConfigDto

    @GET("livekit/token")
    suspend fun getLiveKitToken(
        @Query("room") room: String,
        @Query("identity") identity: String
    ): LiveKitTokenDto

    @Multipart
    @POST("upload")
    suspend fun uploadFile(@Part file: MultipartBody.Part): UploadResponse

    @GET("users/search")
    suspend fun searchByPhone(@Query("phone") phone: String): UserDto?

    @POST("me/device-token")
    suspend fun registerDeviceToken(@Body request: DeviceTokenRequest): ApiSuccessResponse

    @POST("chats/private")
    suspend fun createPrivateChat(@Body request: CreateChatRequest): ChatDto

    @POST("chats/group")
    suspend fun createGroupChat(@Body request: CreateGroupChatRequest): ChatDto
}

data class LoginRequest(
    val phone: String,
    val password: String
)

data class RegisterRequest(
    val phone: String,
    val name: String,
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
    val lastMessage: LastMessageDto? = null,
    val participantCount: Int? = null,
    val participants: List<ChatParticipantDto> = emptyList(),
    val updatedAt: String? = null
)

data class ChatParticipantDto(
    val role: String? = null,
    val user: Any? = null
)

data class LastMessageDto(
    val text: String? = null,
    val type: String? = null,
    val createdAt: String? = null
)

data class MessageDto(
    @Json(name = "_id") val id: String,
    val chat: String? = null,
    val sender: MessageSenderDto? = null,
    val type: String = "text",
    val text: String = "",
    val attachment: AttachmentDto? = null,
    val readBy: List<ReadByDto> = emptyList(),
    val createdAt: String? = null
)

data class MessageSenderDto(
    @Json(name = "_id") val id: String? = null,
    val name: String? = null,
    val phone: String? = null,
    val avatarUrl: String? = null
)

data class AttachmentDto(
    val url: String? = null,
    val originalName: String? = null,
    val mimeType: String? = null,
    val size: Long? = null
)

data class ReadByDto(
    val user: Any? = null
)

data class UploadResponse(
    val url: String,
    val originalName: String,
    val mimeType: String? = null,
    val size: Long? = null
)

data class DeviceTokenRequest(
    val token: String,
    val platform: String = "android"
)

data class ApiSuccessResponse(
    val success: Boolean = true
)

data class WebRtcIceConfigDto(
    val iceServers: List<IceServerDto> = emptyList(),
    val iceCandidatePoolSize: Int = 0
)

data class LiveKitTokenDto(
    val token: String
)

data class IceServerDto(
    val urls: Any? = null,
    val username: String? = null,
    val credential: String? = null
)

data class CreateChatRequest(
    val userId: String
)

data class CreateGroupChatRequest(
    val name: String,
    val participantPhones: List<String> = emptyList(),
    val participantIds: List<String> = emptyList()
)
