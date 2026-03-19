package ru.govchat.app.ui.screens.main

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.call.CallManager
import ru.govchat.app.core.call.CallUiPhase
import ru.govchat.app.core.call.CallUiState
import ru.govchat.app.core.media.TempMediaStore
import ru.govchat.app.core.notification.CallNotificationManager
import ru.govchat.app.core.notification.IncomingCallManagerEvent
import ru.govchat.app.core.notification.NotificationCommand
import ru.govchat.app.core.notification.NotificationIntents
import ru.govchat.app.core.storage.ChatMessagesCacheStorage
import ru.govchat.app.core.ui.viewModelFactory
import ru.govchat.app.domain.model.AttachmentType
import ru.govchat.app.domain.model.CallHistoryDraft
import ru.govchat.app.domain.model.CallHistoryDirection
import ru.govchat.app.domain.model.CallHistoryStatus
import ru.govchat.app.domain.model.CallHistoryType
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatType
import ru.govchat.app.domain.model.MessageDeliveryStatus
import ru.govchat.app.domain.model.MessageType
import ru.govchat.app.domain.model.RealtimeEvent
import ru.govchat.app.domain.model.TypingUser
import ru.govchat.app.domain.model.WebRtcConfig
import ru.govchat.app.domain.model.WebRtcIceServer
import ru.govchat.app.domain.repository.AuthRepository
import ru.govchat.app.domain.repository.CallHistoryRepository
import ru.govchat.app.domain.repository.ChatRepository
import ru.govchat.app.domain.usecase.LoadMessagesUseCase
import ru.govchat.app.domain.usecase.LoadChatsUseCase
import ru.govchat.app.domain.usecase.AcceptCallUseCase
import ru.govchat.app.domain.usecase.DeleteMessageUseCase
import ru.govchat.app.domain.usecase.DeclineCallUseCase
import ru.govchat.app.domain.usecase.EditMessageUseCase
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
import ru.govchat.app.service.call.IncomingCallService
import java.util.UUID

class MainViewModel(
    appContext: Context,
    private val loadChatsUseCase: LoadChatsUseCase,
    private val loadMessagesUseCase: LoadMessagesUseCase,
    private val editMessageUseCase: EditMessageUseCase,
    private val deleteMessageUseCase: DeleteMessageUseCase,
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
    private val messagesDiskCache: ChatMessagesCacheStorage,
    private val callHistoryRepository: CallHistoryRepository,
    private val chatRepository: ChatRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val applicationContext = appContext.applicationContext
    private val tempMediaStore = TempMediaStore(applicationContext)
    private val cleanupScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutableState = MutableStateFlow(MainUiState(isLoadingChats = true))
    val state: StateFlow<MainUiState> = mutableState.asStateFlow()
    private val mutableUploadProgress = MutableStateFlow<Int?>(null)
    val uploadProgress: StateFlow<Int?> = mutableUploadProgress.asStateFlow()
    private val mutableRecordingElapsedSeconds = MutableStateFlow(0)
    val recordingElapsedSeconds: StateFlow<Int> = mutableRecordingElapsedSeconds.asStateFlow()
    private val mutableRecordingCommands = MutableSharedFlow<RecordingCommand>(extraBufferCapacity = 4)
    val recordingCommands = mutableRecordingCommands.asSharedFlow()
    private val callManager = CallManager(
        appContext = applicationContext
    )
    val callUiState: StateFlow<CallUiState> = callManager.state

    private var typingStopJob: Job? = null
    private var callControlsAutoHideJob: Job? = null
    private var recordingTickerJob: Job? = null
    private var uploadJob: Job? = null
    private var activeRecordingSession: RecordingSession? = null
    private var tokenInitialized = false
    private val handledNotificationEventIds = LinkedHashSet<String>()
    private val answeredCallHistoryIds = LinkedHashSet<String>()
    private val messagesCache: MutableMap<String, List<ChatMessage>> = LinkedHashMap()
    private val pagingByChat: MutableMap<String, ChatPagingState> = LinkedHashMap()

    init {
        CallNotificationManager.ensureInitialized(applicationContext)
        callManager.bind(viewModelScope)
        viewModelScope.launch(Dispatchers.IO) {
            tempMediaStore.cleanupExpired()
        }
        viewModelScope.launch {
            CallNotificationManager.incomingCall.collect { command ->
                syncIncomingCallFromManager(command)
            }
        }
        viewModelScope.launch {
            CallNotificationManager.events.collect { event ->
                when (event) {
                    is IncomingCallManagerEvent.Cleared -> {
                        mutableState.update { current ->
                            val incoming = current.incomingCall
                            if (incoming?.callId != event.callId) {
                                current
                            } else {
                                current.copy(incomingCall = null, isCallActionInProgress = false)
                            }
                        }
                    }

                    is IncomingCallManagerEvent.Missed -> {
                        appendSyntheticCallMessage(event.command)
                    }
                }
            }
        }
        viewModelScope.launch {
            callHistoryRepository.observeCallsSortedByDate().collect { history ->
                mutableState.update { it.copy(callHistory = history) }
            }
        }
        viewModelScope.launch {
            callUiState.collect { call ->
                if (call.phase == CallUiPhase.Active) {
                    mutableState.value.activeCall?.callId?.let { activeCallId ->
                        if (answeredCallHistoryIds.add(activeCallId)) {
                            callHistoryRepository.markAnswered(activeCallId)
                            while (answeredCallHistoryIds.size > MAX_HANDLED_NOTIFICATION_EVENTS) {
                                val oldest = answeredCallHistoryIds.firstOrNull() ?: break
                                answeredCallHistoryIds.remove(oldest)
                            }
                        }
                    }
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
                            errorMessage = error.message ?: "Р В РЎвЂєР РЋРІвЂљВ¬Р В РЎвЂР В Р’В±Р В РЎвЂќР В Р’В° Р В Р’В·Р В Р’В°Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂќР В РЎвЂ Р РЋРІР‚РЋР В Р’В°Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ "
                        )
                    }
                }
        }
    }

    fun selectChat(chatId: String) {
        val current = mutableState.value.selectedChatId
        if (current == chatId) return
        val memoryCached = messagesCache[chatId].orEmpty()
        val hasMemoryCache = memoryCached.isNotEmpty()

        mutableState.update {
            it.copy(
                selectedChatId = chatId,
                messages = memoryCached,
                chats = it.chats.map { chat ->
                    if (chat.id == chatId) chat.copy(unreadCount = 0) else chat
                },
                isLoadingMessages = !hasMemoryCache,
                isLoadingOlderMessages = false,
                hasOlderMessages = pagingByChat[chatId]?.hasMore ?: hasMemoryCache,
                errorMessage = null
            )
        }

        viewModelScope.launch {
            chatRepository.joinChat(chatId)
            if (!hasMemoryCache) {
                showDiskCacheIfAvailable(chatId)
            }
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
                            groupParticipantsErrorMessage = error.message ?: "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ РЎС“РЎвЂЎР В°РЎРѓРЎвЂљР Р…Р С‘Р С”Р С•Р Р†"
                        )
                    }
                }
        }
    }

    fun clearSelectedChat() {
        typingStopJob?.cancel()
        recordingTickerJob?.cancel()
        uploadJob?.cancel()
        activeRecordingSession = null
        mutableUploadProgress.value = null
        mutableRecordingElapsedSeconds.value = 0
        val selected = mutableState.value.selectedChatId ?: return
        chatRepository.stopTyping(selected)
        mutableState.update {
            it.copy(
                selectedChatId = null,
                messages = emptyList(),
                isLoadingMessages = false,
                isLoadingOlderMessages = false,
                hasOlderMessages = false,
                recordingState = RecordingState.Idle
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
                            errorMessage = error.message ?: "Р В РЎвЂєР РЋРІвЂљВ¬Р В РЎвЂР В Р’В±Р В РЎвЂќР В Р’В° Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂќР В РЎвЂ"
                        )
                    }
                }
        }
    }

    fun editMessage(messageId: String, text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return
        val currentMessage = findMessageById(messageId)
        if (currentMessage?.deleted == true) return
        val optimisticMessage = currentMessage?.let { buildOptimisticEditedMessage(it, trimmed) }

        viewModelScope.launch {
            mutableState.update { it.copy(errorMessage = null) }
            optimisticMessage?.let { applyMessageMutation(it) }
            editMessageUseCase(
                messageId = messageId,
                text = trimmed,
                expectedRevision = currentMessage?.revision,
                expectedUpdatedAtMillis = messageMutationTimestamp(currentMessage)
            )
                .onSuccess { message ->
                    applyMessageMutation(normalizeDeliveryStatus(message))
                }
                .onFailure { error ->
                    currentMessage?.let { applyMessageMutation(it) }
                    refreshChatMessages(currentMessage?.chatId ?: mutableState.value.selectedChatId)
                    mutableState.update {
                        it.copy(errorMessage = error.message ?: "Не удалось обновить сообщение")
                    }
                }
        }
    }

    fun deleteMessage(messageId: String) {
        val currentMessage = findMessageById(messageId)
        if (currentMessage?.deleted == true) return
        val optimisticMessage = currentMessage?.let { buildOptimisticDeletedMessage(it) }

        viewModelScope.launch {
            mutableState.update { it.copy(errorMessage = null) }
            optimisticMessage?.let { applyMessageMutation(it) }
            deleteMessageUseCase(
                messageId = messageId,
                expectedRevision = currentMessage?.revision,
                expectedUpdatedAtMillis = messageMutationTimestamp(currentMessage)
            )
                .onSuccess { message ->
                    applyMessageMutation(normalizeDeliveryStatus(message))
                }
                .onFailure { error ->
                    currentMessage?.let { applyMessageMutation(it) }
                    refreshChatMessages(currentMessage?.chatId ?: mutableState.value.selectedChatId)
                    mutableState.update {
                        it.copy(errorMessage = error.message ?: "Не удалось удалить сообщение")
                    }
                }
        }
    }

    fun sendAttachment(uri: Uri) {
        val chatId = mutableState.value.selectedChatId ?: return

        stopTypingNow()
        uploadAttachment(
            chatId = chatId,
            uri = uri,
            attachmentType = null,
            durationMs = null,
            onUploadFailed = null
        )
    }

    fun toggleRecordingMode() {
        if (mutableState.value.recordingState != RecordingState.Idle) return
        mutableState.update { current ->
            val nextMode = when (current.recordingMode) {
                RecordingMode.Voice -> RecordingMode.Video
                RecordingMode.Video -> RecordingMode.Voice
                RecordingMode.None -> RecordingMode.Voice
            }
            current.copy(recordingMode = nextMode)
        }
    }

    fun onRecordingStarted(mode: RecordingMode): Long? {
        if (mode == RecordingMode.None) return null
        val current = mutableState.value
        if (current.recordingState != RecordingState.Idle) return null
        val chatId = current.selectedChatId ?: return null
        val session = RecordingSession(
            id = SystemClock.elapsedRealtimeNanos(),
            chatId = chatId,
            mode = mode
        )
        activeRecordingSession = session
        mutableRecordingElapsedSeconds.value = 0

        mutableState.update {
            it.copy(
                recordingMode = mode,
                recordingState = RecordingState.Recording,
                failedRecordingUpload = null,
                errorMessage = null
            )
        }
        startRecordingTicker()
        return session.id
    }

    fun onRecordingLocked() {
        mutableState.update { current ->
            if (current.recordingState != RecordingState.Recording) current
            else current.copy(recordingState = RecordingState.Locked)
        }
    }

    fun onRecordingCancelled() {
        stopRecordingTicker(resetElapsed = true)
        activeRecordingSession = null
        mutableState.update { current ->
            if (current.recordingState == RecordingState.Uploading) current
            else current.copy(recordingState = RecordingState.Idle)
        }
    }

    fun onRecordingFinished(sessionId: Long, uri: Uri, durationMs: Long) {
        val session = activeRecordingSession
        if (session == null || session.id != sessionId) {
            tempMediaStore.deleteLocalRecordingFile(uri)
            return
        }

        stopTypingNow()
        stopRecordingTicker(resetElapsed = false)
        mutableRecordingElapsedSeconds.value = (durationMs / 1000L).toInt().coerceAtLeast(0)
        mutableState.update {
            it.copy(
                recordingMode = session.mode,
                recordingState = RecordingState.Uploading,
                failedRecordingUpload = null
            )
        }
        uploadAttachment(
            chatId = session.chatId,
            uri = uri,
            attachmentType = session.mode.toAttachmentType(),
            durationMs = durationMs,
            onUploadFailed = { errorMessage ->
                mutableState.update {
                    it.copy(
                        failedRecordingUpload = FailedRecordingUploadUi(
                            chatId = session.chatId,
                            uri = uri.toString(),
                            attachmentType = session.mode.toAttachmentType()
                                ?: AttachmentType.File,
                            durationMs = durationMs,
                            errorMessage = errorMessage
                        )
                    )
                }
            }
        )
    }

    fun retryFailedRecordingUpload() {
        val failed = mutableState.value.failedRecordingUpload ?: return
        mutableRecordingElapsedSeconds.value = (failed.durationMs / 1000L).toInt().coerceAtLeast(0)
        mutableState.update {
            it.copy(
                recordingState = RecordingState.Uploading,
                failedRecordingUpload = null
            )
        }
        uploadAttachment(
            chatId = failed.chatId,
            uri = Uri.parse(failed.uri),
            attachmentType = failed.attachmentType,
            durationMs = failed.durationMs,
            onUploadFailed = { errorMessage ->
                mutableState.update {
                    it.copy(
                        failedRecordingUpload = failed.copy(errorMessage = errorMessage)
                    )
                }
            }
        )
    }

    fun clearFailedRecordingUpload() {
        mutableState.value.failedRecordingUpload?.let { failed ->
            tempMediaStore.deleteLocalRecordingFile(Uri.parse(failed.uri))
        }
        mutableState.update { it.copy(failedRecordingUpload = null) }
    }

    fun cancelUpload() {
        uploadJob?.cancel()
        uploadJob = null
        activeRecordingSession = null
        mutableUploadProgress.value = null
        mutableState.update {
            it.copy(
                isSending = false,
                recordingState = RecordingState.Idle
            )
        }
    }

    private fun uploadAttachment(
        chatId: String,
        uri: Uri,
        attachmentType: AttachmentType?,
        durationMs: Long?,
        onUploadFailed: ((String) -> Unit)?
    ) {
        if (uploadJob?.isActive == true && onUploadFailed != null) {
            onUploadFailed?.invoke("Upload already in progress")
            return
        }
        uploadJob = viewModelScope.launch {
            mutableState.update { it.copy(isSending = true, errorMessage = null) }
            mutableUploadProgress.value = 0
            val uploadResult = sendAttachmentMessageUseCase(
                chatId = chatId,
                attachmentUri = uri.toString(),
                attachmentType = attachmentType,
                durationMs = durationMs
            ) { progress ->
                mutableUploadProgress.value = progress.coerceIn(0, 100)
            }
            uploadResult.onSuccess { message ->
                val normalized = normalizeDeliveryStatus(message)
                appendMessage(normalized)
                updateChatWithMessage(chatId, normalized)
                tempMediaStore.deleteLocalRecordingFile(uri)
                activeRecordingSession = null
                mutableUploadProgress.value = null
                mutableRecordingElapsedSeconds.value = 0
                mutableState.update {
                    it.copy(
                        isSending = false,
                        recordingState = RecordingState.Idle,
                        failedRecordingUpload = null
                    )
                }
                uploadJob = null
            }.onFailure { error ->
                val errorText = when {
                    error is CancellationException -> "Upload cancelled"
                    error.message?.contains("413") == true -> "File too large (413)"
                    else -> error.message ?: "Не удалось загрузить вложение"
                }
                activeRecordingSession = null
                mutableUploadProgress.value = null
                mutableRecordingElapsedSeconds.value = 0
                mutableState.update {
                    it.copy(
                        isSending = false,
                        recordingState = RecordingState.Idle,
                        errorMessage = errorText
                    )
                }
                onUploadFailed?.invoke(errorText)
                uploadJob = null
            }
        }
    }

    private fun startRecordingTicker() {
        recordingTickerJob?.cancel()
        recordingTickerJob = viewModelScope.launch {
            while (true) {
                delay(1_000L)
                val recordingState = mutableState.value.recordingState
                if (
                    recordingState != RecordingState.Recording &&
                    recordingState != RecordingState.Locked
                ) {
                    continue
                }
                mutableRecordingElapsedSeconds.update { it + 1 }
            }
        }
    }

    private fun stopRecordingTicker(resetElapsed: Boolean) {
        recordingTickerJob?.cancel()
        recordingTickerJob = null
        if (resetElapsed) {
            mutableRecordingElapsedSeconds.value = 0
        }
    }

    private fun requestRecordingPreempt(command: RecordingCommand) {
        val recordingState = mutableState.value.recordingState
        if (recordingState != RecordingState.Recording && recordingState != RecordingState.Locked) return
        mutableRecordingCommands.tryEmit(command)
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
        if (chat.isAiChat) {
            mutableState.update {
                it.copy(callErrorMessage = "В чате поддержки звонки недоступны")
            }
            return
        }
        requestRecordingPreempt(RecordingCommand.StopAndSend)
        val callStartedAtMillis = System.currentTimeMillis()
        val historyEntryId = UUID.randomUUID().toString()

        viewModelScope.launch {
            callHistoryRepository.createPendingCall(
                createOutgoingCallDraft(
                    entryId = historyEntryId,
                    chat = chat,
                    type = type,
                    startedAt = callStartedAtMillis
                )
            )
            mutableState.update {
                it.copy(
                    isCallActionInProgress = true,
                    callErrorMessage = null,
                    incomingCall = null
                )
            }
            val result = startCallUseCase(chatId = chat.id, type = type)
            if (result.isFailure) {
                callHistoryRepository.markCancelled(historyEntryId)
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
                callHistoryRepository.attachServerCallId(historyEntryId, callId)
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
                            phase = ActiveCallPhase.Outgoing,
                            startedAtMillis = callStartedAtMillis
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
                callHistoryRepository.markCancelled(callId.ifBlank { historyEntryId })
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
        requestRecordingPreempt(RecordingCommand.StopAndSend)
        val callStartedAtMillis = System.currentTimeMillis()
        val historyEntryId = UUID.randomUUID().toString()

        viewModelScope.launch {
            callHistoryRepository.createPendingCall(
                createOutgoingCallDraft(
                    entryId = historyEntryId,
                    chat = chat,
                    type = type,
                    startedAt = callStartedAtMillis
                )
            )
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
                    callHistoryRepository.attachServerCallId(historyEntryId, callId)
                    if (startResult.alreadyActive) {
                        callHistoryRepository.markCancelled(historyEntryId)
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
                        callHistoryRepository.markCancelled(callId.ifBlank { historyEntryId })
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
                    callHistoryRepository.markCancelled(historyEntryId)
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
        val callStartedAtMillis = System.currentTimeMillis()

        viewModelScope.launch {
            callHistoryRepository.createPendingCall(
                CallHistoryDraft(
                    id = prompt.callId,
                    serverCallId = prompt.callId,
                    chatId = prompt.chatId,
                    userId = prompt.chatId,
                    userName = prompt.chatName,
                    avatarUrl = mutableState.value.chats.firstOrNull { it.id == prompt.chatId }?.avatarUrl,
                    direction = CallHistoryDirection.OUTGOING,
                    callType = prompt.type.toCallHistoryType(),
                    startedAt = callStartedAtMillis,
                    isGroupCall = true
                )
            )
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
                callHistoryRepository.markCancelled(prompt.callId)
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
                CallNotificationManager.cancelIncomingNotification(applicationContext, callId)
            }

            when (command.action) {
                NotificationIntents.ACTION_OPEN_CALL -> {
                    ensureIncomingCallFromNotification(command)
                }

                NotificationIntents.ACTION_ACCEPT_CALL -> {
                    ensureIncomingCallFromNotification(command)
                    IncomingCallService.acknowledgeIncomingCall(applicationContext, command)
                    acceptIncomingCall(fromNotification = true)
                }

                NotificationIntents.ACTION_DECLINE_CALL -> {
                    ensureIncomingCallFromNotification(command)
                    declineIncomingCall()
                }
            }
        }
    }

    fun acceptIncomingCall(fromNotification: Boolean = false) {
        val incoming = mutableState.value.incomingCall ?: return
        if (mutableState.value.isCallActionInProgress) return
        requestRecordingPreempt(RecordingCommand.StopAndSend)
        val callStartedAtMillis = System.currentTimeMillis()

        viewModelScope.launch {
            callHistoryRepository.createPendingCall(
                incoming.toIncomingCallDraft(
                    startedAt = incomingCallStartedAt(incoming)
                )
            )
            val hasMicrophonePermission = hasRuntimePermission(Manifest.permission.RECORD_AUDIO)
            val hasCameraPermission = incoming.type != "video" || hasRuntimePermission(Manifest.permission.CAMERA)
            if (!hasMicrophonePermission || !hasCameraPermission) {
                mutableState.update {
                    it.copy(
                        isCallActionInProgress = false,
                        callErrorMessage = if (fromNotification) {
                            "РќСѓР¶РЅС‹ СЂР°Р·СЂРµС€РµРЅРёСЏ РЅР° РјРёРєСЂРѕС„РѕРЅ Рё РєР°РјРµСЂСѓ РґР»СЏ РїСЂРёРЅСЏС‚РёСЏ Р·РІРѕРЅРєР°"
                        } else {
                            "Нужны разрешения на микрофон и камеру для звонка"
                        }
                    )
                }
                return@launch
            }

            mutableState.update {
                it.copy(
                    isCallActionInProgress = true,
                    callErrorMessage = null,
                    existingGroupCallPrompt = null
                )
            }
            ensureRealtimeWarmup()
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
                            phase = ActiveCallPhase.Connecting,
                            startedAtMillis = callStartedAtMillis
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
                            phase = ActiveCallPhase.Connecting,
                            startedAtMillis = callStartedAtMillis
                        )
                    )
                }
                retrySocketOnce {
                    acceptCallUseCase(callId = incoming.callId)
                }
            }

            result.onSuccess {
                CallNotificationManager.dismissIncomingCall(applicationContext, incoming.callId)
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
                            phase = if (incoming.isGroup) ActiveCallPhase.Active else ActiveCallPhase.Connecting,
                            startedAtMillis = callStartedAtMillis
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
            ensureRealtimeWarmup()
            if (!incoming.isGroup) {
                retrySocketOnce {
                    declineCallUseCase(callId = incoming.callId)
                }
            }
            callHistoryRepository.markDeclined(incoming.callId)
            CallNotificationManager.dismissIncomingCall(applicationContext, incoming.callId)
            mutableState.update { it.copy(incomingCall = null, isCallActionInProgress = false) }
        }
    }

    private fun hasRuntimePermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(applicationContext, permission) == PackageManager.PERMISSION_GRANTED
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
                callHistoryRepository.markEnded(
                    callReference = activeCall.callId,
                    fallbackStatus = CallHistoryStatus.CANCELLED
                )
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
                    it.copy(callErrorMessage = error.message ?: "РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРєР»СЋС‡РёС‚СЊ РјРёРєСЂРѕС„РѕРЅ")
                }
            }
            showCallControlsTemporarily()
        }
    }

    fun toggleSpeakerphone() {
        if (mutableState.value.activeCall == null) return
        viewModelScope.launch {
            callManager.toggleSpeakerphone().onFailure { error ->
                mutableState.update {
                    it.copy(callErrorMessage = error.message ?: "Не удалось переключить громкую связь")
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
                    it.copy(callErrorMessage = error.message ?: "РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРєР»СЋС‡РёС‚СЊ РєР°РјРµСЂСѓ")
                }
            }
            showCallControlsTemporarily()
        }
    }

    fun switchCamera() {
        if (mutableState.value.activeCall == null) return
        viewModelScope.launch {
            callManager.switchCamera().onFailure { error ->
                mutableState.update { it.copy(callErrorMessage = error.message ?: "Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В Р’В°Р В РЎВР В Р’ВµР РЋР вЂљР РЋРЎвЂњ") }
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
                    refreshChats()
                    val selectedChatId = mutableState.value.selectedChatId
                    if (!selectedChatId.isNullOrBlank()) {
                        viewModelScope.launch {
                            chatRepository.joinChat(selectedChatId)
                            loadMessages(selectedChatId)
                        }
                    }
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

                is RealtimeEvent.MessageUpdated -> {
                    applyMessageMutation(normalizeDeliveryStatus(event.message))
                }

                is RealtimeEvent.UserStatusChanged -> {
                    applyUserStatusChange(event)
                }

                is RealtimeEvent.IncomingCall -> {
                    if (mutableState.value.activeCall != null) {
                        return@collect
                    }
                    requestRecordingPreempt(RecordingCommand.StopAndSend)
                    val currentUserId = mutableState.value.currentUserId
                    if (event.initiatorId.isNotBlank() && event.initiatorId == currentUserId) {
                        return@collect
                    }
                    if (CallNotificationManager.isIncomingCallStillPending(applicationContext, event.callId)) {
                        return@collect
                    }
                    val command = NotificationIntents.incomingCallCommand(
                        callId = event.callId,
                        chatId = event.chatId,
                        chatName = event.chatName.ifBlank {
                            mutableState.value.chats.firstOrNull { it.id == event.chatId }?.title ?: "GovChat"
                        },
                        callType = event.type.ifBlank { "audio" },
                        isGroupCall = event.isGroup,
                        initiatorId = event.initiatorId,
                        initiatorName = event.initiatorName.ifBlank { "Контакт" },
                        initiatorAvatarUrl = event.initiatorAvatarUrl,
                        participantCount = event.participantCount
                    )
                    val showNotification = !ProcessLifecycleOwner.get().lifecycle.currentState
                        .isAtLeast(Lifecycle.State.STARTED)
                    IncomingCallService.showIncomingCall(
                        context = applicationContext,
                        command = command,
                        showNotification = showNotification
                    )
                    if (mutableState.value.selectedChatId != event.chatId) {
                        selectChat(event.chatId)
                    }
                }

                is RealtimeEvent.MessagesRead -> {
                    applyMessagesRead(event.chatId, event.userId, event.messageIds)
                }

                is RealtimeEvent.TypingUpdated -> {
                    updateTyping(event)
                }

                is RealtimeEvent.ChatCreated -> {
                    upsertChatOnTop(event.chat)
                }

                is RealtimeEvent.ChatDeleted -> {
                    messagesCache.remove(event.chatId)
                    pagingByChat.remove(event.chatId)
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
                    if (event.scope == "for_me") {
                        removeMessageFromCache(event.chatId, event.messageId)
                        mutableState.update { current ->
                            if (current.selectedChatId != event.chatId) return@update current
                            current.copy(messages = current.messages.filterNot { it.id == event.messageId })
                        }
                    } else {
                        event.message?.let { message ->
                            applyMessageMutation(normalizeDeliveryStatus(message))
                        } ?: refreshChatMessages(event.chatId)
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
                    callHistoryRepository.markEnded(
                        callReference = event.callId,
                        fallbackStatus = resolveTerminalStatus(reason = "completed", callId = event.callId)
                    )
                    IncomingCallService.cancelIncomingCall(applicationContext, event.callId)
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

                is RealtimeEvent.CallEnded -> {
                    callHistoryRepository.markEnded(
                        callReference = event.callId,
                        fallbackStatus = resolveTerminalStatus(reason = event.reason, callId = event.callId)
                    )
                    IncomingCallService.cancelIncomingCall(applicationContext, event.callId)
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
                    callHistoryRepository.markEnded(
                        callReference = event.callId,
                        fallbackStatus = resolveTerminalStatus(reason = event.reason, callId = event.callId)
                    )
                    IncomingCallService.cancelIncomingCall(applicationContext, event.callId)
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
                    phase = ActiveCallPhase.Active,
                    startedAtMillis = System.currentTimeMillis()
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
                        it.copy(errorMessage = error.message ?: "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ РЎвЂЎР В°РЎвЂљ")
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
                        it.copy(errorMessage = error.message ?: "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р С–РЎР‚РЎС“Р С—Р С—РЎС“")
                    }
                }
        }
    }

    fun resetUserSearch() {
        searchJob?.cancel()
        mutableState.update { it.copy(userSearchStatus = UserSearchStatus.Idle, searchedUser = null) }
    }

    fun openChatFromCallHistory(callHistoryId: String) {
        val historyEntry = mutableState.value.callHistory.firstOrNull { it.id == callHistoryId } ?: return
        viewModelScope.launch {
            val existingChat = historyEntry.chatId
                ?.let { targetId -> mutableState.value.chats.firstOrNull { it.id == targetId } }
                ?: mutableState.value.chats.firstOrNull {
                    !historyEntry.isGroupCall && it.peerUserId == historyEntry.userId
                }

            if (existingChat != null) {
                selectChat(existingChat.id)
                return@launch
            }

            if (!historyEntry.isGroupCall && historyEntry.userId.isNotBlank()) {
                createChatUseCase(historyEntry.userId)
                    .onSuccess { chat ->
                        upsertChatOnTop(chat)
                        selectChat(chat.id)
                    }
                    .onFailure { error ->
                        mutableState.update {
                            it.copy(errorMessage = error.message ?: "Не удалось открыть чат")
                        }
                    }
            }
        }
    }

    fun deleteCallHistoryEntries(ids: List<String>) {
        val uniqueIds = ids.filter { it.isNotBlank() }.distinct()
        if (uniqueIds.isEmpty()) return
        viewModelScope.launch {
            uniqueIds.forEach { id ->
                callHistoryRepository.deleteCall(id)
            }
        }
    }

    fun clearCallHistory() {
        viewModelScope.launch {
            callHistoryRepository.clearHistory()
        }
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
                    initiatorName = command.initiatorName.orEmpty().ifBlank { "Контакт" },
                    participantCount = command.participantCount
                ),
                callErrorMessage = null,
                existingGroupCallPrompt = null
            )
        }
    }

    private fun syncIncomingCallFromManager(command: NotificationCommand?) {
        if (command == null) {
            mutableState.update { current ->
                if (current.incomingCall == null) current else current.copy(incomingCall = null)
            }
            return
        }
        ensureIncomingCallFromNotification(command)
    }

    private fun appendSyntheticCallMessage(command: NotificationCommand) {
        val chatId = command.chatId.orEmpty()
        val callId = command.callId.orEmpty()
        if (chatId.isBlank() || callId.isBlank()) return

        val message = ChatMessage(
            id = "missed-call:$callId",
            chatId = chatId,
            senderId = "system",
            senderName = "GovChat",
            type = MessageType.System,
            text = CallNotificationManager.buildMissedCallMessageText(applicationContext, command),
            attachment = null,
            readByUserIds = mutableState.value.currentUserId?.let(::setOf).orEmpty(),
            createdAtMillis = System.currentTimeMillis(),
            deliveryStatus = MessageDeliveryStatus.Delivered
        )
        appendMessage(message)
        updateChatWithMessage(chatId, message)
    }

    private fun createOutgoingCallDraft(
        entryId: String,
        chat: ru.govchat.app.domain.model.ChatPreview,
        type: String,
        startedAt: Long
    ): CallHistoryDraft {
        val userId = when {
            chat.type == ChatType.PRIVATE && !chat.peerUserId.isNullOrBlank() -> chat.peerUserId
            else -> chat.id
        }.orEmpty()
        return CallHistoryDraft(
            id = entryId,
            chatId = chat.id,
            userId = userId,
            userName = chat.title,
            avatarUrl = chat.avatarUrl,
            direction = CallHistoryDirection.OUTGOING,
            callType = type.toCallHistoryType(),
            startedAt = startedAt,
            isGroupCall = chat.type == ChatType.GROUP
        )
    }

    private fun IncomingCallUi.toIncomingCallDraft(startedAt: Long): CallHistoryDraft {
        return CallHistoryDraft(
            id = callId,
            serverCallId = callId,
            chatId = chatId,
            userId = if (isGroup) chatId else initiatorId.ifBlank { chatId },
            userName = if (isGroup) chatName else initiatorName.ifBlank { chatName },
            avatarUrl = mutableState.value.chats.firstOrNull { it.id == chatId }?.avatarUrl,
            direction = CallHistoryDirection.INCOMING,
            callType = type.toCallHistoryType(),
            startedAt = startedAt,
            isGroupCall = isGroup
        )
    }

    private fun incomingCallStartedAt(incoming: IncomingCallUi): Long {
        return mutableState.value.callHistory.firstOrNull {
            it.serverCallId == incoming.callId || it.id == incoming.callId
        }?.startedAt ?: System.currentTimeMillis()
    }

    private fun resolveTerminalStatus(reason: String, callId: String): CallHistoryStatus {
        val normalized = reason.lowercase()
        val currentActive = mutableState.value.activeCall?.takeIf { it.callId == callId }
        if (currentActive != null && currentActive.phase == ActiveCallPhase.Active) {
            return CallHistoryStatus.ANSWERED
        }
        return when {
            normalized.contains("declin") -> CallHistoryStatus.DECLINED
            normalized.contains("miss") -> CallHistoryStatus.MISSED
            else -> CallHistoryStatus.CANCELLED
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

    fun loadOlderMessages() {
        val current = mutableState.value
        val chatId = current.selectedChatId ?: return
        if (current.isLoadingMessages || current.isLoadingOlderMessages) return

        val pagingState = pagingByChat[chatId]
        if (pagingState != null && !pagingState.hasMore) return

        val beforeMillis = pagingState?.oldestLoadedMillis
            ?: messagesForChat(chatId).firstOrNull()?.createdAtMillis
            ?: return

        viewModelScope.launch {
            mutableState.update { it.copy(isLoadingOlderMessages = true, errorMessage = null) }
            loadMessagesUseCase(
                chatId = chatId,
                beforeMillis = beforeMillis,
                limit = MESSAGES_PAGE_SIZE
            ).onSuccess { loaded ->
                val normalized = loaded
                    .map { normalizeDeliveryStatus(it) }
                    .sortedBy { it.createdAtMillis }
                val merged = mergeMessages(
                    base = messagesForChat(chatId),
                    incoming = normalized
                )
                val hasMore = loaded.size >= MESSAGES_PAGE_SIZE
                pagingByChat[chatId] = ChatPagingState(
                    oldestLoadedMillis = merged.firstOrNull()?.createdAtMillis,
                    hasMore = hasMore
                )
                updateMessagesCache(chatId, merged)

                if (mutableState.value.selectedChatId == chatId) {
                    mutableState.update {
                        it.copy(
                            messages = merged,
                            isLoadingOlderMessages = false,
                            hasOlderMessages = hasMore
                        )
                    }
                }
            }.onFailure { error ->
                mutableState.update {
                    it.copy(
                        isLoadingOlderMessages = false,
                        errorMessage = error.message ?: "Не удалось загрузить предыдущие сообщения"
                    )
                }
            }
        }
    }

    private suspend fun loadMessages(chatId: String) {
        if (mutableState.value.selectedChatId == chatId && mutableState.value.messages.isEmpty()) {
            mutableState.update {
                it.copy(
                    isLoadingMessages = true,
                    isLoadingOlderMessages = false,
                    errorMessage = null
                )
            }
        } else {
            mutableState.update { it.copy(errorMessage = null) }
        }

        loadMessagesUseCase(
            chatId = chatId,
            beforeMillis = null,
            limit = MESSAGES_PAGE_SIZE
        ).onSuccess { loaded ->
            val normalized = loaded
                .map { normalizeDeliveryStatus(it) }
                .sortedBy { it.createdAtMillis }
            val merged = mergeMessages(
                base = messagesForChat(chatId),
                incoming = normalized
            )
            val hasMore = loaded.size >= MESSAGES_PAGE_SIZE
            pagingByChat[chatId] = ChatPagingState(
                oldestLoadedMillis = merged.firstOrNull()?.createdAtMillis,
                hasMore = hasMore
            )
            updateMessagesCache(chatId, merged)

            if (mutableState.value.selectedChatId == chatId) {
                mutableState.update {
                    it.copy(
                        isLoadingMessages = false,
                        isLoadingOlderMessages = false,
                        hasOlderMessages = hasMore,
                        messages = merged
                    )
                }
            }
            maybeMarkMessagesRead(chatId, normalized)
        }.onFailure { error ->
            mutableState.update {
                it.copy(
                    isLoadingMessages = false,
                    isLoadingOlderMessages = false,
                    errorMessage = error.message ?: "Не удалось загрузить сообщения"
                )
            }
        }
    }

    private suspend fun showDiskCacheIfAvailable(chatId: String) {
        val diskCached = messagesDiskCache.readMessages(chatId)
            .map { normalizeDeliveryStatus(it) }
            .sortedBy { it.createdAtMillis }
        if (diskCached.isEmpty()) return

        val merged = mergeMessages(
            base = messagesForChat(chatId),
            incoming = diskCached
        )
        updateMessagesCache(chatId, merged)
        pagingByChat[chatId] = ChatPagingState(
            oldestLoadedMillis = merged.firstOrNull()?.createdAtMillis,
            hasMore = merged.size >= MESSAGES_PAGE_SIZE
        )

        if (mutableState.value.selectedChatId == chatId) {
            mutableState.update {
                it.copy(
                    messages = merged,
                    isLoadingMessages = false,
                    hasOlderMessages = merged.size >= MESSAGES_PAGE_SIZE
                )
            }
            maybeMarkMessagesRead(chatId, merged)
        }
    }

    private fun appendMessage(message: ChatMessage) {
        val chatId = message.chatId
        val merged = mergeMessages(
            base = messagesForChat(chatId),
            incoming = listOf(message)
        )
        updateMessagesCache(chatId, merged)
        pagingByChat[chatId] = pagingByChat[chatId]?.copy(
            oldestLoadedMillis = merged.firstOrNull()?.createdAtMillis
        ) ?: ChatPagingState(
            oldestLoadedMillis = merged.firstOrNull()?.createdAtMillis,
            hasMore = merged.size >= MESSAGES_PAGE_SIZE
        )

        mutableState.update { current ->
            if (current.selectedChatId != chatId) return@update current
            current.copy(messages = merged)
        }
    }

    private fun applyMessageMutation(message: ChatMessage) {
        val chatId = message.chatId
        val existing = messagesForChat(chatId)
        val currentMessage = existing.firstOrNull { it.id == message.id }
        if (currentMessage == null) {
            updateChatWithMessage(chatId, message, moveToTop = false)
            return
        }
        if (!shouldReplaceMessage(currentMessage, message)) {
            return
        }

        val updated = existing.map { current ->
            if (current.id == message.id) message else current
        }
        updateMessagesCache(chatId, updated)
        if (mutableState.value.selectedChatId == chatId) {
            mutableState.update { it.copy(messages = updated) }
        }
        updateChatWithMessage(chatId, message, moveToTop = false)
    }

    private fun removeMessage(messageId: String) {
        val chatId = mutableState.value.selectedChatId ?: return
        removeMessageFromCache(chatId = chatId, messageId = messageId)
        mutableState.update { current ->
            if (current.selectedChatId != chatId) return@update current
            current.copy(messages = current.messages.filterNot { it.id == messageId })
        }
    }

    private fun updateChatWithMessage(chatId: String, message: ChatMessage, moveToTop: Boolean = true) {
        mutableState.update { current ->
            val index = current.chats.indexOfFirst { it.id == chatId }
            if (index < 0) return@update current

            val source = current.chats[index]
            val shouldRefreshSubtitle = moveToTop || message.createdAtMillis >= source.updatedAtMillis
            if (!shouldRefreshSubtitle && current.selectedChatId != chatId) {
                return@update current
            }
            val shouldIncreaseUnread = current.selectedChatId != chatId &&
                message.senderId != current.currentUserId
            val updated = source.copy(
                subtitle = if (shouldRefreshSubtitle) message.toChatSubtitle() else source.subtitle,
                updatedAtMillis = if (shouldRefreshSubtitle) message.createdAtMillis else source.updatedAtMillis,
                unreadCount = if (shouldIncreaseUnread) source.unreadCount + 1 else source.unreadCount
            )

            val reordered = current.chats.toMutableList()
            reordered[index] = updated
            if (moveToTop && index > 0) {
                reordered.removeAt(index)
                reordered.add(0, updated)
            }

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

    private fun applyMessagesRead(chatId: String, userId: String, messageIds: List<String>) {
        if (messageIds.isEmpty()) return
        val source = messagesForChat(chatId)
        if (source.isEmpty()) return
        val currentUserId = mutableState.value.currentUserId.orEmpty()
        val updated = source.map { message ->
            if (message.id !in messageIds) return@map message
            val nextReadBy = message.readByUserIds + userId
            val nextStatus = if (message.senderId == currentUserId && userId != currentUserId) {
                MessageDeliveryStatus.Read
            } else {
                message.deliveryStatus
            }
            message.copy(readByUserIds = nextReadBy, deliveryStatus = nextStatus)
        }
        updateMessagesCache(chatId, updated)
        if (mutableState.value.selectedChatId == chatId) {
            mutableState.update { it.copy(messages = updated) }
        }
    }

    private fun maybeMarkMessagesRead(chatId: String, messages: List<ChatMessage>) {
        val currentUserId = mutableState.value.currentUserId ?: return
        val unreadIncomingIds = messages
            .filter { !it.deleted && it.senderId != currentUserId && !it.readByUserIds.contains(currentUserId) }
            .map { it.id }
            .distinct()

        if (unreadIncomingIds.isEmpty()) return

        viewModelScope.launch {
            chatRepository.markMessagesRead(chatId = chatId, messageIds = unreadIncomingIds)
            val updated = messagesForChat(chatId).map { message ->
                if (message.id !in unreadIncomingIds) {
                    message
                } else {
                    message.copy(readByUserIds = message.readByUserIds + currentUserId)
                }
            }
            updateMessagesCache(chatId, updated)
            if (mutableState.value.selectedChatId == chatId) {
                mutableState.update { it.copy(messages = updated) }
            }
        }
    }

    private fun applyUserStatusChange(event: RealtimeEvent.UserStatusChanged) {
        if (event.userId.isBlank()) return
        val isOnline = event.status.equals("online", ignoreCase = true)
        mutableState.update { current ->
            var hasUpdates = false
            val chats = current.chats.map { chat ->
                if (chat.peerUserId == event.userId && chat.isOnline != isOnline) {
                    hasUpdates = true
                    chat.copy(isOnline = isOnline)
                } else {
                    chat
                }
            }
            if (!hasUpdates) current else current.copy(chats = chats)
        }
    }

    private fun messagesForChat(chatId: String): List<ChatMessage> {
        return messagesCache[chatId]
            ?: if (mutableState.value.selectedChatId == chatId) mutableState.value.messages else emptyList()
    }

    private fun findMessageById(messageId: String): ChatMessage? {
        if (messageId.isBlank()) return null
        mutableState.value.messages.firstOrNull { it.id == messageId }?.let { return it }
        return messagesCache.values.asSequence()
            .flatten()
            .firstOrNull { it.id == messageId }
    }

    private fun messageMutationTimestamp(message: ChatMessage?): Long? {
        if (message == null) return null
        return listOf(
            message.updatedAtMillis,
            message.editedAtMillis,
            message.createdAtMillis.takeIf { it > 0L }
        ).firstOrNull { it != null && it > 0L }
    }

    private fun shouldReplaceMessage(current: ChatMessage?, incoming: ChatMessage): Boolean {
        if (current == null) return true

        if (incoming.revision != current.revision) {
            return incoming.revision > current.revision
        }

        val currentTimestamp = messageMutationTimestamp(current) ?: 0L
        val incomingTimestamp = messageMutationTimestamp(incoming) ?: 0L
        if (incomingTimestamp != currentTimestamp) {
            return incomingTimestamp >= currentTimestamp
        }

        if (incoming.deleted != current.deleted) {
            return incoming.deleted
        }

        if (incoming.edited != current.edited) {
            return incoming.edited
        }

        return incoming.createdAtMillis >= current.createdAtMillis
    }

    private fun buildOptimisticEditedMessage(message: ChatMessage, text: String): ChatMessage {
        val now = System.currentTimeMillis()
        return message.copy(
            text = text,
            edited = true,
            editedAtMillis = now,
            updatedAtMillis = now,
            revision = message.revision + 1
        )
    }

    private fun buildOptimisticDeletedMessage(message: ChatMessage): ChatMessage {
        val now = System.currentTimeMillis()
        return message.copy(
            text = "",
            attachment = null,
            edited = false,
            editedAtMillis = null,
            deleted = true,
            deletedForUserIds = emptySet(),
            updatedAtMillis = now,
            revision = message.revision + 1
        )
    }

    private fun refreshChatMessages(chatId: String?) {
        if (chatId.isNullOrBlank()) return
        viewModelScope.launch {
            chatRepository.joinChat(chatId)
            loadMessages(chatId)
        }
    }

    private fun mergeMessages(base: List<ChatMessage>, incoming: List<ChatMessage>): List<ChatMessage> {
        val byId = LinkedHashMap<String, ChatMessage>(base.size + incoming.size)
        base.forEach { byId[it.id] = it }
        incoming.forEach { message ->
            val current = byId[message.id]
            if (shouldReplaceMessage(current, message)) {
                byId[message.id] = message
            }
        }
        return byId.values.sortedBy { it.createdAtMillis }
    }

    private fun updateMessagesCache(chatId: String, messages: List<ChatMessage>) {
        val normalized = messages
            .distinctBy { it.id }
            .sortedBy { it.createdAtMillis }
        messagesCache[chatId] = normalized
        persistMessagesToDisk(chatId, normalized)
    }

    private fun removeMessageFromCache(chatId: String, messageId: String) {
        val updated = messagesForChat(chatId).filterNot { it.id == messageId }
        messagesCache[chatId] = updated
        pagingByChat[chatId]?.let { paging ->
            pagingByChat[chatId] = paging.copy(
                oldestLoadedMillis = updated.firstOrNull()?.createdAtMillis
            )
        }
        persistMessagesToDisk(chatId, updated)
    }

    private fun persistMessagesToDisk(chatId: String, messages: List<ChatMessage>) {
        viewModelScope.launch {
            runCatching {
                messagesDiskCache.saveMessages(
                    chatId = chatId,
                    messages = messages,
                    maxCount = DISK_CACHE_MESSAGES_LIMIT
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

    private suspend fun ensureRealtimeWarmup() {
        chatRepository.connectRealtime()
        delay(300)
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
        recordingTickerJob?.cancel()
        uploadJob?.cancel()
        cleanupScope.launch {
            runCatching { callManager.close() }
        }
        super.onCleared()
    }

    companion object {
        private const val TYPING_STOP_DELAY_MS = 2_000L
        private const val CALL_CONTROLS_AUTO_HIDE_MS = 3_500L
        private const val ICE_CONFIG_TIMEOUT_MS = 3_000L
        private const val MAX_HANDLED_NOTIFICATION_EVENTS = 128
        private const val MESSAGES_PAGE_SIZE = 30
        private const val DISK_CACHE_MESSAGES_LIMIT = 100

        fun factory(
            appContext: Context,
            loadChatsUseCase: LoadChatsUseCase,
            loadMessagesUseCase: LoadMessagesUseCase,
            editMessageUseCase: EditMessageUseCase,
            deleteMessageUseCase: DeleteMessageUseCase,
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
            messagesDiskCache: ChatMessagesCacheStorage,
            callHistoryRepository: CallHistoryRepository,
            chatRepository: ChatRepository,
            authRepository: AuthRepository
        ) = viewModelFactory {
            MainViewModel(
                appContext = appContext,
                loadChatsUseCase = loadChatsUseCase,
                loadMessagesUseCase = loadMessagesUseCase,
                editMessageUseCase = editMessageUseCase,
                deleteMessageUseCase = deleteMessageUseCase,
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
                messagesDiskCache = messagesDiskCache,
                callHistoryRepository = callHistoryRepository,
                chatRepository = chatRepository,
                authRepository = authRepository
            )
        }
    }
}

private data class ChatPagingState(
    val oldestLoadedMillis: Long?,
    val hasMore: Boolean
)

private fun RecordingMode.toAttachmentType(): AttachmentType? {
    return when (this) {
        RecordingMode.None -> null
        RecordingMode.Voice -> AttachmentType.Voice
        RecordingMode.Video -> AttachmentType.VideoNote
    }
}

private fun String.toCallHistoryType(): CallHistoryType {
    return if (equals("video", ignoreCase = true)) {
        CallHistoryType.VIDEO
    } else {
        CallHistoryType.AUDIO
    }
}

private fun ChatMessage.toChatSubtitle(): String {
    if (deleted) return "Сообщение удалено"
    return when (type) {
        MessageType.Voice -> "Голосовое сообщение"
        MessageType.VideoNote -> "Видео-кружок"
        MessageType.Audio -> "РЎР‚РЎСџР вЂ№Р’В¤ Р В РІР‚СљР В РЎвЂўР В Р’В»Р В РЎвЂўР РЋР С“Р В РЎвЂўР В Р вЂ Р В РЎвЂўР В Р’Вµ Р РЋР С“Р В РЎвЂўР В РЎвЂўР В Р’В±Р РЋРІР‚В°Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ"
        MessageType.Image -> "РЎР‚РЎСџРІР‚СљР’В· Р В Р’ВР В Р’В·Р В РЎвЂўР В Р’В±Р РЋР вЂљР В Р’В°Р В Р’В¶Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ"
        MessageType.Video -> "РЎР‚РЎСџР вЂ№РўС’ Р В РІР‚в„ўР В РЎвЂР В РўвЂР В Р’ВµР В РЎвЂў"
        MessageType.File -> "РЎР‚РЎСџРІР‚СљР вЂ№ Р В Р’В¤Р В Р’В°Р В РІвЂћвЂ“Р В Р’В»"
        MessageType.System -> text.ifBlank { "Р В Р Р‹Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В Р’ВµР В РЎВР В Р вЂ¦Р В РЎвЂўР В Р’Вµ Р РЋР С“Р В РЎвЂўР В РЎвЂўР В Р’В±Р РЋРІР‚В°Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ" }
        MessageType.Text -> text.ifBlank { "Р В Р Р‹Р В РЎвЂўР В РЎвЂўР В Р’В±Р РЋРІР‚В°Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ" }
    }
}



