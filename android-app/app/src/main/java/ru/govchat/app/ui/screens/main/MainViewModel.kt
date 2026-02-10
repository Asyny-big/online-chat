package ru.govchat.app.ui.screens.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.govchat.app.core.ui.viewModelFactory
import ru.govchat.app.domain.model.RealtimeEvent
import ru.govchat.app.domain.repository.ChatRepository
import ru.govchat.app.domain.usecase.LoadChatsUseCase

class MainViewModel(
    private val loadChatsUseCase: LoadChatsUseCase,
    private val chatRepository: ChatRepository
) : ViewModel() {

    private val mutableState = MutableStateFlow(MainUiState(isLoading = true))
    val state: StateFlow<MainUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            chatRepository.connectRealtime()
            observeRealtime()
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            mutableState.update { it.copy(isLoading = true, errorMessage = null) }
            loadChatsUseCase()
                .onSuccess { dialogs ->
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            dialogs = dialogs,
                            errorMessage = null
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Unable to load chats"
                        )
                    }
                }
        }
    }

    private suspend fun observeRealtime() {
        chatRepository.observeRealtimeEvents().collect { event ->
            when (event) {
                is RealtimeEvent.SocketConnected -> {
                    mutableState.update { it.copy(isRealtimeConnected = true) }
                }

                is RealtimeEvent.SocketDisconnected -> {
                    mutableState.update { it.copy(isRealtimeConnected = false) }
                }

                is RealtimeEvent.MessageCreated -> {
                    refresh()
                }

                is RealtimeEvent.UserStatusChanged -> {
                    refresh()
                }

                is RealtimeEvent.IncomingCall -> {
                    // Call UI is handled by foreground service / dedicated call flow.
                }
            }
        }
    }

    companion object {
        fun factory(loadChatsUseCase: LoadChatsUseCase, chatRepository: ChatRepository) = viewModelFactory {
            MainViewModel(loadChatsUseCase, chatRepository)
        }
    }
}