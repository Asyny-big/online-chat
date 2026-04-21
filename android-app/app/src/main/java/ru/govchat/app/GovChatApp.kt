package ru.govchat.app

import android.app.Application
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
        SingBoxRunner.getInstance().initialize(this)

        // Initialize VLESS secure tunnel manager
        ru.govchat.app.tunnel.TunnelManager.getInstance(this).initialize()

        ProcessLifecycleOwner.get().lifecycle.addObserver(
            RealtimeLifecycleObserver(
                chatRepository = container.chatRepository,
                deviceRepository = container.deviceRepository,
                applicationScope = container.applicationScope
            )
        )
    }
}

