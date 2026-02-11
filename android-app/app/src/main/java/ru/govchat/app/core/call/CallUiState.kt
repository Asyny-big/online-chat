package ru.govchat.app.core.call

import org.webrtc.EglBase
import org.webrtc.VideoTrack

data class CallControlsState(
    val isMicrophoneEnabled: Boolean = true,
    val isCameraEnabled: Boolean = true,
    val isUsingFrontCamera: Boolean = true,
    val canSwitchCamera: Boolean = false,
    val isScreenShareSupported: Boolean = false,
    val isScreenSharing: Boolean = false
)

enum class CallUiPhase {
    Idle,
    Outgoing,
    Connecting,
    Active,
    Reconnecting,
    PoorNetwork,
    Ended
}

data class CallUiState(
    val localVideoTrack: VideoTrack? = null,
    val remoteVideoTrack: VideoTrack? = null,
    val eglContext: EglBase.Context? = null,
    val connectionState: String = "NEW",
    val phase: CallUiPhase = CallUiPhase.Idle,
    val controls: CallControlsState = CallControlsState(),
    val inCall: Boolean = false,
    val isVideoCall: Boolean = false,
    val isControlsVisible: Boolean = true,
    val isMinimized: Boolean = false,
    val statusMessage: String? = null
)
