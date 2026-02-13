package ru.govchat.app.ui.screens.main

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.call.CallManager
import ru.govchat.app.core.call.CallUiPhase
import ru.govchat.app.core.call.CallUiState
import ru.govchat.app.core.notification.IncomingCallNotifications
import ru.govchat.app.core.notification.NotificationCommand
import ru.govchat.app.core.notification.NotificationIntents
import ru.govchat.app.core.ui.viewModelFactory
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatType
import ru.govchat.app.domain.model.MessageDeliveryStatus
import ru.govchat.app.domain.model.MessageType
import ru.govchat.app.domain.model.RealtimeEvent
import ru.govchat.app.domain.model.TypingUser
import ru.govchat.app.domain.model.WebRtcConfig
import ru.govchat.app.domain.model.WebRtcIceServer
import ru.govchat.app.domain.repository.AuthRepository
import ru.govchat.app.domain.repository.ChatRepository
import ru.govchat.app.domain.usecase.LoadMessagesUseCase
import ru.govchat.app.domain.usecase.LoadChatsUseCase
import ru.govchat.app.domain.usecase.AcceptCallUseCase
import ru.govchat.app.domain.usecase.DeclineCallUseCase
import ru.govchat.app.domain.usecase.JoinGroupCallUseCase
import ru.govchat.app.domain.usecase.LeaveCallUseCase
import ru.govchat.app.domain.usecase.LeaveGroupCallUseCase
import ru.govchat.app.domain.usecase.LoadWebRtcConfigUseCase
import ru.govchat.app.domain.usecase.LogoutUseCase
import ru.govchat.app.domain.usecase.SendAttachmentMessageUseCase
import ru.govchat.app.domain.usecase.SendCallSignalUseCase
import ru.govchat.app.domain.usecase.SendGroupCallSignalUseCase
import ru.govchat.app.domain.usecase.SendTextMessageUseCase
import ru.govchat.app.domain.usecase.StartCallUseCase
import ru.govchat.app.domain.usecase.StartGroupCallUseCase
import ru.govchat.app.domain.usecase.SearchUserByPhoneUseCase
import ru.govchat.app.domain.usecase.CreateChatUseCase
import ru.govchat.app.domain.usecase.CreateGroupChatUseCase

class MainViewModel(
    appContext: Context,
    private val loadChatsUseCase: LoadChatsUseCase,
    private val loadMessagesUseCase: LoadMessagesUseCase,
    private val sendTextMessageUseCase: SendTextMessageUseCase,
    private val sendAttachmentMessageUseCase: SendAttachmentMessageUseCase,
    private val loadWebRtcConfigUseCase: LoadWebRtcConfigUseCase,
    private val sendCallSignalUseCase: SendCallSignalUseCase,
    private val sendGroupCallSignalUseCase: SendGroupCallSignalUseCase,
    private val startCallUseCase: StartCallUseCase,
    private val acceptCallUseCase: AcceptCallUseCase,
    private val declineCallUseCase: DeclineCallUseCase,
    private val leaveCallUseCase: LeaveCallUseCase,
    private val startGroupCallUseCase: StartGroupCallUseCase,
    private val joinGroupCallUseCase: JoinGroupCallUseCase,
    private val leaveGroupCallUseCase: LeaveGroupCallUseCase,
    private val logoutUseCase: LogoutUseCase,
    private val searchUserByPhoneUseCase: SearchUserByPhoneUseCase,
    private val createChatUseCase: CreateChatUseCase,
    private val createGroupChatUseCase: CreateGroupChatUseCase,
    private val chatRepository: ChatRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val applicationContext = appContext.applicationContext
    private val mutableState = MutableStateFlow(MainUiState(isLoadingChats = true))
    val state: StateFlow<MainUiState> = mutableState.asStateFlow()
    private val callManager = CallManager(
        appContext = applicationContext
    )
    val callUiState: StateFlow<CallUiState> = callManager.state

    private var typingStopJob: Job? = null
    private var callControlsAutoHideJob: Job? = null
    private var tokenInitialized = false
    private val handledNotificationEventIds = LinkedHashSet<String>()

    init {
        callManager.bind(viewModelScope)
        viewModelScope.launch {
            callUiState.collect { call ->
                if (call.phase == CallUiPhase.Active) {
                    mutableState.update { current ->
                        val active = current.activeCall ?: return@update current
                        if (active.isGroup || active.phase == ActiveCallPhase.Active) {
                            current
                        } else {
                            current.copy(activeCall = active.copy(phase = ActiveCallPhase.Active))
                        }
                    }
                }
            }
        }
        viewModelScope.launch {
            chatRepository.connectRealtime()
            observeRealtime()
        }
        viewModelScope.launch {
            observeSession()
        }

        viewModelScope.launch {
            loadCurrentUser()
            refreshChats()
        }
    }

    fun refreshChats() {
        viewModelScope.launch {
            mutableState.update { it.copy(isLoadingChats = true, errorMessage = null) }
            loadChatsUseCase()
                .onSuccess { chats ->
                    mutableState.update {
                        it.copy(
                            isLoadingChats = false,
                            chats = chats,
                            errorMessage = null
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            isLoadingChats = false,
                            errorMessage = error.message ?: "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ РЎвЂЎР В°РЎвЂљР С•Р Р†"
                        )
                    }
                }
        }
    }

    fun selectChat(chatId: String) {
        val current = mutableState.value.selectedChatId
        if (current == chatId) return

        mutableState.update {
            it.copy(
                selectedChatId = chatId,
                messages = emptyList(),
                chats = it.chats.map { chat ->
                    if (chat.id == chatId) chat.copy(unreadCount = 0) else chat
                },
                errorMessage = null
            )
        }

        viewModelScope.launch {
            chatRepository.joinChat(chatId)
            loadMessages(chatId)

            val chatType = mutableState.value.chats.firstOrNull { it.id == chatId }?.type
            if (chatType == ChatType.GROUP) {
                loadGroupParticipants(chatId)
            } else {
                mutableState.update {
                    it.copy(
                        groupParticipants = emptyList(),
                        isLoadingGroupParticipants = false,
                        groupParticipantsErrorMessage = null
                    )
                }
            }
        }
    }

    private fun loadGroupParticipants(chatId: String) {
        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isLoadingGroupParticipants = true,
                    groupParticipantsErrorMessage = null
                )
            }
            chatRepository.getChatParticipants(chatId)
                .onSuccess { participants ->
                    mutableState.update {
                        it.copy(
                            groupParticipants = participants,
                            isLoadingGroupParticipants = false,
                            groupParticipantsErrorMessage = null
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            isLoadingGroupParticipants = false,
                            groupParticipantsErrorMessage = error.message ?: "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєРѕРІ"
                        )
                    }
                }
        }
    }

    fun clearSelectedChat() {
        typingStopJob?.cancel()
        val selected = mutableState.value.selectedChatId ?: return
        chatRepository.stopTyping(selected)
        mutableState.update {
            it.copy(
                selectedChatId = null,
                messages = emptyList(),
                uploadProgress = null
            )
        }
    }

    fun sendTextMessage(text: String) {
        val chatId = mutableState.value.selectedChatId ?: return
        val trimmed = text.trim()
        if (trimmed.isBlank()) return

        val pendingMessage = createPendingTextMessage(chatId = chatId, text = trimmed)
        if (pendingMessage != null) {
            appendMessage(pendingMessage)
            updateChatWithMessage(chatId, pendingMessage)
        }

        stopTypingNow()
        viewModelScope.launch {
            mutableState.update { it.copy(isSending = true, errorMessage = null) }
            sendTextMessageUseCase(chatId = chatId, text = trimmed)
                .onSuccess { message ->
                    pendingMessage?.let { removeMessage(it.id) }
                    val normalized = normalizeDeliveryStatus(message)
                    appendMessage(normalized)
                    updateChatWithMessage(chatId, normalized)
                    mutableState.update { it.copy(isSending = false) }
                }
                .onFailure { error ->
                    pendingMessage?.let { removeMessage(it.id) }
                    mutableState.update {
                        it.copy(
                            isSending = false,
                            errorMessage = error.message ?: "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘"
                        )
                    }
                }
        }
    }

    fun sendAttachment(uri: Uri) {
        val chatId = mutableState.value.selectedChatId ?: return

        stopTypingNow()
        viewModelScope.launch {
            mutableState.update { it.copy(isSending = true, uploadProgress = 0, errorMessage = null) }
            sendAttachmentMessageUseCase(
                chatId = chatId,
                attachmentUri = uri.toString()
            ) { progress ->
                mutableState.update { it.copy(uploadProgress = progress.coerceIn(0, 100)) }
            }.onSuccess { message ->
                val normalized = normalizeDeliveryStatus(message)
                appendMessage(normalized)
                updateChatWithMessage(chatId, normalized)
                mutableState.update { it.copy(isSending = false, uploadProgress = null) }
            }.onFailure { error ->
                mutableState.update {
                    it.copy(
                        isSending = false,
                        uploadProgress = null,
                        errorMessage = error.message ?: "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ РЎвЂћР В°Р в„–Р В»Р В°"
                    )
                }
            }
        }
    }

    fun onInputChanged(text: String) {
        val chatId = mutableState.value.selectedChatId ?: return
        if (text.isBlank()) {
            stopTypingNow()
            return
        }

        chatRepository.startTyping(chatId)
        typingStopJob?.cancel()
        typingStopJob = viewModelScope.launch {
            delay(TYPING_STOP_DELAY_MS)
            chatRepository.stopTyping(chatId)
        }
    }

    fun logout() {
        viewModelScope.launch {
            logoutUseCase()
            mutableState.update { it.copy(sessionExpired = true) }
        }
    }

    fun startCall(type: String) {
        val chat = mutableState.value.selectedChat ?: return
        if (chat.type == ChatType.GROUP) {
            startGroupCall(type)
            return
        }

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isCallActionInProgress = true,
                    callErrorMessage = null,
                    incomingCall = null
                )
            }
            val result = startCallUseCase(chatId = chat.id, type = type)
            if (result.isFailure) {
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        activeCall = null,
                        callErrorMessage = result.exceptionOrNull()?.message ?: "Call start failed"
                    )
                }
                return@launch
            }

            val callId = result.getOrNull().orEmpty()
            try {
                // Set activeCall BEFORE WebRTC init so participant/signal events
                // for this call are not dropped while ICE config/media are loading.
                mutableState.update {
                    it.copy(
                        activeCall = ActiveCallUi(
                            callId = callId,
                            chatId = chat.id,
                            chatName = chat.title,
                            type = type,
                            isGroup = false,
                            phase = ActiveCallPhase.Outgoing
                        )
                    )
                }
                initializeWebRtc(
                    callId = callId,
                    callType = type,
                    isInitiator = true,
                    remoteUserId = null
                )
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false
                    )
                }
                showCallControlsTemporarily()
            } catch (error: Throwable) {
                leaveCallUseCase(callId)
                try {
                    callManager.close()
                } catch (_: Throwable) {
                }
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        activeCall = null,
                        callErrorMessage = error.message ?: "WebRTC init failed"
                    )
                }
            }
        }
    }

    fun startGroupCall(type: String) {
        val chat = mutableState.value.selectedChat ?: return
        if (chat.type != ChatType.GROUP) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isCallActionInProgress = true,
                    callErrorMessage = null,
                    incomingCall = null,
                    existingGroupCallPrompt = null
                )
            }
            startGroupCallUseCase(chatId = chat.id, type = type)
                .onSuccess { startResult ->
                    val callId = startResult.callId
                    val callType = startResult.type.ifBlank { type }
                    if (startResult.alreadyActive) {
                        mutableState.update {
                            it.copy(
                                isCallActionInProgress = false,
                                activeCall = null,
                                existingGroupCallPrompt = ExistingGroupCallPromptUi(
                                    callId = callId,
                                    chatId = chat.id,
                                    chatName = chat.title,
                                    type = callType
                                )
                            )
                        }
                        return@onSuccess
                    }
                    try {
                        joinAndActivateGroupCall(
                            chatId = chat.id,
                            chatName = chat.title,
                            callId = callId,
                            callType = callType
                        )
                    } catch (error: Throwable) {
                        leaveGroupCallUseCase(callId)
                        try {
                            callManager.close()
                        } catch (_: Throwable) {
                        }
                        mutableState.update {
                            it.copy(
                                isCallActionInProgress = false,
                                activeCall = null,
                                callErrorMessage = error.message ?: "LiveKit init failed"
                            )
                        }
                    }
                }
                .onFailure { error ->
                    viewModelScope.launch {
                        try {
                            callManager.close()
                        } catch (_: Throwable) {
                        }
                    }
                    mutableState.update {
                        it.copy(
                            isCallActionInProgress = false,
                            activeCall = null,
                            existingGroupCallPrompt = null,
                            callErrorMessage = error.message ?: "Group call start failed"
                        )
                    }
                }
        }
    }

    fun confirmJoinExistingGroupCall() {
        val prompt = mutableState.value.existingGroupCallPrompt ?: return
        if (mutableState.value.isCallActionInProgress) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isCallActionInProgress = true,
                    callErrorMessage = null,
                    incomingCall = null,
                    existingGroupCallPrompt = null
                )
            }
            try {
                joinAndActivateGroupCall(
                    chatId = prompt.chatId,
                    chatName = prompt.chatName,
                    callId = prompt.callId,
                    callType = prompt.type
                )
            } catch (error: Throwable) {
                leaveGroupCallUseCase(prompt.callId)
                try {
                    callManager.close()
                } catch (_: Throwable) {
                }
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        activeCall = null,
                        callErrorMessage = error.message ?: "Group call join failed"
                    )
                }
            }
        }
    }

    fun dismissExistingGroupCallPrompt() {
        mutableState.update { it.copy(existingGroupCallPrompt = null) }
    }

    fun handleNotificationCommand(command: NotificationCommand) {
        if (!shouldHandleNotificationCommand(command.eventId)) return

        viewModelScope.launch {
            val chatId = command.chatId.orEmpty()
            if (chatId.isNotBlank()) {
                selectChat(chatId)
            }

            val callId = command.callId.orEmpty()
            if (callId.isNotBlank()) {
                IncomingCallNotifications.cancel(applicationContext, callId)
            }

            when (command.action) {
                NotificationIntents.ACTION_OPEN_CALL -> {
                    ensureIncomingCallFromNotification(command)
                }

                NotificationIntents.ACTION_ACCEPT_CALL -> {
                    ensureIncomingCallFromNotification(command)
                    acceptIncomingCall()
                }

                NotificationIntents.ACTION_DECLINE_CALL -> {
                    ensureIncomingCallFromNotification(command)
                    declineIncomingCall()
                }
            }
        }
    }

    fun acceptIncomingCall() {
        val incoming = mutableState.value.incomingCall ?: return
        if (mutableState.value.isCallActionInProgress) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isCallActionInProgress = true,
                    callErrorMessage = null,
                    existingGroupCallPrompt = null
                )
            }
            chatRepository.connectRealtime()
            val result = if (incoming.isGroup) {
                mutableState.update {
                    it.copy(
                        incomingCall = null,
                        activeCall = ActiveCallUi(
                            callId = incoming.callId,
                            chatId = incoming.chatId,
                            chatName = incoming.chatName,
                            type = incoming.type,
                            isGroup = true,
                            phase = ActiveCallPhase.Connecting
                        )
                    )
                }
                runCatching {
                    retrySocketOnce {
                        joinGroupCallUseCase(chatId = incoming.chatId, callId = incoming.callId)
                    }.getOrThrow()
                    initializeLiveKitForGroupCall(
                        callId = incoming.callId,
                        callType = incoming.type
                    )
                }.map { Unit }
            } else {
                try {
                    initializeWebRtc(
                        callId = incoming.callId,
                        callType = incoming.type,
                        isInitiator = false,
                        remoteUserId = incoming.initiatorId
                    )
                } catch (error: Throwable) {
                    mutableState.update {
                        it.copy(
                            isCallActionInProgress = false,
                            callErrorMessage = error.message ?: "WebRTC init failed"
                        )
                    }
                    return@launch
                }
                // Set activeCall BEFORE accept so incoming signals (offer/ICE)
                // are routed to callManager.onSignal() instead of being dropped.
                // Server notifies the initiator immediately after accept, and the
                // initiator sends offer before acceptCallUseCase even returns.
                mutableState.update {
                    it.copy(
                        incomingCall = null,
                        activeCall = ActiveCallUi(
                            callId = incoming.callId,
                            chatId = incoming.chatId,
                            chatName = incoming.chatName,
                            type = incoming.type,
                            isGroup = false,
                            phase = ActiveCallPhase.Connecting
                        )
                    )
                }
                retrySocketOnce {
                    acceptCallUseCase(callId = incoming.callId)
                }
            }

            result.onSuccess {
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        incomingCall = null,
                        activeCall = ActiveCallUi(
                            callId = incoming.callId,
                            chatId = incoming.chatId,
                            chatName = incoming.chatName,
                            type = incoming.type,
                            isGroup = incoming.isGroup,
                            phase = if (incoming.isGroup) ActiveCallPhase.Active else ActiveCallPhase.Connecting
                        )
                    )
                }
                showCallControlsTemporarily()
            }.onFailure { error ->
                if (incoming.isGroup) {
                    leaveGroupCallUseCase(incoming.callId)
                }
                viewModelScope.launch {
                    try {
                        callManager.close()
                    } catch (_: Throwable) {
                    }
                }
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        activeCall = null,
                        callErrorMessage = error.message ?: "Call accept failed"
                    )
                }
            }
        }
    }

    fun declineIncomingCall() {
        val incoming = mutableState.value.incomingCall ?: return

        viewModelScope.launch {
            chatRepository.connectRealtime()
            if (!incoming.isGroup) {
                declineCallUseCase(callId = incoming.callId)
            }
            mutableState.update { it.copy(incomingCall = null, isCallActionInProgress = false) }
        }
    }

    fun leaveActiveCall() {
        val activeCall = mutableState.value.activeCall ?: return
        viewModelScope.launch {
            mutableState.update { it.copy(isCallActionInProgress = true) }
            val result = if (activeCall.isGroup) {
                leaveGroupCallUseCase(activeCall.callId)
            } else {
                leaveCallUseCase(activeCall.callId)
            }
            result.onSuccess {
                viewModelScope.launch {
                    try {
                        callManager.close()
                    } catch (_: Throwable) {
                    }
                }
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        activeCall = null
                    )
                }
            }.onFailure { error ->
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        callErrorMessage = error.message ?: "Call leave failed"
                    )
                }
            }
        }
    }

    fun clearCallError() {
        callManager.clearStatusMessage()
        mutableState.update { it.copy(callErrorMessage = null) }
    }

    fun onCallSurfaceInteraction() {
        if (mutableState.value.activeCall == null) return
        showCallControlsTemporarily()
    }

    fun toggleCallMinimized() {
        if (mutableState.value.activeCall == null) return
        callManager.toggleMinimized()
        if (!callUiState.value.isMinimized) {
            showCallControlsTemporarily()
        } else {
            callControlsAutoHideJob?.cancel()
            callManager.setControlsVisible(false)
        }
    }

    fun expandMinimizedCall() {
        if (mutableState.value.activeCall == null) return
        callManager.expandFromFloating()
        showCallControlsTemporarily()
    }

    fun toggleMicrophone() {
        if (mutableState.value.activeCall == null) return
        viewModelScope.launch {
            callManager.toggleMicrophone().onFailure { error ->
                mutableState.update {
                    it.copy(callErrorMessage = error.message ?: "Не удалось переключить микрофон")
                }
            }
            showCallControlsTemporarily()
        }
    }

    fun toggleCamera() {
        if (mutableState.value.activeCall == null) return
        viewModelScope.launch {
            callManager.toggleCamera().onFailure { error ->
                mutableState.update {
                    it.copy(callErrorMessage = error.message ?: "Не удалось переключить камеру")
                }
            }
            showCallControlsTemporarily()
        }
    }

    fun switchCamera() {
        if (mutableState.value.activeCall == null) return
        viewModelScope.launch {
            callManager.switchCamera().onFailure { error ->
                mutableState.update { it.copy(callErrorMessage = error.message ?: "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С—Р ВµРЎР‚Р ВµР С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ Р С”Р В°Р СР ВµРЎР‚РЎС“") }
            }
            showCallControlsTemporarily()
        }
    }

    fun startScreenShare(resultCode: Int, permissionData: Intent?) {
        val activeCall = mutableState.value.activeCall ?: return
        if (activeCall.type != "video") return
        viewModelScope.launch {
            callManager.startScreenShare(resultCode = resultCode, permissionData = permissionData)
                .onFailure { error ->
                    mutableState.update { it.copy(callErrorMessage = error.message ?: "Screen share unavailable") }
                }
            showCallControlsTemporarily()
        }
    }

    fun stopScreenShare() {
        val activeCall = mutableState.value.activeCall ?: return
        if (activeCall.type != "video") return
        viewModelScope.launch {
            callManager.stopScreenShare().onFailure { error ->
                mutableState.update {
                    it.copy(callErrorMessage = error.message ?: "Failed to stop screen share")
                }
            }
            showCallControlsTemporarily()
        }
    }

    private suspend fun observeRealtime() {
        chatRepository.observeRealtimeEvents().collect { event ->
            when (event) {
                is RealtimeEvent.SocketConnected -> {
                    mutableState.update { it.copy(isRealtimeConnected = true) }
                }

                is RealtimeEvent.SocketDisconnected -> {
                    mutableState.update { it.copy(isRealtimeConnected = false) }
                }

                is RealtimeEvent.MessageCreated -> {
                    val message = normalizeDeliveryStatus(event.message)
                    appendMessage(message)
                    updateChatWithMessage(event.chatId, message)
                    maybeMarkMessagesRead(event.chatId, listOf(message))
                }

                is RealtimeEvent.UserStatusChanged -> {
                    refreshChats()
                }

                is RealtimeEvent.IncomingCall -> {
                    if (mutableState.value.activeCall != null) {
                        return@collect
                    }
                    val currentUserId = mutableState.value.currentUserId
                    if (event.initiatorId.isNotBlank() && event.initiatorId == currentUserId) {
                        return@collect
                    }
                    val incoming = IncomingCallUi(
                        callId = event.callId,
                        chatId = event.chatId,
                        chatName = event.chatName.ifBlank {
                            mutableState.value.chats.firstOrNull { it.id == event.chatId }?.title ?: "GovChat"
                        },
                        type = event.type.ifBlank { "audio" },
                        isGroup = event.isGroup,
                        initiatorId = event.initiatorId,
                        initiatorName = event.initiatorName.ifBlank { "Контакт" },
                        participantCount = event.participantCount
                    )
                    mutableState.update {
                        it.copy(
                            incomingCall = incoming,
                            callErrorMessage = null,
                            existingGroupCallPrompt = null
                        )
                    }
                    if (mutableState.value.selectedChatId != event.chatId) {
                        selectChat(event.chatId)
                    }
                }

                is RealtimeEvent.MessagesRead -> {
                    applyMessagesRead(event.userId, event.messageIds)
                }

                is RealtimeEvent.TypingUpdated -> {
                    updateTyping(event)
                }

                is RealtimeEvent.ChatCreated -> {
                    upsertChatOnTop(event.chat)
                }

                is RealtimeEvent.ChatDeleted -> {
                    mutableState.update { current ->
                        val removedSelected = current.selectedChatId == event.chatId
                        current.copy(
                            chats = current.chats.filterNot { it.id == event.chatId },
                            selectedChatId = if (removedSelected) null else current.selectedChatId,
                            messages = if (removedSelected) emptyList() else current.messages
                        )
                    }
                }

                is RealtimeEvent.MessageDeleted -> {
                    mutableState.update { current ->
                        if (current.selectedChatId != event.chatId) return@update current
                        current.copy(messages = current.messages.filterNot { it.id == event.messageId })
                    }
                }

                is RealtimeEvent.CallParticipantJoined -> {
                    mutableState.update { current ->
                        val active = current.activeCall ?: return@update current
                        if (active.callId != event.callId) return@update current
                        if (active.phase == ActiveCallPhase.Active) return@update current
                        current.copy(activeCall = active.copy(phase = ActiveCallPhase.Active))
                    }
                    val active = mutableState.value.activeCall
                    if (active != null && !active.isGroup && active.callId == event.callId) {
                        runCatching {
                            callManager.onParticipantJoined(event.userId)
                        }.onFailure { err ->
                            mutableState.update { it.copy(callErrorMessage = err.message ?: "Offer creation failed") }
                        }
                    }
                }

                is RealtimeEvent.CallParticipantLeft -> {
                    if (!event.callEnded) return@collect
                    try {
                        callManager.close()
                    } catch (_: Throwable) {
                    }
                    mutableState.update { current ->
                        val active = current.activeCall
                        if (active == null || active.callId != event.callId) {
                            current
                        } else {
                            current.copy(activeCall = null)
                        }
                    }
                }

                is RealtimeEvent.CallEnded -> {
                    try {
                        callManager.close()
                    } catch (_: Throwable) {
                    }
                    mutableState.update { current ->
                        val incoming = current.incomingCall
                        val active = current.activeCall
                        current.copy(
                            incomingCall = if (incoming?.callId == event.callId) null else incoming,
                            activeCall = if (active?.callId == event.callId) null else active
                        )
                    }
                }

                is RealtimeEvent.GroupCallStarted -> {
                    mutableState.update { current ->
                        val active = current.activeCall ?: return@update current
                        if (!active.isGroup || active.callId != event.callId) return@update current
                        current.copy(activeCall = active.copy(phase = ActiveCallPhase.Active))
                    }
                }

                is RealtimeEvent.GroupCallUpdated -> {
                    Unit
                }

                is RealtimeEvent.GroupCallEnded -> {
                    try {
                        callManager.close()
                    } catch (_: Throwable) {
                    }
                    mutableState.update { current ->
                        val incoming = current.incomingCall
                        val active = current.activeCall
                        current.copy(
                            incomingCall = if (incoming?.callId == event.callId) null else incoming,
                            activeCall = if (active?.callId == event.callId) null else active
                        )
                    }
                }

                is RealtimeEvent.CallSignalReceived -> {
                    val active = mutableState.value.activeCall
                    if (active == null || active.callId != event.callId) {
                        return@collect
                    }
                    if (active.isGroup) {
                        return@collect
                    }
                    val currentUserId = mutableState.value.currentUserId
                    if (!currentUserId.isNullOrBlank() && event.fromUserId == currentUserId) {
                        return@collect
                    }
                    runCatching {
                        callManager.onSignal(event.fromUserId, event.signal)
                    }.onFailure { error ->
                        mutableState.update { it.copy(callErrorMessage = error.message ?: "Signal handling failed") }
                    }
                }
            }
        }
    }

    private suspend fun initializeWebRtc(
        callId: String,
        callType: String,
        isInitiator: Boolean,
        remoteUserId: String?
    ) {
        val config = runCatching {
            withTimeout(ICE_CONFIG_TIMEOUT_MS) {
                loadWebRtcConfigUseCase().getOrThrow()
            }
        }.getOrElse { fallbackWebRtcConfig() }
        callManager.startWebRtcSession(
            callId = callId,
            isInitiator = isInitiator,
            isVideo = callType == "video",
            config = config,
            remoteUserId = remoteUserId
        ) { targetUserId, signal ->
            sendCallSignalUseCase(
                callId = callId,
                targetUserId = targetUserId,
                signal = signal
            )
        }
    }

    private suspend fun initializeWebRtcForGroupCall(
        callId: String,
        callType: String,
        isInitiator: Boolean,
        remoteUserId: String?
    ) {
        val config = runCatching {
            withTimeout(ICE_CONFIG_TIMEOUT_MS) {
                loadWebRtcConfigUseCase().getOrThrow()
            }
        }.getOrElse { fallbackWebRtcConfig() }
        callManager.startWebRtcSession(
            callId = callId,
            isInitiator = isInitiator,
            isVideo = callType == "video",
            config = config,
            remoteUserId = remoteUserId
        ) { targetUserId, signal ->
            sendGroupCallSignalUseCase(
                callId = callId,
                targetUserId = targetUserId,
                signal = signal
            )
        }
    }

    private suspend fun initializeLiveKitForGroupCall(
        callId: String,
        callType: String
    ) {
        val identity = resolveCurrentUserIdForLiveKit()
        val token = chatRepository.loadLiveKitToken(room = callId, identity = identity).getOrThrow()
        callManager.startLiveKitGroupSession(
            liveKitUrl = BuildConfig.LIVEKIT_URL,
            token = token,
            isVideo = callType == "video"
        )
    }

    private suspend fun joinAndActivateGroupCall(
        chatId: String,
        chatName: String,
        callId: String,
        callType: String
    ) {
        joinGroupCallUseCase(chatId = chatId, callId = callId).getOrThrow()
        initializeLiveKitForGroupCall(
            callId = callId,
            callType = callType
        )
        mutableState.update {
            it.copy(
                isCallActionInProgress = false,
                activeCall = ActiveCallUi(
                    callId = callId,
                    chatId = chatId,
                    chatName = chatName,
                    type = callType,
                    isGroup = true,
                    phase = ActiveCallPhase.Active
                )
            )
        }
        showCallControlsTemporarily()
    }

    private suspend fun resolveCurrentUserIdForLiveKit(): String {
        val current = mutableState.value.currentUserId
        if (!current.isNullOrBlank()) {
            return current
        }
        val profile = chatRepository.getCurrentUser().getOrThrow()
        mutableState.update { it.copy(currentUserId = profile.id, userProfile = profile) }
        return profile.id
    }

    private suspend fun observeSession() {
        authRepository.tokenFlow.collect { token ->
            if (!tokenInitialized) {
                tokenInitialized = true
                return@collect
            }
            if (token.isNullOrBlank()) {
                mutableState.update { it.copy(sessionExpired = true) }
            }
        }
    }

    private suspend fun loadCurrentUser() {
        mutableState.update { it.copy(userProfileLoading = true) }
        chatRepository.getCurrentUser().onSuccess { user ->
            mutableState.update {
                it.copy(
                    currentUserId = user.id,
                    userProfile = user,
                    userProfileLoading = false
                )
            }
        }.onFailure {
            mutableState.update { it.copy(userProfileLoading = false) }
        }
    }

    fun refreshProfile() {
        viewModelScope.launch {
            loadCurrentUser()
        }
    }

    private var searchJob: Job? = null

    fun searchUserByPhone(phone: String) {
        searchJob?.cancel()
        val cleaned = phone.replace("[^\\d+]".toRegex(), "")
        val digitCount = cleaned.count { it.isDigit() }
        if (digitCount < 4) {
            mutableState.update {
                it.copy(
                    userSearchStatus = if (cleaned.isEmpty()) UserSearchStatus.Idle else UserSearchStatus.TooShort,
                    searchedUser = null
                )
            }
            return
        }

        // Backend refuses requests shorter than 9 digits (anti-enumeration).
        if (digitCount < 9) {
            mutableState.update { it.copy(userSearchStatus = UserSearchStatus.TooShort, searchedUser = null) }
            return
        }
        mutableState.update { it.copy(userSearchStatus = UserSearchStatus.Loading, searchedUser = null) }
        searchJob = viewModelScope.launch {
            delay(400) // debounce
            searchUserByPhoneUseCase(cleaned)
                .onSuccess { user ->
                    mutableState.update {
                        if (user != null) {
                            it.copy(userSearchStatus = UserSearchStatus.Found, searchedUser = user)
                        } else {
                            it.copy(userSearchStatus = UserSearchStatus.NotFound, searchedUser = null)
                        }
                    }
                }
                .onFailure {
                    mutableState.update { it.copy(userSearchStatus = UserSearchStatus.Error, searchedUser = null) }
                }
        }
    }

    fun createChatWithUser(userId: String) {
        viewModelScope.launch {
            createChatUseCase(userId)
                .onSuccess { chat ->
                    upsertChatOnTop(chat)
                    selectChat(chat.id)
                    mutableState.update {
                        it.copy(userSearchStatus = UserSearchStatus.Idle, searchedUser = null)
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(errorMessage = error.message ?: "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ С‡Р°С‚")
                    }
                }
        }
    }

    fun createGroupChat(name: String, participantIds: List<String>) {
        viewModelScope.launch {
            createGroupChatUseCase(name = name, participantIds = participantIds)
                .onSuccess { chat ->
                    upsertChatOnTop(chat)
                    selectChat(chat.id)
                    resetUserSearch()
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(errorMessage = error.message ?: "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РіСЂСѓРїРїСѓ")
                    }
                }
        }
    }

    fun resetUserSearch() {
        searchJob?.cancel()
        mutableState.update { it.copy(userSearchStatus = UserSearchStatus.Idle, searchedUser = null) }
    }

    private fun ensureIncomingCallFromNotification(command: NotificationCommand) {
        val callId = command.callId.orEmpty()
        val chatId = command.chatId.orEmpty()
        if (callId.isBlank() || chatId.isBlank()) return

        val currentIncoming = mutableState.value.incomingCall
        if (currentIncoming?.callId == callId) return

        val chatName = command.chatName
            ?.takeIf { it.isNotBlank() }
            ?: mutableState.value.chats.firstOrNull { it.id == chatId }?.title
            ?: "GovChat"

        mutableState.update {
            it.copy(
                incomingCall = IncomingCallUi(
                    callId = callId,
                    chatId = chatId,
                    chatName = chatName,
                    type = command.callType.orEmpty().ifBlank { "audio" },
                    isGroup = command.isGroupCall,
                    initiatorId = command.initiatorId.orEmpty(),
                    initiatorName = command.initiatorName.orEmpty().ifBlank { "Contact" },
                    participantCount = 0
                ),
                callErrorMessage = null,
                existingGroupCallPrompt = null
            )
        }
    }

    private fun shouldHandleNotificationCommand(eventId: String): Boolean {
        if (eventId.isBlank()) return true
        if (!handledNotificationEventIds.add(eventId)) return false
        while (handledNotificationEventIds.size > MAX_HANDLED_NOTIFICATION_EVENTS) {
            val oldest = handledNotificationEventIds.firstOrNull() ?: break
            handledNotificationEventIds.remove(oldest)
        }
        return true
    }

    private suspend fun loadMessages(chatId: String) {
        mutableState.update { it.copy(isLoadingMessages = true, errorMessage = null) }

        loadMessagesUseCase(chatId = chatId)
            .onSuccess { loaded ->
                val normalized = loaded.map { normalizeDeliveryStatus(it) }
                mutableState.update {
                    it.copy(
                        isLoadingMessages = false,
                        messages = normalized
                    )
                }
                maybeMarkMessagesRead(chatId, normalized)
            }
            .onFailure { error ->
                mutableState.update {
                    it.copy(
                        isLoadingMessages = false,
                        errorMessage = error.message ?: "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С”Р С‘ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р в„–"
                    )
                }
            }
    }

    private fun appendMessage(message: ChatMessage) {
        mutableState.update { current ->
            if (current.selectedChatId != message.chatId) return@update current
            if (current.messages.any { it.id == message.id }) return@update current
            current.copy(messages = current.messages + message)
        }
    }

    private fun removeMessage(messageId: String) {
        mutableState.update { current ->
            current.copy(messages = current.messages.filterNot { it.id == messageId })
        }
    }

    private fun updateChatWithMessage(chatId: String, message: ChatMessage) {
        mutableState.update { current ->
            val index = current.chats.indexOfFirst { it.id == chatId }
            if (index < 0) return@update current

            val source = current.chats[index]
            val shouldIncreaseUnread = current.selectedChatId != chatId &&
                message.senderId != current.currentUserId
            val updated = source.copy(
                subtitle = message.toChatSubtitle(),
                updatedAtMillis = message.createdAtMillis,
                unreadCount = if (shouldIncreaseUnread) source.unreadCount + 1 else source.unreadCount
            )

            val reordered = current.chats.toMutableList()
            reordered.removeAt(index)
            reordered.add(0, updated)

            current.copy(chats = reordered)
        }
    }

    private fun upsertChatOnTop(chat: ru.govchat.app.domain.model.ChatPreview) {
        mutableState.update { current ->
            val existing = current.chats.indexOfFirst { it.id == chat.id }
            val next = current.chats.toMutableList()
            if (existing >= 0) {
                next.removeAt(existing)
            }
            next.add(0, chat)
            current.copy(chats = next)
        }
    }

    private fun applyMessagesRead(userId: String, messageIds: List<String>) {
        if (messageIds.isEmpty()) return
        val currentUserId = mutableState.value.currentUserId.orEmpty()
        mutableState.update { current ->
            current.copy(
                messages = current.messages.map { message ->
                    if (message.id !in messageIds) return@map message
                    val nextReadBy = message.readByUserIds + userId
                    val nextStatus = if (message.senderId == currentUserId && userId != currentUserId) {
                        MessageDeliveryStatus.Read
                    } else {
                        message.deliveryStatus
                    }
                    message.copy(readByUserIds = nextReadBy, deliveryStatus = nextStatus)
                }
            )
        }
    }

    private fun maybeMarkMessagesRead(chatId: String, messages: List<ChatMessage>) {
        val currentUserId = mutableState.value.currentUserId ?: return
        val unreadIncomingIds = messages
            .filter { it.senderId != currentUserId && !it.readByUserIds.contains(currentUserId) }
            .map { it.id }
            .distinct()

        if (unreadIncomingIds.isEmpty()) return

        viewModelScope.launch {
            chatRepository.markMessagesRead(chatId = chatId, messageIds = unreadIncomingIds)
            mutableState.update { current ->
                current.copy(
                    messages = current.messages.map { message ->
                        if (message.id !in unreadIncomingIds) {
                            message
                        } else {
                            message.copy(readByUserIds = message.readByUserIds + currentUserId)
                        }
                    }
                )
            }
        }
    }

    private fun updateTyping(event: RealtimeEvent.TypingUpdated) {
        val currentUserId = mutableState.value.currentUserId
        if (event.userId == currentUserId) return

        mutableState.update { current ->
            val others = current.typingUsers.filterNot {
                it.chatId == event.chatId && it.userId == event.userId
            }
            if (!event.isTyping) {
                current.copy(typingUsers = others)
            } else {
                current.copy(
                    typingUsers = others + TypingUser(
                        chatId = event.chatId,
                        userId = event.userId,
                        userName = event.userName
                    )
                )
            }
        }
    }

    private fun stopTypingNow() {
        typingStopJob?.cancel()
        val chatId = mutableState.value.selectedChatId ?: return
        chatRepository.stopTyping(chatId)
    }

    private fun normalizeDeliveryStatus(message: ChatMessage): ChatMessage {
        val currentUserId = mutableState.value.currentUserId.orEmpty()
        if (currentUserId.isBlank() || message.senderId != currentUserId) {
            return message
        }

        val readByOthers = message.readByUserIds.any { it != currentUserId }
        val status = if (readByOthers) MessageDeliveryStatus.Read else MessageDeliveryStatus.Delivered
        return message.copy(deliveryStatus = status)
    }

    private fun createPendingTextMessage(chatId: String, text: String): ChatMessage? {
        val currentUserId = mutableState.value.currentUserId ?: return null
        return ChatMessage(
            id = "local-${System.currentTimeMillis()}",
            chatId = chatId,
            senderId = currentUserId,
            senderName = "",
            type = MessageType.Text,
            text = text,
            attachment = null,
            readByUserIds = setOf(currentUserId),
            createdAtMillis = System.currentTimeMillis(),
            deliveryStatus = MessageDeliveryStatus.Sent
        )
    }

    private suspend fun <T> retrySocketOnce(block: suspend () -> Result<T>): Result<T> {
        val first = block()
        if (first.isSuccess) return first

        val message = first.exceptionOrNull()?.message.orEmpty().lowercase()
        if (!message.contains("socket disconnected")) {
            return first
        }

        chatRepository.connectRealtime()
        delay(300)
        return block()
    }

    private fun showCallControlsTemporarily() {
        if (mutableState.value.activeCall == null) return
        callManager.setControlsVisible(true)
        callControlsAutoHideJob?.cancel()
        callControlsAutoHideJob = viewModelScope.launch {
            delay(CALL_CONTROLS_AUTO_HIDE_MS)
            if (!callUiState.value.isMinimized) {
                callManager.setControlsVisible(false)
            }
        }
    }

    private fun fallbackWebRtcConfig(): WebRtcConfig {
        return WebRtcConfig(
            iceServers = listOf(
                WebRtcIceServer(urls = listOf("stun:stun.l.google.com:19302"), username = null, credential = null),
                WebRtcIceServer(urls = listOf("stun:stun1.l.google.com:19302"), username = null, credential = null)
            ),
            iceCandidatePoolSize = 10
        )
    }

    override fun onCleared() {
        callControlsAutoHideJob?.cancel()
        // viewModelScope is already cancelled when onCleared runs,
        // so use GlobalScope to ensure WebRTC resources are released.
        GlobalScope.launch(kotlinx.coroutines.Dispatchers.Main.immediate) {
            runCatching { callManager.close() }
        }
        super.onCleared()
    }

    companion object {
        private const val TYPING_STOP_DELAY_MS = 2_000L
        private const val CALL_CONTROLS_AUTO_HIDE_MS = 3_500L
        private const val ICE_CONFIG_TIMEOUT_MS = 3_000L
        private const val MAX_HANDLED_NOTIFICATION_EVENTS = 128

        fun factory(
            appContext: Context,
            loadChatsUseCase: LoadChatsUseCase,
            loadMessagesUseCase: LoadMessagesUseCase,
            sendTextMessageUseCase: SendTextMessageUseCase,
            sendAttachmentMessageUseCase: SendAttachmentMessageUseCase,
            loadWebRtcConfigUseCase: LoadWebRtcConfigUseCase,
            sendCallSignalUseCase: SendCallSignalUseCase,
            sendGroupCallSignalUseCase: SendGroupCallSignalUseCase,
            startCallUseCase: StartCallUseCase,
            acceptCallUseCase: AcceptCallUseCase,
            declineCallUseCase: DeclineCallUseCase,
            leaveCallUseCase: LeaveCallUseCase,
            startGroupCallUseCase: StartGroupCallUseCase,
            joinGroupCallUseCase: JoinGroupCallUseCase,
            leaveGroupCallUseCase: LeaveGroupCallUseCase,
            logoutUseCase: LogoutUseCase,
            searchUserByPhoneUseCase: SearchUserByPhoneUseCase,
            createChatUseCase: CreateChatUseCase,
            createGroupChatUseCase: CreateGroupChatUseCase,
            chatRepository: ChatRepository,
            authRepository: AuthRepository
        ) = viewModelFactory {
            MainViewModel(
                appContext = appContext,
                loadChatsUseCase = loadChatsUseCase,
                loadMessagesUseCase = loadMessagesUseCase,
                sendTextMessageUseCase = sendTextMessageUseCase,
                sendAttachmentMessageUseCase = sendAttachmentMessageUseCase,
                loadWebRtcConfigUseCase = loadWebRtcConfigUseCase,
                sendCallSignalUseCase = sendCallSignalUseCase,
                sendGroupCallSignalUseCase = sendGroupCallSignalUseCase,
                startCallUseCase = startCallUseCase,
                acceptCallUseCase = acceptCallUseCase,
                declineCallUseCase = declineCallUseCase,
                leaveCallUseCase = leaveCallUseCase,
                startGroupCallUseCase = startGroupCallUseCase,
                joinGroupCallUseCase = joinGroupCallUseCase,
                leaveGroupCallUseCase = leaveGroupCallUseCase,
                logoutUseCase = logoutUseCase,
                searchUserByPhoneUseCase = searchUserByPhoneUseCase,
                createChatUseCase = createChatUseCase,
                createGroupChatUseCase = createGroupChatUseCase,
                chatRepository = chatRepository,
                authRepository = authRepository
            )
        }
    }
}

private fun ChatMessage.toChatSubtitle(): String {
    return when (type) {
        MessageType.Audio -> "СЂСџР‹В¤ Р вЂњР С•Р В»Р С•РЎРѓР С•Р Р†Р С•Р Вµ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ"
        MessageType.Image -> "СЂСџвЂњВ· Р ВР В·Р С•Р В±РЎР‚Р В°Р В¶Р ВµР Р…Р С‘Р Вµ"
        MessageType.Video -> "СЂСџР‹Тђ Р вЂ™Р С‘Р Т‘Р ВµР С•"
        MessageType.File -> "СЂСџвЂњР‹ Р В¤Р В°Р в„–Р В»"
        MessageType.System -> text.ifBlank { "Р РЋР С‘РЎРѓРЎвЂљР ВµР СР Р…Р С•Р Вµ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ" }
        MessageType.Text -> text.ifBlank { "Р РЋР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ" }
    }
}


