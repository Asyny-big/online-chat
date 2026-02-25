package ru.govchat.app.core.call

import org.webrtc.EglBase
import io.livekit.android.room.Room

sealed interface CallVideoTrack {
    data class WebRtc(val track: org.webrtc.VideoTrack) : CallVideoTrack
    data class LiveKit(val track: io.livekit.android.room.track.VideoTrack) : CallVideoTrack
}

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
    val localVideoTrack: CallVideoTrack? = null,
    val remoteVideoTrack: CallVideoTrack? = null,
    val remoteVideoTracks: List<CallVideoTrack> = emptyList(),
    val eglContext: EglBase.Context? = null,
    val liveKitRoom: Room? = null,
    val connectionState: String = "NEW",
    val phase: CallUiPhase = CallUiPhase.Idle,
    val controls: CallControlsState = CallControlsState(),
    val inCall: Boolean = false,
    val isVideoCall: Boolean = false,
    val isControlsVisible: Boolean = true,
    val isMinimized: Boolean = false,
    val statusMessage: String? = null
)
