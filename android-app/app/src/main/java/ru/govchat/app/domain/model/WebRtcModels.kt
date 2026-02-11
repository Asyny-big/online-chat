package ru.govchat.app.domain.model

data class WebRtcConfig(
    val iceServers: List<WebRtcIceServer>,
    val iceCandidatePoolSize: Int
)

data class WebRtcIceServer(
    val urls: List<String>,
    val username: String?,
    val credential: String?
)
