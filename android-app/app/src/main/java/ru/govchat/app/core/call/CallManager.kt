package ru.govchat.app.core.call

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import io.livekit.android.ConnectOptions
import io.livekit.android.LiveKit
import io.livekit.android.events.collect as collectEvents
import io.livekit.android.events.RoomEvent
import io.livekit.android.room.Room
import io.livekit.android.room.track.CameraPosition
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.TrackPublication
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import io.livekit.android.room.track.VideoTrack as LiveKitVideoTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.WebRtcConfig

class CallManager(
    appContext: Context,
    private val webRtcController: GovChatWebRtcController = GovChatWebRtcController(
        appContext = appContext.applicationContext
    )
) {
    private val liveKitController: InternalLiveKitController = InternalLiveKitController(
        appContext = appContext.applicationContext
    )

    private enum class MediaEngine {
        None,
        WebRtc,
        LiveKit
    }

    private val mutableState = MutableStateFlow(CallUiState())
    val state: StateFlow<CallUiState> = mutableState.asStateFlow()

    private var boundToScope = false
    private var mediaEngine: MediaEngine = MediaEngine.None
    private val pendingWebRtcParticipantJoins = LinkedHashSet<String>()

    fun bind(scope: CoroutineScope) {
        if (boundToScope) return
        boundToScope = true
        webRtcController.state
            .onEach { media ->
                if (mediaEngine != MediaEngine.WebRtc) return@onEach
                applyMediaState(media)
            }
            .launchIn(scope)

        liveKitController.state
            .onEach { media ->
                if (mediaEngine != MediaEngine.LiveKit) return@onEach
                applyMediaState(media)
            }
            .launchIn(scope)
    }

    suspend fun startWebRtcSession(
        callId: String,
        isInitiator: Boolean,
        isVideo: Boolean,
        config: WebRtcConfig,
        remoteUserId: String?,
        onSignal: (targetUserId: String, signal: CallSignalPayload) -> Unit
    ) {
        if (mediaEngine == MediaEngine.LiveKit) {
            liveKitController.close()
        }
        mediaEngine = MediaEngine.WebRtc

        mutableState.update {
            it.copy(
                inCall = true,
                isVideoCall = isVideo,
                phase = if (isInitiator) CallUiPhase.Outgoing else CallUiPhase.Connecting,
                isControlsVisible = true,
                isMinimized = false,
                localVideoTrack = null,
                remoteVideoTrack = null,
                remoteVideoTracks = emptyList(),
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
        flushPendingWebRtcParticipantJoins()
    }

    suspend fun startLiveKitGroupSession(
        liveKitUrl: String,
        token: String,
        isVideo: Boolean
    ) {
        if (mediaEngine == MediaEngine.WebRtc) {
            webRtcController.close()
        }
        mediaEngine = MediaEngine.LiveKit
        pendingWebRtcParticipantJoins.clear()

        mutableState.update {
            it.copy(
                inCall = true,
                isVideoCall = isVideo,
                phase = CallUiPhase.Connecting,
                isControlsVisible = true,
                isMinimized = false,
                localVideoTrack = null,
                remoteVideoTrack = null,
                remoteVideoTracks = emptyList(),
                statusMessage = null,
                controls = it.controls.copy(
                    isMicrophoneEnabled = true,
                    isCameraEnabled = isVideo,
                    isUsingFrontCamera = true,
                    canSwitchCamera = isVideo,
                    isScreenShareSupported = isVideo && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP,
                    isScreenSharing = false
                )
            )
        }

        liveKitController.startSession(
            liveKitUrl = liveKitUrl,
            token = token,
            isVideo = isVideo
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
                    canSwitchCamera = type == "video",
                    isScreenShareSupported = type == "video" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP,
                    isScreenSharing = false
                )
            )
        }
    }

    suspend fun onParticipantJoined(userId: String) {
        if (userId.isBlank()) return
        if (mediaEngine != MediaEngine.WebRtc) {
            pendingWebRtcParticipantJoins += userId
            return
        }
        webRtcController.onParticipantJoined(userId)
    }

    suspend fun onSignal(fromUserId: String, signal: CallSignalPayload) {
        if (mediaEngine != MediaEngine.WebRtc) return
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

    suspend fun toggleMicrophone(): Result<Unit> {
        val currentEnabled = mutableState.value.controls.isMicrophoneEnabled
        val nextEnabled = !currentEnabled
        val applied = when (mediaEngine) {
            MediaEngine.WebRtc -> webRtcController.setMicrophoneEnabled(nextEnabled)
            MediaEngine.LiveKit -> liveKitController.setMicrophoneEnabled(nextEnabled)
            MediaEngine.None -> false
        }
        if (!applied) {
            return Result.failure(IllegalStateException("Microphone is unavailable"))
        }
        mutableState.update {
            it.copy(
                controls = it.controls.copy(isMicrophoneEnabled = nextEnabled),
                statusMessage = null
            )
        }
        return Result.success(Unit)
    }

    suspend fun toggleCamera(): Result<Unit> {
        val currentEnabled = mutableState.value.controls.isCameraEnabled
        val nextEnabled = !currentEnabled
        val applied = when (mediaEngine) {
            MediaEngine.WebRtc -> webRtcController.setCameraEnabled(nextEnabled)
            MediaEngine.LiveKit -> liveKitController.setCameraEnabled(nextEnabled)
            MediaEngine.None -> false
        }
        if (!applied) {
            return Result.failure(IllegalStateException("Camera is unavailable"))
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
        val result = when (mediaEngine) {
            MediaEngine.WebRtc -> webRtcController.switchCamera()
            MediaEngine.LiveKit -> liveKitController.switchCamera()
            MediaEngine.None -> Result.failure(IllegalStateException("Camera switch is unavailable"))
        }
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

    suspend fun startScreenShare(resultCode: Int, permissionData: Intent?): Result<Unit> {
        if (resultCode != Activity.RESULT_OK || permissionData == null) {
            val error = IllegalStateException("Screen sharing permission was not granted")
            mutableState.update { it.copy(statusMessage = error.message) }
            return Result.failure(error)
        }
        val result = when (mediaEngine) {
            MediaEngine.WebRtc -> webRtcController.startScreenShare(
                resultCode = resultCode,
                permissionData = permissionData
            )
            MediaEngine.LiveKit -> {
                if (liveKitController.setScreenShareEnabled(enabled = true, permissionData = permissionData)) {
                    Result.success(Unit)
                } else {
                    Result.failure(IllegalStateException("Screen share is unavailable"))
                }
            }
            MediaEngine.None -> Result.failure(IllegalStateException("Screen share is unavailable"))
        }
        result.onSuccess {
            mutableState.update {
                it.copy(
                    controls = it.controls.copy(isScreenSharing = true),
                    statusMessage = null
                )
            }
        }.onFailure { error ->
            mutableState.update {
                it.copy(statusMessage = error.message ?: "Failed to start screen share")
            }
        }
        return result
    }

    suspend fun stopScreenShare(): Result<Unit> {
        val result = when (mediaEngine) {
            MediaEngine.WebRtc -> webRtcController.stopScreenShare()
            MediaEngine.LiveKit -> {
                if (liveKitController.setScreenShareEnabled(enabled = false, permissionData = null)) {
                    Result.success(Unit)
                } else {
                    Result.failure(IllegalStateException("Screen share is unavailable"))
                }
            }
            MediaEngine.None -> Result.failure(IllegalStateException("Screen share is unavailable"))
        }
        result.onSuccess {
            mutableState.update {
                it.copy(
                    controls = it.controls.copy(isScreenSharing = false),
                    statusMessage = null
                )
            }
        }.onFailure { error ->
            mutableState.update {
                it.copy(statusMessage = error.message ?: "Failed to stop screen share")
            }
        }
        return result
    }

    fun clearStatusMessage() {
        mutableState.update { it.copy(statusMessage = null) }
    }

    fun forceReset() {
        pendingWebRtcParticipantJoins.clear()
        mutableState.value = CallUiState()
    }

    suspend fun close() {
        when (mediaEngine) {
            MediaEngine.WebRtc -> webRtcController.close()
            MediaEngine.LiveKit -> liveKitController.close()
            MediaEngine.None -> Unit
        }
        mediaEngine = MediaEngine.None
        pendingWebRtcParticipantJoins.clear()
        mutableState.value = CallUiState()
    }

    private suspend fun flushPendingWebRtcParticipantJoins() {
        if (mediaEngine != MediaEngine.WebRtc) return
        if (pendingWebRtcParticipantJoins.isEmpty()) return
        val queued = pendingWebRtcParticipantJoins.toList()
        pendingWebRtcParticipantJoins.clear()
        queued.forEach { participantId ->
            webRtcController.onParticipantJoined(participantId)
        }
    }

    private fun applyMediaState(media: CallMediaState) {
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
                remoteVideoTracks = media.remoteVideoTracks,
                eglContext = media.eglContext,
                liveKitRoom = media.liveKitRoom,
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

private class InternalLiveKitController(
    appContext: Context
) {
    companion object {
        private const val TAG = "InternalLiveKitCtrl"
    }

    private val applicationContext: Context = appContext.applicationContext
    private val mutableState = MutableStateFlow(CallMediaState())
    val state: StateFlow<CallMediaState> = mutableState.asStateFlow()

    private val eventsScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private var room: Room? = null
    private var eventsJob: Job? = null
    private var isVideoSession: Boolean = false

    suspend fun startSession(
        liveKitUrl: String,
        token: String,
        isVideo: Boolean
    ) = withContext(Dispatchers.Main.immediate) {
        closeInternal()

        isVideoSession = isVideo
        val canScreenShare = isVideo && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP

        val nextRoom = LiveKit.create(applicationContext)
        room = nextRoom

        mutableState.value = CallMediaState(
            connectionState = "CONNECTING",
            isMicrophoneEnabled = true,
            isCameraEnabled = isVideo,
            isUsingFrontCamera = true,
            canSwitchCamera = isVideo,
            isScreenShareSupported = canScreenShare,
            isScreenSharing = false,
            localVideoTrack = null,
            remoteVideoTrack = null,
            remoteVideoTracks = emptyList(),
            liveKitRoom = nextRoom
        )

        eventsJob = eventsScope.launch {
            nextRoom.events.collectEvents { event ->
                handleRoomEvent(event)
            }
        }

        try {
            nextRoom.connect(
                url = liveKitUrl,
                token = token,
                options = ConnectOptions(autoSubscribe = true)
            )

            nextRoom.localParticipant.setMicrophoneEnabled(true)
            if (isVideo) {
                nextRoom.localParticipant.setCameraEnabled(true)
            }
            mutableState.update { current ->
                current.copy(
                    connectionState = "CONNECTED",
                    isMicrophoneEnabled = true,
                    isCameraEnabled = isVideo,
                    isUsingFrontCamera = true,
                    canSwitchCamera = isVideo,
                    isScreenShareSupported = canScreenShare,
                    isScreenSharing = false,
                    liveKitRoom = nextRoom
                )
            }
            refreshTracks(
                reason = "startSession.connect",
                activeRoom = nextRoom
            )
        } catch (error: Throwable) {
            closeInternal()
            throw error
        }
    }

    suspend fun setMicrophoneEnabled(enabled: Boolean): Boolean = withContext(Dispatchers.Main.immediate) {
        val activeRoom = room ?: return@withContext false
        try {
            activeRoom.localParticipant.setMicrophoneEnabled(enabled)
            mutableState.update { it.copy(isMicrophoneEnabled = enabled) }
            true
        } catch (_: Throwable) {
            false
        }
    }

    suspend fun setCameraEnabled(enabled: Boolean): Boolean = withContext(Dispatchers.Main.immediate) {
        val activeRoom = room ?: return@withContext false
        if (!isVideoSession) return@withContext false
        try {
            activeRoom.localParticipant.setCameraEnabled(enabled)
            mutableState.update {
                it.copy(
                    isCameraEnabled = enabled
                )
            }
            refreshTracks(
                reason = "setCameraEnabled:$enabled",
                activeRoom = activeRoom
            )
            true
        } catch (_: Throwable) {
            false
        }
    }

    suspend fun switchCamera(): Result<Boolean> = withContext(Dispatchers.Main.immediate) {
        val activeRoom = room ?: return@withContext Result.failure(
            IllegalStateException("Camera switch is unavailable")
        )
        if (!isVideoSession) {
            return@withContext Result.failure(IllegalStateException("Camera switch is unavailable"))
        }

        val publication = activeRoom.localParticipant.getTrackPublication(Track.Source.CAMERA)
        val localTrack = publication?.track as? LocalVideoTrack
            ?: return@withContext Result.failure(IllegalStateException("Local camera track is unavailable"))
        val targetPosition = if (mutableState.value.isUsingFrontCamera) {
            CameraPosition.BACK
        } else {
            CameraPosition.FRONT
        }

        return@withContext runCatching {
            localTrack.switchCamera(position = targetPosition)
            val isFront = targetPosition == CameraPosition.FRONT
            mutableState.update {
                it.copy(
                    isUsingFrontCamera = isFront,
                    canSwitchCamera = true
                )
            }
            refreshTracks(
                reason = "switchCamera:$targetPosition",
                activeRoom = activeRoom
            )
            isFront
        }
    }

    suspend fun setScreenShareEnabled(enabled: Boolean, permissionData: Intent?): Boolean =
        withContext(Dispatchers.Main.immediate) {
            val activeRoom = room ?: return@withContext false
            if (!isVideoSession) return@withContext false
            if (enabled && permissionData == null) return@withContext false
            val canScreenShare = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
            if (!canScreenShare) return@withContext false
            return@withContext try {
                if (enabled) {
                    activeRoom.localParticipant.setScreenShareEnabled(
                        enabled = true,
                        screenCaptureParams = ScreenCaptureParams(
                            mediaProjectionPermissionResultData = permissionData!!,
                            onStop = {
                                eventsScope.launch {
                                    val roomNow = room ?: return@launch
                                    mutableState.update { it.copy(isScreenSharing = false) }
                                    refreshTracks(
                                        reason = "screenShare.onStop",
                                        activeRoom = roomNow
                                    )
                                }
                            }
                        )
                    )
                } else {
                    activeRoom.localParticipant.setScreenShareEnabled(enabled = false)
                }
                mutableState.update {
                    it.copy(
                        isScreenShareSupported = true,
                        isScreenSharing = enabled
                    )
                }
                refreshTracks(
                    reason = "setScreenShareEnabled:$enabled",
                    activeRoom = activeRoom
                )
                true
            } catch (error: Throwable) {
                Log.w(TAG, "setScreenShareEnabled failed enabled=$enabled", error)
                false
            }
        }

    suspend fun close() = withContext(Dispatchers.Main.immediate) {
        closeInternal()
    }

    private fun handleRoomEvent(event: RoomEvent) {
        when (event) {
            is RoomEvent.Connected -> {
                val activeRoom = room ?: return
                mutableState.update {
                    it.copy(
                        connectionState = "CONNECTED",
                        liveKitRoom = activeRoom
                    )
                }
                refreshTracks(
                    reason = "event.Connected",
                    activeRoom = activeRoom
                )
            }

            is RoomEvent.Reconnecting -> {
                mutableState.update { it.copy(connectionState = "DISCONNECTED") }
            }

            is RoomEvent.Reconnected -> {
                val activeRoom = room ?: return
                mutableState.update {
                    it.copy(
                        connectionState = "CONNECTED",
                        liveKitRoom = activeRoom
                    )
                }
                refreshTracks(
                    reason = "event.Reconnected",
                    activeRoom = activeRoom
                )
            }

            is RoomEvent.Disconnected -> {
                mutableState.update {
                    it.copy(
                        connectionState = "CLOSED",
                        localVideoTrack = null,
                        remoteVideoTrack = null,
                        remoteVideoTracks = emptyList()
                    )
                }
            }

            is RoomEvent.FailedToConnect -> {
                mutableState.update { it.copy(connectionState = "FAILED") }
            }

            is RoomEvent.TrackSubscribed -> {
                val activeRoom = room ?: return
                val fallbackTrack = (event.track as? LiveKitVideoTrack)?.let { CallVideoTrack.LiveKit(it) }
                refreshTracks(
                    reason = "event.TrackSubscribed",
                    activeRoom = activeRoom,
                    fallbackRemoteTrack = fallbackTrack
                )
            }

            is RoomEvent.TrackUnsubscribed,
            is RoomEvent.TrackPublished,
            is RoomEvent.TrackUnpublished,
            is RoomEvent.TrackMuted,
            is RoomEvent.TrackUnmuted,
            is RoomEvent.ParticipantConnected,
            is RoomEvent.ParticipantDisconnected -> {
                val activeRoom = room ?: return
                refreshTracks(
                    reason = "event.${event.javaClass.simpleName}",
                    activeRoom = activeRoom
                )
            }

            else -> Unit
        }
    }

    private fun refreshTracks(
        reason: String,
        activeRoom: Room,
        fallbackRemoteTrack: CallVideoTrack.LiveKit? = null
    ) {
        val localTrack = if (isVideoSession) resolveLocalVideoTrack(activeRoom) else null
        val remoteTracks = resolveRemoteVideoTracks(activeRoom).toMutableList()
        if (remoteTracks.isEmpty() && fallbackRemoteTrack != null) {
            remoteTracks += fallbackRemoteTrack
        }
        Log.d(
            TAG,
            "refreshTracks reason=$reason local=${localTrack != null} remote=${remoteTracks.size} participants=${activeRoom.remoteParticipants.size}"
        )
        if (activeRoom.remoteParticipants.isNotEmpty() && remoteTracks.isEmpty()) {
            Log.w(
                TAG,
                "refreshTracks: remote participants exist but no remote video tracks (reason=$reason)"
            )
        }
        mutableState.update {
            it.copy(
                localVideoTrack = localTrack,
                remoteVideoTrack = remoteTracks.firstOrNull(),
                remoteVideoTracks = remoteTracks,
                liveKitRoom = activeRoom
            )
        }
    }

    private fun resolveLocalVideoTrack(room: Room): CallVideoTrack.LiveKit? {
        for (publication in extractTrackPublications(room.localParticipant.videoTrackPublications)) {
            if (publication.muted) continue
            val track = publication.track as? LiveKitVideoTrack ?: continue
            return CallVideoTrack.LiveKit(track)
        }
        return null
    }

    private fun resolveRemoteVideoTracks(room: Room): List<CallVideoTrack.LiveKit> {
        val tracks = mutableListOf<CallVideoTrack.LiveKit>()
        val seen = HashSet<Int>()
        room.remoteParticipants.values.forEach { participant ->
            for (publication in extractTrackPublications(participant.videoTrackPublications)) {
                if (publication.muted) continue
                val track = publication.track as? LiveKitVideoTrack ?: continue
                if (seen.add(System.identityHashCode(track))) {
                    tracks += CallVideoTrack.LiveKit(track)
                }
            }
        }
        return tracks
    }

    private fun extractTrackPublications(publications: Any?): List<TrackPublication> {
        return when (publications) {
            null -> emptyList()
            is TrackPublication -> listOf(publications)
            is Pair<*, *> -> listOfNotNull(
                publications.first as? TrackPublication,
                publications.second as? TrackPublication
            )
            is Map<*, *> -> publications.values.flatMap { extractTrackPublications(it) }
            is Iterable<*> -> publications.flatMap { extractTrackPublications(it) }
            is Array<*> -> publications.flatMap { extractTrackPublications(it) }
            else -> {
                Log.w(
                    TAG,
                    "Unsupported track publications container: ${publications.javaClass.name}"
                )
                emptyList()
            }
        }.distinctBy { it.sid }
    }

    private fun closeInternal() {
        eventsJob?.cancel()
        eventsJob = null

        runCatching { room?.disconnect() }
        room = null
        isVideoSession = false

        mutableState.value = CallMediaState()
    }
}
