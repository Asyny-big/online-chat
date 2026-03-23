package ru.govchat.app.core.call

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.Surface
import android.view.WindowManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import ru.govchat.app.domain.model.CallControlSessionSummary
import ru.govchat.app.domain.model.CallSignalPayload

class RemoteControlManager(
    private val appContext: Context
) {
    private val mutableState = MutableStateFlow(RemoteControlUiState())
    val state: StateFlow<RemoteControlUiState> = mutableState.asStateFlow()

    private var pendingPointer: PointerStroke? = null

    fun refreshAvailability(isScreenSharing: Boolean, allowRequests: Boolean = isScreenSharing) {
        val metrics = readScreenMetrics()
        val accessibilityEnabled = isAccessibilityEnabled()
        mutableState.update { current ->
            current.copy(
                enabled = isScreenSharing,
                accessibilityEnabled = accessibilityEnabled,
                canRequest = isScreenSharing && allowRequests,
                screenWidth = metrics.width,
                screenHeight = metrics.height,
                rotation = metrics.rotation,
                statusMessage = current.statusMessage
            )
        }
    }

    fun buildControlStateSignal(): CallSignalPayload.ControlState {
        val current = mutableState.value
        return CallSignalPayload.ControlState(
            enabled = current.enabled,
            accessibilityEnabled = current.accessibilityEnabled,
            canRequest = current.canRequest,
            sessionId = current.sessionId,
            screenWidth = current.screenWidth,
            screenHeight = current.screenHeight,
            rotation = current.rotation
        )
    }

    fun syncSession(summary: CallControlSessionSummary?, currentUserId: String?) {
        val currentUser = currentUserId.orEmpty()
        if (summary == null) {
            mutableState.update { current ->
                current.copy(
                    sessionId = null,
                    controllerUserId = null,
                    targetUserId = null,
                    isActive = false,
                    isViewOnly = false,
                    pendingRequest = null,
                    expiresAtMillis = null
                )
            }
            return
        }

        val isTarget = currentUser.isNotBlank() && currentUser == summary.targetUserId
        mutableState.update { current ->
            current.copy(
                sessionId = summary.sessionId,
                controllerUserId = summary.controllerUserId,
                targetUserId = summary.targetUserId,
                isActive = summary.state == "granted" && isTarget,
                isViewOnly = summary.viewOnly,
                pendingRequest = if (summary.state == "requested" && isTarget) {
                    RemoteControlRequestUi(
                        sessionId = summary.sessionId,
                        requestedByUserId = summary.controllerUserId
                    )
                } else {
                    null
                },
                expiresAtMillis = summary.expiresAt?.let { runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() }
            )
        }
    }

    fun handleIncomingSignal(fromUserId: String, signal: CallSignalPayload) {
        when (signal) {
            is CallSignalPayload.ControlState -> {
                mutableState.update { current ->
                    current.copy(
                        enabled = signal.enabled,
                        accessibilityEnabled = signal.accessibilityEnabled,
                        canRequest = signal.canRequest,
                        sessionId = signal.sessionId ?: current.sessionId,
                        screenWidth = signal.screenWidth.coerceAtLeast(0),
                        screenHeight = signal.screenHeight.coerceAtLeast(0),
                        rotation = signal.rotation
                    )
                }
            }

            is CallSignalPayload.ControlRequest -> {
                mutableState.update { current ->
                    current.copy(
                        pendingRequest = RemoteControlRequestUi(
                            sessionId = signal.sessionId,
                            requestedByUserId = if (signal.requestedBy.isNotBlank()) signal.requestedBy else fromUserId
                        ),
                        sessionId = signal.sessionId,
                        controllerUserId = if (signal.requestedBy.isNotBlank()) signal.requestedBy else fromUserId,
                        targetUserId = current.targetUserId,
                        isActive = false,
                        isViewOnly = false,
                        expiresAtMillis = null
                    )
                }
            }

            is CallSignalPayload.ControlGrant -> {
                mutableState.update { current ->
                    current.copy(
                        sessionId = signal.sessionId,
                        isActive = !signal.viewOnly,
                        isViewOnly = signal.viewOnly,
                        pendingRequest = null,
                        expiresAtMillis = runCatching {
                            java.time.Instant.parse(signal.expiresAt).toEpochMilli()
                        }.getOrNull()
                    )
                }
            }

            is CallSignalPayload.ControlDeny,
            is CallSignalPayload.ControlStop -> clearSession()

            is CallSignalPayload.ControlHeartbeat -> Unit
            else -> Unit
        }
    }

    fun buildGrantSignal(): CallSignalPayload.ControlGrant? {
        val current = mutableState.value
        val request = current.pendingRequest ?: return null
        val viewOnly = !current.accessibilityEnabled
        mutableState.update {
            it.copy(
                sessionId = request.sessionId,
                controllerUserId = request.requestedByUserId,
                isActive = !viewOnly,
                isViewOnly = viewOnly,
                pendingRequest = null,
                expiresAtMillis = System.currentTimeMillis() + SESSION_TTL_MS
            )
        }
        return CallSignalPayload.ControlGrant(
            sessionId = request.sessionId,
            expiresAt = java.time.Instant.ofEpochMilli(System.currentTimeMillis() + SESSION_TTL_MS).toString(),
            viewOnly = viewOnly
        )
    }

    fun buildDenySignal(reason: String = "denied"): CallSignalPayload.ControlDeny? {
        val request = mutableState.value.pendingRequest ?: return null
        clearSession()
        return CallSignalPayload.ControlDeny(
            sessionId = request.sessionId,
            reason = reason
        )
    }

    fun buildStopSignal(reason: String = "stopped"): CallSignalPayload.ControlStop? {
        val sessionId = mutableState.value.sessionId ?: return null
        clearSession()
        return CallSignalPayload.ControlStop(sessionId = sessionId, reason = reason)
    }

    fun clearSession() {
        pendingPointer = null
        mutableState.update { current ->
            current.copy(
                sessionId = null,
                controllerUserId = null,
                targetUserId = null,
                isActive = false,
                isViewOnly = false,
                pendingRequest = null,
                expiresAtMillis = null
            )
        }
    }

    fun execute(command: RemoteControlCommand) {
        if (!canExecuteRemoteInput()) {
            if (command is RemoteControlCommand.ScreenInfo) {
                updateScreenInfo(command)
            }
            if (command is RemoteControlCommand.Stop) {
                clearSession()
            }
            return
        }

        when (command) {
            is RemoteControlCommand.ScreenInfo -> updateScreenInfo(command)
            is RemoteControlCommand.PointerDown -> {
                pendingPointer = PointerStroke(
                    startX = command.x,
                    startY = command.y,
                    lastX = command.x,
                    lastY = command.y,
                    startedAtMs = System.currentTimeMillis()
                )
            }
            is RemoteControlCommand.PointerMove -> {
                pendingPointer = pendingPointer?.copy(lastX = command.x, lastY = command.y)
            }
            is RemoteControlCommand.PointerUp -> executePointerStroke(command)
            is RemoteControlCommand.Tap -> {
                val point = denormalize(command.x, command.y)
                RemoteControlAccessibilityService.performTap(point.first, point.second)
            }
            is RemoteControlCommand.Swipe -> {
                val start = denormalize(command.startX, command.startY)
                val end = denormalize(command.endX, command.endY)
                RemoteControlAccessibilityService.performSwipe(
                    start.first,
                    start.second,
                    end.first,
                    end.second,
                    command.durationMs.toLong().coerceAtLeast(120L)
                )
            }
            is RemoteControlCommand.Text -> {
                RemoteControlAccessibilityService.inputText(command.value)
            }
            is RemoteControlCommand.GlobalAction -> {
                val action = when (command.action) {
                    RemoteControlProtocol.GLOBAL_ACTION_BACK -> AccessibilityService.GLOBAL_ACTION_BACK
                    RemoteControlProtocol.GLOBAL_ACTION_HOME -> AccessibilityService.GLOBAL_ACTION_HOME
                    RemoteControlProtocol.GLOBAL_ACTION_RECENTS -> AccessibilityService.GLOBAL_ACTION_RECENTS
                    else -> null
                }
                if (action != null) {
                    RemoteControlAccessibilityService.performGlobalActionCompat(action)
                }
            }
            is RemoteControlCommand.Heartbeat -> Unit
            is RemoteControlCommand.Stop -> clearSession()
        }
    }

    private fun executePointerStroke(command: RemoteControlCommand.PointerUp) {
        val stroke = pendingPointer
        pendingPointer = null
        if (stroke == null) {
            val point = denormalize(command.x, command.y)
            RemoteControlAccessibilityService.performTap(point.first, point.second)
            return
        }

        val start = denormalize(stroke.startX, stroke.startY)
        val end = denormalize(command.x, command.y)
        val moved = kotlin.math.abs(command.x - stroke.startX) > MOVE_THRESHOLD ||
            kotlin.math.abs(command.y - stroke.startY) > MOVE_THRESHOLD
        if (!moved) {
            RemoteControlAccessibilityService.performTap(end.first, end.second)
            return
        }

        val duration = (System.currentTimeMillis() - stroke.startedAtMs).coerceIn(120L, 900L)
        RemoteControlAccessibilityService.performSwipe(
            start.first,
            start.second,
            end.first,
            end.second,
            duration
        )
    }

    private fun updateScreenInfo(command: RemoteControlCommand.ScreenInfo) {
        mutableState.update { current ->
            current.copy(
                screenWidth = command.width.coerceAtLeast(0),
                screenHeight = command.height.coerceAtLeast(0),
                rotation = command.rotation
            )
        }
    }

    private fun canExecuteRemoteInput(): Boolean {
        val current = mutableState.value
        return current.enabled && current.isActive && !current.isViewOnly && current.accessibilityEnabled
    }

    private fun denormalize(x: Int, y: Int): Pair<Float, Float> {
        val state = mutableState.value
        val width = state.screenWidth.coerceAtLeast(1)
        val height = state.screenHeight.coerceAtLeast(1)
        val px = (x.toFloat() / 65535f) * width.toFloat()
        val py = (y.toFloat() / 65535f) * height.toFloat()
        return px to py
    }

    private fun isAccessibilityEnabled(): Boolean {
        if (RemoteControlAccessibilityService.isRunning()) return true
        val enabledServices = Settings.Secure.getString(
            appContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ).orEmpty()
        val expected = ComponentName(appContext, RemoteControlAccessibilityService::class.java).flattenToString()
        return enabledServices.split(':').any { it.equals(expected, ignoreCase = true) }
    }

    private fun readScreenMetrics(): ScreenMetrics {
        val metrics = DisplayMetrics()
        val windowManager = appContext.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        val rotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            appContext.display?.rotation ?: Surface.ROTATION_0
        } else {
            @Suppress("DEPRECATION")
            windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_0
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = windowManager?.currentWindowMetrics?.bounds
            return ScreenMetrics(
                width = bounds?.width() ?: appContext.resources.displayMetrics.widthPixels,
                height = bounds?.height() ?: appContext.resources.displayMetrics.heightPixels,
                rotation = rotation
            )
        }

        @Suppress("DEPRECATION")
        windowManager?.defaultDisplay?.getRealMetrics(metrics)
        return ScreenMetrics(
            width = metrics.widthPixels.takeIf { it > 0 } ?: appContext.resources.displayMetrics.widthPixels,
            height = metrics.heightPixels.takeIf { it > 0 } ?: appContext.resources.displayMetrics.heightPixels,
            rotation = rotation
        )
    }

    private data class PointerStroke(
        val startX: Int,
        val startY: Int,
        val lastX: Int,
        val lastY: Int,
        val startedAtMs: Long
    )

    private data class ScreenMetrics(
        val width: Int,
        val height: Int,
        val rotation: Int
    )

    private companion object {
        private const val SESSION_TTL_MS = 15 * 60 * 1000L
        private const val MOVE_THRESHOLD = 256
    }
}
