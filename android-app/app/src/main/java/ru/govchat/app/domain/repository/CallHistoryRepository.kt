package ru.govchat.app.domain.repository

import kotlinx.coroutines.flow.Flow
import ru.govchat.app.domain.model.CallHistory
import ru.govchat.app.domain.model.CallHistoryDraft
import ru.govchat.app.domain.model.CallHistoryStatus

interface CallHistoryRepository {
    fun observeCallsSortedByDate(): Flow<List<CallHistory>>
    suspend fun createPendingCall(draft: CallHistoryDraft)
    suspend fun attachServerCallId(localId: String, serverCallId: String)
    suspend fun markAnswered(callReference: String, answeredAt: Long = System.currentTimeMillis())
    suspend fun markDeclined(callReference: String, endedAt: Long = System.currentTimeMillis())
    suspend fun markMissed(callReference: String, endedAt: Long = System.currentTimeMillis())
    suspend fun markCancelled(callReference: String, endedAt: Long = System.currentTimeMillis())
    suspend fun markEnded(
        callReference: String,
        endedAt: Long = System.currentTimeMillis(),
        fallbackStatus: CallHistoryStatus = CallHistoryStatus.CANCELLED
    )
    suspend fun deleteCall(id: String)
    suspend fun clearHistory()
}
