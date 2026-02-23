package ru.govchat.app.ui.screens.main

import android.app.Activity
import android.content.ContextWrapper
import android.net.Uri
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Cached
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import ru.govchat.app.core.media.VideoRecorder
import ru.govchat.app.core.media.VoiceRecorder

@Composable
fun MessageInput(
    draft: String,
    onDraftChanged: (String) -> Unit,
    onSendText: (String) -> Unit,
    onOpenAttachmentPicker: () -> Unit,
    recordingMode: RecordingMode,
    recordingState: RecordingState,
    recordingElapsedSeconds: Int,
    recordingCommands: Flow<RecordingCommand>,
    failedRecordingUpload: FailedRecordingUploadUi?,
    onToggleRecordingMode: () -> Unit,
    onRecordingStarted: (RecordingMode) -> Long?,
    onRecordingLocked: () -> Unit,
    onRecordingCancelled: () -> Unit,
    onRecordingFinished: (Long, Uri, Long) -> Unit,
    onCancelUpload: () -> Unit,
    onRetryFailedRecordingUpload: () -> Unit,
    onDismissFailedRecordingUpload: () -> Unit,
    ensureVoicePermission: (onGranted: () -> Unit) -> Unit,
    ensureVideoPermission: (onGranted: () -> Unit) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val voiceRecorder = remember(context.applicationContext) { VoiceRecorder(context.applicationContext) }
    val videoRecorder = remember(context.applicationContext) { VideoRecorder(context.applicationContext) }
    val previewView = remember(context.applicationContext) {
        PreviewView(context).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }

    var suppressTap by remember { mutableStateOf(false) }
    var longPressArmed by remember { mutableStateOf(false) }
    var dragDx by remember { mutableStateOf(0f) }
    var dragDy by remember { mutableStateOf(0f) }
    var lockGestureHandled by remember { mutableStateOf(false) }
    var cancelGestureHandled by remember { mutableStateOf(false) }
    var activeSessionId by remember { mutableStateOf<Long?>(null) }

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val isRecording = recordingState == RecordingState.Recording || recordingState == RecordingState.Locked
    val isLocked = recordingState == RecordingState.Locked
    val isUploading = recordingState == RecordingState.Uploading
    val latestRecordingState by rememberUpdatedState(recordingState)

    fun resetGestureState() {
        longPressArmed = false
        dragDx = 0f
        dragDy = 0f
        lockGestureHandled = false
        cancelGestureHandled = false
    }

    fun clearSession() {
        activeSessionId = null
    }

    fun stopVoiceAndSend() {
        voiceRecorder.stop()
            .onSuccess { result ->
                val sessionId = activeSessionId
                if (sessionId != null) {
                    onRecordingFinished(sessionId, Uri.fromFile(result.file), result.durationMs)
                } else {
                    onRecordingCancelled()
                }
                clearSession()
                resetGestureState()
            }
            .onFailure {
                onRecordingCancelled()
                clearSession()
                resetGestureState()
            }
    }

    fun stopVideoAndSend() {
        scope.launch {
            videoRecorder.stopAndAwaitFinalize()
            resetGestureState()
        }
    }

    fun cancelRecording() {
        when (recordingMode) {
            RecordingMode.Voice -> voiceRecorder.cancel()
            RecordingMode.Video -> videoRecorder.cancelRecording()
            RecordingMode.None -> Unit
        }
        onRecordingCancelled()
        clearSession()
        resetGestureState()
    }

    fun startVoiceRecording() {
        if (isRecording || isUploading) return
        ensureVoicePermission {
            if (!longPressArmed) return@ensureVoicePermission
            voiceRecorder.start()
                .onSuccess {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    val sessionId = onRecordingStarted(RecordingMode.Voice)
                    if (sessionId == null) {
                        voiceRecorder.cancel()
                        onRecordingCancelled()
                        resetGestureState()
                        return@onSuccess
                    }
                    activeSessionId = sessionId
                    suppressTap = true
                }
                .onFailure {
                    onRecordingCancelled()
                    clearSession()
                    resetGestureState()
                }
        }
    }

    fun startVideoRecording() {
        if (isRecording || isUploading) return
        ensureVideoPermission {
            if (!longPressArmed) return@ensureVideoPermission
            scope.launch {
                videoRecorder.bindToPreview(
                    lifecycleOwner = lifecycleOwner,
                    previewView = previewView
                ).onFailure {
                    onRecordingCancelled()
                    resetGestureState()
                    return@launch
                }

                videoRecorder.startRecording(maxDurationMs = VIDEO_MAX_DURATION_MS) { result ->
                    result.onSuccess { recording ->
                        val sessionId = activeSessionId
                        if (sessionId != null) {
                            onRecordingFinished(
                                sessionId,
                                Uri.fromFile(recording.file),
                                recording.durationMs
                            )
                        } else {
                            onRecordingCancelled()
                        }
                        clearSession()
                    }.onFailure {
                        onRecordingCancelled()
                        clearSession()
                    }
                }.onSuccess {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    val sessionId = onRecordingStarted(RecordingMode.Video)
                    if (sessionId == null) {
                        videoRecorder.cancelRecording()
                        onRecordingCancelled()
                        resetGestureState()
                        return@onSuccess
                    }
                    activeSessionId = sessionId
                    suppressTap = true
                }.onFailure {
                    onRecordingCancelled()
                    clearSession()
                    resetGestureState()
                }
            }
        }
    }

    fun startRecordingFromCurrentMode() {
        when (recordingMode) {
            RecordingMode.Voice -> startVoiceRecording()
            RecordingMode.Video -> startVideoRecording()
            RecordingMode.None -> Unit
        }
    }

    val lifecycleStopHandler by rememberUpdatedState {
        if (!isRecording) return@rememberUpdatedState
        val isChangingConfig = context.findActivity()?.isChangingConfigurations == true
        if (isChangingConfig) {
            cancelRecording()
            return@rememberUpdatedState
        }
        when (recordingMode) {
            RecordingMode.Voice -> stopVoiceAndSend()
            RecordingMode.Video -> stopVideoAndSend()
            RecordingMode.None -> Unit
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                lifecycleStopHandler()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            voiceRecorder.cancel()
            clearSession()
            videoRecorder.release()
        }
    }

    LaunchedEffect(recordingCommands) {
        recordingCommands.collectLatest { command ->
            when (command) {
                RecordingCommand.StopAndSend -> {
                    when (recordingMode) {
                        RecordingMode.Voice -> stopVoiceAndSend()
                        RecordingMode.Video -> stopVideoAndSend()
                        RecordingMode.None -> Unit
                    }
                }

                RecordingCommand.Cancel -> {
                    cancelRecording()
                }
            }
        }
    }

    LaunchedEffect(isPressed, draft, recordingState, recordingMode) {
        if (isPressed && draft.isBlank() && recordingState == RecordingState.Idle) {
            delay(HOLD_TO_RECORD_DELAY_MS)
            if (isPressed) {
                longPressArmed = true
                startRecordingFromCurrentMode()
            }
            return@LaunchedEffect
        }

        if (!isPressed && longPressArmed) {
            if (recordingState == RecordingState.Recording && !cancelGestureHandled) {
                when (recordingMode) {
                    RecordingMode.Voice -> stopVoiceAndSend()
                    RecordingMode.Video -> stopVideoAndSend()
                    RecordingMode.None -> Unit
                }
            }
            resetGestureState()
        }
    }

    LaunchedEffect(recordingState, recordingMode, recordingElapsedSeconds) {
        if (recordingState != RecordingState.Recording && recordingState != RecordingState.Locked) return@LaunchedEffect

        when (recordingMode) {
            RecordingMode.Voice -> if (recordingElapsedSeconds >= VOICE_MAX_DURATION_SEC) stopVoiceAndSend()
            RecordingMode.Video -> if (recordingElapsedSeconds >= VIDEO_MAX_DURATION_SEC) stopVideoAndSend()
            RecordingMode.None -> Unit
        }
    }

    val pulseTransition = rememberInfiniteTransition(label = "recordPulse")
    val recordDotAlpha by pulseTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(700),
            repeatMode = RepeatMode.Reverse
        ),
        label = "recordDotAlpha"
    )

    val actionButtonScale by animateFloatAsState(
        targetValue = when {
            isPressed -> 1.18f
            isRecording -> 1.12f
            else -> 1f
        },
        animationSpec = tween(150),
        label = "actionButtonScale"
    )

    Column(modifier = modifier.fillMaxWidth()) {
        failedRecordingUpload?.let { failed ->
            Surface(
                color = Color(0xFF2B1F1F),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = failed.errorMessage,
                        color = Color(0xFFFFC4C4),
                        modifier = Modifier.weight(1f)
                    )
                    Button(onClick = onRetryFailedRecordingUpload) {
                        Text("Повторить")
                    }
                    Icon(
                        imageVector = Icons.Filled.Close,
                        contentDescription = "Скрыть",
                        tint = Color(0xFFFFC4C4),
                        modifier = Modifier
                            .size(20.dp)
                            .clickable { onDismissFailedRecordingUpload() }
                    )
                }
            }
        }

        AnimatedVisibility(
            visible = isRecording || isUploading,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Surface(
                color = Color(0xFF1F2C39),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (isRecording) {
                        Icon(
                            imageVector = Icons.Filled.FiberManualRecord,
                            contentDescription = null,
                            tint = Color(0xFFFF4D4D).copy(alpha = recordDotAlpha),
                            modifier = Modifier.size(12.dp)
                        )
                    }

                    Text(
                        text = formatRecordingTime(recordingElapsedSeconds),
                        color = Color.White
                    )

                    Text(
                        text = when {
                            isUploading -> "Загрузка записи..."
                            isLocked -> "Запись зафиксирована"
                            else -> "Свайп влево для отмены, вверх для фиксации"
                        },
                        color = Color(0xFF9FB4C8),
                        modifier = Modifier.weight(1f)
                    )

                    if (isUploading) {
                        IconButton(onClick = onCancelUpload) {
                            Icon(
                                imageVector = Icons.Filled.Close,
                                contentDescription = "Отменить загрузку",
                                tint = Color(0xFFFFC4C4)
                            )
                        }
                    }

                    if (recordingMode == RecordingMode.Video && isRecording) {
                        Box(
                            modifier = Modifier
                                .size(66.dp)
                                .clip(CircleShape)
                                .background(Color.Black)
                        ) {
                            AndroidView(
                                factory = { previewView },
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                            )
                        }

                    }

                    if (isLocked) {
                        IconButton(onClick = {
                            when (recordingMode) {
                                RecordingMode.Voice -> stopVoiceAndSend()
                                RecordingMode.Video -> stopVideoAndSend()
                                RecordingMode.None -> Unit
                            }
                        }) {
                            Icon(
                                imageVector = Icons.Filled.Stop,
                                contentDescription = "Остановить",
                                tint = Color(0xFFFF6B6B)
                            )
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 6.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onOpenAttachmentPicker,
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.AttachFile,
                    contentDescription = "Прикрепить",
                    tint = Color(0xFF8296AC),
                    modifier = Modifier.size(22.dp)
                )
            }

            TextField(
                value = draft,
                onValueChange = onDraftChanged,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 4.dp),
                placeholder = {
                    Text("Сообщение", color = Color(0xFF6B7D8E))
                },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFF242F3D),
                    unfocusedContainerColor = Color(0xFF242F3D),
                    cursorColor = Color(0xFF5EB5F7),
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                shape = RoundedCornerShape(24.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(
                    onSend = {
                        if (draft.isNotBlank()) {
                            onSendText(draft)
                        }
                    }
                )
            )

            if (draft.isNotBlank()) {
                IconButton(
                    onClick = { onSendText(draft) },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Отправить",
                        tint = Color(0xFF5EB5F7),
                        modifier = Modifier.size(22.dp)
                    )
                }
            } else {
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .graphicsLayer {
                            scaleX = actionButtonScale
                            scaleY = actionButtonScale
                        }
                        .clip(CircleShape)
                        .background(Color(0xFF2B5278))
                        .clickable(
                            interactionSource = interactionSource,
                            indication = null,
                            onClick = {
                                if (suppressTap) {
                                    suppressTap = false
                                } else if (!isRecording && !isUploading) {
                                    onToggleRecordingMode()
                                }
                            }
                        )
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDrag = { change, dragAmount ->
                                    if (latestRecordingState != RecordingState.Recording) return@detectDragGestures
                                    change.consume()
                                    dragDx += dragAmount.x
                                    dragDy += dragAmount.y

                                    if (!lockGestureHandled && dragDy < -LOCK_THRESHOLD_PX) {
                                        lockGestureHandled = true
                                        onRecordingLocked()
                                    }

                                    if (!cancelGestureHandled && !lockGestureHandled && dragDx < -CANCEL_THRESHOLD_PX) {
                                        cancelGestureHandled = true
                                        cancelRecording()
                                    }
                                },
                                onDragEnd = {
                                    dragDx = 0f
                                    dragDy = 0f
                                },
                                onDragCancel = {
                                    dragDx = 0f
                                    dragDy = 0f
                                }
                            )
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (recordingMode == RecordingMode.Video) Icons.Filled.Videocam else Icons.Filled.Mic,
                        contentDescription = if (recordingMode == RecordingMode.Video) "Видео-кружок" else "Голосовое сообщение",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }

        if (recordingState == RecordingState.Recording) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.Cached,
                    contentDescription = null,
                    tint = Color(0xFF9FB4C8),
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.size(6.dp))
                Text(
                    text = if (recordingMode == RecordingMode.Video) {
                        "Свайп влево для отмены, вверх для lock"
                    } else {
                        "Свайп влево для отмены"
                    },
                    color = Color(0xFF7F95AB)
                )
                Spacer(modifier = Modifier.weight(1f))
                Icon(
                    imageVector = Icons.Filled.Lock,
                    contentDescription = null,
                    tint = if (lockGestureHandled) Color(0xFF5EB5F7) else Color(0xFF7F95AB),
                    modifier = Modifier.size(15.dp)
                )
            }
        }
    }
}

private fun formatRecordingTime(totalSeconds: Int): String {
    val safe = totalSeconds.coerceAtLeast(0)
    val minutes = safe / 60
    val seconds = safe % 60
    return "%02d:%02d".format(minutes, seconds)
}

private tailrec fun android.content.Context.findActivity(): Activity? {
    return when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
}

private const val HOLD_TO_RECORD_DELAY_MS = 180L
private const val LOCK_THRESHOLD_PX = 90f
private const val CANCEL_THRESHOLD_PX = 120f
private const val VOICE_MAX_DURATION_SEC = 120
private const val VIDEO_MAX_DURATION_SEC = 60
private const val VIDEO_MAX_DURATION_MS = 60_000L
