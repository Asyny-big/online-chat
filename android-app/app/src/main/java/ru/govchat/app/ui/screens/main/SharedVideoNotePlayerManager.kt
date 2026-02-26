package ru.govchat.app.ui.screens.main

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import ru.govchat.app.core.media.MediaCacheManager

internal enum class VideoNotePlaybackState {
    Idle,
    InlineMuted,
    ExpandedWithSound
}

internal class SharedVideoNotePlayerManager(
    context: Context
) {
    private val appContext = context.applicationContext
    private val player: ExoPlayer = MediaCacheManager.createPlayer(appContext).apply {
        repeatMode = Player.REPEAT_MODE_ONE
        playWhenReady = false
        volume = 0f
    }

    private var currentMediaUrl: String? = null
    private var attachedPlayerView: PlayerView? = null
    var activeMessageId: String? by mutableStateOf(null)
        private set
    var playbackState: VideoNotePlaybackState by mutableStateOf(VideoNotePlaybackState.Idle)
        private set

    fun playInline(messageId: String, mediaUrl: String) {
        if (
            activeMessageId == messageId &&
            currentMediaUrl == mediaUrl &&
            playbackState == VideoNotePlaybackState.InlineMuted
        ) {
            if (player.volume != 0f) player.volume = 0f
            if (!player.playWhenReady) player.playWhenReady = true
            if (!player.isPlaying) runCatching { player.play() }
            return
        }
        ensureMedia(mediaUrl)
        activeMessageId = messageId
        playbackState = VideoNotePlaybackState.InlineMuted
        player.volume = 0f
        player.playWhenReady = true
        runCatching { player.play() }
    }

    fun playExpanded(messageId: String, mediaUrl: String) {
        if (
            activeMessageId == messageId &&
            currentMediaUrl == mediaUrl &&
            playbackState == VideoNotePlaybackState.ExpandedWithSound
        ) {
            if (player.volume != 1f) player.volume = 1f
            if (!player.playWhenReady) player.playWhenReady = true
            if (!player.isPlaying) runCatching { player.play() }
            return
        }
        ensureMedia(mediaUrl)
        activeMessageId = messageId
        playbackState = VideoNotePlaybackState.ExpandedWithSound
        player.volume = 1f
        player.playWhenReady = true
        runCatching { player.play() }
    }

    fun bindInline(playerView: PlayerView) {
        bind(
            playerView = playerView,
            useController = false,
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        )
    }

    fun bindExpanded(playerView: PlayerView) {
        bind(
            playerView = playerView,
            useController = false,
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        )
    }

    fun unbind(playerView: PlayerView) {
        if (attachedPlayerView === playerView) {
            attachedPlayerView = null
        }
        if (playerView.player === player) {
            playerView.player = null
        }
    }

    fun enterIdle(resetToStart: Boolean) {
        activeMessageId = null
        playbackState = VideoNotePlaybackState.Idle
        player.volume = 0f
        runCatching { player.pause() }
        player.playWhenReady = false
        if (resetToStart) {
            runCatching { player.seekTo(0L) }
        }
    }

    fun release() {
        activeMessageId = null
        playbackState = VideoNotePlaybackState.Idle
        attachedPlayerView?.player = null
        attachedPlayerView = null
        runCatching { player.pause() }
        runCatching { player.stop() }
        runCatching { player.clearMediaItems() }
        runCatching { player.release() }
        currentMediaUrl = null
    }

    private fun bind(
        playerView: PlayerView,
        useController: Boolean,
        resizeMode: Int
    ) {
        if (attachedPlayerView !== playerView) {
            attachedPlayerView?.player = null
            attachedPlayerView = playerView
        }
        playerView.useController = useController
        playerView.resizeMode = resizeMode
        if (playerView.player !== player) {
            playerView.player = player
        }
    }

    private fun ensureMedia(mediaUrl: String) {
        if (currentMediaUrl == mediaUrl) return
        currentMediaUrl = mediaUrl
        player.setMediaItem(MediaCacheManager.mediaItem(mediaUrl))
        player.prepare()
    }
}
