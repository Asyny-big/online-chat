package ru.govchat.app.ui.screens.login

sealed interface LoginEffect {
    data object NavigateMain : LoginEffect
}

