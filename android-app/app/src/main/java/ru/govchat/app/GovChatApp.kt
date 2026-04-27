package ru.govchat.app

import android.app.Application
import android.util.Log
import androidx.lifecycle.ProcessLifecycleOwner
import ru.govchat.app.core.AppContainer
import ru.govchat.app.core.lifecycle.RealtimeLifecycleObserver
import ru.govchat.app.core.notification.CallNotificationManager
import ru.govchat.app.core.notification.NotificationChannels
import ru.govchat.app.tunnel.core.SingBoxRunner

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
