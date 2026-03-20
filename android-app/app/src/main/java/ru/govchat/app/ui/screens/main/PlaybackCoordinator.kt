package ru.govchat.app.ui.screens.main

import android.content.Context
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import ru.govchat.app.core.media.MediaCacheManager

class PlaybackCoordinator(
    context: Context
) {

    private val audioPlayer: ExoPlayer = MediaCacheManager.createPlayer(context.applicationContext).apply {
        playWhenReady = false
        repeatMode = Player.REPEAT_MODE_OFF
    }

    private var activeAudioId: String? = null
    private var currentUrl: String? = null
    private var activeChangedCallback: ((String?) -> Unit)? = null
    private var errorCallback: (() -> Unit)? = null

    init {
        audioPlayer.addListener(
            object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState != Player.STATE_ENDED) return
                    runCatching { audioPlayer.seekTo(0L) }
                    runCatching { audioPlayer.pause() }
                    activeAudioId = null
                    activeChangedCallback?.invoke(null)
                }

                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    clearActivePlayback()
                    runCatching { audioPlayer.stop() }
                    runCatching { audioPlayer.clearMediaItems() }
                    currentUrl = null
                    errorCallback?.invoke()
                }
            }
        )
    }

    fun activeId(): String? = activeAudioId

    fun toggle(
        messageId: String,
        url: String,
        onActiveChanged: (String?) -> Unit,
        onError: () -> Unit
    ) {
        activeChangedCallback = onActiveChanged
        errorCallback = onError

        if (activeAudioId == messageId) {
            if (audioPlayer.isPlaying) {
                runCatching { audioPlayer.pause() }
                onActiveChanged(null)
            } else {
                runCatching { audioPlayer.play() }
                    .onSuccess { onActiveChanged(messageId) }
                    .onFailure {
                        clearPlayer()
                        onError()
                    }
            }
            return
        }

        runCatching { audioPlayer.pause() }
        if (currentUrl != url) {
            runCatching { audioPlayer.stop() }
            audioPlayer.setMediaItem(MediaCacheManager.mediaItem(url))
            audioPlayer.prepare()
            currentUrl = url
        } else if (audioPlayer.playbackState == Player.STATE_ENDED) {
            runCatching { audioPlayer.seekTo(0L) }
        }

        activeAudioId = messageId
        runCatching { audioPlayer.play() }
            .onSuccess { onActiveChanged(messageId) }
            .onFailure {
                clearPlayer()
                onError()
            }
    }

    fun stop(onActiveChanged: (String?) -> Unit = {}) {
        clearPlayer()
        onActiveChanged(null)
    }

    fun release() {
        clearPlayer()
        runCatching { audioPlayer.release() }
    }

    private fun clearPlayer() {
        clearActivePlayback()
        runCatching { audioPlayer.stop() }
        runCatching { audioPlayer.clearMediaItems() }
        runCatching { audioPlayer.seekTo(0L) }
        currentUrl = null
    }

    private fun clearActivePlayback() {
        if (audioPlayer.playbackState != Player.STATE_IDLE) {
            runCatching { audioPlayer.pause() }
        }
        activeAudioId = null
        activeChangedCallback?.invoke(null)
    }
}
