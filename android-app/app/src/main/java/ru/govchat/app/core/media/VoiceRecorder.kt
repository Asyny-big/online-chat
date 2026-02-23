package ru.govchat.app.core.media

import android.content.Context
import android.media.MediaRecorder
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
        val file = File(cacheDir, "voice_${System.currentTimeMillis()}.m4a")
        reachedMaxDuration = false

        return runCatching {
            val recorder = createRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
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
        }.recoverCatching { error ->
            file.delete()
            releaseInternal()
            throw error
        }
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

    companion object {
        const val DEFAULT_MAX_DURATION_MS = 2 * 60 * 1000
        private const val AUDIO_BITRATE = 128_000
        private const val AUDIO_SAMPLE_RATE = 44_100
    }
}

data class VoiceRecordingResult(
    val file: File,
    val durationMs: Long,
    val reachedMaxDuration: Boolean
)
