package ru.govchat.app.data.repository

import android.util.Log
import retrofit2.HttpException
import ru.govchat.app.core.network.DeviceTokenRequest
import ru.govchat.app.core.network.GovChatApi
import ru.govchat.app.core.storage.SessionStorage
import ru.govchat.app.domain.repository.DeviceRepository

class DeviceRepositoryImpl(
    private val api: GovChatApi,
    private val sessionStorage: SessionStorage
) : DeviceRepository {

    override suspend fun onNewToken(token: String) {
        sessionStorage.savePendingFcmToken(token)
        syncPendingToken()
    }

    override suspend fun syncPendingToken() {
        val pendingToken = sessionStorage.getPendingFcmToken() ?: return
        val authToken = sessionStorage.currentToken() ?: sessionStorage.awaitToken()
        if (authToken.isNullOrBlank()) return

        runCatching {
            api.registerDeviceToken(
                request = DeviceTokenRequest(
                    token = pendingToken,
                    platform = "android"
                )
            )
        }.onSuccess {
            sessionStorage.clearPendingFcmToken()
        }.onFailure { error ->
            if (error is HttpException && error.code() in listOf(404, 405, 501)) {
                Log.w("DeviceRepository", "Device token endpoint is not yet available on backend")
                return
            }
            Log.e("DeviceRepository", "Device token sync failed", error)
        }
    }
}
