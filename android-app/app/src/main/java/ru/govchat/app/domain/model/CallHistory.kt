package ru.govchat.app.domain.model

data class CallHistory(
    val id: String,
    val userId: String,
    val userName: String,
    val avatarUrl: String?,
    val direction: CallHistoryDirection,
    val status: CallHistoryStatus,
    val callType: CallHistoryType,
    val startedAt: Long,
    val endedAt: Long?,
    val duration: Long,
    val chatId: String? = null,
    val serverCallId: String? = null,
    val isGroupCall: Boolean = false
)

data class CallHistoryDraft(
    val id: String,
    val serverCallId: String? = null,
    val chatId: String? = null,
    val userId: String,
    val userName: String,
    val avatarUrl: String?,
    val direction: CallHistoryDirection,
    val callType: CallHistoryType,
    val startedAt: Long,
    val isGroupCall: Boolean = false
)

enum class CallHistoryDirection {
    INCOMING,
    OUTGOING
}

enum class CallHistoryStatus {
    MISSED,
    ANSWERED,
    DECLINED,
    CANCELLED
}

enum class CallHistoryType {
    AUDIO,
    VIDEO
}
