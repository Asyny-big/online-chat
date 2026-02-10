package ru.govchat.app.domain.repository

import kotlinx.coroutines.flow.Flow
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.RealtimeEvent

interface ChatRepository {
    suspend fun loadDialogs(): Result<List<ChatPreview>>
    suspend fun connectRealtime()
    suspend fun disconnectRealtime()
    fun observeRealtimeEvents(): Flow<RealtimeEvent>
}

