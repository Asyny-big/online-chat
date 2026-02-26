package ru.govchat.app.ui.screens.main

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.DisposableEffect
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Cached
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import io.livekit.android.room.participant.RemoteParticipant
import io.livekit.android.room.Room
import io.livekit.android.room.track.Track as LiveKitTrack
import io.livekit.android.room.track.TrackPublication as LiveKitTrackPublication
import io.livekit.android.room.track.VideoTrack as LiveKitMediaVideoTrack
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.size.Precision
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import livekit.org.webrtc.RendererCommon as LiveKitRendererCommon
import livekit.org.webrtc.SurfaceViewRenderer as LiveKitSurfaceViewRenderer
import org.webrtc.EglBase
import org.webrtc.RendererCommon as WebRtcRendererCommon
import org.webrtc.SurfaceViewRenderer as WebRtcSurfaceViewRenderer
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.call.CallControlsState
import ru.govchat.app.core.call.CallUiPhase
import ru.govchat.app.core.call.CallUiState
import ru.govchat.app.core.call.CallVideoTrack
import ru.govchat.app.core.file.GovChatAttachmentDownloader
import ru.govchat.app.core.media.MediaCacheManager
import ru.govchat.app.core.notification.IncomingCallNotifications
import ru.govchat.app.core.permission.GovChatPermissionFeature
import ru.govchat.app.core.permission.rememberGovChatPermissionFlow
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.ChatType
import ru.govchat.app.domain.model.MessageAttachment
import ru.govchat.app.domain.model.MessageDeliveryStatus
import ru.govchat.app.domain.model.MessageType
import ru.govchat.app.domain.model.UserProfile
import ru.govchat.app.service.call.CallForegroundService
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

@Composable
fun MainScreen(
    state: MainUiState,
    recordingElapsedSeconds: Int,
    uploadProgress: Int?,
    recordingCommands: Flow<RecordingCommand>,
    callUiState: CallUiState,
    isInPictureInPictureMode: Boolean,
    onRefresh: () -> Unit,
    onSelectChat: (String) -> Unit,
    onBackFromChat: () -> Unit,
    onSendText: (String) -> Unit,
    onInputChanged: (String) -> Unit,
    onSendAttachment: (Uri) -> Unit,
    onToggleRecordingMode: () -> Unit,
    onRecordingStarted: (RecordingMode) -> Long?,
    onRecordingLocked: () -> Unit,
    onRecordingCancelled: () -> Unit,
    onRecordingFinished: (Long, Uri, Long) -> Unit,
    onCancelUpload: () -> Unit,
    onRetryFailedRecordingUpload: () -> Unit,
    onDismissFailedRecordingUpload: () -> Unit,
    onLoadOlderMessages: () -> Unit,
    onStartCall: (String) -> Unit,
    onStartGroupCall: (String) -> Unit,
    onConfirmJoinExistingGroupCall: () -> Unit,
    onDismissExistingGroupCallPrompt: () -> Unit,
    onAcceptIncomingCall: () -> Unit,
    onDeclineIncomingCall: () -> Unit,
    onLeaveCall: () -> Unit,
    onToggleCallMinimized: () -> Unit,
    onExpandMinimizedCall: () -> Unit,
    onCallSurfaceInteraction: () -> Unit,
    onToggleMicrophone: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onStartScreenShare: (Int, Intent?) -> Unit,
    onStopScreenShare: () -> Unit,
    onClearCallError: () -> Unit,
    onLogout: () -> Unit,
    onSearchUserByPhone: (String) -> Unit,
    onCreateChatWithUser: (String) -> Unit,
    onCreateGroupChat: (String, List<String>) -> Unit,
    onResetUserSearch: () -> Unit,
    onRefreshProfile: () -> Unit
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val permissionFlow = rememberGovChatPermissionFlow()
    val downloader = remember(context.applicationContext) {
        GovChatAttachmentDownloader(context.applicationContext)
    }
    var lastIncomingCallId by remember { mutableStateOf<String?>(null) }
    val permissionPrefs = remember(context.applicationContext) {
        context.applicationContext.getSharedPreferences(
            INITIAL_PERMISSION_PREFS_NAME,
            Context.MODE_PRIVATE
        )
    }
    var initialPermissionRequestTriggered by remember {
        mutableStateOf(permissionPrefs.getBoolean(INITIAL_PERMISSION_PREFS_KEY, false))
    }

    var permissionPrompt by remember { mutableStateOf<PermissionPrompt?>(null) }

    BackHandler(
        enabled =
            state.selectedChat != null &&
                state.activeCall == null &&
                state.incomingCall == null &&
                state.existingGroupCallPrompt == null &&
                permissionPrompt == null &&
                !isInPictureInPictureMode
    ) {
        onBackFromChat()
    }

    DisposableEffect(activity, state.activeCall?.callId) {
        if (state.activeCall != null) {
            activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        onDispose {
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    val requestPermission: (GovChatPermissionFeature, () -> Unit) -> Unit = { feature, onGranted ->
        permissionFlow.request(feature) { result ->
            if (result.granted) {
                onGranted()
            } else {
                permissionPrompt = PermissionPrompt(
                    feature = feature,
                    permanentlyDenied = result.permanentlyDenied,
                    onGranted = onGranted
                )
            }
        }
    }

    val requestPermissionsInOrder: (List<GovChatPermissionFeature>, () -> Unit) -> Unit = { features, onGranted ->
        fun next(index: Int) {
            if (index >= features.size) {
                onGranted()
                return
            }
            requestPermission(features[index]) {
                next(index + 1)
            }
        }
        next(0)
    }

    val requestPermissionsInOrderIgnoringDenial: (List<GovChatPermissionFeature>) -> Unit = { features ->
        fun next(index: Int) {
            if (index >= features.size) return
            permissionFlow.request(features[index]) {
                next(index + 1)
            }
        }
        next(0)
    }

    val requestCallPermissions: (String, () -> Unit) -> Unit = { callType, onGranted ->
        val features = if (callType == "video") {
            listOf(GovChatPermissionFeature.Camera, GovChatPermissionFeature.Microphone)
        } else {
            listOf(GovChatPermissionFeature.Microphone)
        }
        requestPermissionsInOrder(features, onGranted)
    }
    val ensureVoiceRecordingPermission: (() -> Unit) -> Unit = { onGranted ->
        requestPermission(GovChatPermissionFeature.Microphone, onGranted)
    }
    val ensureVideoRecordingPermissions: (() -> Unit) -> Unit = { onGranted ->
        requestPermissionsInOrder(
            listOf(GovChatPermissionFeature.Camera, GovChatPermissionFeature.Microphone),
            onGranted
        )
    }

    val mediaProjectionManager = remember(context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            context.getSystemService(MediaProjectionManager::class.java)
        } else {
            null
        }
    }
    val screenShareScope = rememberCoroutineScope()
    val screenShareLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val activeCall = state.activeCall
        val shouldPrepareMediaProjectionService =
            result.resultCode == Activity.RESULT_OK &&
                result.data != null &&
                activeCall?.type == "video"
        if (shouldPrepareMediaProjectionService && activeCall != null) {
            CallForegroundService.start(
                context = context,
                remoteName = activeCall.chatName,
                callType = activeCall.type,
                isScreenShareActive = true
            )
            // Give the service a short window to switch foreground type to mediaProjection.
            screenShareScope.launch {
                delay(150)
                onStartScreenShare(result.resultCode, result.data)
            }
        } else {
            onStartScreenShare(result.resultCode, result.data)
        }
    }
    val toggleScreenShare: () -> Unit = screenShareToggle@{
        if (callUiState.controls.isScreenSharing) {
            state.activeCall?.let { activeCall ->
                CallForegroundService.start(
                    context = context,
                    remoteName = activeCall.chatName,
                    callType = activeCall.type,
                    isScreenShareActive = false
                )
            }
            onStopScreenShare()
            return@screenShareToggle
        }
        if (!callUiState.controls.isScreenShareSupported) {
            Toast.makeText(context, "Демонстрация экрана недоступна", Toast.LENGTH_SHORT).show()
            return@screenShareToggle
        }
        val manager = mediaProjectionManager
        if (manager == null) {
            Toast.makeText(context, "MediaProjectionManager недоступен", Toast.LENGTH_SHORT).show()
            return@screenShareToggle
        }
        screenShareLauncher.launch(manager.createScreenCaptureIntent())
    }

    LaunchedEffect(state.incomingCall?.callId) {
        val incoming = state.incomingCall
        if (incoming == null) {
            lastIncomingCallId?.let { callId ->
                IncomingCallNotifications.cancel(context, callId)
            }
            lastIncomingCallId = null
            return@LaunchedEffect
        }
        lastIncomingCallId = incoming.callId
    }

    LaunchedEffect(state.currentUserId, isInPictureInPictureMode, initialPermissionRequestTriggered) {
        if (initialPermissionRequestTriggered) return@LaunchedEffect
        if (isInPictureInPictureMode) return@LaunchedEffect
        if (state.currentUserId.isNullOrBlank()) return@LaunchedEffect

        initialPermissionRequestTriggered = true
        permissionPrefs.edit().putBoolean(INITIAL_PERMISSION_PREFS_KEY, true).apply()

        requestPermissionsInOrderIgnoringDenial(
            listOf(
                GovChatPermissionFeature.Notifications,
                GovChatPermissionFeature.Camera,
                GovChatPermissionFeature.Microphone,
                GovChatPermissionFeature.MediaRead
            )
        )
    }

    LaunchedEffect(state.activeCall?.callId, callUiState.controls.isScreenSharing) {
        val active = state.activeCall
        if (active == null) {
            CallForegroundService.stop(context)
            return@LaunchedEffect
        }
        IncomingCallNotifications.cancelAll(context)
        IncomingCallNotifications.cancel(context, active.callId)
        // On Android 14+ (targetSdk 34+), foreground service with microphone type
        // requires RECORD_AUDIO runtime permission to be granted.
        val hasMic = ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.RECORD_AUDIO
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (hasMic) {
            CallForegroundService.start(
                context = context,
                remoteName = active.chatName,
                callType = active.type,
                isScreenShareActive = callUiState.controls.isScreenSharing
            )
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (isInPictureInPictureMode && state.activeCall != null) {
            PipCallContent(
                call = state.activeCall,
                uiState = callUiState
            )
        } else {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color(0xFF17212B)
            ) {
                if (state.selectedChat == null) {
                    ChatsListContent(
                        state = state,
                        onRefresh = onRefresh,
                        onSelectChat = onSelectChat,
                        onLogout = onLogout,
                        notificationsEnabled = permissionFlow.isGranted(GovChatPermissionFeature.Notifications),
                        onRequestNotifications = {
                            requestPermission(GovChatPermissionFeature.Notifications) {
                                Toast.makeText(context, "Уведомления включены", Toast.LENGTH_SHORT).show()
                            }
                        },
                        onSearchUserByPhone = onSearchUserByPhone,
                        onCreateChatWithUser = onCreateChatWithUser,
                        onCreateGroupChat = onCreateGroupChat,
                        onResetUserSearch = onResetUserSearch,
                        onRefreshProfile = onRefreshProfile
                    )
                } else {
                    ChatContent(
                        state = state,
                        recordingElapsedSeconds = recordingElapsedSeconds,
                        uploadProgress = uploadProgress,
                        recordingCommands = recordingCommands,
                        onBack = onBackFromChat,
                        onSendText = onSendText,
                        onInputChanged = onInputChanged,
                        onSendAttachment = onSendAttachment,
                        onToggleRecordingMode = onToggleRecordingMode,
                        onRecordingStarted = onRecordingStarted,
                        onRecordingLocked = onRecordingLocked,
                        onRecordingCancelled = onRecordingCancelled,
                        onRecordingFinished = onRecordingFinished,
                        onCancelUpload = onCancelUpload,
                        onRetryFailedRecordingUpload = onRetryFailedRecordingUpload,
                        onDismissFailedRecordingUpload = onDismissFailedRecordingUpload,
                        ensureVoiceRecordingPermission = ensureVoiceRecordingPermission,
                        ensureVideoRecordingPermissions = ensureVideoRecordingPermissions,
                        onLoadOlderMessages = onLoadOlderMessages,
                        onStartCall = { type ->
                            requestCallPermissions(type) {
                                onStartCall(type)
                            }
                        },
                        onStartGroupCall = { type ->
                            requestCallPermissions(type) {
                                onStartGroupCall(type)
                            }
                        },
                        onAttachmentClick = { type, attachment ->
                            if (attachment == null) return@ChatContent
                            downloader.download(type, attachment)
                                .onSuccess {
                                    val toast = if (type == MessageType.Image) {
                                        "Изображение загружается..."
                                    } else {
                                        "Файл загружается в Downloads/GovChat"
                                    }
                                    Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
                                }
                                .onFailure { error ->
                                    Toast.makeText(
                                        context,
                                        error.message ?: "Не удалось загрузить файл",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                        }
                    )
                }
            }

            val incoming = state.incomingCall
            if (incoming != null && state.activeCall == null && !isInPictureInPictureMode) {
                IncomingCallFullScreenOverlay(
                    incoming = incoming,
                    avatarUrl = state.chats.firstOrNull { it.id == incoming.chatId }?.avatarUrl,
                    isBusy = state.isCallActionInProgress,
                    onDecline = onDeclineIncomingCall,
                    onAccept = {
                        requestCallPermissions(incoming.type.ifBlank { "audio" }) {
                            onAcceptIncomingCall()
                        }
                    }
                )
            }

            if (state.activeCall != null && !callUiState.isMinimized) {
                ActiveCallOverlay(
                    call = state.activeCall,
                    uiState = callUiState,
                    groupParticipants = state.groupParticipants,
                    currentUserProfile = state.userProfile,
                    remoteChatAvatarUrl = state.chats.firstOrNull { it.id == state.activeCall.chatId }?.avatarUrl,
                    onLeaveCall = onLeaveCall,
                    onToggleMinimize = onToggleCallMinimized,
                    onInteraction = onCallSurfaceInteraction,
                    onToggleMicrophone = onToggleMicrophone,
                    onToggleCamera = onToggleCamera,
                    onSwitchCamera = onSwitchCamera,
                    onToggleScreenShare = toggleScreenShare
                )
            }

            if (state.activeCall != null && callUiState.isMinimized) {
                MinimizedCallWindow(
                    call = state.activeCall,
                    uiState = callUiState,
                    onExpand = onExpandMinimizedCall,
                    onLeaveCall = onLeaveCall
                )
            }

            if (state.callErrorMessage != null) {
                LaunchedEffect(state.callErrorMessage) {
                    Toast.makeText(context, state.callErrorMessage, Toast.LENGTH_SHORT).show()
                    onClearCallError()
                }
            }
        }
    }

    if (permissionPrompt != null && !isInPictureInPictureMode) {
        PermissionDeniedDialog(
            prompt = permissionPrompt!!,
            onDismiss = { permissionPrompt = null },
            onRequestAgain = {
                val prompt = permissionPrompt!!
                permissionPrompt = null
                requestPermission(prompt.feature) {
                    prompt.onGranted?.invoke()
                }
            },
            onOpenSettings = {
                permissionFlow.openAppSettings()
                permissionPrompt = null
            }
        )
    }

    if (state.existingGroupCallPrompt != null && !isInPictureInPictureMode) {
        val prompt = state.existingGroupCallPrompt
        AlertDialog(
            onDismissRequest = onDismissExistingGroupCallPrompt,
            title = { Text("Звонок уже активен") },
            text = {
                Text(
                    "В группе \"${prompt.chatName}\" уже идет ${if (prompt.type == "video") "видеозвонок" else "аудиозвонок"}. Подключиться?"
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        requestCallPermissions(prompt.type) {
                            onConfirmJoinExistingGroupCall()
                        }
                    }
                ) {
                    Text("Да")
                }
            },
            dismissButton = {
                TextButton(onClick = onDismissExistingGroupCallPrompt) {
                    Text("Нет")
                }
            }
        )
    }
}

@Composable
private fun ChatsListContent(
    state: MainUiState,
    onRefresh: () -> Unit,
    onSelectChat: (String) -> Unit,
    onLogout: () -> Unit,
    notificationsEnabled: Boolean,
    onRequestNotifications: () -> Unit,
    onSearchUserByPhone: (String) -> Unit,
    onCreateChatWithUser: (String) -> Unit,
    onCreateGroupChat: (String, List<String>) -> Unit,
    onResetUserSearch: () -> Unit,
    onRefreshProfile: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var showAddChatDialog by remember { mutableStateOf(false) }
    var showCreateGroupDialog by remember { mutableStateOf(false) }
    var showFabMenu by remember { mutableStateOf(false) }

    val totalUnread = state.chats.sumOf { it.unreadCount }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF17212B))
            .statusBarsPadding()
    ) {
        // ── Telegram-style Header ──
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFF1E2742),
            shadowElevation = 4.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // User avatar (navigates to profile)
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFF5EB5F7), Color(0xFF3A7BD5))
                            )
                        )
                        .clickable { selectedTab = 3 },
                    contentAlignment = Alignment.Center
                ) {
                    val initial = state.userProfile?.name?.firstOrNull()?.uppercase() ?: "?"
                    Text(
                        text = initial,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Title based on selected tab
                val title = when (selectedTab) {
                    0 -> "GovChat"
                    1 -> "Звонки"
                    2 -> "Контакты"
                    3 -> "Профиль"
                    else -> "GovChat"
                }

                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )

                // Connection status indicator
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(
                            if (state.isRealtimeConnected) Color(0xFF4CAF50)
                            else Color(0xFFEF4444)
                        )
                )
                Spacer(modifier = Modifier.width(12.dp))

                // Refresh
                IconButton(
                    onClick = onRefresh,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Refresh,
                        contentDescription = "Обновить",
                        tint = Color(0xFF8296AC),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        if (!notificationsEnabled) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                color = Color(0xFF1E2C3A),
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Включите уведомления",
                        color = Color.White,
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodySmall
                    )
                    TextButton(onClick = onRequestNotifications) {
                        Text("Разрешить", color = Color(0xFF5EB5F7))
                    }
                }
            }
        }

        if (state.errorMessage != null) {
            Text(
                text = state.errorMessage,
                color = Color(0xFFEF4444),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )
        }

        // ── Tab Content (no duplicate chip tabs) ──
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            when (selectedTab) {
                0 -> ChatsTabContent(
                    state = state,
                    onSelectChat = onSelectChat
                )
                1 -> PlaceholderTabContent("Звонки", "История звонков появится здесь")
                2 -> PlaceholderTabContent("Контакты", "Скоро здесь будут ваши контакты")
                3 -> ProfileTabContent(
                    state = state,
                    onLogout = onLogout,
                    onRefreshProfile = onRefreshProfile
                )
            }

            // ── FAB — single compose button on Chats tab ──
            if (selectedTab == 0) {
                // Expanded FAB menu
                if (showFabMenu) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xAA000000))
                            .clickable(
                                indication = null,
                                interactionSource = remember { MutableInteractionSource() }
                            ) { showFabMenu = false }
                    )
                    Column(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(end = 16.dp, bottom = 80.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        horizontalAlignment = Alignment.End
                    ) {
                        // Create group option
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF1E2C3A))
                                .clickable {
                                    showFabMenu = false
                                    showCreateGroupDialog = true
                                }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.GroupAdd,
                                contentDescription = null,
                                tint = Color(0xFF5EB5F7),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Новая группа", color = Color.White, fontSize = 14.sp)
                        }
                        // New chat option
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF1E2C3A))
                                .clickable {
                                    showFabMenu = false
                                    showAddChatDialog = true
                                }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Person,
                                contentDescription = null,
                                tint = Color(0xFF5EB5F7),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Новый чат", color = Color.White, fontSize = 14.sp)
                        }
                    }
                }

                // Main FAB
                val fabRotation by animateFloatAsState(
                    targetValue = if (showFabMenu) 45f else 0f,
                    animationSpec = tween(200),
                    label = "fabRotation"
                )
                FloatingActionButton(
                    onClick = { showFabMenu = !showFabMenu },
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 16.dp, bottom = 16.dp),
                    containerColor = Color(0xFF5EB5F7),
                    contentColor = Color.White,
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = "Новый чат",
                        modifier = Modifier
                            .size(26.dp)
                            .graphicsLayer { rotationZ = fabRotation }
                    )
                }
            }
        }

        // ── Bottom Nav ──
        BottomNavBar(
            selectedTab = selectedTab,
            onTabSelected = { selectedTab = it },
            unreadCount = totalUnread
        )
    }

    if (showAddChatDialog) {
        AddChatDialog(
            state = state,
            onDismiss = {
                showAddChatDialog = false
                onResetUserSearch()
            },
            onSearchPhone = onSearchUserByPhone,
            onCreateChat = { userId ->
                onCreateChatWithUser(userId)
                showAddChatDialog = false
            }
        )
    }

    if (showCreateGroupDialog) {
        CreateGroupDialog(
            state = state,
            onDismiss = {
                showCreateGroupDialog = false
                onResetUserSearch()
            },
            onSearchPhone = onSearchUserByPhone,
            onResetSearch = onResetUserSearch,
            onCreateGroup = { name, participantIds ->
                onCreateGroupChat(name, participantIds)
                showCreateGroupDialog = false
            }
        )
    }
}

@Composable
private fun ChatsTabContent(
    state: MainUiState,
    onSelectChat: (String) -> Unit
) {
    if (state.isLoadingChats) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = Color(0xFF5EB5F7))
        }
    } else if (state.chats.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Filled.Email,
                    contentDescription = null,
                    modifier = Modifier.size(56.dp),
                    tint = Color(0xFF3A4B5C)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Нет чатов",
                    color = Color(0xFF8296AC),
                    style = MaterialTheme.typography.bodyLarge
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Нажмите + чтобы начать общение",
                    color = Color(0xFF6B7D8E),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize()
        ) {
            items(state.chats, key = { it.id }) { chat ->
                ChatRow(chat = chat, onClick = { onSelectChat(chat.id) })
            }
        }
    }
}

@Composable
private fun PlaceholderTabContent(title: String, subtitle: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            val icon = when (title) {
                "Звонки" -> Icons.Filled.Call
                "Контакты" -> Icons.Filled.People
                else -> Icons.Filled.Settings
            }
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(56.dp),
                tint = Color(0xFF3A4B5C)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = title,
                color = Color(0xFF8296AC),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = subtitle,
                color = Color(0xFF6B7D8E),
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun ProfileTabContent(
    state: MainUiState,
    onLogout: () -> Unit,
    onRefreshProfile: () -> Unit
) {
    val profile = state.userProfile
    var showLogoutConfirm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // ── Avatar + Info Header ──
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF1E2C3A))
                .padding(vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Avatar with gradient fallback
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF5EB5F7), Color(0xFF3A7BD5))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                val fallbackLetter = (profile?.name?.firstOrNull() ?: '?').uppercase()
                val avatarUrl = resolveAvatarUrl(profile?.avatarUrl)
                Text(
                    text = fallbackLetter,
                    color = Color.White,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold
                )
                if (avatarUrl.isNotBlank()) {
                    AsyncImage(
                        model = rememberImageRequest(
                            data = avatarUrl,
                            downsamplePx = 320
                        ),
                        imageLoader = rememberGovChatImageLoader(),
                        contentDescription = "Аватар",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = profile?.name ?: "Загрузка...",
                color = Color.White,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = profile?.phone ?: "",
                color = Color(0xFF8296AC),
                style = MaterialTheme.typography.bodyMedium
            )

            if (state.userProfileLoading) {
                Spacer(modifier = Modifier.height(12.dp))
                CircularProgressIndicator(
                    color = Color(0xFF5EB5F7),
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // ── Account Section ──
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFF1E2C3A)
        ) {
            Column {
                // Name row
                ProfileSettingsRow(
                    icon = Icons.Filled.Person,
                    title = "Имя",
                    value = profile?.name ?: "—"
                )
                Divider(
                    modifier = Modifier.padding(start = 56.dp),
                    color = Color(0xFF1D2E3D),
                    thickness = 0.5.dp
                )
                // Phone row
                ProfileSettingsRow(
                    icon = Icons.Filled.Call,
                    title = "Телефон",
                    value = profile?.phone ?: "—"
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // ── App Section ──
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFF1E2C3A)
        ) {
            Column {
                // Refresh
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onRefreshProfile() }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Filled.Refresh,
                        contentDescription = null,
                        tint = Color(0xFF5EB5F7),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = "Обновить профиль",
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
                Divider(
                    modifier = Modifier.padding(start = 56.dp),
                    color = Color(0xFF1D2E3D),
                    thickness = 0.5.dp
                )
                // Logout
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showLogoutConfirm = true }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Filled.ExitToApp,
                        contentDescription = null,
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = "Выйти",
                        color = Color(0xFFEF4444),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
        }
    }

    // Logout confirmation
    if (showLogoutConfirm) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirm = false },
            title = { Text("Выйти из аккаунта?") },
            text = { Text("Вы уверены, что хотите выйти?") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutConfirm = false
                    onLogout()
                }) {
                    Text("Выйти", color = Color(0xFFEF4444))
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirm = false }) {
                    Text("Отмена")
                }
            }
        )
    }
}

@Composable
private fun ProfileSettingsRow(
    icon: ImageVector,
    title: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Color(0xFF8296AC),
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(
                text = title,
                color = Color(0xFF8296AC),
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(modifier = Modifier.height(1.dp))
            Text(
                text = value,
                color = Color.White,
                style = MaterialTheme.typography.bodyLarge
            )
        }
    }
}

@Composable
private fun BottomNavBar(
    selectedTab: Int,
    onTabSelected: (Int) -> Unit,
    unreadCount: Int = 0
) {
    val tabs = listOf(
        Triple("Чаты", Icons.Filled.Email, true),
        Triple("Звонки", Icons.Filled.Call, false),
        Triple("Контакты", Icons.Filled.People, false),
        Triple("Профиль", Icons.Filled.Person, false)
    )

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFF17212B),
        shadowElevation = 12.dp,
        tonalElevation = 0.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(top = 6.dp, bottom = 6.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            tabs.forEachIndexed { index, (label, icon, showBadge) ->
                val isSelected = selectedTab == index
                val tintColor by animateColorAsState(
                    targetValue = if (isSelected) Color(0xFF5EB5F7) else Color(0xFF6B7D8E),
                    animationSpec = tween(250),
                    label = "tabTint"
                )
                val scale by animateFloatAsState(
                    targetValue = if (isSelected) 1.08f else 1f,
                    animationSpec = spring(dampingRatio = 0.6f),
                    label = "tabScale"
                )

                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(
                            indication = null,
                            interactionSource = remember { MutableInteractionSource() }
                        ) { onTabSelected(index) }
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                        .graphicsLayer { scaleX = scale; scaleY = scale },
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box {
                        Icon(
                            imageVector = icon,
                            contentDescription = label,
                            modifier = Modifier.size(24.dp),
                            tint = tintColor
                        )
                        if (showBadge && unreadCount > 0) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 6.dp, y = (-4).dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF4CAF50))
                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                            ) {
                                Text(
                                    text = if (unreadCount > 99) "99+" else unreadCount.toString(),
                                    color = Color.White,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    lineHeight = 10.sp
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = label,
                        color = tintColor,
                        fontSize = 10.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
        }
    }
}

@Composable
private fun AddChatDialog(
    state: MainUiState,
    onDismiss: () -> Unit,
    onSearchPhone: (String) -> Unit,
    onCreateChat: (String) -> Unit
) {
    var phoneInput by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFF1E293B),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp)
            ) {
                Text(
                    text = "Новый чат",
                    color = Color.White,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Введите номер телефона пользователя",
                    color = Color(0xFF94A3B8),
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = phoneInput,
                    onValueChange = {
                        phoneInput = it
                        onSearchPhone(it)
                    },
                    label = { Text("Номер телефона") },
                    placeholder = { Text("7...") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Phone,
                        imeAction = ImeAction.Search
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF3B82F6),
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedLabelColor = Color(0xFF3B82F6),
                        unfocusedLabelColor = Color(0xFF64748B),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Color(0xFF3B82F6)
                    ),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Search status
                when (state.userSearchStatus) {
                    UserSearchStatus.Idle -> {}
                    UserSearchStatus.TooShort -> {
                        Text(
                            text = "Введите минимум 9 цифр",
                            color = Color(0xFF64748B),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    UserSearchStatus.Loading -> {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            CircularProgressIndicator(
                                color = Color(0xFF3B82F6),
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                            Text(
                                text = "Поиск...",
                                color = Color(0xFF94A3B8),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                    UserSearchStatus.Found -> {
                        val user = state.searchedUser
                        if (user != null) {
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable { onCreateChat(user.id) },
                                color = Color(0xFF0F172A),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF3B82F6)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = (user.name.firstOrNull() ?: '?').uppercase(),
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 18.sp
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = user.name,
                                            color = Color.White,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            text = user.phone,
                                            color = Color(0xFF94A3B8),
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                    Text(
                                        text = "Чат →",
                                        color = Color(0xFF3B82F6),
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                    }
                    UserSearchStatus.NotFound -> {
                        Text(
                            text = "Пользователь не найден",
                            color = Color(0xFFEF4444),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    UserSearchStatus.Error -> {
                        Text(
                            text = "Ошибка поиска",
                            color = Color(0xFFEF4444),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("Отмена", color = Color(0xFF64748B))
                }
            }
        }
    }
}

@Composable
private fun CreateGroupDialog(
    state: MainUiState,
    onDismiss: () -> Unit,
    onSearchPhone: (String) -> Unit,
    onResetSearch: () -> Unit,
    onCreateGroup: (String, List<String>) -> Unit
) {
    var groupName by remember { mutableStateOf("") }
    var phoneInput by remember { mutableStateOf("") }
    var participants by remember { mutableStateOf<List<UserProfile>>(emptyList()) }
    var localError by remember { mutableStateOf<String?>(null) }

    val maxHeight = (LocalConfiguration.current.screenHeightDp * 0.85f).dp
    val participantsListMaxHeight = (LocalConfiguration.current.screenHeightDp * 0.35f).dp

    Dialog(
        onDismissRequest = {
            onResetSearch()
            onDismiss()
        }
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFF1E293B),
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = maxHeight)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Text(
                    text = "Создать группу",
                    color = Color.White,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Введите название и добавьте участников",
                    color = Color(0xFF94A3B8),
                    style = MaterialTheme.typography.bodySmall
                )

                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = groupName,
                    onValueChange = {
                        groupName = it
                        localError = null
                    },
                    label = { Text("Название группы") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF7E22CE),
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedLabelColor = Color(0xFF7E22CE),
                        unfocusedLabelColor = Color(0xFF64748B),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Color(0xFF7E22CE)
                    ),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = phoneInput,
                    onValueChange = {
                        phoneInput = it
                        localError = null
                        onSearchPhone(it)
                    },
                    label = { Text("Телефон участника") },
                    placeholder = { Text("7...") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Phone,
                        imeAction = ImeAction.Search
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF7E22CE),
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedLabelColor = Color(0xFF7E22CE),
                        unfocusedLabelColor = Color(0xFF64748B),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Color(0xFF7E22CE)
                    ),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))
                when (state.userSearchStatus) {
                    UserSearchStatus.Idle -> Unit
                    UserSearchStatus.TooShort -> Text(
                        text = "Введите минимум 9 цифр",
                        color = Color(0xFF64748B),
                        style = MaterialTheme.typography.bodySmall
                    )

                    UserSearchStatus.Loading -> Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(
                            color = Color(0xFF7E22CE),
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                        Text(
                            text = "Поиск...",
                            color = Color(0xFF94A3B8),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    UserSearchStatus.Found -> {
                        val user = state.searchedUser
                        if (user != null) {
                            val isAlreadyAdded = participants.any { it.id == user.id }
                            val isSelf = user.id == state.currentUserId
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                color = Color(0xFF0F172A),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF7E22CE)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = (user.name.firstOrNull() ?: '?').uppercase(),
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 18.sp
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = user.name,
                                            color = Color.White,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            text = user.phone,
                                            color = Color(0xFF94A3B8),
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }

                                    val addEnabled = !isAlreadyAdded && !isSelf
                                    TextButton(
                                        onClick = {
                                            if (!addEnabled) return@TextButton
                                            participants = participants + user
                                            phoneInput = ""
                                            onResetSearch()
                                        },
                                        enabled = addEnabled
                                    ) {
                                        Text(
                                            text = when {
                                                isSelf -> "Вы"
                                                isAlreadyAdded -> "Добавлен"
                                                else -> "Добавить"
                                            },
                                            color = if (addEnabled) Color(0xFF7E22CE) else Color(0xFF64748B),
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }
                        }
                    }

                    UserSearchStatus.NotFound -> Text(
                        text = "Пользователь не найден",
                        color = Color(0xFFEF4444),
                        style = MaterialTheme.typography.bodySmall
                    )

                    UserSearchStatus.Error -> Text(
                        text = "Ошибка поиска",
                        color = Color(0xFFEF4444),
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (participants.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Участники (${participants.size})",
                        color = Color.White,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = participantsListMaxHeight),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(participants, key = { it.id }) { user ->
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                color = Color(0xFF0F172A),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = user.name,
                                        color = Color.White,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    TextButton(
                                        onClick = { participants = participants.filterNot { it.id == user.id } }
                                    ) {
                                        Text("Удалить", color = Color(0xFF64748B))
                                    }
                                }
                            }
                        }
                    }
                }

                if (localError != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = localError!!,
                        color = Color(0xFFEF4444),
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(
                        onClick = {
                            onResetSearch()
                            onDismiss()
                        }
                    ) {
                        Text("Отмена", color = Color(0xFF64748B))
                    }

                    Spacer(modifier = Modifier.width(6.dp))

                    Button(
                        onClick = {
                            val trimmed = groupName.trim()
                            if (trimmed.isBlank()) {
                                localError = "Укажите название группы"
                                return@Button
                            }
                            if (participants.isEmpty()) {
                                localError = "Добавьте хотя бы одного участника"
                                return@Button
                            }
                            onCreateGroup(trimmed, participants.map { it.id })
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7E22CE)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Создать", color = Color.White)
                    }
                }
            }
        }
    }
}

private fun resolveAvatarUrl(url: String?): String {
    if (url.isNullOrBlank()) return ""
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    return BuildConfig.API_BASE_URL.trimEnd('/') + "/" + url.trimStart('/')
}

@Composable
private fun ChatRow(
    chat: ChatPreview,
    onClick: () -> Unit
) {
    val isGroup = chat.type == ChatType.GROUP
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar with group icon overlay
            Box {
                AvatarBubble(
                    title = chat.title,
                    background = if (isGroup) Color(0xFF7E57C2) else Color(0xFF5EB5F7),
                    size = 52
                )
                if (isGroup) {
                    Box(
                        modifier = Modifier
                            .size(18.dp)
                            .align(Alignment.BottomEnd)
                            .clip(CircleShape)
                            .background(Color(0xFF17212B))
                            .padding(2.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF7E57C2)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.People,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(10.dp)
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = chat.title,
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                }
                Spacer(modifier = Modifier.height(3.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = chat.subtitle,
                        color = Color(0xFF6B7D8E),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (chat.unreadCount > 0) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(Color(0xFF4CAF50))
                                .padding(horizontal = 7.dp, vertical = 3.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (chat.unreadCount > 99) "99+" else chat.unreadCount.toString(),
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                lineHeight = 12.sp
                            )
                        }
                    }
                }
            }
        }
        // Telegram-style divider indented from avatar
        Divider(
            modifier = Modifier.padding(start = 78.dp),
            color = Color(0xFF1D2E3D),
            thickness = 0.5.dp
        )
    }
}

@Composable
private fun ChatContent(
    state: MainUiState,
    recordingElapsedSeconds: Int,
    uploadProgress: Int?,
    recordingCommands: Flow<RecordingCommand>,
    onBack: () -> Unit,
    onSendText: (String) -> Unit,
    onInputChanged: (String) -> Unit,
    onSendAttachment: (Uri) -> Unit,
    onToggleRecordingMode: () -> Unit,
    onRecordingStarted: (RecordingMode) -> Long?,
    onRecordingLocked: () -> Unit,
    onRecordingCancelled: () -> Unit,
    onRecordingFinished: (Long, Uri, Long) -> Unit,
    onCancelUpload: () -> Unit,
    onRetryFailedRecordingUpload: () -> Unit,
    onDismissFailedRecordingUpload: () -> Unit,
    ensureVoiceRecordingPermission: (() -> Unit) -> Unit,
    ensureVideoRecordingPermissions: (() -> Unit) -> Unit,
    onLoadOlderMessages: () -> Unit,
    onStartCall: (String) -> Unit,
    onStartGroupCall: (String) -> Unit,
    onAttachmentClick: (MessageType, MessageAttachment?) -> Unit
) {
    val chat = state.selectedChat ?: return
    val context = LocalContext.current
    var showParticipantsDialog by remember(chat.id) { mutableStateOf(false) }
    var draft by remember(chat.id) { mutableStateOf("") }
    val selectedMediaUris = remember(chat.id) { mutableStateListOf<Uri>() }
    val imageMessages = remember(state.messages) {
        state.messages.filter { message ->
            message.type == MessageType.Image && !message.attachment?.url.isNullOrBlank()
        }
    }
    var imagePreviewStartIndex by remember(chat.id) { mutableIntStateOf(-1) }
    val listState = rememberLazyListState()
    val playbackCoordinator = remember(chat.id) { PlaybackCoordinator() }
    var activePlaybackMessageId by remember(chat.id) { mutableStateOf<String?>(null) }

    DisposableEffect(chat.id) {
        onDispose {
            playbackCoordinator.release()
            activePlaybackMessageId = null
        }
    }

    BackHandler(enabled = imagePreviewStartIndex >= 0) {
        imagePreviewStartIndex = -1
    }
    BackHandler(enabled = imagePreviewStartIndex < 0 && showParticipantsDialog) {
        showParticipantsDialog = false
    }
    BackHandler(
        enabled = imagePreviewStartIndex < 0 &&
            !showParticipantsDialog &&
            selectedMediaUris.isNotEmpty()
    ) {
        selectedMediaUris.clear()
    }

    val openMediaLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = 20)
    ) { uris ->
        if (uris.isEmpty()) return@rememberLauncherForActivityResult
        uris.forEach { uri ->
            if (selectedMediaUris.none { it.toString() == uri.toString() }) {
                selectedMediaUris.add(uri)
            }
        }
    }

    val sendSelectedMedia: () -> Unit = sendMedia@{
        if (selectedMediaUris.isEmpty()) return@sendMedia
        val batch = selectedMediaUris.toList()
        selectedMediaUris.clear()
        batch.forEach { uri ->
            onSendAttachment(uri)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // ── Telegram-style Chat Header ──
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFF1E2742),
            shadowElevation = 4.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 6.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Back button
                IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Назад",
                        tint = Color(0xFF5EB5F7)
                    )
                }

                // Avatar
                AvatarBubble(
                    title = chat.title,
                    background = if (chat.type == ChatType.GROUP) Color(0xFF7E57C2) else Color(0xFF5EB5F7),
                    size = 40
                )

                // Title + subtitle
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 10.dp)
                ) {
                    Text(
                        text = chat.title,
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    val typingInCurrentChat = state.typingUsers
                        .filter { it.chatId == chat.id }
                        .joinToString { it.userName.ifBlank { "Собеседник" } }

                    val subtitle = when {
                        typingInCurrentChat.isNotBlank() -> "$typingInCurrentChat печатает..."
                        chat.type == ChatType.GROUP -> "Участников: ${chat.participantCount}"
                        chat.isOnline -> "в сети"
                        else -> "не в сети"
                    }
                    val subtitleColor = when {
                        typingInCurrentChat.isNotBlank() -> Color(0xFF5EB5F7)
                        else -> Color(0xFF6B7D8E)
                    }
                    Text(
                        text = subtitle,
                        color = subtitleColor,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1
                    )
                }

                // Action buttons
                if (chat.type == ChatType.GROUP) {
                    IconButton(
                        onClick = { showParticipantsDialog = true },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.People,
                            contentDescription = "Участники",
                            tint = Color(0xFF8296AC),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    IconButton(
                        onClick = { onStartGroupCall("audio") },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Call,
                            contentDescription = "Звонок",
                            tint = Color(0xFF8296AC),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    IconButton(
                        onClick = { onStartGroupCall("video") },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Videocam,
                            contentDescription = "Видео",
                            tint = Color(0xFF8296AC),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                } else {
                    IconButton(
                        onClick = { onStartCall("audio") },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Call,
                            contentDescription = "Звонок",
                            tint = Color(0xFF8296AC),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    IconButton(
                        onClick = { onStartCall("video") },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Videocam,
                            contentDescription = "Видео",
                            tint = Color(0xFF8296AC),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        if (showParticipantsDialog) {
            AlertDialog(
                onDismissRequest = { showParticipantsDialog = false },
                title = { Text("Участники") },
                text = {
                    when {
                        state.isLoadingGroupParticipants -> {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                Text("Загрузка...")
                            }
                        }

                        state.groupParticipantsErrorMessage != null -> {
                            Text(state.groupParticipantsErrorMessage)
                        }

                        state.groupParticipants.isEmpty() -> {
                            Text("Список участников недоступен")
                        }

                        else -> {
                            LazyColumn(
                                modifier = Modifier.heightIn(max = 380.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(state.groupParticipants, key = { it.id }) { user ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = user.name.ifBlank { user.phone },
                                            modifier = Modifier.weight(1f),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (user.phone.isNotBlank()) {
                                            Text(
                                                text = user.phone,
                                                color = Color(0xFF64748B)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showParticipantsDialog = false }) {
                        Text("Закрыть")
                    }
                }
            )
        }

        if (state.errorMessage != null) {
            Text(
                text = state.errorMessage,
                color = Color(0xFFEF4444),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }

        if (state.isLoadingMessages) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color(0xFF3B82F6))
            }
        } else {
            ChatMessagesList(
                chatId = chat.id,
                messages = state.messages,
                currentUserId = state.currentUserId,
                listState = listState,
                isLoadingOlderMessages = state.isLoadingOlderMessages,
                hasOlderMessages = state.hasOlderMessages,
                onLoadOlderMessages = onLoadOlderMessages,
                playbackCoordinator = playbackCoordinator,
                activePlaybackMessageId = activePlaybackMessageId,
                onActivePlaybackChanged = { activePlaybackMessageId = it },
                onAttachmentClick = { message, type, attachment ->
                    if (type == MessageType.Image && !attachment?.url.isNullOrBlank()) {
                        val previewIndex = imageMessages.indexOfFirst { it.id == message.id }
                        if (previewIndex >= 0) {
                            imagePreviewStartIndex = previewIndex
                        }
                    } else {
                        onAttachmentClick(type, attachment)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            )
        }

        Divider(color = Color(0xFF334155))
        // ── Telegram-style Input Bar ──
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFF17212B)
        ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                ) {
                    if (uploadProgress != null) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Загрузка вложения...",
                                    color = Color(0xFF8296AC),
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(onClick = onCancelUpload) {
                                    Text("Отмена")
                                }
                            }
                            LinearProgressIndicator(
                                progress = uploadProgress / 100f,
                                modifier = Modifier.fillMaxWidth(),
                                color = Color(0xFF5EB5F7)
                            )
                        }
                    }

                    if (selectedMediaUris.isNotEmpty()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(selectedMediaUris, key = { it.toString() }) { uri ->
                                    Box(
                                        modifier = Modifier
                                            .size(width = 82.dp, height = 110.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(Color(0xFF1E293B))
                                    ) {
                                        LocalImagePreview(
                                            uri = uri,
                                            modifier = Modifier.fillMaxSize()
                                        )
                                        Surface(
                                            color = Color(0xAA0F172A),
                                            shape = CircleShape,
                                            modifier = Modifier
                                                .align(Alignment.TopEnd)
                                                .padding(4.dp)
                                                .size(22.dp)
                                                .clickable {
                                                    selectedMediaUris.removeAll { it.toString() == uri.toString() }
                                                }
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(
                                                    imageVector = Icons.Filled.Close,
                                                    contentDescription = "Удалить",
                                                    tint = Color.White,
                                                    modifier = Modifier.size(14.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Выбрано: ${selectedMediaUris.size}",
                                    color = Color(0xFF9FB4C8),
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Spacer(modifier = Modifier.weight(1f))
                                TextButton(onClick = { selectedMediaUris.clear() }) {
                                    Text("Очистить")
                                }
                                Button(
                                    onClick = sendSelectedMedia,
                                    enabled = uploadProgress == null
                                ) {
                                    Text("Отправить")
                                }
                            }
                        }
                    }

                    MessageInput(
                        draft = draft,
                        onDraftChanged = { value ->
                            draft = value
                            onInputChanged(value)
                        },
                        onSendText = { value ->
                            if (value.isBlank()) return@MessageInput
                            onSendText(value)
                            draft = ""
                        },
                        onOpenAttachmentPicker = {
                            openMediaLauncher.launch(
                                PickVisualMediaRequest(
                                    ActivityResultContracts.PickVisualMedia.ImageOnly
                                )
                            )
                        },
                        recordingMode = state.recordingMode,
                        recordingState = state.recordingState,
                        recordingElapsedSeconds = recordingElapsedSeconds,
                        recordingCommands = recordingCommands,
                        failedRecordingUpload = state.failedRecordingUpload,
                        onToggleRecordingMode = onToggleRecordingMode,
                        onRecordingStarted = onRecordingStarted,
                        onRecordingLocked = onRecordingLocked,
                        onRecordingCancelled = onRecordingCancelled,
                        onRecordingFinished = onRecordingFinished,
                        onCancelUpload = onCancelUpload,
                        onRetryFailedRecordingUpload = onRetryFailedRecordingUpload,
                        onDismissFailedRecordingUpload = onDismissFailedRecordingUpload,
                        ensureVoicePermission = ensureVoiceRecordingPermission,
                        ensureVideoPermission = ensureVideoRecordingPermissions
                    )
                }
        }
    }

    if (imagePreviewStartIndex >= 0 && imageMessages.isNotEmpty()) {
        ImagesGalleryDialog(
            messages = imageMessages,
            startIndex = imagePreviewStartIndex,
            onDismiss = { imagePreviewStartIndex = -1 },
            onDownload = { message ->
                onAttachmentClick(message.type, message.attachment)
            }
        )
    }
}

@Composable
private fun ChatMessagesList(
    chatId: String,
    messages: List<ChatMessage>,
    currentUserId: String?,
    listState: LazyListState,
    isLoadingOlderMessages: Boolean,
    hasOlderMessages: Boolean,
    onLoadOlderMessages: () -> Unit,
    playbackCoordinator: PlaybackCoordinator,
    activePlaybackMessageId: String?,
    onActivePlaybackChanged: (String?) -> Unit,
    onAttachmentClick: (ChatMessage, MessageType, MessageAttachment?) -> Unit,
    modifier: Modifier = Modifier
) {
    val appContext = LocalContext.current.applicationContext
    val displayMessages = remember(messages) { messages.asReversed() }
    val timelineItems = remember(displayMessages) { buildMessageTimelineItems(displayMessages) }
    val timelineItemByKey = remember(timelineItems) { timelineItems.associateBy { it.key } }
    val latestMessageId = messages.lastOrNull()?.id
    var initialScrollPerformed by remember(chatId) { mutableStateOf(false) }
    var shouldAutoScrollOnNewMessage by remember(chatId) { mutableStateOf(true) }
    var lastObservedLatestMessageId by remember(chatId) { mutableStateOf<String?>(null) }
    var paginationTriggered by remember(chatId) { mutableStateOf(false) }
    var visibleMessageIds by remember(chatId) { mutableStateOf<Set<String>>(emptySet()) }
    var autoplayVideoNoteId by remember(chatId) { mutableStateOf<String?>(null) }

    LaunchedEffect(chatId) {
        snapshotFlow { listState.isNearBottomForReverseLayout() }
            .collect { isNearBottom ->
                shouldAutoScrollOnNewMessage = isNearBottom
            }
    }

    LaunchedEffect(chatId, latestMessageId, initialScrollPerformed) {
        if (messages.isEmpty()) return@LaunchedEffect

        if (!initialScrollPerformed) {
            listState.scrollToItem(0)
            initialScrollPerformed = true
            lastObservedLatestMessageId = latestMessageId
            return@LaunchedEffect
        }

        val hasNewMessage = lastObservedLatestMessageId != null &&
            lastObservedLatestMessageId != latestMessageId
        if (hasNewMessage && shouldAutoScrollOnNewMessage) {
            listState.animateScrollToItem(0)
        }
        lastObservedLatestMessageId = latestMessageId
    }

    LaunchedEffect(chatId, hasOlderMessages, isLoadingOlderMessages, timelineItems.size) {
        if (!hasOlderMessages || isLoadingOlderMessages) return@LaunchedEffect
        snapshotFlow {
            val totalItemsCount = listState.layoutInfo.totalItemsCount
            val maxVisibleIndex = listState.layoutInfo.visibleItemsInfo.maxOfOrNull { it.index } ?: -1
            totalItemsCount to maxVisibleIndex
        }.collect { (totalItemsCount, maxVisibleIndex) ->
            if (totalItemsCount <= 0) return@collect
            val nearOlderMessagesEdge = maxVisibleIndex >= totalItemsCount - 3
            if (nearOlderMessagesEdge && !paginationTriggered) {
                paginationTriggered = true
                onLoadOlderMessages()
            } else if (!nearOlderMessagesEdge) {
                paginationTriggered = false
            }
        }
    }

    LaunchedEffect(chatId, isLoadingOlderMessages) {
        if (!isLoadingOlderMessages) {
            paginationTriggered = false
        }
    }

    LaunchedEffect(chatId, timelineItems, playbackCoordinator) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.map { it.index to it.key } }
            .map { visibleInfo ->
                val sortedByIndex = visibleInfo.sortedBy { it.first }
                val visibleMessages = sortedByIndex
                    .mapNotNull { (_, rawKey) ->
                        val key = rawKey as? String ?: return@mapNotNull null
                        timelineItemByKey[key]?.message
                    }
                val visibleIds = visibleMessages.map { it.id }.toSet()
                val autoplayCandidate = visibleMessages
                    .firstOrNull { it.type == MessageType.VideoNote }
                    ?.id
                val visibleVideoUrls = visibleMessages
                    .mapNotNull { message ->
                        message.takeIf { it.type == MessageType.VideoNote }
                            ?.attachment
                            ?.url
                            ?.let(::resolveMediaUrl)
                    }
                    .distinct()
                    .sorted()
                Triple(visibleIds, autoplayCandidate, visibleVideoUrls)
            }
            .distinctUntilChanged()
            .collect { (ids, autoplayId, visibleUrls) ->
                visibleMessageIds = ids
                autoplayVideoNoteId = autoplayId
                visibleUrls.forEach { url ->
                    MediaCacheManager.prefetch(appContext, url)
                }
                val activeVideoId = playbackCoordinator.activeVideoId()
                if (activeVideoId != null && activeVideoId !in ids) {
                    playbackCoordinator.stopActiveVideo(onActivePlaybackChanged)
                }
            }
    }

    LazyColumn(
        state = listState,
        modifier = modifier,
        reverseLayout = true,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(
            items = timelineItems,
            key = { it.key },
            contentType = { if (it.message != null) "message" else "day_separator" }
        ) { item ->
            val message = item.message
            if (message == null) {
                MessageDaySeparator(label = item.dayLabel.orEmpty())
            } else {
                MessageBubble(
                    message = message,
                    isMine = message.senderId == currentUserId,
                    playbackCoordinator = playbackCoordinator,
                    activePlaybackMessageId = activePlaybackMessageId,
                    onActivePlaybackChanged = onActivePlaybackChanged,
                    isVisibleInViewport = visibleMessageIds.contains(message.id),
                    shouldAutoplayVideoNote = autoplayVideoNoteId == message.id,
                    onAttachmentClick = { type, attachment ->
                        onAttachmentClick(message, type, attachment)
                    }
                )
            }
        }
        if (isLoadingOlderMessages) {
            item(key = "messages_loading_older") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(
                        color = Color(0xFF3B82F6),
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp
                    )
                }
            }
        }
    }
}

@Composable
private fun IncomingCallFullScreenOverlay(
    incoming: IncomingCallUi,
    avatarUrl: String?,
    isBusy: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    val resolvedAvatarUrl = remember(avatarUrl) { resolveAvatarUrl(avatarUrl).ifBlank { null } }

    val pulseTransition = rememberInfiniteTransition(label = "incomingCallPulse")
    val pulseScale by pulseTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "incomingCallPulseScale"
    )
    val pulseAlpha by pulseTransition.animateFloat(
        initialValue = 0.30f,
        targetValue = 0.10f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "incomingCallPulseAlpha"
    )

    val peerName = if (incoming.isGroup) {
        incoming.chatName.ifBlank { "Групповой звонок" }
    } else {
        incoming.initiatorName.ifBlank { incoming.chatName }.ifBlank { "Контакт" }
    }
    val topSubtitle = if (incoming.isGroup) {
        "${incoming.initiatorName.ifBlank { "Контакт" }} приглашает в звонок"
    } else {
        "Входящий звонок..."
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xE6010B1A)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color(0x99256D85),
                            Color(0xCC0B1636),
                            Color(0xFF040915)
                        ),
                        radius = 1200f
                    )
                )
                .padding(horizontal = 24.dp, vertical = 20.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(36.dp))
                Text(
                    text = peerName,
                    color = Color.White,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = topSubtitle,
                    color = Color(0xFFBFDBFE),
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (incoming.type == "video") "Видеозвонок" else "Аудиозвонок",
                    color = Color(0xFF60A5FA),
                    style = MaterialTheme.typography.titleSmall
                )

                Spacer(modifier = Modifier.weight(1f))

                Box(
                    modifier = Modifier.size(240.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(188.dp * pulseScale)
                            .clip(CircleShape)
                            .background(Color(0xFF10B981).copy(alpha = pulseAlpha))
                    )
                    Box(
                        modifier = Modifier
                            .size(132.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1E293B))
                            .border(width = 2.dp, color = Color(0xFF334155), shape = CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = peerName.firstOrNull()?.uppercase() ?: "?",
                            color = Color.White,
                            style = MaterialTheme.typography.headlineLarge
                        )
                        if (!resolvedAvatarUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = rememberImageRequest(
                                    data = resolvedAvatarUrl,
                                    downsamplePx = 528
                                ),
                                imageLoader = rememberGovChatImageLoader(),
                                contentDescription = peerName,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(28.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Button(
                            onClick = onDecline,
                            enabled = !isBusy,
                            shape = CircleShape,
                            contentPadding = PaddingValues(0.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFEF4444),
                                contentColor = Color.White
                            ),
                            modifier = Modifier.size(74.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.CallEnd,
                                contentDescription = "Отклонить",
                                tint = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Отклонить", color = Color(0xFFFFCDD2), style = MaterialTheme.typography.bodySmall)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Button(
                            onClick = onAccept,
                            enabled = !isBusy,
                            shape = CircleShape,
                            contentPadding = PaddingValues(0.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF22C55E),
                                contentColor = Color.White
                            ),
                            modifier = Modifier.size(74.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Call,
                                contentDescription = "Принять",
                                tint = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Принять", color = Color(0xFFBBF7D0), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun PipCallContent(
    call: ActiveCallUi,
    uiState: CallUiState
) {
    val compactTrack = resolveCompactCallTrack(uiState)
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color.Black
    ) {
        if (call.type == "video" && compactTrack != null) {
            CallVideoView(
                track = compactTrack.track,
                webRtcEglContext = uiState.eglContext,
                liveKitRoom = uiState.liveKitRoom,
                mirror = shouldMirrorLocalVideo(isLocal = compactTrack.isLocal, uiState = uiState),
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

private data class CallVideoFeedItem(
    val id: String,
    val track: CallVideoTrack?,
    val title: String,
    val isLocal: Boolean,
    val userId: String? = null,
    val avatarUrl: String? = null
)

private data class CompactCallTrack(
    val track: CallVideoTrack,
    val isLocal: Boolean
)

private fun shouldMirrorLocalVideo(
    isLocal: Boolean,
    uiState: CallUiState
): Boolean {
    return isLocal &&
        uiState.controls.isUsingFrontCamera &&
        !uiState.controls.isScreenSharing
}

private fun resolveCompactCallTrack(uiState: CallUiState): CompactCallTrack? {
    val remoteTrack = uiState.remoteVideoTracks.firstOrNull() ?: uiState.remoteVideoTrack
    if (remoteTrack != null) {
        return CompactCallTrack(track = remoteTrack, isLocal = false)
    }
    val localTrack = uiState.localVideoTrack ?: return null
    return CompactCallTrack(track = localTrack, isLocal = true)
}

private fun callVideoTrackKey(track: CallVideoTrack): String {
    return when (track) {
        is CallVideoTrack.WebRtc -> "webrtc-${System.identityHashCode(track.track)}"
        is CallVideoTrack.LiveKit -> "livekit-${System.identityHashCode(track.track)}"
    }
}

private fun buildCallVideoFeedItems(
    uiState: CallUiState,
    groupParticipants: List<UserProfile>,
    currentUserProfile: UserProfile?
): List<CallVideoFeedItem> {
    val participantsById = groupParticipants.associateBy { it.id }
    val room = uiState.liveKitRoom
    if (room != null) {
        val remoteParticipants = room.remoteParticipants.values
            .toList()
            .sortedBy { participant ->
                participant.name?.takeIf { it.isNotBlank() }
                    ?: participant.identity?.value?.takeIf { it.isNotBlank() }
                    ?: participant.sid.value
            }
        val remoteItems = remoteParticipants.mapIndexed { index, participant ->
            val participantIdentity = participant.identity?.value?.trim().orEmpty().takeIf { it.isNotBlank() }
            val profile = participantIdentity?.let { participantsById[it] }
            val title = profile?.name?.takeIf { it.isNotBlank() }
                ?: resolveRemoteParticipantTitle(participant, index)
            val participantKey = participant.sid.value.ifBlank { "${index + 1}" }
            CallVideoFeedItem(
                id = "remote-participant-$participantKey",
                track = resolveRemoteLiveKitParticipantTrack(participant),
                title = title,
                isLocal = false,
                userId = profile?.id ?: participantIdentity,
                avatarUrl = profile?.avatarUrl
            )
        }
        val localTitle = currentUserProfile?.name?.takeIf { it.isNotBlank() } ?: "Вы"
        val localItem = CallVideoFeedItem(
            id = "local-self",
            track = uiState.localVideoTrack,
            title = localTitle,
            isLocal = true,
            userId = currentUserProfile?.id,
            avatarUrl = currentUserProfile?.avatarUrl
        )
        return remoteItems + localItem
    }

    val remoteTracks = buildList {
        val seenTrackKeys = mutableSetOf<String>()
        uiState.remoteVideoTracks.forEach { track ->
            val key = callVideoTrackKey(track)
            if (seenTrackKeys.add(key)) {
                add(track)
            }
        }
        uiState.remoteVideoTrack?.let { fallbackTrack ->
            val fallbackKey = callVideoTrackKey(fallbackTrack)
            if (seenTrackKeys.add(fallbackKey)) {
                add(fallbackTrack)
            }
        }
    }
    val remoteItems = remoteTracks.mapIndexed { index, track ->
        CallVideoFeedItem(
            id = "remote-${callVideoTrackKey(track)}",
            track = track,
            title = "Участник ${index + 1}",
            isLocal = false
        )
    }
    val localItem = uiState.localVideoTrack?.let { localTrack ->
        CallVideoFeedItem(
            id = "local-${callVideoTrackKey(localTrack)}",
            track = localTrack,
            title = currentUserProfile?.name?.takeIf { it.isNotBlank() } ?: "Вы",
            isLocal = true,
            userId = currentUserProfile?.id,
            avatarUrl = currentUserProfile?.avatarUrl
        )
    }
    return if (localItem != null) remoteItems + localItem else remoteItems
}

private fun resolveRemoteParticipantTitle(participant: RemoteParticipant, index: Int): String {
    val nameCandidate = participant.name?.trim().orEmpty()
    if (!looksLikeTechnicalParticipantId(nameCandidate)) {
        return nameCandidate
    }
    val identityCandidate = participant.identity?.value?.trim().orEmpty()
    if (!looksLikeTechnicalParticipantId(identityCandidate)) {
        return identityCandidate
    }
    return "Участник ${index + 1}"
}

private fun looksLikeTechnicalParticipantId(value: String): Boolean {
    if (value.isBlank()) return true
    val candidate = value.trim()
    if (candidate.contains(' ')) return false
    if (Regex("^[0-9a-fA-F]{24}$").matches(candidate)) return true
    if (Regex("^[0-9a-fA-F\\-]{32,}$").matches(candidate)) return true
    if (candidate.length >= 20 && candidate.none { it == '@' || it == '.' }) return true
    return false
}

private fun resolveRemoteLiveKitParticipantTrack(
    participant: RemoteParticipant
): CallVideoTrack.LiveKit? {
    var screenShareTrack: LiveKitMediaVideoTrack? = null
    var cameraTrack: LiveKitMediaVideoTrack? = null
    for (publication in extractLiveKitTrackPublications(participant.videoTrackPublications)) {
        if (publication.muted) continue
        val track = publication.track as? LiveKitMediaVideoTrack ?: continue
        when (publication.source) {
            LiveKitTrack.Source.SCREEN_SHARE -> if (screenShareTrack == null) {
                screenShareTrack = track
            }
            LiveKitTrack.Source.CAMERA -> if (cameraTrack == null) {
                cameraTrack = track
            }
            else -> if (cameraTrack == null) {
                cameraTrack = track
            }
        }
    }
    val chosenTrack = screenShareTrack ?: cameraTrack ?: return null
    return CallVideoTrack.LiveKit(chosenTrack)
}

private fun extractLiveKitTrackPublications(publications: Any?): List<LiveKitTrackPublication> {
    return when (publications) {
        null -> emptyList()
        is LiveKitTrackPublication -> listOf(publications)
        is Pair<*, *> -> listOfNotNull(
            publications.first as? LiveKitTrackPublication,
            publications.second as? LiveKitTrackPublication
        )
        is Map<*, *> -> publications.values.flatMap { extractLiveKitTrackPublications(it) }
        is Iterable<*> -> publications.flatMap { extractLiveKitTrackPublications(it) }
        is Array<*> -> publications.flatMap { extractLiveKitTrackPublications(it) }
        else -> emptyList()
    }.distinctBy { it.sid }
}

@Composable
private fun ActiveCallOverlay(
    call: ActiveCallUi,
    uiState: CallUiState,
    groupParticipants: List<UserProfile>,
    currentUserProfile: UserProfile?,
    remoteChatAvatarUrl: String?,
    onLeaveCall: () -> Unit,
    onToggleMinimize: () -> Unit,
    onInteraction: () -> Unit,
    onToggleMicrophone: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onToggleScreenShare: () -> Unit
) {
    val nowMillis by produceState(initialValue = System.currentTimeMillis(), key1 = call.callId) {
        value = System.currentTimeMillis()
        while (true) {
            delay(1000)
            value = System.currentTimeMillis()
        }
    }
    val elapsedSeconds = ((nowMillis - call.startedAtMillis).coerceAtLeast(0L) / 1000L).toInt()

    val phaseLabel = rememberCallPhaseLabel(
        call = call,
        phase = uiState.phase,
        elapsedSeconds = elapsedSeconds
    )
    val subStatus = rememberCallSubStatus(call = call, uiState = uiState)
    val isGroupVideoLayout = call.isGroup && call.type == "video"
    val feedItems = remember(
        uiState.remoteVideoTracks,
        uiState.remoteVideoTrack,
        uiState.localVideoTrack,
        uiState.liveKitRoom,
        groupParticipants,
        currentUserProfile
    ) {
        buildCallVideoFeedItems(
            uiState = uiState,
            groupParticipants = groupParticipants,
            currentUserProfile = currentUserProfile
        )
    }
    var selectedFeedItemId by remember(call.callId) { mutableStateOf<String?>(null) }

    LaunchedEffect(feedItems) {
        if (feedItems.none { it.id == selectedFeedItemId }) {
            selectedFeedItemId = feedItems.firstOrNull { !it.isLocal }?.id ?: feedItems.firstOrNull()?.id
        }
    }
    val selectedFeedItem = feedItems.firstOrNull { it.id == selectedFeedItemId }
    val mainVideoItem = if (isGroupVideoLayout) {
        selectedFeedItem ?: feedItems.firstOrNull()
    } else {
        val remoteTrack = uiState.remoteVideoTracks.firstOrNull() ?: uiState.remoteVideoTrack
        when {
            remoteTrack != null -> CallVideoFeedItem(
                id = "remote-main-${callVideoTrackKey(remoteTrack)}",
                track = remoteTrack,
                title = call.chatName,
                isLocal = false,
                avatarUrl = remoteChatAvatarUrl
            )

            call.type == "video" -> CallVideoFeedItem(
                id = "remote-main-missing-${call.callId}",
                track = null,
                title = call.chatName,
                isLocal = false,
                avatarUrl = remoteChatAvatarUrl
            )

            else -> null
        }
    }

    val pipWidth = 118.dp
    val pipHeight = 176.dp
    var pipOffset by remember(call.callId) { mutableStateOf(androidx.compose.ui.unit.IntOffset.Zero) }
    var pipInitialized by remember(call.callId) { mutableStateOf(false) }

    androidx.compose.foundation.layout.BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xE6000000))
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(8.dp)
    ) {
        val density = androidx.compose.ui.platform.LocalDensity.current
        val maxWidthPx = with(density) { maxWidth.roundToPx() }
        val maxHeightPx = with(density) { maxHeight.roundToPx() }
        val pipWidthPx = with(density) { pipWidth.roundToPx() }
        val pipHeightPx = with(density) { pipHeight.roundToPx() }
        val pipMarginPx = with(density) { 14.dp.roundToPx() }

        if (!pipInitialized) {
            pipOffset = androidx.compose.ui.unit.IntOffset(
                x = (maxWidthPx - pipWidthPx - pipMarginPx).coerceAtLeast(0),
                y = pipMarginPx
            )
            pipInitialized = true
        } else {
            pipOffset = clampFloatingOffset(
                offset = pipOffset,
                containerWidthPx = maxWidthPx,
                containerHeightPx = maxHeightPx,
                itemWidthPx = pipWidthPx,
                itemHeightPx = pipHeightPx,
                marginPx = pipMarginPx
            )
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFF0B1220))
                .clickable { onInteraction() }
        ) {
            if (call.type == "video" && mainVideoItem?.track != null) {
                CallVideoView(
                    track = mainVideoItem.track,
                    webRtcEglContext = uiState.eglContext,
                    liveKitRoom = uiState.liveKitRoom,
                    mirror = shouldMirrorLocalVideo(isLocal = mainVideoItem.isLocal, uiState = uiState),
                    modifier = Modifier.fillMaxSize()
                )
            } else if (call.type == "video" && mainVideoItem != null) {
                CallParticipantVideoPlaceholder(
                    title = mainVideoItem.title,
                    avatarUrl = mainVideoItem.avatarUrl,
                    subtitle = if (mainVideoItem.isLocal && !uiState.controls.isCameraEnabled) {
                        "Камера выключена"
                    } else {
                        "Камера выключена"
                    },
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                CallNoVideoPlaceholder(
                    call = call,
                    phaseLabel = phaseLabel,
                    subStatus = subStatus
                )
            }

            if (!isGroupVideoLayout && call.type == "video" && uiState.localVideoTrack != null) {
                CallVideoView(
                    track = uiState.localVideoTrack,
                    webRtcEglContext = uiState.eglContext,
                    liveKitRoom = uiState.liveKitRoom,
                    mirror = shouldMirrorLocalVideo(isLocal = true, uiState = uiState),
                    zOrderMediaOverlay = true,
                    modifier = Modifier
                        .offset { pipOffset }
                        .size(width = pipWidth, height = pipHeight)
                        .shadow(16.dp, RoundedCornerShape(14.dp), clip = true)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xAA0F172A))
                        .pointerInput(maxWidthPx, maxHeightPx, pipWidthPx, pipHeightPx) {
                            detectDragGestures(
                                onDragStart = { onInteraction() },
                                onDrag = { _: PointerInputChange, dragAmount: Offset ->
                                    val next = androidx.compose.ui.unit.IntOffset(
                                        x = pipOffset.x + dragAmount.x.toInt(),
                                        y = pipOffset.y + dragAmount.y.toInt()
                                    )
                                    pipOffset = clampFloatingOffset(
                                        offset = next,
                                        containerWidthPx = maxWidthPx,
                                        containerHeightPx = maxHeightPx,
                                        itemWidthPx = pipWidthPx,
                                        itemHeightPx = pipHeightPx,
                                        marginPx = pipMarginPx
                                    )
                                }
                            )
                        }
                        .clickable { onInteraction() }
                )
            }

            if (isGroupVideoLayout && feedItems.isNotEmpty()) {
                val thumbnailsBottomPadding = if (uiState.isControlsVisible) 116.dp else 20.dp
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(start = 12.dp, end = 12.dp, bottom = thumbnailsBottomPadding)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    feedItems.forEach { item ->
                        val selected = item.id == selectedFeedItemId
                        Surface(
                            modifier = Modifier
                                .size(width = 96.dp, height = 132.dp)
                                .border(
                                    width = if (selected) 2.dp else 1.dp,
                                    color = if (selected) Color(0xFF60A5FA) else Color(0x66334155),
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clip(RoundedCornerShape(12.dp))
                                .clickable {
                                    selectedFeedItemId = item.id
                                    onInteraction()
                                },
                            color = Color(0xCC0F172A)
                        ) {
                            Box(modifier = Modifier.fillMaxSize()) {
                                if (item.track != null) {
                                    CallVideoView(
                                        track = item.track,
                                        webRtcEglContext = uiState.eglContext,
                                        liveKitRoom = uiState.liveKitRoom,
                                        mirror = shouldMirrorLocalVideo(isLocal = item.isLocal, uiState = uiState),
                                        zOrderMediaOverlay = true,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    CallParticipantVideoPlaceholder(
                                        title = item.title,
                                        avatarUrl = item.avatarUrl,
                                        subtitle = "Камера выключена",
                                        compact = true,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                }
                                Surface(
                                    color = Color(0xAA020617),
                                    shape = RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp),
                                    modifier = Modifier
                                        .align(Alignment.BottomCenter)
                                        .fillMaxWidth()
                                ) {
                                    Text(
                                        text = item.title,
                                        color = Color.White,
                                        style = MaterialTheme.typography.labelSmall,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Column(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 14.dp, start = 56.dp, end = 56.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = call.chatName,
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = phaseLabel,
                    color = Color(0xFFD3E8FF),
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center
                )
                if (subStatus.isNotBlank()) {
                    Text(
                        text = subStatus,
                        color = Color(0xFFA8CBF3),
                        style = MaterialTheme.typography.labelSmall,
                        textAlign = TextAlign.Center
                    )
                }
                if (!uiState.statusMessage.isNullOrBlank()) {
                    Text(
                        text = uiState.statusMessage,
                        color = Color(0xFFFBBF24),
                        style = MaterialTheme.typography.labelSmall,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Surface(
                color = Color(0x7A101E35),
                shape = CircleShape,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp)
                    .size(44.dp)
                    .border(1.dp, Color(0x40FFFFFF), CircleShape)
                    .clickable {
                        onInteraction()
                        onToggleMinimize()
                    }
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.Fullscreen,
                        contentDescription = "Свернуть",
                        tint = Color.White
                    )
                }
            }

            androidx.compose.animation.AnimatedVisibility(
                visible = uiState.isControlsVisible,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 20.dp),
                enter = androidx.compose.animation.fadeIn() +
                    androidx.compose.animation.slideInVertically { it / 2 },
                exit = androidx.compose.animation.fadeOut() +
                    androidx.compose.animation.slideOutVertically { it / 2 }
            ) {
                CallControlsBar(
                    call = call,
                    controls = uiState.controls,
                    onInteraction = onInteraction,
                    onToggleMicrophone = onToggleMicrophone,
                    onToggleCamera = onToggleCamera,
                    onSwitchCamera = onSwitchCamera,
                    onToggleScreenShare = onToggleScreenShare,
                    onLeaveCall = onLeaveCall
                )
            }
        }
    }
}

@Composable
private fun MinimizedCallWindow(
    call: ActiveCallUi,
    uiState: CallUiState,
    onExpand: () -> Unit,
    onLeaveCall: () -> Unit
) {
    val compactTrack = resolveCompactCallTrack(uiState)
    var offset by remember(call.callId) { mutableStateOf(androidx.compose.ui.unit.IntOffset.Zero) }
    var initialized by remember(call.callId) { mutableStateOf(false) }

    androidx.compose.foundation.layout.BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        val density = androidx.compose.ui.platform.LocalDensity.current
        val width = 176.dp
        val height = 122.dp
        val margin = 12.dp
        val widthPx = with(density) { width.roundToPx() }
        val heightPx = with(density) { height.roundToPx() }
        val marginPx = with(density) { margin.roundToPx() }
        val maxWidthPx = with(density) { maxWidth.roundToPx() }
        val maxHeightPx = with(density) { maxHeight.roundToPx() }

        if (!initialized) {
            offset = androidx.compose.ui.unit.IntOffset(
                x = (maxWidthPx - widthPx - marginPx).coerceAtLeast(0),
                y = (maxHeightPx - heightPx - marginPx).coerceAtLeast(0)
            )
            initialized = true
        } else {
            offset = clampFloatingOffset(
                offset = offset,
                containerWidthPx = maxWidthPx,
                containerHeightPx = maxHeightPx,
                itemWidthPx = widthPx,
                itemHeightPx = heightPx,
                marginPx = marginPx
            )
        }

        Surface(
            modifier = Modifier
                .offset { offset }
                .size(width = width, height = height)
                .shadow(18.dp, RoundedCornerShape(14.dp), clip = true)
                .clip(RoundedCornerShape(14.dp))
                .pointerInput(maxWidthPx, maxHeightPx, widthPx, heightPx) {
                    detectDragGestures { _: PointerInputChange, dragAmount: Offset ->
                        val next = androidx.compose.ui.unit.IntOffset(
                            x = offset.x + dragAmount.x.toInt(),
                            y = offset.y + dragAmount.y.toInt()
                        )
                        offset = clampFloatingOffset(
                            offset = next,
                            containerWidthPx = maxWidthPx,
                            containerHeightPx = maxHeightPx,
                            itemWidthPx = widthPx,
                            itemHeightPx = heightPx,
                            marginPx = marginPx
                        )
                    }
                }
                .clickable(onClick = onExpand),
            color = Color(0xEE0F172A)
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (call.type == "video" && compactTrack != null) {
                    CallVideoView(
                        track = compactTrack.track,
                        webRtcEglContext = uiState.eglContext,
                        liveKitRoom = uiState.liveKitRoom,
                        mirror = shouldMirrorLocalVideo(isLocal = compactTrack.isLocal, uiState = uiState),
                        modifier = Modifier.fillMaxSize()
                    )
                }

                Surface(
                    color = Color(0x9A020617),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                ) {
                    Text(
                        text = "${call.chatName}\nЗвонок свернут",
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                    )
                }

                Row(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Surface(
                        color = Color(0xA3112239),
                        shape = CircleShape,
                        modifier = Modifier
                            .size(32.dp)
                            .clickable(onClick = onExpand)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Filled.Fullscreen,
                                contentDescription = "Развернуть",
                                tint = Color.White
                            )
                        }
                    }
                    Surface(
                        color = Color(0xE84141),
                        shape = CircleShape,
                        modifier = Modifier
                            .size(32.dp)
                            .clickable(onClick = onLeaveCall)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Filled.Close,
                                contentDescription = "Завершить звонок",
                                tint = Color.White
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CallNoVideoPlaceholder(
    call: ActiveCallUi,
    phaseLabel: String,
    subStatus: String
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            AvatarBubble(title = call.chatName)
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = call.chatName,
                color = Color.White,
                style = MaterialTheme.typography.titleLarge
            )
            Text(
                text = phaseLabel,
                color = Color(0xFFBFDBFE),
                style = MaterialTheme.typography.bodyMedium
            )
            if (subStatus.isNotBlank()) {
                Text(
                    text = subStatus,
                    color = Color(0xFF93C5FD),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun CallParticipantVideoPlaceholder(
    title: String,
    avatarUrl: String?,
    subtitle: String,
    compact: Boolean = false,
    modifier: Modifier = Modifier
) {
    val avatarSize = if (compact) 34.dp else 56.dp
    val titleStyle = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.titleMedium
    val subtitleStyle = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.bodySmall
    val resolvedAvatarUrl = remember(avatarUrl) { resolveAvatarUrl(avatarUrl).ifBlank { null } }
    Box(
        modifier = modifier.background(Color(0xFF0F172A)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(avatarSize)
                    .clip(CircleShape)
                    .background(Color(0xFF334155)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = title.firstOrNull()?.uppercase() ?: "?",
                    color = Color.White,
                    style = if (compact) MaterialTheme.typography.labelMedium else MaterialTheme.typography.titleLarge
                )
                if (!resolvedAvatarUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = rememberImageRequest(
                            data = resolvedAvatarUrl,
                            downsamplePx = if (compact) 96 else 160
                        ),
                        imageLoader = rememberGovChatImageLoader(),
                        contentDescription = title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }
            }
            Spacer(modifier = Modifier.height(if (compact) 4.dp else 10.dp))
            Text(
                text = title,
                color = Color.White,
                style = titleStyle,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                color = Color(0xFF94A3B8),
                style = subtitleStyle,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ChatHeaderActionButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit
) {
    Surface(
        color = Color(0x1FFFFFFF),
        shape = CircleShape,
        modifier = Modifier
            .size(38.dp)
            .border(1.dp, Color(0x2DFFFFFF), CircleShape)
            .clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = Color(0xFFE5F0FF),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
private fun CallControlsBar(
    call: ActiveCallUi,
    controls: CallControlsState,
    onInteraction: () -> Unit,
    onToggleMicrophone: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onToggleScreenShare: () -> Unit,
    onLeaveCall: () -> Unit
) {
    val isCompactControls = LocalConfiguration.current.screenWidthDp <= 360
    val regularButtonSize = if (isCompactControls) 48.dp else 56.dp
    val dangerButtonSize = if (isCompactControls) 52.dp else 60.dp
    val regularIconSize = if (isCompactControls) 21.dp else 23.dp
    val dangerIconSize = if (isCompactControls) 22.dp else 24.dp
    val controlsSpacing = if (isCompactControls) 6.dp else 10.dp
    val controlsHorizontalPadding = if (isCompactControls) 8.dp else 14.dp
    val controlsVerticalPadding = if (isCompactControls) 10.dp else 12.dp

    Surface(
        color = Color.Transparent,
        shape = RoundedCornerShape(32.dp),
        modifier = Modifier
            .padding(horizontal = 10.dp)
            .shadow(22.dp, RoundedCornerShape(32.dp))
            .border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(32.dp))
    ) {
        Row(
            modifier = Modifier
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Color(0xCE2A384F),
                            Color(0xCF244742),
                            Color(0xCE2B3C59)
                        )
                    )
                )
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = controlsHorizontalPadding, vertical = controlsVerticalPadding),
            horizontalArrangement = Arrangement.spacedBy(controlsSpacing),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CallControlButton(
                icon = if (controls.isMicrophoneEnabled) Icons.Filled.Mic else Icons.Filled.MicOff,
                contentDescription = if (controls.isMicrophoneEnabled) "Выключить микрофон" else "Включить микрофон",
                selected = !controls.isMicrophoneEnabled,
                buttonSize = regularButtonSize,
                iconSize = regularIconSize,
                onClick = {
                    onInteraction()
                    onToggleMicrophone()
                }
            )

            if (call.type == "video") {
                CallControlButton(
                    icon = if (controls.isCameraEnabled) Icons.Filled.Videocam else Icons.Filled.VideocamOff,
                    contentDescription = if (controls.isCameraEnabled) "Выключить камеру" else "Включить камеру",
                    selected = !controls.isCameraEnabled,
                    buttonSize = regularButtonSize,
                    iconSize = regularIconSize,
                    onClick = {
                        onInteraction()
                        onToggleCamera()
                    }
                )
                CallControlButton(
                    icon = Icons.Filled.Cached,
                    contentDescription = "Сменить камеру",
                    selected = false,
                    enabled = controls.canSwitchCamera,
                    buttonSize = regularButtonSize,
                    iconSize = regularIconSize,
                    onClick = {
                        onInteraction()
                        onSwitchCamera()
                    }
                )
                CallControlButton(
                    icon = Icons.Filled.DesktopWindows,
                    contentDescription = if (controls.isScreenSharing) {
                        "Остановить демонстрацию экрана"
                    } else {
                        "Начать демонстрацию экрана"
                    },
                    selected = controls.isScreenSharing,
                    enabled = controls.isScreenSharing || controls.isScreenShareSupported,
                    buttonSize = regularButtonSize,
                    iconSize = regularIconSize,
                    onClick = {
                        onInteraction()
                        onToggleScreenShare()
                    }
                )
            }

            CallControlButton(
                icon = Icons.Filled.CallEnd,
                contentDescription = "Завершить звонок",
                selected = true,
                danger = true,
                buttonSize = dangerButtonSize,
                iconSize = dangerIconSize,
                onClick = {
                    onInteraction()
                    onLeaveCall()
                }
            )
        }
    }
}

@Composable
private fun CallControlButton(
    icon: ImageVector,
    contentDescription: String,
    selected: Boolean,
    onClick: () -> Unit,
    buttonSize: Dp = 56.dp,
    iconSize: Dp = 23.dp,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    danger: Boolean = false
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed && enabled) 0.92f else 1f,
        animationSpec = spring(dampingRatio = 0.72f, stiffness = 520f),
        label = "callControlScale"
    )

    val backgroundTarget = when {
        !enabled -> Color(0x17FFFFFF)
        danger -> Color(0xFFE34D4D)
        selected -> Color(0x7A2563EB)
        else -> Color(0x1EFFFFFF)
    }
    val borderTarget = when {
        !enabled -> Color(0x18FFFFFF)
        danger -> Color(0x00FFFFFF)
        selected -> Color(0xFF8BB5FF)
        else -> Color(0x2AFFFFFF)
    }
    val iconTarget = when {
        !enabled -> Color(0xFF75839A)
        selected -> Color(0xFFEFF6FF)
        else -> Color.White
    }

    val background by animateColorAsState(
        targetValue = backgroundTarget,
        animationSpec = tween(durationMillis = 180),
        label = "callControlBg"
    )
    val borderColor by animateColorAsState(
        targetValue = borderTarget,
        animationSpec = tween(durationMillis = 180),
        label = "callControlBorder"
    )
    val iconColor by animateColorAsState(
        targetValue = iconTarget,
        animationSpec = tween(durationMillis = 150),
        label = "callControlIcon"
    )

    Surface(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .size(buttonSize)
            .clip(CircleShape)
            .border(1.dp, borderColor, CircleShape)
            .clickable(
                enabled = enabled,
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            ),
        shape = CircleShape,
        color = background
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = iconColor,
                modifier = Modifier.size(iconSize)
            )
        }
    }
}

private fun rememberCallPhaseLabel(
    call: ActiveCallUi,
    phase: CallUiPhase,
    elapsedSeconds: Int
): String {
    return when (phase) {
        CallUiPhase.Outgoing -> "Вызов..."
        CallUiPhase.Connecting -> "Подключение..."
        CallUiPhase.Reconnecting -> "Переподключение..."
        CallUiPhase.PoorNetwork -> "Плохая сеть"
        CallUiPhase.Ended -> "Звонок завершен"
        CallUiPhase.Active -> {
            if (call.phase == ActiveCallPhase.Outgoing) {
                "Соединение..."
            } else {
                formatCallDuration(elapsedSeconds)
            }
        }

        CallUiPhase.Idle -> "Звонок"
    }
}

private fun rememberCallSubStatus(
    call: ActiveCallUi,
    uiState: CallUiState
): String {
    val labels = mutableListOf<String>()
    val hasRemoteVideo = uiState.remoteVideoTracks.isNotEmpty() || uiState.remoteVideoTrack != null
    if (!uiState.controls.isMicrophoneEnabled) labels += "Микрофон выключен"
    if (call.type == "video" && !uiState.controls.isCameraEnabled) labels += "Камера выключена"
    if (call.type == "video" && uiState.phase == CallUiPhase.Active && !hasRemoteVideo) {
        labels += "Видео собеседника недоступно"
    }
    if (uiState.phase == CallUiPhase.Reconnecting) labels += "Восстанавливаем соединение"
    return labels.joinToString(separator = " • ")
}

private fun clampFloatingOffset(
    offset: androidx.compose.ui.unit.IntOffset,
    containerWidthPx: Int,
    containerHeightPx: Int,
    itemWidthPx: Int,
    itemHeightPx: Int,
    marginPx: Int
): androidx.compose.ui.unit.IntOffset {
    val minX = marginPx
    val minY = marginPx
    val maxX = (containerWidthPx - itemWidthPx - marginPx).coerceAtLeast(minX)
    val maxY = (containerHeightPx - itemHeightPx - marginPx).coerceAtLeast(minY)
    return androidx.compose.ui.unit.IntOffset(
        x = offset.x.coerceIn(minX, maxX),
        y = offset.y.coerceIn(minY, maxY)
    )
}

@Composable
private fun CallVideoView(
    track: CallVideoTrack,
    webRtcEglContext: EglBase.Context?,
    liveKitRoom: Room?,
    mirror: Boolean,
    zOrderMediaOverlay: Boolean = false,
    modifier: Modifier = Modifier
) {
    when (track) {
        is CallVideoTrack.WebRtc -> {
            val eglContext = webRtcEglContext ?: return
            val webRtcTrack = track.track
            val trackId = remember(webRtcTrack) { System.identityHashCode(webRtcTrack) }
            val eglId = remember(eglContext) { System.identityHashCode(eglContext) }
            androidx.compose.runtime.key(trackId, eglId) {
                AndroidView(
                    factory = { ctx ->
                        WebRtcSurfaceViewRenderer(ctx).apply {
                            setEnableHardwareScaler(true)
                            setScalingType(WebRtcRendererCommon.ScalingType.SCALE_ASPECT_FILL)
                            init(eglContext, null)
                            setMirror(mirror)
                            setZOrderMediaOverlay(zOrderMediaOverlay)
                            webRtcTrack.addSink(this)
                        }
                    },
                    update = { renderer ->
                        renderer.setMirror(mirror)
                        renderer.setZOrderMediaOverlay(zOrderMediaOverlay)
                    },
                    onRelease = { renderer ->
                        runCatching { webRtcTrack.removeSink(renderer) }
                        runCatching { renderer.release() }
                    },
                    modifier = modifier
                )
            }
        }

        is CallVideoTrack.LiveKit -> {
            val room = liveKitRoom ?: return
            val liveKitTrack = track.track
            val trackId = remember(liveKitTrack) { System.identityHashCode(liveKitTrack) }
            val roomId = remember(room) { System.identityHashCode(room) }
            androidx.compose.runtime.key(trackId, roomId) {
                AndroidView(
                    factory = { ctx ->
                        LiveKitSurfaceViewRenderer(ctx).apply {
                            setEnableHardwareScaler(true)
                            setScalingType(LiveKitRendererCommon.ScalingType.SCALE_ASPECT_FILL)
                            room.initVideoRenderer(this)
                            setMirror(mirror)
                            setZOrderMediaOverlay(zOrderMediaOverlay)
                            liveKitTrack.addRenderer(this)
                        }
                    },
                    update = { renderer ->
                        renderer.setMirror(mirror)
                        renderer.setZOrderMediaOverlay(zOrderMediaOverlay)
                    },
                    onRelease = { renderer ->
                        runCatching { liveKitTrack.removeRenderer(renderer) }
                        runCatching { renderer.release() }
                    },
                    modifier = modifier
                )
            }
        }
    }
}

@Composable
private fun MessageDaySeparator(label: String) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            color = Color(0xFF223244),
            shape = RoundedCornerShape(999.dp),
            modifier = Modifier
                .border(1.dp, Color(0x5A4A6B88), RoundedCornerShape(999.dp))
        ) {
            Text(
                text = label,
                color = Color(0xFF9FB4C7),
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )
        }
    }
}

@Composable
private fun MessageBubble(
    message: ChatMessage,
    isMine: Boolean,
    playbackCoordinator: PlaybackCoordinator,
    activePlaybackMessageId: String?,
    onActivePlaybackChanged: (String?) -> Unit,
    isVisibleInViewport: Boolean,
    shouldAutoplayVideoNote: Boolean,
    onAttachmentClick: (MessageType, MessageAttachment?) -> Unit
) {
    val alignment = if (isMine) Alignment.End else Alignment.Start
    val bubbleColor = if (isMine) Color(0xFF2B5278) else Color(0xFF182533)
    val bubbleShape = if (isMine) {
        RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp)
    } else {
        RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = if (isMine) 48.dp else 0.dp,
                end = if (isMine) 0.dp else 48.dp
            ),
        horizontalAlignment = alignment
    ) {
        Surface(
            shape = bubbleShape,
            color = bubbleColor,
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (!isMine && message.senderName.isNotBlank()) {
                    Text(
                        text = message.senderName,
                        color = Color(0xFF5EB5F7),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                }

                MessageBody(
                    message = message,
                    playbackCoordinator = playbackCoordinator,
                    activePlaybackMessageId = activePlaybackMessageId,
                    onActivePlaybackChanged = onActivePlaybackChanged,
                    isVisibleInViewport = isVisibleInViewport,
                    shouldAutoplayVideoNote = shouldAutoplayVideoNote,
                    onAttachmentClick = { onAttachmentClick(message.type, message.attachment) }
                )

                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    modifier = Modifier.align(Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatTime(message.createdAtMillis),
                        color = Color(0x99FFFFFF),
                        fontSize = 11.sp
                    )
                    if (isMine) {
                        Spacer(modifier = Modifier.size(4.dp))
                        Text(
                            text = when (message.deliveryStatus) {
                                MessageDeliveryStatus.Sent -> "✓"
                                MessageDeliveryStatus.Delivered -> "✓✓"
                                MessageDeliveryStatus.Read -> "✓✓"
                            },
                            color = if (message.deliveryStatus == MessageDeliveryStatus.Read) {
                                Color(0xFF5EB5F7)
                            } else {
                                Color(0x99FFFFFF)
                            },
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBody(
    message: ChatMessage,
    playbackCoordinator: PlaybackCoordinator,
    activePlaybackMessageId: String?,
    onActivePlaybackChanged: (String?) -> Unit,
    isVisibleInViewport: Boolean,
    shouldAutoplayVideoNote: Boolean,
    onAttachmentClick: () -> Unit
) {
    when (message.type) {
        MessageType.Image -> {
            val imageUrl = resolveMediaUrl(message.attachment?.url)
            if (imageUrl != null) {
                RemoteImagePreview(
                    imageUrl = imageUrl,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { onAttachmentClick() }
                )
            }
            if (message.text.isNotBlank()) {
                Text(text = message.text, color = Color.White)
            }
        }

        MessageType.Video -> {
            AttachmentLink(
                title = message.attachment?.originalName?.ifBlank { "Видео" } ?: "Видео",
                subtitle = "Скачать видео",
                onClick = onAttachmentClick
            )
            if (message.text.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = message.text, color = Color.White)
            }
        }

        MessageType.VideoNote -> {
            VideoNoteMessageBubble(
                message = message,
                onFallbackClick = onAttachmentClick,
                playbackCoordinator = playbackCoordinator,
                onActivePlaybackChanged = onActivePlaybackChanged,
                isVisibleInViewport = isVisibleInViewport,
                shouldAutoplay = shouldAutoplayVideoNote
            )
        }

        MessageType.Audio -> {
            AttachmentLink(
                title = message.attachment?.originalName?.ifBlank { "Голосовое сообщение" } ?: "Голосовое сообщение",
                subtitle = "Скачать аудио",
                onClick = onAttachmentClick
            )
        }

        MessageType.Voice -> {
            VoiceMessageBody(
                message = message,
                playbackCoordinator = playbackCoordinator,
                isActive = activePlaybackMessageId == message.id,
                onActivePlaybackChanged = onActivePlaybackChanged,
                onFallbackClick = onAttachmentClick
            )
        }

        MessageType.File -> {
            val attachment = message.attachment
            AttachmentLink(
                title = attachment?.originalName?.ifBlank { "Файл" } ?: "Файл",
                subtitle = attachment?.sizeBytes?.toReadableSize() ?: "Скачать",
                onClick = onAttachmentClick
            )
        }

        MessageType.System -> {
            Text(text = message.text.ifBlank { "Системное сообщение" }, color = Color(0xFFE2E8F0))
        }

        MessageType.Text -> {
            Text(text = message.text, color = Color.White)
        }
    }
}

@Composable
private fun VoiceMessageBody(
    message: ChatMessage,
    playbackCoordinator: PlaybackCoordinator,
    isActive: Boolean,
    onActivePlaybackChanged: (String?) -> Unit,
    onFallbackClick: () -> Unit
) {
    val audioUrl = resolveMediaUrl(message.attachment?.url)
    val resolvedDurationMs = rememberResolvedMediaDuration(
        initialDurationMs = message.attachment?.durationMs,
        mediaUrl = audioUrl
    )
    if (audioUrl == null) {
        AttachmentLink(
            title = "Голосовое сообщение",
            subtitle = "Скачать аудио",
            onClick = onFallbackClick
        )
        return
    }
    val isPlaying = isActive

    val waveformBars = remember(message.id) {
        listOf(5.dp, 9.dp, 7.dp, 12.dp, 8.dp, 14.dp, 10.dp, 12.dp, 8.dp, 6.dp, 11.dp, 9.dp)
    }

    Surface(
        color = Color(0x33000000),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onFallbackClick() }
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = CircleShape,
                color = Color(0xFF5EB5F7),
                modifier = Modifier
                    .size(34.dp)
                    .clickable {
                        playbackCoordinator.toggle(
                            messageId = message.id,
                            url = audioUrl,
                            onActiveChanged = onActivePlaybackChanged,
                            onError = onFallbackClick
                        )
                    }
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (isPlaying) "Пауза" else "Воспроизвести",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.size(8.dp))

            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalAlignment = Alignment.Bottom
            ) {
                waveformBars.forEach { height ->
                    Box(
                        modifier = Modifier
                            .width(3.dp)
                            .height(height)
                            .clip(RoundedCornerShape(2.dp))
                            .background(
                                if (isPlaying) Color(0xFF9ED7FF) else Color(0xFF6B7D8E)
                            )
                    )
                }
            }

            Spacer(modifier = Modifier.size(8.dp))
            Text(
                text = formatMediaDuration(resolvedDurationMs),
                color = Color(0xFFD6E4F5),
                fontSize = 12.sp
            )
        }
    }
}

@Composable
private fun VideoNoteMessageBubble(
    message: ChatMessage,
    onFallbackClick: () -> Unit,
    playbackCoordinator: PlaybackCoordinator,
    onActivePlaybackChanged: (String?) -> Unit,
    isVisibleInViewport: Boolean,
    shouldAutoplay: Boolean
) {
    val videoUrl = resolveMediaUrl(message.attachment?.url)
    val resolvedDurationMs = rememberResolvedMediaDuration(
        initialDurationMs = message.attachment?.durationMs,
        mediaUrl = videoUrl
    )
    val context = LocalContext.current
    val exoPlayer = remember(videoUrl) {
        videoUrl?.let { url ->
            MediaCacheManager.createPlayer(context).apply {
                repeatMode = Player.REPEAT_MODE_ONE
                setMediaItem(MediaCacheManager.mediaItem(url))
                prepare()
                playWhenReady = false
            }
        }
    }
    var isPlaying by remember(message.id) { mutableStateOf(false) }
    var progress by remember(message.id) { mutableStateOf(0f) }
    var measuredDurationMs by remember(message.id) { mutableStateOf(0L) }

    DisposableEffect(exoPlayer, message.id) {
        val player = exoPlayer
        if (player == null) {
            onDispose { }
        } else {
            val listener = object : Player.Listener {
                override fun onIsPlayingChanged(playing: Boolean) {
                    isPlaying = playing
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        measuredDurationMs = player.duration.takeIf { it > 0L } ?: measuredDurationMs
                    }
                }

                override fun onPlayerError(error: PlaybackException) {
                    isPlaying = false
                    progress = 0f
                    if (playbackCoordinator.activeVideoId() == message.id) {
                        playbackCoordinator.deactivateVideo(message.id, onActivePlaybackChanged)
                    }
                }
            }
            player.addListener(listener)
            onDispose {
                player.removeListener(listener)
                if (playbackCoordinator.activeVideoId() == message.id) {
                    playbackCoordinator.deactivateVideo(message.id, onActivePlaybackChanged)
                }
                player.release()
            }
        }
    }

    LaunchedEffect(exoPlayer, isVisibleInViewport, shouldAutoplay) {
        val player = exoPlayer ?: return@LaunchedEffect
        if (!isVisibleInViewport) {
            if (playbackCoordinator.activeVideoId() == message.id) {
                player.pause()
                player.seekTo(0L)
                progress = 0f
                playbackCoordinator.deactivateVideo(message.id, onActivePlaybackChanged)
            }
            return@LaunchedEffect
        }

        if (shouldAutoplay) {
            val activated = playbackCoordinator.activateVideo(
                messageId = message.id,
                player = player,
                onActiveChanged = onActivePlaybackChanged
            )
            if (activated) {
                player.playWhenReady = true
                player.play()
            }
        }
    }

    LaunchedEffect(exoPlayer, isVisibleInViewport) {
        val player = exoPlayer ?: return@LaunchedEffect
        while (isVisibleInViewport) {
            val duration = player.duration.takeIf { it > 0L } ?: measuredDurationMs
            val current = player.currentPosition.coerceAtLeast(0L)
            measuredDurationMs = duration
            progress = if (duration > 0L) {
                (current.toFloat() / duration.toFloat()).coerceIn(0f, 1f)
            } else {
                0f
            }
            delay(120L)
        }
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(200.dp)
                .aspectRatio(1f)
        ) {
            Surface(
                shape = CircleShape,
                color = Color(0x33000000),
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .clickable {
                        val player = exoPlayer
                        if (videoUrl == null || player == null) {
                            onFallbackClick()
                        } else {
                            val isActiveVideo = playbackCoordinator.activeVideoId() == message.id
                            if (isActiveVideo && player.isPlaying) {
                                player.pause()
                                playbackCoordinator.deactivateVideo(message.id, onActivePlaybackChanged)
                            } else {
                                playbackCoordinator.activateVideo(
                                    messageId = message.id,
                                    player = player,
                                    onActiveChanged = onActivePlaybackChanged
                                )
                                player.playWhenReady = true
                                player.play()
                            }
                        }
                    }
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    if (exoPlayer != null) {
                        AndroidView(
                            factory = { viewContext ->
                                PlayerView(viewContext).apply {
                                    useController = false
                                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                    player = exoPlayer
                                    layoutParams = android.view.ViewGroup.LayoutParams(
                                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                        android.view.ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                }
                            },
                            update = { playerView ->
                                if (playerView.player !== exoPlayer) {
                                    playerView.player = exoPlayer
                                }
                            },
                            modifier = Modifier
                                .fillMaxSize()
                                .aspectRatio(1f)
                                .clip(CircleShape)
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color(0xFF0F172A))
                        )
                    }

                    Surface(
                        color = Color(0xAA0F172A),
                        shape = CircleShape,
                        modifier = Modifier.size(44.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                contentDescription = if (isPlaying) "Пауза" else "Воспроизвести",
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }

            if (isPlaying || progress > 0f) {
                CircularProgressIndicator(
                    progress = { progress.coerceIn(0f, 1f) },
                    color = Color(0xFF5EB5F7),
                    trackColor = Color(0x445EB5F7),
                    strokeWidth = 3.dp,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(2.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Видео-кружок • ${formatMediaDuration(resolvedDurationMs ?: measuredDurationMs)}",
            color = Color(0xFFD6E4F5),
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun AvatarBubble(
    title: String,
    background: Color = Color(0xFF5EB5F7),
    size: Int = 38
) {
    val gradientColors = listOf(background, background.copy(alpha = 0.7f))
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(Brush.linearGradient(gradientColors)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = title.firstOrNull()?.uppercase() ?: "?",
            color = Color.White,
            fontSize = (size / 2.5).sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun AttachmentLink(
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        color = Color(0x33000000)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = title,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                color = Color(0xFF94A3B8),
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun RemoteImagePreview(
    imageUrl: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop
) {
    Box(
        modifier = modifier.background(Color(0xFF1E293B)),
        contentAlignment = Alignment.Center
    ) {
        AsyncImage(
            model = rememberImageRequest(
                data = imageUrl,
                downsamplePx = 1080
            ),
            imageLoader = rememberGovChatImageLoader(),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = contentScale
        )
    }
}

@Composable
private fun LocalImagePreview(
    uri: Uri,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.background(Color(0xFF0F172A)),
        contentAlignment = Alignment.Center
    ) {
        AsyncImage(
            model = rememberImageRequest(
                data = uri,
                downsamplePx = 360
            ),
            imageLoader = rememberGovChatImageLoader(),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
    }
}

@Composable
private fun ImagesGalleryDialog(
    messages: List<ChatMessage>,
    startIndex: Int,
    onDismiss: () -> Unit,
    onDownload: (ChatMessage) -> Unit
) {
    if (messages.isEmpty()) return
    var currentIndex by remember(messages, startIndex) {
        mutableIntStateOf(startIndex.coerceIn(0, messages.lastIndex))
    }
    LaunchedEffect(startIndex, messages.size) {
        currentIndex = startIndex.coerceIn(0, messages.lastIndex)
    }
    val currentMessage = messages.getOrNull(currentIndex) ?: return
    val imageUrl = resolveMediaUrl(currentMessage.attachment?.url) ?: return
    var horizontalDragSum by remember { mutableStateOf(0f) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color.Black
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(messages.size, currentIndex) {
                        detectHorizontalDragGestures(
                            onDragCancel = { horizontalDragSum = 0f },
                            onHorizontalDrag = { change, dragAmount ->
                                horizontalDragSum += dragAmount
                                change.consume()
                            },
                            onDragEnd = {
                                val thresholdPx = 80f
                                when {
                                    horizontalDragSum > thresholdPx && currentIndex > 0 -> {
                                        currentIndex -= 1
                                    }

                                    horizontalDragSum < -thresholdPx && currentIndex < messages.lastIndex -> {
                                        currentIndex += 1
                                    }
                                }
                                horizontalDragSum = 0f
                            }
                        )
                    }
            ) {
                RemoteImagePreview(
                    imageUrl = imageUrl,
                    modifier = Modifier
                        .fillMaxSize(),
                    contentScale = ContentScale.Fit
                )

                if (currentIndex > 0) {
                    Surface(
                        color = Color(0x880F172A),
                        shape = CircleShape,
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .padding(start = 10.dp)
                            .size(42.dp)
                            .clickable { currentIndex -= 1 }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Filled.ChevronLeft,
                                contentDescription = "Предыдущее фото",
                                tint = Color.White
                            )
                        }
                    }
                }

                if (currentIndex < messages.lastIndex) {
                    Surface(
                        color = Color(0x880F172A),
                        shape = CircleShape,
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .padding(end = 10.dp)
                            .size(42.dp)
                            .clickable { currentIndex += 1 }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Filled.ChevronRight,
                                contentDescription = "Следующее фото",
                                tint = Color.White
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        color = Color(0xAA0F172A),
                        shape = CircleShape,
                        modifier = Modifier
                            .size(40.dp)
                            .clickable { onDismiss() }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Filled.Close,
                                contentDescription = "Закрыть",
                                tint = Color.White
                            )
                        }
                    }
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = "${currentIndex + 1} / ${messages.size}",
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Button(onClick = { onDownload(currentMessage) }) {
                        Text("Скачать")
                    }
                }

                if (abs(horizontalDragSum) > 1f) {
                    Surface(
                        color = Color(0xAA020617),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .navigationBarsPadding()
                            .padding(bottom = 14.dp)
                    ) {
                        Text(
                            text = if (horizontalDragSum > 0f) "Свайп: предыдущее фото" else "Свайп: следующее фото",
                            color = Color(0xFFD6E4F5),
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }
                }
            }
        }
    }
}

private object GovChatImageLoaderHolder {
    @Volatile
    private var imageLoader: ImageLoader? = null

    fun get(context: Context): ImageLoader {
        return imageLoader ?: synchronized(this) {
            imageLoader ?: ImageLoader.Builder(context)
                .memoryCache {
                    MemoryCache.Builder(context)
                        .maxSizePercent(0.25)
                        .build()
                }
                .diskCache {
                    DiskCache.Builder()
                        .directory(context.cacheDir.resolve("govchat_coil_cache"))
                        .maxSizePercent(0.03)
                        .build()
                }
                .respectCacheHeaders(false)
                .build()
                .also { imageLoader = it }
        }
    }
}

@Composable
private fun rememberGovChatImageLoader(): ImageLoader {
    val appContext = LocalContext.current.applicationContext
    return remember(appContext) {
        GovChatImageLoaderHolder.get(appContext)
    }
}

@Composable
private fun rememberImageRequest(
    data: Any?,
    downsamplePx: Int
): ImageRequest {
    val context = LocalContext.current
    return remember(context, data, downsamplePx) {
        ImageRequest.Builder(context)
            .data(data)
            .crossfade(true)
            .precision(Precision.INEXACT)
            .size(downsamplePx)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .networkCachePolicy(CachePolicy.ENABLED)
            .build()
    }
}

@Composable
private fun PermissionDeniedDialog(
    prompt: PermissionPrompt,
    onDismiss: () -> Unit,
    onRequestAgain: () -> Unit,
    onOpenSettings: () -> Unit
) {
    val title = when (prompt.feature) {
        GovChatPermissionFeature.Camera -> "Нужен доступ к камере"
        GovChatPermissionFeature.Microphone -> "Нужен доступ к микрофону"
        GovChatPermissionFeature.MediaRead -> "Нужен доступ к файлам"
        GovChatPermissionFeature.Notifications -> "Нужны уведомления"
    }
    val message = when (prompt.feature) {
        GovChatPermissionFeature.Camera -> "Без разрешения камеры нельзя отправлять фото и видео."
        GovChatPermissionFeature.Microphone -> "Без разрешения микрофона недоступны голосовые и звонки."
        GovChatPermissionFeature.MediaRead -> "Без доступа к медиа нельзя отправлять и скачивать вложения."
        GovChatPermissionFeature.Notifications -> "Без уведомлений вы можете пропустить важные сообщения."
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            if (prompt.permanentlyDenied) {
                TextButton(onClick = onOpenSettings) {
                    Text("Разрешить в настройках")
                }
            } else {
                TextButton(onClick = onRequestAgain) {
                    Text("Повторить")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена")
            }
        }
    )
}

private data class PermissionPrompt(
    val feature: GovChatPermissionFeature,
    val permanentlyDenied: Boolean,
    val onGranted: (() -> Unit)?
)

private const val INITIAL_PERMISSION_PREFS_NAME = "govchat_permission_prefs"
private const val INITIAL_PERMISSION_PREFS_KEY = "initial_runtime_permissions_requested_v1"

private fun LazyListState.isNearBottomForReverseLayout(): Boolean {
    if (firstVisibleItemIndex > 1) return false
    return firstVisibleItemScrollOffset <= 40
}

private tailrec fun Context.findActivity(): Activity? {
    return when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
}

private fun resolveMediaUrl(rawUrl: String?): String? {
    if (rawUrl.isNullOrBlank()) return null
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl

    val normalized = if (rawUrl.startsWith("/")) rawUrl else "/$rawUrl"
    val apiBase = BuildConfig.API_BASE_URL.trimEnd('/')
    val hostBase = apiBase.removeSuffix("/api")

    return when {
        normalized.startsWith("/api/uploads/") -> "$hostBase$normalized"
        normalized.startsWith("/uploads/") -> "$apiBase$normalized"
        else -> "$hostBase$normalized"
    }
}

private data class ChatTimelineItem(
    val key: String,
    val message: ChatMessage? = null,
    val dayLabel: String? = null
)

private val RU_LOCALE = Locale("ru", "RU")
private val TIME_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", RU_LOCALE)
private val DAY_LABEL_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMMM", RU_LOCALE)

private fun buildMessageTimelineItems(displayMessages: List<ChatMessage>): List<ChatTimelineItem> {
    if (displayMessages.isEmpty()) return emptyList()

    val items = ArrayList<ChatTimelineItem>(displayMessages.size + 8)
    var currentDay: LocalDate? = null

    displayMessages.forEachIndexed { index, message ->
        val messageDay = epochMillisToLocalDate(message.createdAtMillis)
        if (currentDay == null) {
            currentDay = messageDay
        } else if (messageDay != null && currentDay != messageDay) {
            items += ChatTimelineItem(
                key = "day-${currentDay.toString()}-$index",
                dayLabel = formatDayLabel(currentDay)
            )
            currentDay = messageDay
        }

        items += ChatTimelineItem(
            key = "msg-${message.id}",
            message = message
        )
    }

    currentDay?.let { day ->
        items += ChatTimelineItem(
            key = "day-${day.toString()}-tail",
            dayLabel = formatDayLabel(day)
        )
    }

    return items
}

private fun epochMillisToLocalDate(epochMillis: Long): LocalDate? {
    if (epochMillis <= 0L) return null
    val zone = ZoneId.systemDefault()
    return runCatching {
        Instant.ofEpochMilli(epochMillis).atZone(zone).toLocalDate()
    }.getOrNull()
}

private fun formatDayLabel(day: LocalDate): String {
    val today = LocalDate.now(ZoneId.systemDefault())
    return when (day) {
        today -> "сегодня"
        today.minusDays(1) -> "вчера"
        else -> day.format(DAY_LABEL_FORMATTER)
    }
}

private fun formatTime(epochMillis: Long): String {
    if (epochMillis <= 0L) return ""
    val zone = ZoneId.systemDefault()
    return runCatching {
        Instant.ofEpochMilli(epochMillis).atZone(zone).format(TIME_FORMATTER)
    }.getOrDefault("")
}

@Composable
private fun rememberResolvedMediaDuration(
    initialDurationMs: Long?,
    mediaUrl: String?
): Long? {
    return produceState(
        initialValue = initialDurationMs,
        key1 = initialDurationMs,
        key2 = mediaUrl
    ) {
        if ((initialDurationMs ?: 0L) > 0L) {
            value = initialDurationMs
            return@produceState
        }

        val safeUrl = mediaUrl?.trim().orEmpty()
        if (safeUrl.isEmpty()) {
            value = initialDurationMs
            return@produceState
        }

        value = withContext(Dispatchers.IO) {
            runCatching {
                val retriever = MediaMetadataRetriever()
                try {
                    if (safeUrl.startsWith("http://") || safeUrl.startsWith("https://")) {
                        retriever.setDataSource(safeUrl, emptyMap())
                    } else {
                        retriever.setDataSource(safeUrl)
                    }
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
                } finally {
                    runCatching { retriever.release() }
                }
            }.getOrNull()
        } ?: initialDurationMs
    }.value
}

private fun formatMediaDuration(durationMs: Long?): String {
    val totalSeconds = (durationMs ?: 0L).div(1000L).toInt()
    if (totalSeconds <= 0) return "--:--"
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}

private fun formatCallDuration(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}

private fun Long.toReadableSize(): String {
    if (this < 1024L) return "$this Б"
    if (this < 1024L * 1024L) return String.format(java.util.Locale.US, "%.1f КБ", this / 1024f)
    return String.format(java.util.Locale.US, "%.1f МБ", this / (1024f * 1024f))
}
