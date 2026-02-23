package ru.govchat.app.domain.model

enum class AttachmentType(val socketValue: String) {
    Image("image"),
    Video("video"),
    Audio("audio"),
    File("file"),
    Voice("voice"),
    VideoNote("video_note")
}

