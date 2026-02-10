package ru.govchat.app.ui.screens.main

import ru.govchat.app.domain.model.ChatPreview

data class MainUiState(
    val dialogs: List<ChatPreview> = emptyList(),
    val isLoading: Boolean = false,
    val isRealtimeConnected: Boolean = false,
    val errorMessage: String? = null
)

