package ru.govchat.app.domain.model

data class ChatMessage(
    val id: String,
    val chatId: String,
    val senderId: String,
    val senderName: String,
    val type: MessageType,
    val text: String,
    val attachment: MessageAttachment?,
    val readByUserIds: Set<String>,
    val createdAtMillis: Long,
    val deliveryStatus: MessageDeliveryStatus = MessageDeliveryStatus.Delivered
)

data class MessageAttachment(
    val url: String,
    val originalName: String,
    val mimeType: String?,
    val sizeBytes: Long?
)

enum class MessageType {
    Text,
    Image,
    Video,
    Audio,
    File,
    System
}

enum class MessageDeliveryStatus {
    Sent,
    Delivered,
    Read
}
