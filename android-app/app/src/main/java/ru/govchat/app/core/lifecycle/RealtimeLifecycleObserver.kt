package ru.govchat.app.core.lifecycle

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ru.govchat.app.domain.repository.ChatRepository
import ru.govchat.app.domain.repository.DeviceRepository
import ru.govchat.app.service.call.CallForegroundService

class RealtimeLifecycleObserver(
    private val chatRepository: ChatRepository,
    private val deviceRepository: DeviceRepository,
    private val applicationScope: CoroutineScope
) : DefaultLifecycleObserver {

    private var disconnectJob: Job? = null

    override fun onStart(owner: LifecycleOwner) {
        disconnectJob?.cancel()
        applicationScope.launch {
            deviceRepository.syncPendingToken()
            chatRepository.connectRealtime()
        }
    }

    override fun onStop(owner: LifecycleOwner) {
        disconnectJob?.cancel()
        disconnectJob = applicationScope.launch {
            delay(DISCONNECT_GRACE_MS)
            if (CallForegroundService.isRunning()) {
                return@launch
            }
            chatRepository.disconnectRealtime()
        }
    }

    private companion object {
        const val DISCONNECT_GRACE_MS = 8_000L
    }
}

