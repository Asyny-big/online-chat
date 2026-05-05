package ru.govchat.app

import android.app.Application
import android.util.Log
import androidx.lifecycle.ProcessLifecycleOwner
import kotlinx.coroutines.launch
import ru.govchat.app.core.AppContainer
import ru.govchat.app.core.lifecycle.RealtimeLifecycleObserver
import ru.govchat.app.core.notification.CallNotificationManager
import ru.govchat.app.core.notification.NotificationChannels
import ru.govchat.app.tunnel.core.SingBoxRunner
import ru.govchat.app.tunnel.data.ServerManager

class GovChatApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()

        container = AppContainer(this)
        NotificationChannels.ensureCreated(this)
        CallNotificationManager.ensureInitialized(this)
        runCatching {
            SingBoxRunner.getInstance().initialize(this)
        }.onFailure { error ->
            Log.e(TAG, "Failed to initialize sing-box during app startup", error)
        }

        runCatching {
            ru.govchat.app.tunnel.TunnelManager.getInstance(this).initialize()
        }.onFailure { error ->
            Log.e(TAG, "Failed to initialize tunnel manager during app startup", error)
        }

        // Refresh the VLESS config cache from GitHub on every app start. We do
        // this regardless of whether a cache already exists so the user always
        // benefits from the latest server pool and dead servers get rotated out.
        // Failure here is not fatal: if the network is unavailable or all
        // GitHub mirrors are blocked, TunnelManager falls back to whatever is
        // already cached.
        container.applicationScope.launch {
            runCatching {
                Log.i(TAG, "Refreshing VLESS config cache on app start (background)")
                val serverManager = ServerManager(this@GovChatApp)
                val ok = serverManager.fetchAndCacheServers()
                Log.i(TAG, "App-start config refresh finished. success=$ok")
            }.onFailure { error ->
                Log.w(TAG, "App-start config refresh failed", error)
            }
        }

        ProcessLifecycleOwner.get().lifecycle.addObserver(
            RealtimeLifecycleObserver(
                chatRepository = container.chatRepository,
                deviceRepository = container.deviceRepository,
                applicationScope = container.applicationScope
            )
        )
    }

    private companion object {
        private const val TAG = "GovChatApp"
    }
}
