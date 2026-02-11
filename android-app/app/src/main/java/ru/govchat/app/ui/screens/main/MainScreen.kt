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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerInputChange
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.webrtc.EglBase
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.call.CallControlsState
import ru.govchat.app.core.call.CallUiPhase
import ru.govchat.app.core.call.CallUiState
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
    onResetUserSearch: () -> Unit,
    onRefreshProfile: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var showAddChatDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "GovChat",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(
                                if (state.isRealtimeConnected) Color(0xFF22C55E) else Color(0xFFEF4444)
                            )
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (state.isRealtimeConnected) "Online" else "Offline",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (state.isRealtimeConnected) Color(0xFF22C55E) else Color(0xFFEF4444)
                    )
                }
            }
        }

        if (!notificationsEnabled) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                color = Color(0xFF1E293B),
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
                        Text("Разрешить")
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

        // Tab Content
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
                1 -> PlaceholderTabContent("Контакты", "Скоро здесь будут ваши контакты")
                2 -> PlaceholderTabContent("Настройки", "Настройки появятся в ближайшем обновлении")
                3 -> ProfileTabContent(
                    state = state,
                    onLogout = onLogout,
                    onRefreshProfile = onRefreshProfile
                )
            }

            // FAB on Chats tab
            if (selectedTab == 0) {
                FloatingActionButton(
                    onClick = { showAddChatDialog = true },
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 16.dp, bottom = 16.dp),
                    containerColor = Color(0xFF3B82F6),
                    contentColor = Color.White,
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = "Новый чат",
                        modifier = Modifier.size(28.dp)
                    )
                }
            }
        }

        // Bottom Navigation Bar
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
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "💬",
                    fontSize = 48.sp
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Нет чатов",
                    color = Color(0xFF94A3B8),
                    style = MaterialTheme.typography.bodyLarge
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Нажмите + чтобы начать",
                    color = Color(0xFF64748B),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
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
            Text(
                text = title,
                color = Color.White,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = subtitle,
                color = Color(0xFF64748B),
                style = MaterialTheme.typography.bodyMedium
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(24.dp))

        // Avatar
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(Color(0xFF3B82F6)),
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

        Spacer(modifier = Modifier.height(16.dp))

        // Name
        Text(
            text = profile?.name ?: "Загрузка...",
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Phone
        Text(
            text = profile?.phone ?: "",
            color = Color(0xFF94A3B8),
            style = MaterialTheme.typography.bodyMedium
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Action buttons
        Button(
            onClick = onRefreshProfile,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF1E293B)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Refresh,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Обновить", color = Color.White)
        }

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF7F1D1D)
            ),
            shape = RoundedCornerShape(12.dp)
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
            Spacer(modifier = Modifier.height(16.dp))
            CircularProgressIndicator(
                color = Color(0xFF3B82F6),
                modifier = Modifier.size(24.dp)
            )
        }
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
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFF1E293B),
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            tabs.forEachIndexed { index, (label, icon) ->
                val isSelected = selectedTab == index
                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onTabSelected(index) }
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        modifier = Modifier.size(24.dp),
                        tint = if (isSelected) Color(0xFF3B82F6) else Color(0xFF64748B)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = label,
                        color = if (isSelected) Color(0xFF3B82F6) else Color(0xFF64748B),
                        fontSize = 11.sp,
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
                            text = "Введите минимум 4 цифры",
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
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        color = Color(0xFF1E293B)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AvatarBubble(title = chat.title)

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
                    text = chat.subtitle,
                    color = Color(0xFF94A3B8),
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            if (chat.unreadCount > 0) {
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color(0xFF3B82F6))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
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
                .background(Color(0xFF1E293B))
                .padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack) {
                Text("Назад")
            }
            AvatarBubble(title = chat.title)
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
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (chat.type == ChatType.GROUP) {
                    TextButton(onClick = { onStartGroupCall("audio") }) {
                        Text("📞")
                    }
                    TextButton(onClick = { onStartGroupCall("video") }) {
                        Text("📹")
                    }
                } else {
                    TextButton(onClick = { onStartCall("audio") }) {
                        Text("📞")
                    }
                    TextButton(onClick = { onStartCall("video") }) {
                        Text("📹")
                    }
                }
            }
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
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.messages, key = { it.id }) { message ->
                    MessageBubble(
                        message = message,
                        isMine = message.senderId == state.currentUserId,
                        onAttachmentClick = onAttachmentClick
                    )
                }
            }
        }

        Divider(color = Color(0xFF334155))

        if (state.uploadProgress != null) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text(
                    text = selectedFileName?.let { "Загрузка: $it" } ?: "Загрузка файла...",
                    color = Color(0xFF94A3B8),
                    style = MaterialTheme.typography.bodySmall
                )
                LinearProgressIndicator(
                    progress = state.uploadProgress / 100f,
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF3B82F6)
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                onRequestAttach {
                    openFileLauncher.launch(arrayOf("*/*"))
                }
            }) {
                Text(text = "📎", color = Color.White)
            }

            OutlinedTextField(
                value = draft,
                onValueChange = {
                    draft = it
                    onInputChanged(it)
                },
                modifier = Modifier.weight(1f),
                placeholder = {
                    Text(
                        if (state.uploadProgress != null) "Загрузка файла..." else "Введите сообщение..."
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
                )
            )

            Button(
                onClick = {
                    if (draft.isNotBlank()) {
                        onSendText(draft)
                        draft = ""
                    }
                },
                enabled = draft.isNotBlank(),
                modifier = Modifier.padding(start = 8.dp)
            ) {
                Text("→")
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
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color.Black
    ) {
        if (call.type == "video" && uiState.remoteVideoTrack != null && uiState.eglContext != null) {
            WebRtcVideoView(
                track = uiState.remoteVideoTrack,
                eglContext = uiState.eglContext,
                mirror = false,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
private fun ActiveCallOverlay(
    call: ActiveCallUi,
    uiState: CallUiState,
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
            if (call.type == "video" && uiState.remoteVideoTrack != null && uiState.eglContext != null) {
                WebRtcVideoView(
                    track = uiState.remoteVideoTrack,
                    eglContext = uiState.eglContext,
                    mirror = false,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                CallNoVideoPlaceholder(
                    call = call,
                    phaseLabel = phaseLabel,
                    subStatus = subStatus
                )
            }

            if (call.type == "video" && uiState.localVideoTrack != null && uiState.eglContext != null) {
                WebRtcVideoView(
                    track = uiState.localVideoTrack,
                    eglContext = uiState.eglContext,
                    mirror = true,
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

            Surface(
                color = Color(0xAA020617),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(12.dp)
            ) {
                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text(
                        text = call.chatName,
                        color = Color.White,
                        style = MaterialTheme.typography.labelLarge
                    )
                    Text(
                        text = phaseLabel,
                        color = Color(0xFFBFDBFE),
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (subStatus.isNotBlank()) {
                        Text(
                            text = subStatus,
                            color = Color(0xFF93C5FD),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                    if (!uiState.statusMessage.isNullOrBlank()) {
                        Text(
                            text = uiState.statusMessage,
                            color = Color(0xFFFBBF24),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }

            TextButton(
                onClick = {
                    onInteraction()
                    onToggleMinimize()
                },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
            ) {
                Text("↗")
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
                if (call.type == "video" && uiState.remoteVideoTrack != null && uiState.eglContext != null) {
                    WebRtcVideoView(
                        track = uiState.remoteVideoTrack,
                        eglContext = uiState.eglContext,
                        mirror = false,
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
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    TextButton(onClick = onExpand) { Text("⤢") }
                    TextButton(onClick = onLeaveCall) { Text("✕", color = Color(0xFFF87171)) }
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
        color = Color(0xB3122239),
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.padding(horizontal = 8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CallControlButton(
                icon = if (controls.isMicrophoneEnabled) "🎤" else "🔇",
                active = !controls.isMicrophoneEnabled,
                onClick = {
                    onInteraction()
                    onToggleMicrophone()
                }
            )

            if (call.type == "video") {
                CallControlButton(
                    icon = if (controls.isCameraEnabled) "🎥" else "🚫",
                    active = !controls.isCameraEnabled,
                    onClick = {
                        onInteraction()
                        onToggleCamera()
                    }
                )
                CallControlButton(
                    icon = "🔄",
                    active = false,
                    enabled = controls.canSwitchCamera,
                    onClick = {
                        onInteraction()
                        onSwitchCamera()
                    }
                )
                CallControlButton(
                    icon = "🖥",
                    active = controls.isScreenSharing,
                    enabled = controls.isScreenSharing || controls.isScreenShareSupported,
                    onClick = {
                        onInteraction()
                        onToggleScreenShare()
                    }
                )
            }

            CallControlButton(
                icon = "📞",
                active = true,
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
    icon: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    danger: Boolean = false
) {
    val background = when {
        !enabled -> Color(0x332B3648)
        danger -> Color(0xFFD92D20)
        active -> Color(0xFF334155)
        else -> Color(0x660B1220)
    }
    Surface(
        modifier = modifier
            .size(50.dp)
            .clip(CircleShape)
            .clickable(enabled = enabled, onClick = onClick),
        shape = CircleShape,
        color = background
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = icon,
                color = if (enabled) Color.White else Color(0xFF64748B)
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
    if (!uiState.controls.isMicrophoneEnabled) labels += "Микрофон выключен"
    if (call.type == "video" && !uiState.controls.isCameraEnabled) labels += "Камера выключена"
    if (call.type == "video" && uiState.phase == CallUiPhase.Active && uiState.remoteVideoTrack == null) {
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
private fun WebRtcVideoView(
    track: VideoTrack,
    eglContext: EglBase.Context,
    mirror: Boolean,
    modifier: Modifier = Modifier
) {
    // Use a key to force full recreation when track or eglContext changes,
    // ensuring SurfaceViewRenderer.init() is never called twice on the same instance.
    val trackId = remember(track) { System.identityHashCode(track) }
    val eglId = remember(eglContext) { System.identityHashCode(eglContext) }
    androidx.compose.runtime.key(trackId, eglId) {
        AndroidView(
            factory = { ctx ->
                SurfaceViewRenderer(ctx).apply {
                    setEnableHardwareScaler(true)
                    setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                    init(eglContext, null)
                    setMirror(mirror)
                    setZOrderMediaOverlay(mirror)
                    track.addSink(this)
                }
            },
            update = { renderer ->
                renderer.setMirror(mirror)
            },
            onRelease = { renderer ->
                runCatching { track.removeSink(renderer) }
                runCatching { renderer.release() }
            },
            modifier = modifier
        )
    }
}

@Composable
private fun MessageBubble(
    message: ChatMessage,
    isMine: Boolean,
    onAttachmentClick: (MessageType, MessageAttachment?) -> Unit
) {
    val alignment = if (isMine) Alignment.End else Alignment.Start
    val bubbleColor = if (isMine) Color(0xFF2563EB) else Color(0xFF334155)

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = bubbleColor,
            modifier = Modifier.fillMaxWidth(0.8f)
        ) {
            Column(modifier = Modifier.padding(10.dp)) {
                if (!isMine && message.senderName.isNotBlank()) {
                    Text(
                        text = message.senderName,
                        color = Color(0xFF60A5FA),
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                }

                MessageBody(
                    message = message,
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
                        color = Color(0xB3FFFFFF),
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
                                Color(0xFF93C5FD)
                            } else {
                                Color(0xB3FFFFFF)
                            },
                            style = MaterialTheme.typography.labelSmall
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

        MessageType.Audio -> {
            AttachmentLink(
                title = message.attachment?.originalName?.ifBlank { "Голосовое сообщение" } ?: "Голосовое сообщение",
                subtitle = "Скачать аудио",
                onClick = onAttachmentClick
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
private fun AvatarBubble(title: String) {
    Box(
        modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(Color(0xFF3B82F6)),
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
