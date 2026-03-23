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
    data class ControlState(
        val enabled: Boolean,
        val accessibilityEnabled: Boolean,
        val canRequest: Boolean,
        val sessionId: String? = null,
        val screenWidth: Int = 0,
        val screenHeight: Int = 0,
        val rotation: Int = 0
    ) : CallSignalPayload
    data class ControlRequest(
        val sessionId: String,
        val requestedBy: String
    ) : CallSignalPayload
    data class ControlGrant(
        val sessionId: String,
        val expiresAt: String,
        val viewOnly: Boolean
    ) : CallSignalPayload
    data class ControlDeny(
        val sessionId: String,
        val reason: String
    ) : CallSignalPayload
    data class ControlStop(
        val sessionId: String,
        val reason: String
    ) : CallSignalPayload
    data class ControlHeartbeat(
        val sessionId: String
    ) : CallSignalPayload
    data class Unknown(val type: String) : CallSignalPayload
}

data class CallControlSessionSummary(
    val sessionId: String,
    val controllerUserId: String,
    val targetUserId: String,
    val state: String,
    val viewOnly: Boolean,
    val grantedAt: String?,
    val requestedAt: String?,
    val expiresAt: String?,
    val lastHeartbeatAt: String?,
    val reconnectGraceUntil: String?
)
