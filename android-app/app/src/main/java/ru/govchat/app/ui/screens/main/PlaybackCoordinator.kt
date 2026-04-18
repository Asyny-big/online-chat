package ru.govchat.app.ui.screens.main

import android.content.Context
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.govchat.app.core.media.MediaCacheManager

data class AudioPlaybackUiState(
    val activeMessageId: String? = null,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val errorMessageId: String? = null,
    val errorMessage: String? = null
)

class PlaybackCoordinator(
    context: Context
) {

    private val audioPlayer: ExoPlayer = MediaCacheManager.createPlayer(context.applicationContext).apply {
        playWhenReady = false
        repeatMode = Player.REPEAT_MODE_OFF
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutableUiState = MutableStateFlow(AudioPlaybackUiState())

    private var activeAudioId: String? = null
    private var currentUrl: String? = null
    private var activeChangedCallback: ((String?) -> Unit)? = null
    private var errorCallback: (() -> Unit)? = null
    private var progressJob: Job? = null

    val uiState: StateFlow<AudioPlaybackUiState> = mutableUiState.asStateFlow()

    init {
        audioPlayer.addListener(
            object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    syncUiState()
                    updateProgressJob()
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) {
                        runCatching { audioPlayer.seekTo(0L) }
                        runCatching { audioPlayer.pause() }
                        clearActivePlayback(notifyActiveCleared = true)
                    } else {
                        syncUiState()
                    }
                    updateProgressJob()
                }

                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    val failedMessageId = activeAudioId
                    clearActivePlayback(notifyActiveCleared = true)
                    runCatching { audioPlayer.stop() }
                    runCatching { audioPlayer.clearMediaItems() }
                    currentUrl = null
                    mutableUiState.value = mutableUiState.value.copy(
                        activeMessageId = null,
                        isPlaying = false,
                        isBuffering = false,
                        positionMs = 0L,
                        durationMs = 0L,
                        errorMessageId = failedMessageId,
                        errorMessage = error.message ?: "Не удалось воспроизвести аудио"
                    )
                    updateProgressJob()
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
                syncUiState()
                updateProgressJob()
                onActiveChanged(messageId)
            } else {
                runCatching { audioPlayer.play() }
                    .onSuccess {
                        syncUiState()
                        updateProgressJob()
                        onActiveChanged(messageId)
                    }
                    .onFailure {
                        clearPlayer()
                        onError()
                    }
            }
            return
        }

        runCatching { audioPlayer.pause() }
        mutableUiState.value = mutableUiState.value.copy(
            errorMessageId = null,
            errorMessage = null
        )
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
            .onSuccess {
                syncUiState()
                updateProgressJob()
                onActiveChanged(messageId)
            }
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
        progressJob?.cancel()
        scope.cancel()
        runCatching { audioPlayer.release() }
    }

    private fun clearPlayer() {
        clearActivePlayback()
        runCatching { audioPlayer.stop() }
        runCatching { audioPlayer.clearMediaItems() }
        runCatching { audioPlayer.seekTo(0L) }
        currentUrl = null
        syncUiState()
        updateProgressJob()
    }

    private fun clearActivePlayback(notifyActiveCleared: Boolean = false) {
        if (audioPlayer.playbackState != Player.STATE_IDLE) {
            runCatching { audioPlayer.pause() }
        }
        activeAudioId = null
        syncUiState()
        if (notifyActiveCleared) {
            activeChangedCallback?.invoke(null)
        }
    }

    private fun syncUiState() {
        val activeId = activeAudioId
        val durationMs = audioPlayer.duration.takeIf { it > 0L } ?: 0L
        val positionMs = audioPlayer.currentPosition.takeIf { it >= 0L } ?: 0L
        mutableUiState.value = mutableUiState.value.copy(
            activeMessageId = activeId,
            isPlaying = activeId != null && audioPlayer.isPlaying,
            isBuffering = activeId != null && audioPlayer.playbackState == Player.STATE_BUFFERING,
            positionMs = if (activeId != null) positionMs else 0L,
            durationMs = if (activeId != null) durationMs else 0L
        )
    }

    private fun updateProgressJob() {
        val shouldTick = activeAudioId != null && (
            audioPlayer.isPlaying ||
                audioPlayer.playbackState == Player.STATE_BUFFERING ||
                audioPlayer.playbackState == Player.STATE_READY
            )
        if (!shouldTick) {
            progressJob?.cancel()
            progressJob = null
            return
        }
        if (progressJob?.isActive == true) return

        progressJob = scope.launch {
            while (true) {
                syncUiState()
                delay(250L)
            }
        }
    }
}
