package ru.govchat.app.data.local.callhistory

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CallHistoryDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCall(call: CallHistoryEntity)

    @Query("SELECT * FROM call_history ORDER BY startedAt DESC")
    suspend fun getAllCalls(): List<CallHistoryEntity>

    @Query("SELECT * FROM call_history WHERE isVisibleInHistory = 1 ORDER BY startedAt DESC")
    suspend fun getCallsSortedByDate(): List<CallHistoryEntity>

    @Query("SELECT * FROM call_history WHERE isVisibleInHistory = 1 ORDER BY startedAt DESC")
    fun observeCallsSortedByDate(): Flow<List<CallHistoryEntity>>

    @Query("SELECT * FROM call_history WHERE id = :reference OR serverCallId = :reference LIMIT 1")
    suspend fun findByReference(reference: String): CallHistoryEntity?

    @Query("DELETE FROM call_history WHERE id = :id")
    suspend fun deleteCall(id: String)

    @Query("DELETE FROM call_history")
    suspend fun clearHistory()
}
