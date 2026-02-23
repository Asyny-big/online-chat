package ru.govchat.app.ui.screens.main

import android.media.AudioAttributes
import android.media.MediaPlayer

class PlaybackCoordinator {

    private var activeId: String? = null
    private var player: MediaPlayer? = null

    fun activeId(): String? = activeId

    fun toggle(
        messageId: String,
        url: String,
        onActiveChanged: (String?) -> Unit,
        onError: () -> Unit
    ) {
        val current = player
        if (current != null && activeId == messageId) {
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

        stop(onActiveChanged)

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
                activeId = messageId
                onActiveChanged(messageId)
            }
            created.setOnCompletionListener { mp ->
                runCatching { mp.seekTo(0) }
                activeId = null
                onActiveChanged(null)
            }
            created.setOnErrorListener { _, _, _ ->
                release()
                onActiveChanged(null)
                onError()
                true
            }
            created.prepareAsync()
            player = created
        }.onFailure {
            runCatching { created.release() }
            onError()
        }
    }

    fun stop(onActiveChanged: (String?) -> Unit = {}) {
        runCatching { player?.stop() }
        runCatching { player?.release() }
        player = null
        activeId = null
        onActiveChanged(null)
    }

    fun release() {
        stop()
    }
}

