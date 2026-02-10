package ru.govchat.app.domain.repository

interface DeviceRepository {
    suspend fun onNewToken(token: String)
    suspend fun syncPendingToken()
}

