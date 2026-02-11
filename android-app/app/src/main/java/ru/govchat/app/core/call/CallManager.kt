package ru.govchat.app.core.call

import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.WebRtcConfig

class CallManager(
    appContext: Context,
    private val webRtcController: GovChatWebRtcController = GovChatWebRtcController(
        appContext = appContext.applicationContext
    )
) {

    private val mutableState = MutableStateFlow(CallUiState())
    val state: StateFlow<CallUiState> = mutableState.asStateFlow()

    private var boundToScope = false

    fun bind(scope: CoroutineScope) {
        if (boundToScope) return
        boundToScope = true
        scope.launch {
            webRtcController.state.collect { media ->
                mutableState.update { current ->
                    val controls = current.controls.copy(
                        isMicrophoneEnabled = media.isMicrophoneEnabled,
                        isCameraEnabled = media.isCameraEnabled,
                        isUsingFrontCamera = media.isUsingFrontCamera,
                        canSwitchCamera = media.canSwitchCamera,
                        isScreenShareSupported = media.isScreenShareSupported,
                        isScreenSharing = media.isScreenSharing
                    )
                    current.copy(
                        localVideoTrack = media.localVideoTrack,
                        remoteVideoTrack = media.remoteVideoTrack,
                        eglContext = media.eglContext,
                        connectionState = media.connectionState,
                        controls = controls,
                        phase = resolvePhase(
                            inCall = current.inCall,
                            currentPhase = current.phase,
                            connectionState = media.connectionState
                        )
                    )
                }
            }
        }
    }

    suspend fun startWebRtcSession(
        callId: String,
        isInitiator: Boolean,
        isVideo: Boolean,
        config: WebRtcConfig,
        remoteUserId: String?,
        onSignal: (targetUserId: String, signal: CallSignalPayload) -> Unit
    ) {
        mutableState.update {
            it.copy(
                inCall = true,
                isVideoCall = isVideo,
                phase = if (isInitiator) CallUiPhase.Outgoing else CallUiPhase.Connecting,
                isControlsVisible = true,
                isMinimized = false,
                statusMessage = null,
                controls = it.controls.copy(
                    isMicrophoneEnabled = true,
                    isCameraEnabled = isVideo,
                    isScreenShareSupported = false,
                    isScreenSharing = false
                )
            )
        }
        webRtcController.startSession(
            callId = callId,
            isInitiator = isInitiator,
            isVideo = isVideo,
            config = config,
            remoteUserId = remoteUserId,
            onSignal = onSignal
        )
    }

    fun markGroupCallActive(type: String) {
        mutableState.update {
            it.copy(
                inCall = true,
                isVideoCall = type == "video",
                phase = CallUiPhase.Active,
                isControlsVisible = true,
                isMinimized = false,
                statusMessage = null,
                controls = it.controls.copy(
                    isMicrophoneEnabled = true,
                    isCameraEnabled = type == "video",
                    canSwitchCamera = false,
                    isScreenShareSupported = false,
                    isScreenSharing = false
                )
            )
        }
    }

    suspend fun onParticipantJoined(userId: String) {
        webRtcController.onParticipantJoined(userId)
    }

    suspend fun onSignal(fromUserId: String, signal: CallSignalPayload) {
        webRtcController.onSignal(fromUserId = fromUserId, signal = signal)
    }

    fun setControlsVisible(visible: Boolean) {
        mutableState.update { it.copy(isControlsVisible = visible) }
    }

    fun toggleMinimized() {
        mutableState.update { current ->
            current.copy(
                isMinimized = !current.isMinimized,
                isControlsVisible = if (current.isMinimized) true else current.isControlsVisible
            )
        }
    }

    fun expandFromFloating() {
        mutableState.update { it.copy(isMinimized = false, isControlsVisible = true) }
    }

    fun toggleMicrophone(): Result<Unit> {
        val currentEnabled = mutableState.value.controls.isMicrophoneEnabled
        val nextEnabled = !currentEnabled
        val applied = webRtcController.setMicrophoneEnabled(nextEnabled)
        if (!applied) {
            return Result.failure(IllegalStateException("РњРёРєСЂРѕС„РѕРЅ РЅРµРґРѕСЃС‚СѓРїРµРЅ"))
        }
        mutableState.update {
            it.copy(
                controls = it.controls.copy(isMicrophoneEnabled = nextEnabled),
                statusMessage = null
            )
        }
        return Result.success(Unit)
    }

    fun toggleCamera(): Result<Unit> {
        val currentEnabled = mutableState.value.controls.isCameraEnabled
        val nextEnabled = !currentEnabled
        val applied = webRtcController.setCameraEnabled(nextEnabled)
        if (!applied) {
            return Result.failure(IllegalStateException("РљР°РјРµСЂР° РЅРµРґРѕСЃС‚СѓРїРЅР°"))
        }
        mutableState.update {
            it.copy(
                controls = it.controls.copy(isCameraEnabled = nextEnabled),
                statusMessage = null
            )
        }
        return Result.success(Unit)
    }

    suspend fun switchCamera(): Result<Unit> {
        val result = webRtcController.switchCamera()
        return result.fold(
            onSuccess = { isFront ->
                mutableState.update {
                    it.copy(
                        controls = it.controls.copy(isUsingFrontCamera = isFront),
                        statusMessage = null
                    )
                }
                Result.success(Unit)
            },
            onFailure = { error ->
                Result.failure(error)
            }
        )
    }

    fun startScreenShare(resultCode: Int, permissionData: Intent?): Result<Unit> {
        val result = webRtcController.startScreenShare(
            resultCode = resultCode,
            permissionData = permissionData
        )
        result.onSuccess {
            mutableState.update {
                it.copy(
                    controls = it.controls.copy(isScreenSharing = true),
                    statusMessage = null
                )
            }
        }.onFailure { error ->
            mutableState.update {
                it.copy(statusMessage = error.message ?: "Не удалось включить демонстрацию экрана")
            }
        }
        return result
    }

    fun stopScreenShare(): Result<Unit> {
        val result = webRtcController.stopScreenShare()
        result.onSuccess {
            mutableState.update {
                it.copy(
                    controls = it.controls.copy(isScreenSharing = false),
                    statusMessage = null
                )
            }
        }.onFailure { error ->
            mutableState.update {
                it.copy(statusMessage = error.message ?: "Не удалось отключить демонстрацию экрана")
            }
        }
        return result
    }

    fun clearStatusMessage() {
        mutableState.update { it.copy(statusMessage = null) }
    }

    fun forceReset() {
        mutableState.value = CallUiState()
    }

    suspend fun close() {
        webRtcController.close()
        mutableState.value = CallUiState()
    }

    private fun resolvePhase(
        inCall: Boolean,
        currentPhase: CallUiPhase,
        connectionState: String
    ): CallUiPhase {
        if (!inCall) return CallUiPhase.Idle
        return when (connectionState.uppercase()) {
            "CONNECTED" -> CallUiPhase.Active
            "CONNECTING", "CHECKING", "NEW" -> {
                if (currentPhase == CallUiPhase.Outgoing) {
                    CallUiPhase.Outgoing
                } else {
                    CallUiPhase.Connecting
                }
            }

            "DISCONNECTED" -> CallUiPhase.Reconnecting
            "FAILED" -> CallUiPhase.PoorNetwork
            "CLOSED" -> CallUiPhase.Ended
            else -> currentPhase
        }
    }
}

