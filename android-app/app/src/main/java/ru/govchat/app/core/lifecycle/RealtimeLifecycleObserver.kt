package ru.govchat.app.core.lifecycle

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import ru.govchat.app.domain.repository.ChatRepository
import ru.govchat.app.domain.repository.DeviceRepository

class RealtimeLifecycleObserver(
    private val chatRepository: ChatRepository,
    private val deviceRepository: DeviceRepository,
    private val applicationScope: CoroutineScope
) : DefaultLifecycleObserver {

    override fun onStart(owner: LifecycleOwner) {
        applicationScope.launch {
            deviceRepository.syncPendingToken()
            chatRepository.connectRealtime()
        }
    }

    override fun onStop(owner: LifecycleOwner) {
        applicationScope.launch {
            chatRepository.disconnectRealtime()
        }
    }
}

