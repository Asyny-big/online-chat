package ru.govchat.app.ui.screens.main

import android.graphics.BitmapFactory
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.DisposableEffect
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Cached
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.GroupAdd
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import io.livekit.android.room.participant.RemoteParticipant
import io.livekit.android.room.Room
import io.livekit.android.room.track.Track as LiveKitTrack
import io.livekit.android.room.track.TrackPublication as LiveKitTrackPublication
import io.livekit.android.room.track.VideoTrack as LiveKitMediaVideoTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
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

@Composable
fun MainScreen(
    state: MainUiState,
    callUiState: CallUiState,
    isInPictureInPictureMode: Boolean,
    onRefresh: () -> Unit,
    onSelectChat: (String) -> Unit,
    onBackFromChat: () -> Unit,
    onSendText: (String) -> Unit,
    onInputChanged: (String) -> Unit,
    onSendAttachment: (Uri) -> Unit,
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
    val permissionFlow = rememberGovChatPermissionFlow()
    val downloader = remember(context.applicationContext) {
        GovChatAttachmentDownloader(context.applicationContext)
    }
    var lastIncomingCallId by remember { mutableStateOf<String?>(null) }

    var permissionPrompt by remember { mutableStateOf<PermissionPrompt?>(null) }

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

    val requestCallPermissions: (String, () -> Unit) -> Unit = { callType, onGranted ->
        val features = if (callType == "video") {
            listOf(GovChatPermissionFeature.Camera, GovChatPermissionFeature.Microphone)
        } else {
            listOf(GovChatPermissionFeature.Microphone)
        }
        requestPermissionsInOrder(features, onGranted)
    }

    val mediaProjectionManager = remember(context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            context.getSystemService(MediaProjectionManager::class.java)
        } else {
            null
        }
    }
    val screenShareLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        onStartScreenShare(result.resultCode, result.data)
    }
    val toggleScreenShare: () -> Unit = screenShareToggle@{
        if (callUiState.controls.isScreenSharing) {
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
        IncomingCallNotifications.show(context, incoming)
    }

    LaunchedEffect(state.activeCall?.callId) {
        val active = state.activeCall
        if (active == null) {
            CallForegroundService.stop(context)
            return@LaunchedEffect
        }
        IncomingCallNotifications.cancel(context, active.callId)
        // On Android 14+ (targetSdk 34+), startForeground with microphone|camera
        // type requires runtime permissions to be already granted. Check before starting.
        val hasMic = ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.RECORD_AUDIO
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val hasCam = active.type != "video" || ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.CAMERA
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (hasMic && hasCam) {
            CallForegroundService.start(
                context = context,
                remoteName = active.chatName,
                callType = active.type
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
                color = Color(0xFF0F172A)
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
                        onBack = onBackFromChat,
                        onSendText = onSendText,
                        onInputChanged = onInputChanged,
                        onSendAttachment = onSendAttachment,
                        onRequestAttach = { openPicker -> openPicker() },
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
                        onAcceptIncomingCall = {
                            val incomingType = state.incomingCall?.type ?: "audio"
                            requestCallPermissions(incomingType) {
                                onAcceptIncomingCall()
                            }
                        },
                        onDeclineIncomingCall = onDeclineIncomingCall,
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
    val title = when (selectedTab) {
        0 -> "Чаты"
        1 -> "Контакты"
        2 -> "Настройки"
        else -> "Профиль"
    }
    val subtitle = when (selectedTab) {
        0 -> "Все диалоги и группы в одном месте"
        1 -> "Быстрый доступ к вашим собеседникам"
        2 -> "Уведомления и поведение приложения"
        else -> "Данные аккаунта и персональные действия"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFF0F172A),
                        Color(0xFF0C1628),
                        Color(0xFF0A1221)
                    )
                )
            )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp)
                .border(1.dp, Color(0x2D9DB8FF), RoundedCornerShape(22.dp)),
            shape = RoundedCornerShape(22.dp),
            color = Color.Transparent
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                Color(0xC1162942),
                                Color(0xBD1C3554),
                                Color(0xB9162942)
                            )
                        )
                    )
                    .padding(horizontal = 14.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFAAC2E8)
                    )
                }

                if (selectedTab != 3) {
                    IconButton(
                        onClick = onRefresh,
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color(0x24FFFFFF))
                            .border(1.dp, Color(0x36FFFFFF), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Refresh,
                            contentDescription = "Обновить",
                            tint = Color(0xFFE7F1FF),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(Color(0x1BFFFFFF))
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (state.isRealtimeConnected) Color(0xFF4ADE80) else Color(0xFFF87171))
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (state.isRealtimeConnected) "Online" else "Offline",
                            color = if (state.isRealtimeConnected) Color(0xFFBBF7D0) else Color(0xFFFECACA),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }
        }

        if (!notificationsEnabled) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                color = Color(0xFF15253A),
                shape = RoundedCornerShape(14.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Filled.NotificationsOff,
                            contentDescription = null,
                            tint = Color(0xFF9CB5DD),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Включите уведомления",
                            color = Color.White,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    TextButton(onClick = onRequestNotifications) {
                        Text("Разрешить", color = Color(0xFF8EBBFF))
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val chips = listOf(
                "Чаты" to Icons.Filled.Email,
                "Контакты" to Icons.Filled.People,
                "Настройки" to Icons.Filled.Settings,
                "Профиль" to Icons.Filled.Person
            )
            chips.forEachIndexed { index, (chipTitle, icon) ->
                val isActive = selectedTab == index
                val background by animateColorAsState(
                    targetValue = if (isActive) Color(0xFF1F3D66) else Color(0xFF122338),
                    label = "chipBg"
                )
                val border by animateColorAsState(
                    targetValue = if (isActive) Color(0xFF6DA9FF) else Color(0x2AFFFFFF),
                    label = "chipBorder"
                )
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(background)
                        .border(1.dp, border, RoundedCornerShape(16.dp))
                        .clickable { selectedTab = index }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = chipTitle,
                        tint = if (isActive) Color(0xFFE8F2FF) else Color(0xFFA0B6D6),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = chipTitle,
                        color = if (isActive) Color(0xFFF3F8FF) else Color(0xFFA0B6D6),
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
        }

        if (state.errorMessage != null) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                shape = RoundedCornerShape(12.dp),
                color = Color(0x33EF4444)
            ) {
                Text(
                    text = state.errorMessage,
                    color = Color(0xFFFDA4AF),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                )
            }
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(top = 8.dp)
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 8.dp),
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                color = Color(0xFF0B1629),
                shadowElevation = 8.dp
            ) {
                when (selectedTab) {
                    0 -> ChatsTabContent(
                        state = state,
                        onSelectChat = onSelectChat
                    )
                    1 -> ContactsTabContent(
                        state = state,
                        onSelectChat = onSelectChat
                    )
                    2 -> SettingsTabContent(
                        notificationsEnabled = notificationsEnabled,
                        onRequestNotifications = onRequestNotifications,
                        onRefresh = onRefresh,
                        onLogout = onLogout
                    )
                    3 -> ProfileTabContent(
                        state = state,
                        onLogout = onLogout,
                        onRefreshProfile = onRefreshProfile
                    )
                }
            }

            if (selectedTab == 0) {
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 20.dp, bottom = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    horizontalAlignment = Alignment.End
                ) {
                    FloatingActionButton(
                        onClick = { showCreateGroupDialog = true },
                        containerColor = Color(0xFF3A2A68),
                        contentColor = Color(0xFFE6DBFF),
                        shape = CircleShape,
                        modifier = Modifier
                            .shadow(12.dp, CircleShape)
                            .border(1.dp, Color(0x6EAC89FF), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.GroupAdd,
                            contentDescription = "Создать группу",
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    FloatingActionButton(
                        onClick = { showAddChatDialog = true },
                        containerColor = Color(0xFF2463CD),
                        contentColor = Color.White,
                        shape = CircleShape,
                        modifier = Modifier
                            .shadow(12.dp, CircleShape)
                            .border(1.dp, Color(0xA87DB6FF), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Add,
                            contentDescription = "Новый чат",
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }

        BottomNavBar(
            selectedTab = selectedTab,
            onTabSelected = { selectedTab = it }
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
            CircularProgressIndicator(color = Color(0xFF3B82F6))
        }
    } else if (state.chats.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(18.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF111D31))
                    .border(1.dp, Color(0x2A8FB5E8), RoundedCornerShape(20.dp))
                    .padding(vertical = 26.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "💬",
                    fontSize = 40.sp
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Нет чатов",
                    color = Color(0xFFDDEAFE),
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Нажмите + чтобы начать",
                    color = Color(0xFF8BA4C9),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(state.chats, key = { it.id }) { chat ->
                ChatRow(chat = chat, onClick = { onSelectChat(chat.id) })
            }
            item {
                Spacer(modifier = Modifier.height(78.dp))
            }
        }
    }
}

@Composable
private fun ContactsTabContent(
    state: MainUiState,
    onSelectChat: (String) -> Unit
) {
    val contacts = remember(state.chats) {
        state.chats.filter { it.type == ChatType.PRIVATE }
    }
    if (contacts.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Контактов пока нет",
                color = Color(0xFF93A9C9),
                style = MaterialTheme.typography.bodyLarge
            )
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(contacts, key = { it.id }) { chat ->
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .clickable { onSelectChat(chat.id) },
                    color = Color(0xFF132238),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AvatarBubble(
                            title = chat.title,
                            background = Color(0xFF2F67C7)
                        )
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .padding(start = 10.dp)
                        ) {
                            Text(
                                text = chat.title,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = if (chat.isOnline) "Онлайн" else "Не в сети",
                                color = if (chat.isOnline) Color(0xFF4ADE80) else Color(0xFF8BA4C9),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        Icon(
                            imageVector = Icons.Filled.ChevronRight,
                            contentDescription = null,
                            tint = Color(0xFF89A8D4)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsTabContent(
    notificationsEnabled: Boolean,
    onRequestNotifications: () -> Unit,
    onRefresh: () -> Unit,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            color = Color(0xFF15263E)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (notificationsEnabled) Icons.Filled.Notifications else Icons.Filled.NotificationsOff,
                    contentDescription = null,
                    tint = if (notificationsEnabled) Color(0xFF7CB5FF) else Color(0xFF9CB0CF)
                )
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 10.dp)
                ) {
                    Text(
                        text = "Уведомления",
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Text(
                        text = if (notificationsEnabled) "Разрешены" else "Отключены",
                        color = Color(0xFF8FA8CA),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                TextButton(onClick = onRequestNotifications, enabled = !notificationsEnabled) {
                    Text(
                        text = if (notificationsEnabled) "Включено" else "Включить",
                        color = if (notificationsEnabled) Color(0xFF7DA2D6) else Color(0xFF9BC4FF)
                    )
                }
            }
        }

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .clickable(onClick = onRefresh),
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF112236)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.Refresh,
                    contentDescription = null,
                    tint = Color(0xFF9BC4FF)
                )
                Text(
                    text = "Обновить данные",
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 10.dp),
                    color = Color.White
                )
                Icon(
                    imageVector = Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = Color(0xFF89A8D4)
                )
            }
        }

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .clickable(onClick = onLogout),
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF381A24)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.ExitToApp,
                    contentDescription = null,
                    tint = Color(0xFFF5A3B0)
                )
                Text(
                    text = "Выйти из аккаунта",
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 10.dp),
                    color = Color(0xFFFFD6DD)
                )
                Icon(
                    imageVector = Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = Color(0xFFF5A3B0)
                )
            }
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp)),
            shape = RoundedCornerShape(22.dp),
            color = Color.Transparent
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                Color(0xFF1C3558),
                                Color(0xFF214772),
                                Color(0xFF1A3558)
                            )
                        )
                    )
                    .padding(horizontal = 18.dp, vertical = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(104.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF3B82F6))
                        .border(2.dp, Color(0x99D7E8FF), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (profile?.avatarUrl != null) {
                        val avatarUrl = resolveAvatarUrl(profile.avatarUrl)
                        val bmpState by produceState<ImageBitmap?>(null, avatarUrl) {
                            value = withContext(Dispatchers.IO) {
                                runCatching {
                                    java.net.URL(avatarUrl).openStream().use { stream ->
                                        BitmapFactory.decodeStream(stream)?.asImageBitmap()
                                    }
                                }.getOrNull()
                            }
                        }
                        val bmp = bmpState
                        if (bmp != null) {
                            androidx.compose.foundation.Image(
                                bitmap = bmp,
                                contentDescription = "Аватар",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Text(
                                text = (profile.name.firstOrNull() ?: '?').uppercase(),
                                color = Color.White,
                                fontSize = 36.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    } else {
                        Text(
                            text = (profile?.name?.firstOrNull() ?: '?').uppercase(),
                            color = Color.White,
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Bold
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
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = profile?.phone ?: "",
                    color = Color(0xFFBED2EF),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))
        Button(
            onClick = onRefreshProfile,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF17304D)
            ),
            shape = RoundedCornerShape(14.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Refresh,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Обновить профиль", color = Color.White)
        }

        Spacer(modifier = Modifier.height(10.dp))

        Button(
            onClick = onLogout,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF5B202E)
            ),
            shape = RoundedCornerShape(14.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.ExitToApp,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Выйти", color = Color.White)
        }

        if (state.userProfileLoading) {
            Spacer(modifier = Modifier.height(14.dp))
            CircularProgressIndicator(
                color = Color(0xFF3B82F6),
                modifier = Modifier.size(24.dp)
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun BottomNavBar(
    selectedTab: Int,
    onTabSelected: (Int) -> Unit
) {
    val tabs = listOf(
        "Чаты" to Icons.Filled.Email,
        "Контакты" to Icons.Filled.People,
        "Настройки" to Icons.Filled.Settings,
        "Профиль" to Icons.Filled.Person
    )
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0x26B6CEED), RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0xE2111F34),
                            Color(0xF0101C30)
                        )
                    )
                )
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            tabs.forEachIndexed { index, (label, icon) ->
                val isSelected = selectedTab == index
                val interactionSource = remember { MutableInteractionSource() }
                val pressed by interactionSource.collectIsPressedAsState()
                val scale by animateFloatAsState(
                    targetValue = if (pressed) 0.94f else 1f,
                    animationSpec = spring(dampingRatio = 0.75f, stiffness = 520f),
                    label = "navScale"
                )
                val iconColor by animateColorAsState(
                    targetValue = if (isSelected) Color(0xFF84B7FF) else Color(0xFF6F85A7),
                    label = "navIcon"
                )
                val textColor by animateColorAsState(
                    targetValue = if (isSelected) Color(0xFFEAF3FF) else Color(0xFF6F85A7),
                    label = "navText"
                )
                val indicatorHeight by animateDpAsState(
                    targetValue = if (isSelected) 4.dp else 0.dp,
                    label = "navIndicator"
                )
                Column(
                    modifier = Modifier
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                        }
                        .clip(RoundedCornerShape(14.dp))
                        .clickable(
                            interactionSource = interactionSource,
                            indication = null
                        ) { onTabSelected(index) }
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (isSelected) Color(0x2E4F87D6) else Color.Transparent)
                            .padding(6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = label,
                            modifier = Modifier.size(20.dp),
                            tint = iconColor
                        )
                    }
                    Text(
                        text = label,
                        color = textColor,
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Box(
                        modifier = Modifier
                            .height(indicatorHeight)
                            .width(16.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) Color(0xFF84B7FF) else Color.Transparent)
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
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.985f else 1f,
        animationSpec = spring(dampingRatio = 0.78f, stiffness = 520f),
        label = "chatRowScale"
    )
    val background by animateColorAsState(
        targetValue = if (pressed) Color(0xFF1A304B) else Color(0xFF15263E),
        label = "chatRowBg"
    )
    val borderColor = when {
        chat.unreadCount > 0 -> Color(0x5E66A5FF)
        isGroup -> Color(0x447E22CE)
        else -> Color(0x2B8AA8D1)
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .border(1.dp, borderColor, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp))
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            ),
        color = background,
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AvatarBubble(
                title = chat.title,
                background = if (isGroup) Color(0xFF7E22CE) else Color(0xFF3B82F6)
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = chat.title,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = formatTime(chat.updatedAtMillis),
                        color = Color(0xFF8FA8CA),
                        style = MaterialTheme.typography.labelSmall
                    )
                }

                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = chat.subtitle,
                        color = Color(0xFFB1C4DF),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    if (chat.type == ChatType.PRIVATE) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (chat.isOnline) Color(0xFF4ADE80) else Color(0xFF64748B))
                        )
                    }
                }
            }

            if (chat.unreadCount > 0) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0xFF2E66D0))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = chat.unreadCount.toString(),
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatContent(
    state: MainUiState,
    onBack: () -> Unit,
    onSendText: (String) -> Unit,
    onInputChanged: (String) -> Unit,
    onSendAttachment: (Uri) -> Unit,
    onRequestAttach: ((() -> Unit) -> Unit),
    onStartCall: (String) -> Unit,
    onStartGroupCall: (String) -> Unit,
    onAcceptIncomingCall: () -> Unit,
    onDeclineIncomingCall: () -> Unit,
    onAttachmentClick: (MessageType, MessageAttachment?) -> Unit
) {
    val chat = state.selectedChat ?: return
    val context = LocalContext.current
    var showParticipantsDialog by remember(chat.id) { mutableStateOf(false) }
    var draft by remember(chat.id) { mutableStateOf("") }
    var selectedFileName by remember(chat.id) { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()

    val openFileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            selectedFileName = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (cursor.moveToFirst() && index >= 0) cursor.getString(index) else null
            }
            onSendAttachment(uri)
        }
    }

    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.lastIndex)
        }
    }

    LaunchedEffect(state.uploadProgress) {
        if (state.uploadProgress == null) {
            selectedFileName = null
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Color(0xFF132238),
                            Color(0xFF1B2E48),
                            Color(0xFF15263D)
                        )
                    )
                )
                .padding(horizontal = 10.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = Color(0x26FFFFFF),
                shape = CircleShape,
                modifier = Modifier
                    .size(38.dp)
                    .border(1.dp, Color(0x30FFFFFF), CircleShape)
                    .clickable(onClick = onBack)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "К списку чатов",
                        tint = Color.White
                    )
                }
            }
            AvatarBubble(
                title = chat.title,
                background = if (chat.type == ChatType.GROUP) Color(0xFF7E22CE) else Color(0xFF3B82F6)
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 10.dp)
            ) {
                Text(
                    text = chat.title,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                val typingInCurrentChat = state.typingUsers
                    .filter { it.chatId == chat.id }
                    .joinToString { it.userName.ifBlank { "Собеседник" } }

                if (typingInCurrentChat.isNotBlank()) {
                    Text(
                        text = "$typingInCurrentChat печатает...",
                        color = Color(0xFF3B82F6),
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (chat.type == ChatType.GROUP) {
                    Text(
                        text = "Участников: ${chat.participantCount}",
                        color = Color(0xFF94A3B8),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (chat.type == ChatType.GROUP) {
                    ChatHeaderActionButton(
                        icon = Icons.Filled.People,
                        contentDescription = "Участники",
                        onClick = { showParticipantsDialog = true }
                    )
                    ChatHeaderActionButton(
                        icon = Icons.Filled.Call,
                        contentDescription = "Групповой аудио звонок",
                        onClick = { onStartGroupCall("audio") }
                    )
                    ChatHeaderActionButton(
                        icon = Icons.Filled.Videocam,
                        contentDescription = "Групповой видео звонок",
                        onClick = { onStartGroupCall("video") }
                    )
                } else {
                    ChatHeaderActionButton(
                        icon = Icons.Filled.Call,
                        contentDescription = "Аудио звонок",
                        onClick = { onStartCall("audio") }
                    )
                    ChatHeaderActionButton(
                        icon = Icons.Filled.Videocam,
                        contentDescription = "Видео звонок",
                        onClick = { onStartCall("video") }
                    )
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

        val incoming = state.incomingCall
        if (incoming != null && incoming.chatId == chat.id) {
            IncomingCallBanner(
                incoming = incoming,
                isBusy = state.isCallActionInProgress,
                onAccept = onAcceptIncomingCall,
                onDecline = onDeclineIncomingCall
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
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color(0xFF0E1A2D),
                                Color(0xFF0C1729)
                            )
                        )
                    )
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(state.messages, key = { it.id }) { message ->
                        MessageBubble(
                            message = message,
                            isMine = message.senderId == state.currentUserId,
                            onAttachmentClick = onAttachmentClick
                        )
                    }
                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }
            }
        }

        if (state.uploadProgress != null) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFF15263E)
            ) {
                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                    Text(
                        text = selectedFileName?.let { "Загрузка: $it" } ?: "Загрузка файла...",
                        color = Color(0xFFB2C6E4),
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = state.uploadProgress / 100f,
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFF3B82F6),
                        trackColor = Color(0x273B82F6)
                    )
                }
            }
        }

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            shape = RoundedCornerShape(22.dp),
            color = Color(0xFF13253B),
            shadowElevation = 8.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .clickable {
                            onRequestAttach {
                                openFileLauncher.launch(arrayOf("*/*"))
                            }
                        },
                    shape = CircleShape,
                    color = Color(0xFF1E3A5F)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Filled.AttachFile,
                            contentDescription = "Прикрепить файл",
                            tint = Color(0xFFD4E6FF)
                        )
                    }
                }

                OutlinedTextField(
                    value = draft,
                    onValueChange = {
                        draft = it
                        onInputChanged(it)
                    },
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 8.dp),
                    placeholder = {
                        Text(
                            text = if (state.uploadProgress != null) "Загрузка файла..." else "Введите сообщение...",
                            color = Color(0xFF87A2C8)
                        )
                    },
                    singleLine = true,
                    enabled = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = {
                            if (draft.isNotBlank()) {
                                onSendText(draft)
                                draft = ""
                            }
                        }
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Color(0xFF8CB8FF),
                        focusedBorderColor = Color(0xFF4A77BB),
                        unfocusedBorderColor = Color(0xFF29496F),
                        disabledBorderColor = Color(0xFF29496F),
                        focusedContainerColor = Color(0xFF0F2033),
                        unfocusedContainerColor = Color(0xFF0F2033)
                    ),
                    shape = RoundedCornerShape(16.dp)
                )

                val canSend = draft.isNotBlank()
                Surface(
                    modifier = Modifier
                        .padding(start = 8.dp)
                        .size(40.dp)
                        .clip(CircleShape)
                        .clickable(enabled = canSend) {
                            onSendText(draft)
                            draft = ""
                        },
                    shape = CircleShape,
                    color = if (canSend) Color(0xFF2B67D2) else Color(0xFF2A3A52)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Отправить",
                            tint = if (canSend) Color.White else Color(0xFF8EA4C3),
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun IncomingCallBanner(
    incoming: IncomingCallUi,
    isBusy: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    val background = if (incoming.isGroup) Color(0xFF7E22CE) else Color(0xFF16A34A)
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        shape = RoundedCornerShape(12.dp),
        color = background
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (incoming.isGroup) "Групповой звонок" else "Входящий звонок",
                    color = Color.White,
                    style = MaterialTheme.typography.labelLarge
                )
                Text(
                    text = if (incoming.isGroup) {
                        "${incoming.initiatorName} начал звонок"
                    } else {
                        "${incoming.initiatorName} звонит вам"
                    },
                    color = Color(0xE6FFFFFF),
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDecline, enabled = !isBusy) {
                    Text("✕", color = Color.White)
                }
                TextButton(onClick = onAccept, enabled = !isBusy) {
                    Text(if (incoming.type == "video") "🎥" else "📞")
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
                mirror = compactTrack.isLocal,
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
    val elapsedSeconds by produceState(initialValue = 0, key1 = call.callId) {
        value = 0
        while (true) {
            delay(1000)
            value += 1
        }
    }

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
                    mirror = mainVideoItem.isLocal,
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
                    mirror = true,
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
                                        mirror = item.isLocal,
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
                        mirror = compactTrack.isLocal,
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
    val resolvedAvatarUrl = remember(avatarUrl) { resolveAvatarUrl(avatarUrl) }
    val avatarBitmap by produceState<ImageBitmap?>(initialValue = null, key1 = resolvedAvatarUrl) {
        value = if (resolvedAvatarUrl == null) {
            null
        } else {
            withContext(Dispatchers.IO) {
                runCatching {
                    java.net.URL(resolvedAvatarUrl).openStream().use { stream ->
                        BitmapFactory.decodeStream(stream)?.asImageBitmap()
                    }
                }.getOrNull()
            }
        }
    }
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
                if (avatarBitmap != null) {
                    androidx.compose.foundation.Image(
                        bitmap = avatarBitmap!!,
                        contentDescription = title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Text(
                        text = title.firstOrNull()?.uppercase() ?: "?",
                        color = Color.White,
                        style = if (compact) MaterialTheme.typography.labelMedium else MaterialTheme.typography.titleLarge
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
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CallControlButton(
                icon = if (controls.isMicrophoneEnabled) Icons.Filled.Mic else Icons.Filled.MicOff,
                contentDescription = if (controls.isMicrophoneEnabled) "Выключить микрофон" else "Включить микрофон",
                selected = !controls.isMicrophoneEnabled,
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

    val buttonSize = if (danger) 64.dp else 56.dp
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
                modifier = Modifier.size(if (danger) 24.dp else 23.dp)
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
private fun MessageBubble(
    message: ChatMessage,
    isMine: Boolean,
    onAttachmentClick: (MessageType, MessageAttachment?) -> Unit
) {
    if (message.type == MessageType.System) {
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = message.text.ifBlank { "Системное сообщение" },
                color = Color(0xFF94A3B8),
                style = MaterialTheme.typography.labelSmall
            )
        }
        return
    }

    val alignment = if (isMine) Alignment.End else Alignment.Start
    val bubbleShape = if (isMine) {
        RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 6.dp)
    } else {
        RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 6.dp, bottomEnd = 18.dp)
    }
    val bubbleTextColor = if (isMine) Color(0xFFF7FAFF) else Color(0xFFE8F0FF)
    val metaColor = if (isMine) Color(0xCCEEF4FF) else Color(0xFF95AAC9)

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Surface(
            shape = bubbleShape,
            color = if (isMine) Color.Transparent else Color(0xFF223752),
            modifier = Modifier
                .fillMaxWidth(0.84f)
                .border(
                    width = if (isMine) 0.dp else 1.dp,
                    color = if (isMine) Color.Transparent else Color(0x337FAAD8),
                    shape = bubbleShape
                )
        ) {
            Box(
                modifier = Modifier
                    .background(
                        if (isMine) {
                            Brush.horizontalGradient(
                                listOf(
                                    Color(0xFF2358BE),
                                    Color(0xFF2B67D2)
                                )
                            )
                        } else {
                            Brush.verticalGradient(
                                listOf(
                                    Color(0xFF1C2F47),
                                    Color(0xFF1A2B42)
                                )
                            )
                        }
                    )
            ) {
                Column(modifier = Modifier.padding(horizontal = 11.dp, vertical = 9.dp)) {
                    if (!isMine && message.senderName.isNotBlank()) {
                        Text(
                            text = message.senderName,
                            color = Color(0xFF8EC3FF),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                    }

                    MessageBody(
                        message = message,
                        textColor = bubbleTextColor,
                        secondaryTextColor = metaColor,
                        onAttachmentClick = { onAttachmentClick(message.type, message.attachment) }
                    )

                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = formatTime(message.createdAtMillis),
                            color = metaColor,
                            style = MaterialTheme.typography.labelSmall
                        )
                        if (isMine) {
                            Spacer(modifier = Modifier.size(6.dp))
                            Text(
                                text = when (message.deliveryStatus) {
                                    MessageDeliveryStatus.Sent -> "✓"
                                    MessageDeliveryStatus.Delivered -> "✓✓"
                                    MessageDeliveryStatus.Read -> "✓✓"
                                },
                                color = if (message.deliveryStatus == MessageDeliveryStatus.Read) {
                                    Color(0xFFBDE0FF)
                                } else {
                                    metaColor
                                },
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBody(
    message: ChatMessage,
    textColor: Color,
    secondaryTextColor: Color,
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
                Text(text = message.text, color = textColor)
            }
        }

        MessageType.Video -> {
            AttachmentLink(
                title = message.attachment?.originalName?.ifBlank { "Видео" } ?: "Видео",
                subtitle = "Скачать видео",
                titleColor = textColor,
                subtitleColor = secondaryTextColor,
                onClick = onAttachmentClick
            )
            if (message.text.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = message.text, color = textColor)
            }
        }

        MessageType.Audio -> {
            AttachmentLink(
                title = message.attachment?.originalName?.ifBlank { "Голосовое сообщение" } ?: "Голосовое сообщение",
                subtitle = "Скачать аудио",
                titleColor = textColor,
                subtitleColor = secondaryTextColor,
                onClick = onAttachmentClick
            )
        }

        MessageType.File -> {
            val attachment = message.attachment
            AttachmentLink(
                title = attachment?.originalName?.ifBlank { "Файл" } ?: "Файл",
                subtitle = attachment?.sizeBytes?.toReadableSize() ?: "Скачать",
                titleColor = textColor,
                subtitleColor = secondaryTextColor,
                onClick = onAttachmentClick
            )
        }

        MessageType.System -> {
            Text(text = message.text.ifBlank { "Системное сообщение" }, color = secondaryTextColor)
        }

        MessageType.Text -> {
            Text(text = message.text, color = textColor)
        }
    }
}

@Composable
private fun AvatarBubble(
    title: String,
    background: Color = Color(0xFF3B82F6)
) {
    Box(
        modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(background),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = title.firstOrNull()?.uppercase() ?: "?",
            color = Color.White,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

@Composable
private fun AttachmentLink(
    title: String,
    subtitle: String,
    titleColor: Color = Color.White,
    subtitleColor: Color = Color(0xFF94A3B8),
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        color = Color(0x26000000)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = title,
                color = titleColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                color = subtitleColor,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun RemoteImagePreview(
    imageUrl: String,
    modifier: Modifier = Modifier
) {
    val bitmap by produceState<ImageBitmap?>(initialValue = null, key1 = imageUrl) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                val connection = java.net.URL(imageUrl).openConnection()
                connection.getInputStream().use { stream ->
                    BitmapFactory.decodeStream(stream)?.asImageBitmap()
                }
            }.getOrNull()
        }
    }

    if (bitmap == null) {
        Box(
            modifier = modifier.background(Color(0xFF1E293B)),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = Color(0xFF3B82F6), modifier = Modifier.size(24.dp))
        }
    } else {
        androidx.compose.foundation.Image(
            bitmap = bitmap!!,
            contentDescription = null,
            modifier = modifier,
            contentScale = ContentScale.Crop
        )
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

private fun formatTime(epochMillis: Long): String {
    return runCatching {
        val formatter = java.text.SimpleDateFormat("HH:mm", java.util.Locale("ru", "RU"))
        formatter.format(java.util.Date(epochMillis))
    }.getOrDefault("")
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
