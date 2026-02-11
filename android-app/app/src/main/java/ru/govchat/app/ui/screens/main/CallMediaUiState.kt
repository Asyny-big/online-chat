package ru.govchat.app.ui.screens.main

import org.webrtc.EglBase
import org.webrtc.VideoTrack

data class CallMediaUiState(
    val localVideoTrack: VideoTrack? = null,
    val remoteVideoTrack: VideoTrack? = null,
    val connectionState: String = "NEW",
    val eglContext: EglBase.Context? = null
)
