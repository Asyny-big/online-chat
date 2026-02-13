package ru.govchat.app.core.call

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.projection.MediaProjection
import android.os.Looper
import android.os.Handler
import android.os.Build
import android.app.Activity
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.Camera1Enumerator
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.CapturerObserver
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpSender
import org.webrtc.RtpTransceiver
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.WebRtcConfig
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class GovChatWebRtcController(
    private val appContext: Context
) {

    private val eglBase: EglBase = EglBase.create()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val audioManager: AudioManager? =
        appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val mutableState = MutableStateFlow(CallMediaState(eglContext = eglBase.eglBaseContext))
    val state: StateFlow<CallMediaState> = mutableState.asStateFlow()

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var cameraVideoCapturer: CameraVideoCapturer? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var videoRtpSender: RtpSender? = null

    private var screenCapturer: ScreenCapturerAndroid? = null
    private var screenVideoSource: VideoSource? = null
    private var screenVideoTrack: VideoTrack? = null
    private var screenSurfaceTextureHelper: SurfaceTextureHelper? = null
    private var isStoppingScreenShare = false

    private var callId: String? = null
    private var remoteUserId: String? = null
    private var initiator: Boolean = false
    private var videoEnabled: Boolean = false
    private var microphoneEnabled: Boolean = true
    private var cameraEnabled: Boolean = true
    private var usingFrontCamera: Boolean = true
    private var canSwitchCamera: Boolean = false
    private var hasSentInitialOffer: Boolean = false
    private var isScreenShareSupported: Boolean = false
    private var isScreenSharing: Boolean = false
    private var onSignal: ((String, CallSignalPayload) -> Unit)? = null
    private var lastRemoteVideoTrack: CallVideoTrack.WebRtc? = null
    private var isRemoteVideoDisabledBySignal: Boolean = false

    private var previousAudioMode: Int? = null
    private var previousSpeakerphoneState: Boolean? = null
    private var previousMicrophoneMuteState: Boolean? = null

    private val pendingRemoteCandidates = mutableListOf<IceCandidate>()
    private val pendingOutgoingCandidates = mutableListOf<CallSignalPayload.IceCandidate>()
    private val localStreamIds = listOf(LOCAL_MEDIA_STREAM_ID)

    suspend fun startSession(
        callId: String,
        isInitiator: Boolean,
        isVideo: Boolean,
        config: WebRtcConfig,
        remoteUserId: String?,
        onSignal: (targetUserId: String, signal: CallSignalPayload) -> Unit
    ) = withContext(Dispatchers.Main.immediate) {
        ensureMainThread("startSession:enter")
        logStep("startSession:begin callId=$callId initiator=$isInitiator video=$isVideo")
        logStep("startSession:before closeInternal")
        closeInternal()
        logStep("startSession:before ensureFactory")
        ensureFactory()

        this@GovChatWebRtcController.callId = callId
        this@GovChatWebRtcController.remoteUserId = remoteUserId
        this@GovChatWebRtcController.initiator = isInitiator
        this@GovChatWebRtcController.videoEnabled = isVideo
        this@GovChatWebRtcController.onSignal = onSignal
        this@GovChatWebRtcController.microphoneEnabled = true
        this@GovChatWebRtcController.cameraEnabled = isVideo
        this@GovChatWebRtcController.usingFrontCamera = true
        this@GovChatWebRtcController.canSwitchCamera = false
        this@GovChatWebRtcController.hasSentInitialOffer = false
        this@GovChatWebRtcController.isScreenShareSupported =
            isVideo && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
        this@GovChatWebRtcController.isScreenSharing = false
        this@GovChatWebRtcController.isRemoteVideoDisabledBySignal = false

        val rtcConfig = PeerConnection.RTCConfiguration(config.toIceServerList()).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            iceCandidatePoolSize = config.iceCandidatePoolSize
        }

        logStep("startSession:before createPeerConnection")
        val pc = peerConnectionFactory?.createPeerConnection(rtcConfig, peerObserver)
            ?: throw IllegalStateException("PeerConnectionFactory unavailable")
        peerConnection = pc

        logStep("startSession:before configureAudioForCall")
        configureAudioForCall()
        logStep("startSession:before createLocalMedia")
        createLocalMedia(isVideo = isVideo)

        audioTrack?.setEnabled(microphoneEnabled)
        videoTrack?.setEnabled(cameraEnabled)

        logStep("startSession:before attachLocalTracks")
        attachLocalTracks(peerConnection = pc, isVideo = isVideo)

        mutableState.value = mutableState.value.copy(
            localVideoTrack = videoTrack?.let(CallVideoTrack::WebRtc),
            remoteVideoTrack = null,
            remoteVideoTracks = emptyList(),
            connectionState = "NEW",
            isMicrophoneEnabled = microphoneEnabled,
            isCameraEnabled = cameraEnabled,
            isUsingFrontCamera = usingFrontCamera,
            canSwitchCamera = canSwitchCamera,
            isScreenShareSupported = isScreenShareSupported,
            isScreenSharing = false
        )
        logStep("startSession:ready")
    }

    suspend fun onParticipantJoined(userId: String) = withContext(Dispatchers.Main.immediate) {
        ensureMainThread("onParticipantJoined")
        logStep("onParticipantJoined:userId=$userId")
        if (userId.isBlank()) return@withContext
        val accepted = bindRemoteUserIfNeeded(userId)
        if (!accepted) return@withContext
        if (!initiator) return@withContext

        val pc = peerConnection ?: return@withContext
        if (hasSentInitialOffer) return@withContext
        if (pc.signalingState() != PeerConnection.SignalingState.STABLE) return@withContext
        logStep("onParticipantJoined:before createOffer")
        val offer = pc.createOfferSdp(videoEnabled)
        logStep("onParticipantJoined:before setLocalDescription(offer)")
        pc.setLocalDescriptionSuspend(offer)
        hasSentInitialOffer = true
        logStep("onParticipantJoined:send offer")
        onSignal?.invoke(userId, CallSignalPayload.Offer(offer.description))
    }

    suspend fun onSignal(fromUserId: String, signal: CallSignalPayload) = withContext(Dispatchers.Main.immediate) {
        ensureMainThread("onSignal")
        logStep("onSignal:type=${signal::class.simpleName} from=$fromUserId")
        val pc = peerConnection ?: return@withContext
        if (fromUserId.isNotBlank()) {
            val accepted = bindRemoteUserIfNeeded(fromUserId)
            if (!accepted) {
                logStep("onSignal:ignore foreign sender=$fromUserId active=$remoteUserId")
                return@withContext
            }
        }

        when (signal) {
            is CallSignalPayload.Offer -> {
                if (initiator) return@withContext
                if (pc.signalingState() != PeerConnection.SignalingState.STABLE) return@withContext
                val remote = SessionDescription(SessionDescription.Type.OFFER, signal.sdp)
                logStep("onSignal:before setRemoteDescription(offer)")
                pc.setRemoteDescriptionSuspend(remote)
                flushPendingRemoteCandidates(pc)
                refreshRemoteVideoTrack(peerConnection = pc, reason = "set-remote-offer")

                logStep("onSignal:before createAnswer")
                val answer = pc.createAnswerSdp()
                logStep("onSignal:before setLocalDescription(answer)")
                pc.setLocalDescriptionSuspend(answer)
                val target = remoteUserId ?: fromUserId
                if (target.isNotBlank()) {
                    logStep("onSignal:send answer")
                    onSignal?.invoke(target, CallSignalPayload.Answer(answer.description))
                }
            }

            is CallSignalPayload.Answer -> {
                if (!initiator) return@withContext
                if (pc.localDescription?.type != SessionDescription.Type.OFFER) return@withContext
                val remote = SessionDescription(SessionDescription.Type.ANSWER, signal.sdp)
                logStep("onSignal:before setRemoteDescription(answer)")
                pc.setRemoteDescriptionSuspend(remote)
                flushPendingRemoteCandidates(pc)
                refreshRemoteVideoTrack(peerConnection = pc, reason = "set-remote-answer")
            }

            is CallSignalPayload.IceCandidate -> {
                if (signal.candidate.isBlank()) return@withContext
                val candidate = IceCandidate(
                    signal.sdpMid,
                    signal.sdpMLineIndex,
                    signal.candidate
                )
                if (pc.remoteDescription == null) {
                    pendingRemoteCandidates.add(candidate)
                } else {
                    logStep("onSignal:before addIceCandidate")
                    pc.addIceCandidate(candidate)
                }
            }

            is CallSignalPayload.VideoMode -> {
                val mode = signal.mode.trim().lowercase()
                when (mode) {
                    "camera-off", "off", "disabled", "none" -> {
                        isRemoteVideoDisabledBySignal = true
                        mutableState.value = mutableState.value.copy(
                            remoteVideoTrack = null,
                            remoteVideoTracks = emptyList()
                        )
                    }

                    "camera", "screen" -> {
                        isRemoteVideoDisabledBySignal = false
                        val knownTrack = lastRemoteVideoTrack
                        if (knownTrack != null) {
                            mutableState.value = mutableState.value.copy(
                                remoteVideoTrack = knownTrack,
                                remoteVideoTracks = listOf(knownTrack)
                            )
                        } else {
                            refreshRemoteVideoTrack(peerConnection = pc, reason = "video-mode:$mode")
                        }
                    }
                }
            }
            is CallSignalPayload.Unknown -> Unit
        }
    }

    fun setMicrophoneEnabled(enabled: Boolean): Boolean {
        ensureMainThread("setMicrophoneEnabled")
        val track = audioTrack ?: return false
        microphoneEnabled = enabled
        track.setEnabled(enabled)
        mutableState.value = mutableState.value.copy(isMicrophoneEnabled = enabled)
        return true
    }

    fun setCameraEnabled(enabled: Boolean): Boolean {
        ensureMainThread("setCameraEnabled")
        if (!videoEnabled) return false
        val track = videoTrack ?: return false
        cameraEnabled = enabled
        track.setEnabled(enabled)
        mutableState.value = mutableState.value.copy(isCameraEnabled = enabled)
        val targetUserId = remoteUserId
        if (!targetUserId.isNullOrBlank()) {
            onSignal?.invoke(
                targetUserId,
                CallSignalPayload.VideoMode(if (enabled) "camera" else "camera-off")
            )
        }
        return true
    }

    fun startScreenShare(resultCode: Int, permissionData: Intent?): Result<Unit> {
        if (!isOnMainThread()) {
            logStep("startScreenShare:wrong thread")
            return Result.failure(IllegalStateException("startScreenShare must run on main thread"))
        }
        logStep("startScreenShare:begin")
        if (!videoEnabled) {
            return Result.failure(IllegalStateException("Screen sharing is available only for video calls"))
        }
        if (!isScreenShareSupported) {
            return Result.failure(IllegalStateException("Screen sharing is not supported on this Android version"))
        }
        if (resultCode != Activity.RESULT_OK || permissionData == null) {
            return Result.failure(IllegalStateException("Screen sharing permission was not granted"))
        }
        if (isScreenSharing) {
            return Result.success(Unit)
        }

        val factory = peerConnectionFactory
            ?: return Result.failure(IllegalStateException("PeerConnectionFactory unavailable"))
        val sender = videoRtpSender
            ?: return Result.failure(IllegalStateException("Video sender is unavailable"))

        disposeScreenCapture()

        return runCatching {
            logStep("startScreenShare:before projection callback")
            val projectionCallback = object : MediaProjection.Callback() {
                override fun onStop() {
                    if (!isStoppingScreenShare) {
                        if (isOnMainThread()) {
                            stopScreenShare()
                        } else {
                            mainHandler.post { stopScreenShare() }
                        }
                    }
                }
            }

            val metrics = appContext.resources.displayMetrics
            val width = metrics.widthPixels.coerceAtLeast(640)
            val height = metrics.heightPixels.coerceAtLeast(360)
            val fps = 15

            logStep("startScreenShare:before create ScreenCapturerAndroid")
            screenCapturer = ScreenCapturerAndroid(permissionData, projectionCallback)
            if (screenSurfaceTextureHelper == null) {
                logStep("startScreenShare:before SurfaceTextureHelper.create(screen)")
                screenSurfaceTextureHelper =
                    SurfaceTextureHelper.create("GovChatScreenCapture", eglBase.eglBaseContext)
            }
            logStep("startScreenShare:before createVideoSource(screen)")
            screenVideoSource = factory.createVideoSource(true)
            val observer = screenVideoSource?.capturerObserver
                ?: throw IllegalStateException("Screen capturer observer unavailable")

            logStep("startScreenShare:before capturer.initialize(screen)")
            screenCapturer?.initialize(screenSurfaceTextureHelper, appContext, observer)
            logStep("startScreenShare:before capturer.startCapture(screen)")
            screenCapturer?.startCapture(width, height, fps)

            logStep("startScreenShare:before createVideoTrack(screen)")
            screenVideoTrack = factory.createVideoTrack("ARDAMSs0", screenVideoSource).apply {
                setEnabled(true)
            }

            logStep("startScreenShare:before sender.setTrack(screen)")
            sender.setTrack(screenVideoTrack, false)
            isScreenSharing = true
            mutableState.value = mutableState.value.copy(
                localVideoTrack = screenVideoTrack?.let(CallVideoTrack::WebRtc),
                isScreenSharing = true,
                isScreenShareSupported = isScreenShareSupported
            )
            val targetUserId = remoteUserId
            if (!targetUserId.isNullOrBlank()) {
                onSignal?.invoke(targetUserId, CallSignalPayload.VideoMode("screen"))
            }
        }.onFailure {
            logStep("startScreenShare:failed ${it.message}")
            disposeScreenCapture()
        }.map { Unit }
    }

    fun stopScreenShare(): Result<Unit> {
        if (!isOnMainThread()) {
            logStep("stopScreenShare:wrong thread")
            return Result.failure(IllegalStateException("stopScreenShare must run on main thread"))
        }
        logStep("stopScreenShare:begin")
        if (!isScreenSharing) return Result.success(Unit)
        val sender = videoRtpSender
            ?: return Result.failure(IllegalStateException("Video sender is unavailable"))

        return runCatching {
            isStoppingScreenShare = true
            val restoreCameraTrack = videoTrack?.takeIf { cameraEnabled }
            logStep("stopScreenShare:before sender.setTrack(camera)")
            sender.setTrack(restoreCameraTrack, false)
            disposeScreenCapture()
            isScreenSharing = false
            mutableState.value = mutableState.value.copy(
                localVideoTrack = restoreCameraTrack?.let(CallVideoTrack::WebRtc),
                isCameraEnabled = cameraEnabled,
                isScreenSharing = false,
                isScreenShareSupported = isScreenShareSupported
            )
            val targetUserId = remoteUserId
            if (!targetUserId.isNullOrBlank()) {
                onSignal?.invoke(targetUserId, CallSignalPayload.VideoMode("camera"))
            }
        }.onFailure {
            logStep("stopScreenShare:failed ${it.message}")
            isStoppingScreenShare = false
        }.onSuccess {
            isStoppingScreenShare = false
        }.map { Unit }
    }

    suspend fun switchCamera(): Result<Boolean> = withContext(Dispatchers.Main.immediate) {
        ensureMainThread("switchCamera")
        logStep("switchCamera:begin")
        val capturer = cameraVideoCapturer
            ?: return@withContext Result.failure(IllegalStateException("Camera switch is unavailable"))

        suspendCancellableCoroutine { continuation ->
            capturer.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
                override fun onCameraSwitchDone(isFrontCamera: Boolean) {
                    usingFrontCamera = isFrontCamera
                    mutableState.value = mutableState.value.copy(isUsingFrontCamera = isFrontCamera)
                    if (continuation.isActive) {
                        continuation.resume(Result.success(isFrontCamera))
                    }
                }

                override fun onCameraSwitchError(errorDescription: String?) {
                    if (continuation.isActive) {
                        continuation.resume(
                            Result.failure(
                                IllegalStateException(
                                    errorDescription ?: "Camera switch failed"
                                )
                            )
                        )
                    }
                }
            })
        }
    }

    suspend fun close() = withContext(Dispatchers.Main.immediate) {
        ensureMainThread("close")
        logStep("close:begin")
        closeInternal()
    }

    private fun ensureFactory() {
        ensureMainThread("ensureFactory")
        if (peerConnectionFactory != null) return
        logStep("ensureFactory:before PeerConnectionFactory.initialize")
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext)
                .createInitializationOptions()
        )
        logStep("ensureFactory:before createPeerConnectionFactory")
        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(
                DefaultVideoEncoderFactory(
                    eglBase.eglBaseContext,
                    true,
                    true
                )
            )
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()
    }

    private fun createLocalMedia(isVideo: Boolean) {
        ensureMainThread("createLocalMedia")
        val factory = peerConnectionFactory ?: return

        logStep("createLocalMedia:before createAudioSource")
        audioSource = factory.createAudioSource(MediaConstraints())
        logStep("createLocalMedia:before createAudioTrack")
        audioTrack = factory.createAudioTrack("ARDAMSa0", audioSource)

        if (!isVideo) {
            videoTrack = null
            cameraVideoCapturer = null
            canSwitchCamera = false
            return
        }

        val capturerSetup = createVideoCapturer()
        if (capturerSetup == null) {
            cameraEnabled = false
            videoTrack = null
            cameraVideoCapturer = null
            canSwitchCamera = false
            return
        }

        val capturer = capturerSetup.capturer
        videoCapturer = capturer
        cameraVideoCapturer = capturer
        usingFrontCamera = capturerSetup.isFrontFacing
        canSwitchCamera = true

        if (surfaceTextureHelper == null) {
            logStep("createLocalMedia:before SurfaceTextureHelper.create(camera)")
            surfaceTextureHelper = SurfaceTextureHelper.create("GovChatCapture", eglBase.eglBaseContext)
        }
        logStep("createLocalMedia:before createVideoSource(camera)")
        videoSource = factory.createVideoSource(capturer.isScreencast)
        val observer: CapturerObserver = videoSource!!.capturerObserver
        val captureStarted = runCatching {
            logStep("createLocalMedia:before capturer.initialize(camera)")
            capturer.initialize(surfaceTextureHelper, appContext, observer)
            logStep("createLocalMedia:before capturer.startCapture(camera)")
            capturer.startCapture(720, 1280, 30)
        }.isSuccess
        if (!captureStarted) {
            runCatching { capturer.dispose() }
            videoCapturer = null
            cameraVideoCapturer = null
            videoSource?.dispose()
            videoSource = null
            videoTrack = null
            cameraEnabled = false
            canSwitchCamera = false
            logStep("createLocalMedia:camera capture failed, video disabled")
            return
        }
        logStep("createLocalMedia:before createVideoTrack(camera)")
        videoTrack = factory.createVideoTrack("ARDAMSv0", videoSource)
    }

    private fun attachLocalTracks(peerConnection: PeerConnection, isVideo: Boolean) {
        ensureMainThread("attachLocalTracks")
        videoRtpSender = null
        val transceiverInit = RtpTransceiver.RtpTransceiverInit(
            RtpTransceiver.RtpTransceiverDirection.SEND_RECV,
            localStreamIds
        )
        audioTrack?.let { localAudioTrack ->
            localAudioTrack.setEnabled(microphoneEnabled)
            val addedViaTransceiver = runCatching {
                logStep("attachLocalTracks:before addTransceiver(audio)")
                peerConnection.addTransceiver(localAudioTrack, transceiverInit)
            }.isSuccess
            if (!addedViaTransceiver) {
                logStep("attachLocalTracks:before addTrack(audio)")
                peerConnection.addTrack(localAudioTrack, localStreamIds)
            }
        }

        if (!isVideo) return

        videoTrack?.let { localVideoTrack ->
            localVideoTrack.setEnabled(cameraEnabled)
            val videoSender = runCatching {
                // Prefer addTrack for better browser interoperability in answer flow (P2P web <-> android).
                logStep("attachLocalTracks:before addTrack(video)")
                peerConnection.addTrack(localVideoTrack, localStreamIds)
            }.getOrNull()
            if (videoSender != null) {
                videoRtpSender = videoSender
            } else {
                val videoTransceiver = runCatching {
                    logStep("attachLocalTracks:before addTransceiver(video)")
                    peerConnection.addTransceiver(localVideoTrack, transceiverInit)
                }.getOrNull()
                videoRtpSender = videoTransceiver?.sender
            }
        }
    }

    private val peerObserver = object : PeerConnection.Observer {
        override fun onSignalingChange(newState: PeerConnection.SignalingState?) = Unit

        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
            mainHandler.post {
                val normalized = when (newState) {
                    PeerConnection.IceConnectionState.CONNECTED,
                    PeerConnection.IceConnectionState.COMPLETED -> "CONNECTED"
                    PeerConnection.IceConnectionState.CHECKING -> "CONNECTING"
                    PeerConnection.IceConnectionState.FAILED -> "FAILED"
                    PeerConnection.IceConnectionState.DISCONNECTED -> "DISCONNECTED"
                    PeerConnection.IceConnectionState.CLOSED -> "CLOSED"
                    else -> "NEW"
                }
                mutableState.value = mutableState.value.copy(connectionState = normalized)
                if (normalized == "CONNECTED") {
                    peerConnection?.let { refreshRemoteVideoTrack(peerConnection = it, reason = "ice:$newState") }
                }
            }
        }

        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) = Unit

        override fun onIceCandidate(candidate: IceCandidate?) {
            if (candidate == null) return
            mainHandler.post {
                val signal = CallSignalPayload.IceCandidate(
                    candidate = candidate.sdp,
                    sdpMid = candidate.sdpMid,
                    sdpMLineIndex = candidate.sdpMLineIndex
                )

                val target = remoteUserId
                if (target.isNullOrBlank()) {
                    pendingOutgoingCandidates.add(signal)
                } else {
                    onSignal?.invoke(target, signal)
                }
            }
        }

        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate?>?) = Unit

        override fun onAddStream(stream: MediaStream?) {
            mainHandler.post {
                val remoteTrack = stream?.videoTracks?.firstOrNull()
                if (remoteTrack != null) {
                    val remoteVideoTrack = CallVideoTrack.WebRtc(remoteTrack)
                    lastRemoteVideoTrack = remoteVideoTrack
                    mutableState.value = mutableState.value.copy(
                        remoteVideoTrack = remoteVideoTrack,
                        remoteVideoTracks = listOf(remoteVideoTrack)
                    )
                }
            }
        }

        override fun onRemoveStream(stream: MediaStream?) {
            mainHandler.post {
                if (stream?.videoTracks?.isNotEmpty() != true) {
                    return@post
                }
                mutableState.value = mutableState.value.copy(
                    remoteVideoTrack = null,
                    remoteVideoTracks = emptyList()
                )
                lastRemoteVideoTrack = null
            }
        }

        override fun onDataChannel(dataChannel: DataChannel?) = Unit
        override fun onRenegotiationNeeded() = Unit

        override fun onAddTrack(receiver: RtpReceiver?, mediaStreams: Array<out MediaStream>?) {
            mainHandler.post {
                val track = receiver?.track()
                if (track is VideoTrack) {
                    val remoteTrack = CallVideoTrack.WebRtc(track)
                    lastRemoteVideoTrack = remoteTrack
                    mutableState.value = mutableState.value.copy(
                        remoteVideoTrack = remoteTrack,
                        remoteVideoTracks = listOf(remoteTrack)
                    )
                }
            }
        }

        override fun onTrack(transceiver: RtpTransceiver?) {
            mainHandler.post {
                val track = transceiver?.receiver?.track()
                if (track is VideoTrack) {
                    val remoteTrack = CallVideoTrack.WebRtc(track)
                    lastRemoteVideoTrack = remoteTrack
                    mutableState.value = mutableState.value.copy(
                        remoteVideoTrack = remoteTrack,
                        remoteVideoTracks = listOf(remoteTrack)
                    )
                }
            }
        }

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) = Unit
    }

    private fun createVideoCapturer(): CameraCapturerSetup? {
        ensureMainThread("createVideoCapturer")
        val camera2 = Camera2Enumerator.isSupported(appContext)
        val enumerator = if (camera2) Camera2Enumerator(appContext) else Camera1Enumerator(false)

        val front = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
        if (front != null) {
            val capturer = enumerator.createCapturer(front, null) as? CameraVideoCapturer
            if (capturer != null) {
                return CameraCapturerSetup(capturer = capturer, isFrontFacing = true)
            }
        }

        val back = enumerator.deviceNames.firstOrNull { enumerator.isBackFacing(it) }
        if (back != null) {
            val capturer = enumerator.createCapturer(back, null) as? CameraVideoCapturer
            if (capturer != null) {
                return CameraCapturerSetup(capturer = capturer, isFrontFacing = false)
            }
        }

        return null
    }

    private suspend fun PeerConnection.createOfferSdp(isVideo: Boolean): SessionDescription {
        ensureMainThread("createOfferSdp")
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", isVideo.toString()))
        }
        return suspendCancellableCoroutine { continuation ->
            createOffer(object : SdpObserverAdapter() {
                override fun onCreateSuccess(sdp: SessionDescription?) {
                    if (sdp == null) {
                        continuation.resumeWithException(IllegalStateException("createOffer returned null"))
                    } else {
                        continuation.resume(sdp)
                    }
                }

                override fun onCreateFailure(error: String?) {
                    continuation.resumeWithException(IllegalStateException(error ?: "createOffer failed"))
                }
            }, constraints)
        }
    }

    private suspend fun PeerConnection.createAnswerSdp(): SessionDescription {
        ensureMainThread("createAnswerSdp")
        return suspendCancellableCoroutine { continuation ->
            createAnswer(object : SdpObserverAdapter() {
                override fun onCreateSuccess(sdp: SessionDescription?) {
                    if (sdp == null) {
                        continuation.resumeWithException(IllegalStateException("createAnswer returned null"))
                    } else {
                        continuation.resume(sdp)
                    }
                }

                override fun onCreateFailure(error: String?) {
                    continuation.resumeWithException(IllegalStateException(error ?: "createAnswer failed"))
                }
            }, MediaConstraints())
        }
    }

    private suspend fun PeerConnection.setLocalDescriptionSuspend(sdp: SessionDescription) {
        ensureMainThread("setLocalDescriptionSuspend")
        suspendCancellableCoroutine { continuation ->
            setLocalDescription(object : SdpObserverAdapter() {
                override fun onSetSuccess() {
                    continuation.resume(Unit)
                }

                override fun onSetFailure(error: String?) {
                    continuation.resumeWithException(IllegalStateException(error ?: "setLocalDescription failed"))
                }
            }, sdp)
        }
    }

    private suspend fun PeerConnection.setRemoteDescriptionSuspend(sdp: SessionDescription) {
        ensureMainThread("setRemoteDescriptionSuspend")
        suspendCancellableCoroutine { continuation ->
            setRemoteDescription(object : SdpObserverAdapter() {
                override fun onSetSuccess() {
                    continuation.resume(Unit)
                }

                override fun onSetFailure(error: String?) {
                    continuation.resumeWithException(IllegalStateException(error ?: "setRemoteDescription failed"))
                }
            }, sdp)
        }
    }

    private fun flushPendingRemoteCandidates(peerConnection: PeerConnection) {
        ensureMainThread("flushPendingRemoteCandidates")
        val iterator = pendingRemoteCandidates.iterator()
        while (iterator.hasNext()) {
            logStep("flushPendingRemoteCandidates:before addIceCandidate")
            peerConnection.addIceCandidate(iterator.next())
            iterator.remove()
        }
    }

    private fun flushPendingOutgoingCandidates() {
        ensureMainThread("flushPendingOutgoingCandidates")
        val target = remoteUserId ?: return
        val callback = onSignal ?: return
        val iterator = pendingOutgoingCandidates.iterator()
        while (iterator.hasNext()) {
            callback(target, iterator.next())
            iterator.remove()
        }
    }

    private fun bindRemoteUserIfNeeded(userId: String): Boolean {
        ensureMainThread("bindRemoteUserIfNeeded")
        if (userId.isBlank()) return false
        val current = remoteUserId
        if (current.isNullOrBlank()) {
            remoteUserId = userId
            flushPendingOutgoingCandidates()
            logStep("bindRemoteUserIfNeeded:bound remote=$userId")
            return true
        }
        if (current == userId) {
            return true
        }
        logStep("bindRemoteUserIfNeeded:ignore secondary remote=$userId active=$current")
        return false
    }

    private fun refreshRemoteVideoTrack(peerConnection: PeerConnection, reason: String) {
        ensureMainThread("refreshRemoteVideoTrack:$reason")
        if (isRemoteVideoDisabledBySignal) return

        val existing = mutableState.value.remoteVideoTracks.firstOrNull() ?: mutableState.value.remoteVideoTrack
        if (existing != null) return

        val knownTrack = lastRemoteVideoTrack
        if (knownTrack != null) {
            mutableState.value = mutableState.value.copy(
                remoteVideoTrack = knownTrack,
                remoteVideoTracks = listOf(knownTrack)
            )
            return
        }

        val remoteTrack = peerConnection.findRemoteVideoTrack() ?: return
        val wrapped = CallVideoTrack.WebRtc(remoteTrack)
        lastRemoteVideoTrack = wrapped
        mutableState.value = mutableState.value.copy(
            remoteVideoTrack = wrapped,
            remoteVideoTracks = listOf(wrapped)
        )
        logStep("refreshRemoteVideoTrack:set reason=$reason track=${remoteTrack.id()}")
    }

    private fun PeerConnection.findRemoteVideoTrack(): VideoTrack? {
        transceivers
            .asSequence()
            .mapNotNull { it.receiver?.track() }
            .filterIsInstance<VideoTrack>()
            .firstOrNull()
            ?.let { return it }

        return receivers
            .asSequence()
            .mapNotNull { it.track() }
            .filterIsInstance<VideoTrack>()
            .firstOrNull()
    }

    private fun closeInternal() {
        ensureMainThread("closeInternal")
        logStep("closeInternal:begin")

        // Emit null tracks BEFORE disposing native resources,
        // so Compose removes renderers before tracks become invalid.
        mutableState.value = CallMediaState(eglContext = eglBase.eglBaseContext)

        pendingRemoteCandidates.clear()
        pendingOutgoingCandidates.clear()
        lastRemoteVideoTrack = null
        isRemoteVideoDisabledBySignal = false
        callId = null
        remoteUserId = null
        onSignal = null
        initiator = false
        videoEnabled = false
        microphoneEnabled = true
        cameraEnabled = true
        usingFrontCamera = true
        canSwitchCamera = false
        hasSentInitialOffer = false
        isScreenShareSupported = false
        isScreenSharing = false
        videoRtpSender = null

        peerConnection?.close()
        peerConnection = null

        disposeScreenCapture()

        runCatching { videoCapturer?.stopCapture() }
        videoCapturer?.dispose()
        videoCapturer = null
        cameraVideoCapturer = null

        videoTrack = null
        videoSource?.dispose()
        videoSource = null

        audioTrack = null
        audioSource?.dispose()
        audioSource = null

        restoreAudioForCall()
    }

    private fun disposeScreenCapture() {
        ensureMainThread("disposeScreenCapture")
        runCatching { screenCapturer?.stopCapture() }
        screenCapturer?.dispose()
        screenCapturer = null

        screenVideoTrack = null
        screenVideoSource?.dispose()
        screenVideoSource = null

        // Keep helper instance to avoid EGL/texture churn between share sessions.
    }

    private fun configureAudioForCall() {
        ensureMainThread("configureAudioForCall")
        val manager = audioManager ?: return
        if (previousAudioMode == null) {
            previousAudioMode = manager.mode
            previousSpeakerphoneState = manager.isSpeakerphoneOn
            previousMicrophoneMuteState = manager.isMicrophoneMute
        }

        manager.mode = AudioManager.MODE_IN_COMMUNICATION
        manager.isSpeakerphoneOn = true
        manager.isMicrophoneMute = false
    }

    private fun restoreAudioForCall() {
        ensureMainThread("restoreAudioForCall")
        val manager = audioManager ?: return
        previousAudioMode?.let { manager.mode = it }
        previousSpeakerphoneState?.let { manager.isSpeakerphoneOn = it }
        previousMicrophoneMuteState?.let { manager.isMicrophoneMute = it }
        previousAudioMode = null
        previousSpeakerphoneState = null
        previousMicrophoneMuteState = null
    }

    private fun WebRtcConfig.toIceServerList(): List<PeerConnection.IceServer> {
        val servers = mutableListOf<PeerConnection.IceServer>()
        iceServers.forEach { server ->
            server.urls.forEach { url ->
                val builder = PeerConnection.IceServer.builder(url)
                server.username?.let(builder::setUsername)
                server.credential?.let(builder::setPassword)
                servers.add(builder.createIceServer())
            }
        }
        if (servers.isEmpty()) {
            servers.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
            servers.add(PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer())
        }
        return servers
    }

    private open class SdpObserverAdapter : SdpObserver {
        override fun onCreateSuccess(sdp: SessionDescription?) = Unit
        override fun onSetSuccess() = Unit
        override fun onCreateFailure(error: String?) = Unit
        override fun onSetFailure(error: String?) = Unit
    }

    private data class CameraCapturerSetup(
        val capturer: CameraVideoCapturer,
        val isFrontFacing: Boolean
    )

    private fun logStep(step: String) {
        Log.e(WEBRTC_STEP_TAG, "$step | thread=${Thread.currentThread().name}")
    }

    private fun isOnMainThread(): Boolean {
        return Looper.myLooper() == Looper.getMainLooper()
    }

    private fun ensureMainThread(step: String) {
        if (!isOnMainThread()) {
            Log.e(WEBRTC_STEP_TAG, "wrong_thread at $step | thread=${Thread.currentThread().name}")
            throw IllegalStateException("WebRTC call must run on main thread: $step")
        }
    }

    private companion object {
        private const val LOCAL_MEDIA_STREAM_ID = "govchat-local-stream"
        private const val WEBRTC_STEP_TAG = "WEBRTC_STEP"
    }
}

data class CallMediaState(
    val localVideoTrack: CallVideoTrack? = null,
    val remoteVideoTrack: CallVideoTrack? = null,
    val remoteVideoTracks: List<CallVideoTrack> = emptyList(),
    val connectionState: String = "NEW",
    val eglContext: EglBase.Context? = null,
    val liveKitRoom: io.livekit.android.room.Room? = null,
    val isMicrophoneEnabled: Boolean = true,
    val isCameraEnabled: Boolean = true,
    val isUsingFrontCamera: Boolean = true,
    val canSwitchCamera: Boolean = false,
    val isScreenShareSupported: Boolean = false,
    val isScreenSharing: Boolean = false
)
