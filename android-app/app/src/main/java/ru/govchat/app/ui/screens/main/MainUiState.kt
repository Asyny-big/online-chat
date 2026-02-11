package ru.govchat.app.ui.screens.main

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
    val isRealtimeConnected: Boolean = false,
    val isSending: Boolean = false,
    val uploadProgress: Int? = null,
    val typingUsers: List<TypingUser> = emptyList(),
    val currentUserId: String? = null,
    val incomingCall: IncomingCallUi? = null,
    val activeCall: ActiveCallUi? = null,
    val isCallActionInProgress: Boolean = false,
    val callErrorMessage: String? = null,
    val errorMessage: String? = null,
    val sessionExpired: Boolean = false,
    val userProfile: UserProfile? = null,
    val userProfileLoading: Boolean = false,
    val searchedUser: UserProfile? = null,
    val userSearchStatus: UserSearchStatus = UserSearchStatus.Idle
) {
    val selectedChat: ChatPreview?
        get() = chats.firstOrNull { it.id == selectedChatId }
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
    val phase: ActiveCallPhase
)

enum class ActiveCallPhase {
    Outgoing,
    Connecting,
    Active
}
