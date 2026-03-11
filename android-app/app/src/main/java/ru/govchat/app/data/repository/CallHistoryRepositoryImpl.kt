package ru.govchat.app.data.repository

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import ru.govchat.app.data.local.callhistory.CallHistoryDao
import ru.govchat.app.data.local.callhistory.CallHistoryEntity
import ru.govchat.app.domain.model.CallHistory
import ru.govchat.app.domain.model.CallHistoryDirection
import ru.govchat.app.domain.model.CallHistoryDraft
import ru.govchat.app.domain.model.CallHistoryStatus
import ru.govchat.app.domain.model.CallHistoryType
import ru.govchat.app.domain.repository.CallHistoryRepository
import kotlin.math.max

class CallHistoryRepositoryImpl(
    private val dao: CallHistoryDao
) : CallHistoryRepository {

    override fun observeCallsSortedByDate(): Flow<List<CallHistory>> {
        return dao.observeCallsSortedByDate().map { items ->
            items.map(CallHistoryEntity::toDomain)
        }
    }

    override suspend fun createPendingCall(draft: CallHistoryDraft) {
        val existing = dao.findByReference(draft.id)
            ?: draft.serverCallId?.let { dao.findByReference(it) }
        if (existing != null) return

        dao.insertCall(
            CallHistoryEntity(
                id = draft.id,
                serverCallId = draft.serverCallId,
                chatId = draft.chatId,
                userId = draft.userId,
                userName = draft.userName,
                avatarUrl = draft.avatarUrl,
                direction = draft.direction.name,
                status = defaultPendingStatus(draft.direction).name,
                callType = draft.callType.name,
                startedAt = draft.startedAt,
                answeredAt = null,
                endedAt = null,
                duration = 0L,
                isGroupCall = draft.isGroupCall,
                isVisibleInHistory = false
            )
        )
    }

    override suspend fun attachServerCallId(localId: String, serverCallId: String) {
        if (serverCallId.isBlank()) return
        val current = dao.findByReference(localId) ?: return
        if (current.serverCallId == serverCallId) return
        dao.insertCall(current.copy(serverCallId = serverCallId))
    }

    override suspend fun markAnswered(callReference: String, answeredAt: Long) {
        val current = dao.findByReference(callReference) ?: return
        val nextAnsweredAt = current.answeredAt ?: answeredAt.coerceAtLeast(current.startedAt)
        dao.insertCall(
            current.copy(
                status = CallHistoryStatus.ANSWERED.name,
                answeredAt = nextAnsweredAt,
                endedAt = current.endedAt,
                duration = current.endedAt?.let { max(0L, it - nextAnsweredAt) } ?: current.duration,
                isVisibleInHistory = true
            )
        )
    }

    override suspend fun markDeclined(callReference: String, endedAt: Long) {
        finalize(callReference, CallHistoryStatus.DECLINED, endedAt)
    }

    override suspend fun markMissed(callReference: String, endedAt: Long) {
        finalize(callReference, CallHistoryStatus.MISSED, endedAt)
    }

    override suspend fun markCancelled(callReference: String, endedAt: Long) {
        finalize(callReference, CallHistoryStatus.CANCELLED, endedAt)
    }

    override suspend fun markEnded(
        callReference: String,
        endedAt: Long,
        fallbackStatus: CallHistoryStatus
    ) {
        val current = dao.findByReference(callReference) ?: return
        val endedAtSafe = endedAt.coerceAtLeast(current.startedAt)
        val terminalStatus = if (current.answeredAt != null || current.status == CallHistoryStatus.ANSWERED.name) {
            CallHistoryStatus.ANSWERED
        } else {
            fallbackStatus
        }
        finalize(callReference, terminalStatus, endedAtSafe)
    }

    override suspend fun deleteCall(id: String) {
        dao.deleteCall(id)
    }

    override suspend fun clearHistory() {
        dao.clearHistory()
    }

    private suspend fun finalize(
        callReference: String,
        targetStatus: CallHistoryStatus,
        endedAt: Long
    ) {
        val current = dao.findByReference(callReference) ?: return
        val resolvedAnsweredAt = current.answeredAt
        val finalStatus = if (resolvedAnsweredAt != null) {
            CallHistoryStatus.ANSWERED
        } else {
            targetStatus
        }
        val duration = if (resolvedAnsweredAt != null) {
            max(0L, endedAt - resolvedAnsweredAt)
        } else {
            0L
        }
        dao.insertCall(
            current.copy(
                status = finalStatus.name,
                endedAt = endedAt.coerceAtLeast(current.startedAt),
                duration = duration,
                isVisibleInHistory = true
            )
        )
    }

    private fun defaultPendingStatus(direction: CallHistoryDirection): CallHistoryStatus {
        return when (direction) {
            CallHistoryDirection.INCOMING -> CallHistoryStatus.MISSED
            CallHistoryDirection.OUTGOING -> CallHistoryStatus.CANCELLED
        }
    }
}

private fun CallHistoryEntity.toDomain(): CallHistory {
    return CallHistory(
        id = id,
        userId = userId,
        userName = userName,
        avatarUrl = avatarUrl,
        direction = direction.toEnumOrDefault(CallHistoryDirection.INCOMING),
        status = status.toEnumOrDefault(CallHistoryStatus.CANCELLED),
        callType = callType.toEnumOrDefault(CallHistoryType.AUDIO),
        startedAt = startedAt,
        endedAt = endedAt,
        duration = duration,
        chatId = chatId,
        serverCallId = serverCallId,
        isGroupCall = isGroupCall
    )
}

private inline fun <reified T : Enum<T>> String.toEnumOrDefault(default: T): T {
    return runCatching { enumValueOf<T>(this) }.getOrDefault(default)
}
