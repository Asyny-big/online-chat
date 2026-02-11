package ru.govchat.app

import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Bundle
import android.os.Build
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.Surface
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.MutableStateFlow
import ru.govchat.app.ui.navigation.GovChatNavGraph
import ru.govchat.app.ui.theme.GovChatTheme

class MainActivity : ComponentActivity() {

    private val pipModeFlow = MutableStateFlow(false)
    private var canEnterPipForCall: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as GovChatApp).container
        setContent {
            val isInPipMode = pipModeFlow.collectAsStateWithLifecycle().value
            GovChatTheme {
                Surface {
                    GovChatNavGraph(
                        container = container,
                        isInPictureInPictureMode = isInPipMode,
                        onCallPipAvailabilityChanged = ::onCallPipAvailabilityChanged
                    )
                }
            }
        }
    }

    fun onCallPipAvailabilityChanged(isAvailable: Boolean) {
        canEnterPipForCall = isAvailable
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (canEnterPipForCall) {
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

        val paramsBuilder = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(9, 16))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            paramsBuilder.setAutoEnterEnabled(true)
        }
        enterPictureInPictureMode(paramsBuilder.build())
    }
}
