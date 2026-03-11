package ru.govchat.app.data.local.callhistory

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "call_history",
    indices = [
        Index(value = ["serverCallId"], unique = true),
        Index(value = ["startedAt"]),
        Index(value = ["isVisibleInHistory", "startedAt"])
    ]
)
data class CallHistoryEntity(
    @PrimaryKey val id: String,
    val serverCallId: String?,
    val chatId: String?,
    val userId: String,
    val userName: String,
    val avatarUrl: String?,
    val direction: String,
    val status: String,
    val callType: String,
    val startedAt: Long,
    val answeredAt: Long?,
    val endedAt: Long?,
    val duration: Long,
    val isGroupCall: Boolean,
    val isVisibleInHistory: Boolean
)
