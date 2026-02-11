package ru.govchat.app.ui.screens.login

data class LoginUiState(
    val mode: AuthMode = AuthMode.Login,
    val phone: String = "",
    val name: String = "",
    val password: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null
)

enum class AuthMode {
    Login,
    Register
}
