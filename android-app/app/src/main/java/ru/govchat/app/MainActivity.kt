package ru.govchat.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.Surface
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import ru.govchat.app.ui.navigation.GovChatNavGraph
import ru.govchat.app.ui.theme.GovChatTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as GovChatApp).container
        setContent {
            GovChatTheme {
                Surface {
                    GovChatNavGraph(container = container)
                }
            }
        }
    }
}
