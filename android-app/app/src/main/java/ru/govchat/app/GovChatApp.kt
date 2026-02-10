package ru.govchat.app

import android.app.Application
import androidx.lifecycle.ProcessLifecycleOwner
import ru.govchat.app.core.AppContainer
import ru.govchat.app.core.lifecycle.RealtimeLifecycleObserver
import ru.govchat.app.core.notification.NotificationChannels

class GovChatApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()

        container = AppContainer(this)
        NotificationChannels.ensureCreated(this)

        ProcessLifecycleOwner.get().lifecycle.addObserver(
            RealtimeLifecycleObserver(
                chatRepository = container.chatRepository,
                deviceRepository = container.deviceRepository,
                applicationScope = container.applicationScope
            )
        )
    }
}

