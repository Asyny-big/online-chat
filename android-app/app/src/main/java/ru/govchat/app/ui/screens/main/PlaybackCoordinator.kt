package ru.govchat.app.ui.screens.main

import android.media.AudioAttributes
import android.media.MediaPlayer
import androidx.media3.exoplayer.ExoPlayer

class PlaybackCoordinator {

    private var activeAudioId: String? = null
    private var audioPlayer: MediaPlayer? = null
    private var activeVideoId: String? = null
    private var activeVideoPlayer: ExoPlayer? = null

    fun activeId(): String? = activeVideoId ?: activeAudioId
    fun activeVideoId(): String? = activeVideoId

    fun toggle(
        messageId: String,
        url: String,
        onActiveChanged: (String?) -> Unit,
        onError: () -> Unit
    ) {
        val current = audioPlayer
        if (current != null && activeAudioId == messageId) {
            if (current.isPlaying) {
                runCatching { current.pause() }
                onActiveChanged(null)
            } else {
                runCatching { current.start() }
                    .onSuccess { onActiveChanged(messageId) }
                    .onFailure {
                        release()
                        onError()
                    }
            }
            return
        }

        stopActiveVideo(onActiveChanged)
        stopAudio(onActiveChanged)

        val created = MediaPlayer()
        runCatching {
            created.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            created.setDataSource(url)
            created.setOnPreparedListener { mp ->
                mp.start()
                activeAudioId = messageId
                onActiveChanged(messageId)
            }
            created.setOnCompletionListener { mp ->
                runCatching { mp.seekTo(0) }
                activeAudioId = null
                onActiveChanged(null)
            }
            created.setOnErrorListener { _, _, _ ->
                release()
                onActiveChanged(null)
                onError()
                true
            }
            created.prepareAsync()
            audioPlayer = created
        }.onFailure {
            runCatching { created.release() }
            onError()
        }
    }

    fun activateVideo(
        messageId: String,
        player: ExoPlayer,
        onActiveChanged: (String?) -> Unit = {}
    ): Boolean {
        if (activeVideoId == messageId && activeVideoPlayer === player) return true

        stopAudio()
        runCatching {
            activeVideoPlayer?.pause()
            activeVideoPlayer?.seekTo(0L)
        }

        activeVideoId = messageId
        activeVideoPlayer = player
        onActiveChanged(messageId)
        return true
    }

    fun deactivateVideo(
        messageId: String,
        onActiveChanged: (String?) -> Unit = {}
    ) {
        if (activeVideoId != messageId) return
        runCatching {
            activeVideoPlayer?.pause()
            activeVideoPlayer?.seekTo(0L)
        }
        activeVideoId = null
        activeVideoPlayer = null
        onActiveChanged(null)
    }

    fun stopActiveVideo(onActiveChanged: (String?) -> Unit = {}) {
        val activeId = activeVideoId ?: return
        deactivateVideo(activeId, onActiveChanged)
    }

    fun stop(onActiveChanged: (String?) -> Unit = {}) {
        stopActiveVideo()
        stopAudio()
        onActiveChanged(null)
    }

    private fun stopAudio(onActiveChanged: (String?) -> Unit = {}) {
        runCatching { audioPlayer?.stop() }
        runCatching { audioPlayer?.release() }
        audioPlayer = null
        activeAudioId = null
        onActiveChanged(null)
    }

    fun release() {
        stop()
    }
}
