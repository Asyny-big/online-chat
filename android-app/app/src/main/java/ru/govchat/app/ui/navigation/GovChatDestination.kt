package ru.govchat.app.ui.navigation

sealed class GovChatDestination(val route: String) {
    data object Splash : GovChatDestination("splash")
    data object Login : GovChatDestination("login")
    data object Main : GovChatDestination("main")
}

