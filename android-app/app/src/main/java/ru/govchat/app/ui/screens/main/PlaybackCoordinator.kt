package ru.govchat.app.ui.screens.main

import android.media.AudioAttributes
import android.media.MediaPlayer

class PlaybackCoordinator {

    private var activeAudioId: String? = null
    private var audioPlayer: MediaPlayer? = null

    fun activeId(): String? = activeAudioId

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

    fun stop(onActiveChanged: (String?) -> Unit = {}) {
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
