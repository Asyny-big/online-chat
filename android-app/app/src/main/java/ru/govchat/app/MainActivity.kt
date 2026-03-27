package ru.govchat.app

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Bundle
import android.os.Build
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Surface
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import ru.govchat.app.core.notification.NotificationCommand
import ru.govchat.app.core.notification.NotificationIntents
import ru.govchat.app.ui.update.AppUpdateDialog
import ru.govchat.app.ui.navigation.GovChatNavGraph
import ru.govchat.app.ui.theme.GovChatTheme

class MainActivity : ComponentActivity() {

    private val pipModeFlow = MutableStateFlow(false)
    private val notificationCommands = MutableSharedFlow<NotificationCommand>(
        replay = 1,
        extraBufferCapacity = 8
    )
    private var canEnterPipForCall: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as GovChatApp).container
        setContent {
            val isInPipMode = pipModeFlow.collectAsStateWithLifecycle().value
            val updateState = container.appUpdateManager.state.collectAsStateWithLifecycle().value
            val lifecycleOwner = LocalLifecycleOwner.current
            val activityLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.StartActivityForResult()
            ) {
                container.appUpdateManager.onHostResumed()
            }

            LaunchedEffect(container) {
                container.appUpdateManager.start()
                container.appUpdateManager.actions.collect { action ->
                    when (action) {
                        is ru.govchat.app.core.update.AppUpdateAction.LaunchInstaller -> {
                            activityLauncher.launch(action.intent)
                        }

                        is ru.govchat.app.core.update.AppUpdateAction.OpenUnknownSourcesSettings -> {
                            activityLauncher.launch(action.intent)
                        }
                    }
                }
            }
            DisposableEffect(lifecycleOwner, container) {
                val observer = LifecycleEventObserver { _, event ->
                    if (event == Lifecycle.Event.ON_RESUME) {
                        container.appUpdateManager.onHostResumed()
                    }
                }
                lifecycleOwner.lifecycle.addObserver(observer)
                onDispose {
                    lifecycleOwner.lifecycle.removeObserver(observer)
                }
            }
            GovChatTheme {
                Surface {
                    Box {
                        GovChatNavGraph(
                            container = container,
                            isInPictureInPictureMode = isInPipMode,
                            onCallPipAvailabilityChanged = ::onCallPipAvailabilityChanged,
                            notificationCommands = notificationCommands.asSharedFlow(),
                            appUpdateState = updateState,
                            onStartAppUpdate = container.appUpdateManager::startUpdate,
                            onPostponeAppUpdate = container.appUpdateManager::postponeCurrentUpdate,
                            onRetryAppUpdate = container.appUpdateManager::retryAfterError
                        )
                        AppUpdateDialog(
                            state = updateState,
                            onStartUpdate = container.appUpdateManager::startUpdate,
                            onPostpone = container.appUpdateManager::postponeCurrentUpdate,
                            onRetry = container.appUpdateManager::retryAfterError
                        )
                    }
                }
            }
        }
        emitNotificationCommand(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        emitNotificationCommand(intent)
    }

    fun onCallPipAvailabilityChanged(isAvailable: Boolean) {
        canEnterPipForCall = isAvailable
        updateCallPictureInPictureParams(isAvailable)
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (canEnterPipForCall && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            enterCallPictureInPicture()
        }
    }

    override fun onStop() {
        super.onStop()
        if (
            canEnterPipForCall &&
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S &&
            !isChangingConfigurations &&
            !isInPictureInPictureMode
        ) {
            enterCallPictureInPicture()
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        pipModeFlow.value = isInPictureInPictureMode
    }

    private fun enterCallPictureInPicture() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
        if (isInPictureInPictureMode) return

        enterPictureInPictureMode(buildCallPictureInPictureParams(autoEnter = canEnterPipForCall))
    }

    private fun updateCallPictureInPictureParams(isCallPipAvailable: Boolean) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return

        setPictureInPictureParams(
            buildCallPictureInPictureParams(autoEnter = isCallPipAvailable)
        )
    }

    private fun buildCallPictureInPictureParams(autoEnter: Boolean): PictureInPictureParams {
        val paramsBuilder = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(9, 16))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            paramsBuilder.setAutoEnterEnabled(autoEnter)
        }
        return paramsBuilder.build()
    }

    private fun emitNotificationCommand(intent: Intent?) {
        val command = NotificationIntents.toCommand(intent) ?: return
        notificationCommands.tryEmit(command)
    }
}
