package ru.govchat.app.data.repository

import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.suspendCancellableCoroutine
import retrofit2.HttpException
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.network.DeviceRegisterRequest
import ru.govchat.app.core.network.GovChatApi
import ru.govchat.app.core.storage.SessionStorage
import ru.govchat.app.domain.repository.DeviceRepository
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class DeviceRepositoryImpl(
    private val api: GovChatApi,
    private val sessionStorage: SessionStorage
) : DeviceRepository {

    override suspend fun onNewToken(token: String) {
        sessionStorage.savePendingFcmToken(token)
        sessionStorage.saveCurrentFcmToken(token)
        syncPendingToken()
    }

    override suspend fun syncPendingToken() {
        val pendingToken = sessionStorage.getPendingFcmToken()
        val tokenToSync = pendingToken
            ?: sessionStorage.getCurrentFcmToken()
            ?: runCatching { fetchCurrentFirebaseToken() }.getOrNull()
            ?: return
        val authToken = sessionStorage.currentToken() ?: sessionStorage.awaitToken()
        if (authToken.isNullOrBlank()) return

        runCatching {
            api.registerDeviceToken(
                request = DeviceRegisterRequest(
                    token = tokenToSync,
                    platform = "android",
                    appVersion = BuildConfig.VERSION_NAME
                )
            )
        }.onSuccess {
            sessionStorage.saveCurrentFcmToken(tokenToSync)
            sessionStorage.clearPendingFcmToken()
        }.onFailure { error ->
            if (error is HttpException && error.code() in listOf(404, 405, 501)) {
                Log.w("DeviceRepository", "Device token endpoint is not yet available on backend")
                return
            }
            Log.e("DeviceRepository", "Device token sync failed", error)
        }
    }

    private suspend fun fetchCurrentFirebaseToken(): String = suspendCancellableCoroutine { continuation ->
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                if (!continuation.isCompleted) continuation.resume(token)
            }
            .addOnFailureListener { error ->
                if (!continuation.isCompleted) continuation.resumeWithException(error)
            }
    }
}
