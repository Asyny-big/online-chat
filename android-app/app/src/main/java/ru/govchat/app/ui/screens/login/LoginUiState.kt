package ru.govchat.app.ui.screens.login

data class LoginUiState(
    val phone: String = "",
    val password: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null
)

