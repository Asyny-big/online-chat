package ru.govchat.app.domain.model

data class ChatMessage(
    val id: String,
    val chatId: String,
    val senderId: String,
    val senderName: String,
    val type: MessageType,
    val text: String,
    val attachment: MessageAttachment?,
    val location: MessageLocation? = null,
    val readByUserIds: Set<String>,
    val createdAtMillis: Long,
    val updatedAtMillis: Long? = null,
    val revision: Int = 0,
    val edited: Boolean = false,
    val editedAtMillis: Long? = null,
    val deleted: Boolean = false,
    val deletedForUserIds: Set<String> = emptySet(),
    val deliveryStatus: MessageDeliveryStatus = MessageDeliveryStatus.Delivered
)

data class MessageLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double,
    val capturedAtMillis: Long,
    val provider: String? = null
)

data class MessageAttachment(
    val url: String,
    val originalName: String,
    val mimeType: String?,
    val sizeBytes: Long?,
    val durationMs: Long? = null,
    val thumbnailUrl: String? = null
)

enum class MessageType {
    Text,
    Image,
    Video,
    Audio,
    Voice,
    VideoNote,
    Location,
    File,
    System
}

enum class MessageDeliveryStatus {
    Sent,
    Delivered,
    Read
}
