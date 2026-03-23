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
    val isSpeakerphoneEnabled: Boolean = false,
    val canToggleSpeakerphone: Boolean = false,
    val currentAudioRoute: CallAudioRoute? = null,
    val availableAudioRoutes: List<CallAudioRoute> = emptyList(),
    val canSelectAudioRoute: Boolean = false,
    val isUsingFrontCamera: Boolean = true,
    val canSwitchCamera: Boolean = false,
    val isScreenShareSupported: Boolean = false,
    val isScreenSharing: Boolean = false
)

data class RemoteControlRequestUi(
    val sessionId: String,
    val requestedByUserId: String
)

data class RemoteControlUiState(
    val enabled: Boolean = false,
    val accessibilityEnabled: Boolean = false,
    val canRequest: Boolean = false,
    val sessionId: String? = null,
    val controllerUserId: String? = null,
    val targetUserId: String? = null,
    val isActive: Boolean = false,
    val isViewOnly: Boolean = false,
    val pendingRequest: RemoteControlRequestUi? = null,
    val expiresAtMillis: Long? = null,
    val screenWidth: Int = 0,
    val screenHeight: Int = 0,
    val rotation: Int = 0,
    val statusMessage: String? = null
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
    val statusMessage: String? = null,
    val remoteControl: RemoteControlUiState = RemoteControlUiState()
)
