package ru.govchat.app.core.media

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class VideoRecorder(
    private val appContext: Context
) {

    private var cameraProvider: ProcessCameraProvider? = null
    private var preview: Preview? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var outputFile: File? = null
    private var startedAtMs: Long = 0L
    private var isCancelled: Boolean = false
    private var stoppedByLimit: Boolean = false
    private var lensFacing: Int = CameraSelector.LENS_FACING_FRONT
    private var recorderState: RecorderState = RecorderState.Unbound
    private var finalizeDeferred: CompletableDeferred<Unit>? = null
    private var boundPreviewView: PreviewView? = null
    private var boundLifecycleOwner: LifecycleOwner? = null

    suspend fun bindToPreview(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView
    ): Result<Unit> {
        if (recorderState == RecorderState.Recording) {
            return Result.failure(IllegalStateException("Video recorder is already recording"))
        }

        return runCatching {
            if (
                recorderState == RecorderState.PreviewBound &&
                boundPreviewView === previewView &&
                boundLifecycleOwner === lifecycleOwner
            ) {
                return@runCatching
            }

            val provider = cameraProvider ?: awaitCameraProvider().also { cameraProvider = it }
            val previewUseCase = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }
            val recorder = Recorder.Builder()
                .setQualitySelector(
                    QualitySelector.from(
                        Quality.HD,
                        FallbackStrategy.lowerQualityOrHigherThan(Quality.SD)
                    )
                )
                .build()
            val videoUseCase = VideoCapture.withOutput(recorder)
            val selector = CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build()

            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, selector, previewUseCase, videoUseCase)

            preview = previewUseCase
            videoCapture = videoUseCase
            boundPreviewView = previewView
            boundLifecycleOwner = lifecycleOwner
            recorderState = RecorderState.PreviewBound
        }
    }

    suspend fun switchCamera(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView
    ): Result<Unit> {
        if (isRecording()) {
            return Result.failure(IllegalStateException("Cannot switch camera while recording"))
        }
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_FRONT) {
            CameraSelector.LENS_FACING_BACK
        } else {
            CameraSelector.LENS_FACING_FRONT
        }
        return bindToPreview(lifecycleOwner, previewView)
    }

    fun startRecording(
        maxDurationMs: Long = DEFAULT_MAX_DURATION_MS,
        onResult: (Result<VideoRecordingResult>) -> Unit
    ): Result<Unit> {
        if (activeRecording != null || recorderState == RecorderState.Recording) {
            return Result.failure(IllegalStateException("Video recorder is already running"))
        }
        val capture = videoCapture
            ?: return Result.failure(IllegalStateException("Video recorder is not bound"))

        val targetFile = File(
            File(appContext.cacheDir, "recordings/video_note").apply { mkdirs() },
            "video_note_${System.currentTimeMillis()}.mp4"
        )
        outputFile = targetFile
        isCancelled = false
        stoppedByLimit = false
        finalizeDeferred = CompletableDeferred()
        recorderState = RecorderState.Recording

        val outputOptions = FileOutputOptions.Builder(targetFile).build()
        val executor = ContextCompat.getMainExecutor(appContext)

        return runCatching {
            val pending = capture.output.prepareRecording(appContext, outputOptions).withAudioEnabled()
            activeRecording = pending.start(executor) recordingEvent@{ event ->
                when (event) {
                    is VideoRecordEvent.Start -> {
                        startedAtMs = System.currentTimeMillis()
                    }

                    is VideoRecordEvent.Status -> {
                        val durationMs = event.recordingStats.recordedDurationNanos / NANOS_IN_MILLI
                        if (durationMs >= maxDurationMs && !stoppedByLimit) {
                            stoppedByLimit = true
                            stopRecording()
                        }
                    }

                    is VideoRecordEvent.Finalize -> {
                        val finalizedFile = outputFile
                        activeRecording = null
                        recorderState = RecorderState.Finalized
                        finalizeDeferred?.complete(Unit)

                        if (finalizedFile == null) {
                            unbindCamera()
                            onResult(Result.failure(IllegalStateException("Video recorder output is missing")))
                            return@recordingEvent
                        }

                        if (isCancelled) {
                            finalizedFile.delete()
                            outputFile = null
                            unbindCamera()
                            onResult(Result.failure(IllegalStateException("Video recording cancelled")))
                            return@recordingEvent
                        }

                        if (event.hasError()) {
                            finalizedFile.delete()
                            outputFile = null
                            unbindCamera()
                            onResult(Result.failure(IllegalStateException("Video recorder finalize error: ${event.error}")))
                            return@recordingEvent
                        }

                        val durationFromStats = event.recordingStats.recordedDurationNanos / NANOS_IN_MILLI
                        val durationMs = durationFromStats.takeIf { it > 0L }
                            ?: (System.currentTimeMillis() - startedAtMs).coerceAtLeast(0L)
                        outputFile = null
                        unbindCamera()
                        onResult(
                            Result.success(
                                VideoRecordingResult(
                                    file = finalizedFile,
                                    durationMs = durationMs,
                                    reachedMaxDuration = stoppedByLimit,
                                    lensFacing = lensFacing
                                )
                            )
                        )
                    }
                }
            }
        }.recoverCatching { error ->
            outputFile?.delete()
            outputFile = null
            activeRecording = null
            recorderState = RecorderState.Unbound
            finalizeDeferred?.complete(Unit)
            unbindCamera()
            throw error
        }
    }

    fun stopRecording() {
        activeRecording?.stop()
    }

    suspend fun stopAndAwaitFinalize(timeoutMs: Long = 2_500L) {
        activeRecording?.stop()
        val deferred = finalizeDeferred ?: return
        if (!deferred.isCompleted) {
            withTimeoutOrNull(timeoutMs) { deferred.await() }
        }
    }

    fun cancelRecording() {
        isCancelled = true
        activeRecording?.stop()
    }

    fun isRecording(): Boolean = activeRecording != null

    fun release() {
        runCatching { activeRecording?.stop() }
        activeRecording = null
        if (recorderState != RecorderState.Recording) {
            outputFile = null
        }
        unbindCamera()
        if (recorderState != RecorderState.Recording) {
            recorderState = RecorderState.Unbound
        }
    }

    private fun unbindCamera() {
        cameraProvider?.unbindAll()
        preview = null
        videoCapture = null
        boundPreviewView = null
        boundLifecycleOwner = null
        if (recorderState != RecorderState.Recording) {
            recorderState = RecorderState.Unbound
        }
    }

    private suspend fun awaitCameraProvider(): ProcessCameraProvider {
        return suspendCancellableCoroutine { continuation ->
            val future = ProcessCameraProvider.getInstance(appContext)
            future.addListener(
                {
                    val provider = runCatching { future.get() }.getOrNull()
                    if (provider == null) {
                        continuation.resumeWithException(IllegalStateException("Unable to initialize camera provider"))
                    } else {
                        continuation.resume(provider)
                    }
                },
                ContextCompat.getMainExecutor(appContext)
            )
        }
    }

    private enum class RecorderState {
        Unbound,
        PreviewBound,
        Recording,
        Finalized
    }

    companion object {
        const val DEFAULT_MAX_DURATION_MS: Long = 60_000L
        private const val NANOS_IN_MILLI = 1_000_000L
    }
}

data class VideoRecordingResult(
    val file: File,
    val durationMs: Long,
    val reachedMaxDuration: Boolean,
    val lensFacing: Int
)
