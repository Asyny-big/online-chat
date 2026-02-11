package ru.govchat.app.core.permission

enum class GovChatPermissionFeature {
    Camera,
    Microphone,
    MediaRead,
    Notifications
}

data class GovChatPermissionResult(
    val granted: Boolean,
    val permanentlyDenied: Boolean,
    val deniedPermissions: List<String>
)
