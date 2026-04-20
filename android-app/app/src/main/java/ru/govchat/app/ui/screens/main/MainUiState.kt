package ru.govchat.app.ui.screens.main

import ru.govchat.app.domain.model.AttachmentType
import ru.govchat.app.domain.model.CallHistory
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.TypingUser
import ru.govchat.app.domain.model.UserProfile

data class MainUiState(
    val chats: List<ChatPreview> = emptyList(),
    val messages: List<ChatMessage> = emptyList(),
    val selectedChatId: String? = null,
    val isLoadingChats: Boolean = false,
    val isLoadingMessages: Boolean = false,
    val isLoadingOlderMessages: Boolean = false,
    val hasOlderMessages: Boolean = false,
    val isRealtimeConnected: Boolean = false,
    val isSending: Boolean = false,
    val typingUsers: List<TypingUser> = emptyList(),
    val currentUserId: String? = null,
    val callHistory: List<CallHistory> = emptyList(),
    val incomingCall: IncomingCallUi? = null,
    val activeCall: ActiveCallUi? = null,
    val existingGroupCallPrompt: ExistingGroupCallPromptUi? = null,
    val pendingLocationRequest: PendingLocationRequestUi? = null,
    val locationAutoReplyEnabled: Boolean = false,
    val isCallActionInProgress: Boolean = false,
    val callErrorMessage: String? = null,
    val errorMessage: String? = null,
    val sessionExpired: Boolean = false,
    val userProfile: UserProfile? = null,
    val userProfileLoading: Boolean = false,
    val searchedUser: UserProfile? = null,
    val userSearchStatus: UserSearchStatus = UserSearchStatus.Idle,
    val groupParticipants: List<UserProfile> = emptyList(),
    val isLoadingGroupParticipants: Boolean = false,
    val groupParticipantsErrorMessage: String? = null,
    val recordingMode: RecordingMode = RecordingMode.Voice,
    val recordingState: RecordingState = RecordingState.Idle,
    val failedRecordingUpload: FailedRecordingUploadUi? = null
) {
    val selectedChat: ChatPreview?
        get() = chats.firstOrNull { it.id == selectedChatId }
}

sealed interface RecordingMode {
    data object None : RecordingMode
    data object Voice : RecordingMode
    data object Video : RecordingMode
}

sealed interface RecordingState {
    data object Idle : RecordingState
    data object Recording : RecordingState
    data object Locked : RecordingState
    data object Uploading : RecordingState
}

data class FailedRecordingUploadUi(
    val chatId: String,
    val uri: String,
    val attachmentType: AttachmentType,
    val durationMs: Long,
    val errorMessage: String
)

data class RecordingSession(
    val id: Long,
    val chatId: String,
    val mode: RecordingMode
)

sealed interface RecordingCommand {
    data object StopAndSend : RecordingCommand
    data object Cancel : RecordingCommand
}

enum class UserSearchStatus {
    Idle, TooShort, Loading, Found, NotFound, Error
}

data class IncomingCallUi(
    val callId: String,
    val chatId: String,
    val chatName: String,
    val type: String,
    val isGroup: Boolean,
    val initiatorId: String,
    val initiatorName: String,
    val participantCount: Int
)

data class ActiveCallUi(
    val callId: String,
    val chatId: String,
    val chatName: String,
    val type: String,
    val isGroup: Boolean,
    val phase: ActiveCallPhase,
    val startedAtMillis: Long
)

data class ExistingGroupCallPromptUi(
    val callId: String,
    val chatId: String,
    val chatName: String,
    val type: String
)

data class PendingLocationRequestUi(
    val requestId: String,
    val chatId: String,
    val requesterUserId: String,
    val requesterName: String,
    val expiresAt: String,
    val awaitingSystemPermission: Boolean = false
)

enum class ActiveCallPhase {
    Outgoing,
    Connecting,
    Active
}
