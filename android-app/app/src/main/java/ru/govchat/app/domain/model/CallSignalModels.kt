package ru.govchat.app.domain.model

sealed interface CallSignalPayload {
    data class Offer(val sdp: String) : CallSignalPayload
    data class Answer(val sdp: String) : CallSignalPayload
    data class IceCandidate(
        val candidate: String,
        val sdpMid: String?,
        val sdpMLineIndex: Int
    ) : CallSignalPayload
    data class VideoMode(val mode: String) : CallSignalPayload
    data class Unknown(val type: String) : CallSignalPayload
}
