package ru.govchat.app.core.media

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

class VoiceRecorder(
    private val appContext: Context
) {

    private var mediaRecorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startedAtMs: Long = 0L
    private var reachedMaxDuration: Boolean = false

    @Synchronized
    fun start(maxDurationMs: Int = DEFAULT_MAX_DURATION_MS): Result<Unit> {
        if (mediaRecorder != null) {
            return Result.failure(IllegalStateException("Voice recorder is already running"))
        }

        val cacheDir = File(appContext.cacheDir, "recordings/voice").apply { mkdirs() }
        reachedMaxDuration = false

        val formats = buildPreferredFormats()
        var lastError: Throwable? = null

        formats.forEach { format ->
            val file = File(cacheDir, "voice_${System.currentTimeMillis()}.${format.extension}")
            val result = runCatching {
                val recorder = createRecorder().apply {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                    setOutputFormat(format.outputFormat)
                    setAudioEncoder(format.audioEncoder)
                    setAudioEncodingBitRate(AUDIO_BITRATE)
                    setAudioSamplingRate(AUDIO_SAMPLE_RATE)
                    setOutputFile(file.absolutePath)
                    setMaxDuration(maxDurationMs)
                    setOnInfoListener { _, what, _ ->
                        if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                            reachedMaxDuration = true
                        }
                    }
                    prepare()
                    start()
                }
                mediaRecorder = recorder
                outputFile = file
                startedAtMs = System.currentTimeMillis()
            }

            if (result.isSuccess) {
                return Result.success(Unit)
            }

            file.delete()
            releaseInternal()
            lastError = result.exceptionOrNull()
        }

        return Result.failure(
            lastError ?: IllegalStateException("Voice recorder format initialization failed")
        )
    }

    @Synchronized
    fun stop(): Result<VoiceRecordingResult> {
        val recorder = mediaRecorder
            ?: return Result.failure(IllegalStateException("Voice recorder is not running"))
        val file = outputFile
            ?: return Result.failure(IllegalStateException("Voice recorder output file is missing"))

        return runCatching {
            recorder.stop()
            val duration = (System.currentTimeMillis() - startedAtMs).coerceAtLeast(0L)
            VoiceRecordingResult(
                file = file,
                durationMs = duration,
                reachedMaxDuration = reachedMaxDuration
            )
        }.recoverCatching { error ->
            file.delete()
            throw error
        }.also {
            releaseInternal()
        }
    }

    @Synchronized
    fun cancel() {
        outputFile?.delete()
        releaseInternal()
    }

    @Synchronized
    fun isRecording(): Boolean = mediaRecorder != null

    @Synchronized
    private fun releaseInternal() {
        runCatching { mediaRecorder?.reset() }
        runCatching { mediaRecorder?.release() }
        mediaRecorder = null
        outputFile = null
        startedAtMs = 0L
        reachedMaxDuration = false
    }

    @Suppress("DEPRECATION")
    private fun createRecorder(): MediaRecorder {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            MediaRecorder(appContext)
        } else {
            MediaRecorder()
        }
    }

    private fun buildPreferredFormats(): List<RecordingFormat> {
        val formats = mutableListOf<RecordingFormat>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            formats += RecordingFormat(
                extension = "webm",
                outputFormat = MediaRecorder.OutputFormat.WEBM,
                audioEncoder = MediaRecorder.AudioEncoder.OPUS
            )
        }
        formats += RecordingFormat(
            extension = "m4a",
            outputFormat = MediaRecorder.OutputFormat.MPEG_4,
            audioEncoder = MediaRecorder.AudioEncoder.AAC
        )
        return formats
    }

    companion object {
        const val DEFAULT_MAX_DURATION_MS = 2 * 60 * 1000
        private const val AUDIO_BITRATE = 128_000
        private const val AUDIO_SAMPLE_RATE = 44_100
    }
}

private data class RecordingFormat(
    val extension: String,
    val outputFormat: Int,
    val audioEncoder: Int
)

data class VoiceRecordingResult(
    val file: File,
    val durationMs: Long,
    val reachedMaxDuration: Boolean
)
