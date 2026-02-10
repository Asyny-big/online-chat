package ru.govchat.app.data.repository

import kotlinx.coroutines.flow.Flow
import ru.govchat.app.core.network.GovChatApi
import ru.govchat.app.core.network.SocketGateway
import ru.govchat.app.core.storage.SessionStorage
import ru.govchat.app.data.mapper.toDomain
import ru.govchat.app.domain.model.ChatPreview
import ru.govchat.app.domain.model.RealtimeEvent
import ru.govchat.app.domain.repository.ChatRepository

class ChatRepositoryImpl(
    private val api: GovChatApi,
    private val socketGateway: SocketGateway,
    private val sessionStorage: SessionStorage
) : ChatRepository {

    override suspend fun loadDialogs(): Result<List<ChatPreview>> {
        return runCatching {
            api.getChats().map { it.toDomain() }
        }
    }

    override suspend fun connectRealtime() {
        val token = sessionStorage.awaitToken()
        if (token.isNullOrBlank()) return
        socketGateway.connect(token)
    }

    override suspend fun disconnectRealtime() {
        socketGateway.disconnect()
    }

    override fun observeRealtimeEvents(): Flow<RealtimeEvent> = socketGateway.events
}

