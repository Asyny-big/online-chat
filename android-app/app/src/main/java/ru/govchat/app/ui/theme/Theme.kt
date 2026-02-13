package ru.govchat.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = GovPrimary,
    onPrimary = GovText,
    secondary = GovPrimaryDark,
    onSecondary = GovText,
    background = GovBackground,
    onBackground = GovText,
    surface = GovSurface,
    onSurface = GovText,
    surfaceVariant = GovSurfaceAlt,
    onSurfaceVariant = GovTextSecondary,
    error = GovError,
    surfaceContainer = GovHeaderBar,
    outline = GovDivider,
    tertiary = GovAccent,
    tertiaryContainer = GovInputBg
)

private val LightColorScheme = lightColorScheme(
    primary = GovPrimaryDark,
    onPrimary = GovText,
    secondary = GovPrimary,
    onSecondary = GovText,
    background = GovBackground,
    onBackground = GovText,
    surface = GovSurface,
    onSurface = GovText,
    surfaceVariant = GovSurfaceAlt,
    onSurfaceVariant = GovTextSecondary,
    error = GovError,
    surfaceContainer = GovHeaderBar,
    outline = GovDivider,
    tertiary = GovAccent,
    tertiaryContainer = GovInputBg
)

@Composable
fun GovChatTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
