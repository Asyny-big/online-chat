package ru.govchat.app.ui.call

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import ru.govchat.app.R
import ru.govchat.app.core.notification.CallNotificationManager
import ru.govchat.app.core.notification.NotificationCommand
import ru.govchat.app.core.notification.NotificationIntents
import ru.govchat.app.service.call.IncomingCallService
import ru.govchat.app.ui.theme.GovChatTheme

class IncomingCallActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureLockScreenWindow()
        CallNotificationManager.ensureInitialized(this)

        setContent {
            val activeCommand by CallNotificationManager.incomingCall.collectAsStateWithLifecycle()
            val fallbackCommand = NotificationIntents.toCommand(intent)
            val command = activeCommand ?: fallbackCommand

            LaunchedEffect(activeCommand?.callId, fallbackCommand?.callId) {
                val fallbackCallId = fallbackCommand?.callId
                if (
                    activeCommand == null &&
                    fallbackCallId != null &&
                    CallNotificationManager.wasCallRecentlyHandled(this@IncomingCallActivity, fallbackCallId)
                ) {
                    finish()
                }
            }

            if (command == null) {
                finish()
                return@setContent
            }

            GovChatTheme {
                IncomingCallScreen(
                    command = command,
                    onAccept = {
                        IncomingCallService.acceptCall(this, command)
                        finish()
                    },
                    onDecline = {
                        IncomingCallService.declineCall(this, command)
                        finish()
                    }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    private fun configureLockScreenWindow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    companion object {
        fun createIntent(context: Context, command: NotificationCommand): Intent {
            return NotificationIntents.addCommandExtras(
                Intent(context, IncomingCallActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or
                        Intent.FLAG_ACTIVITY_NO_USER_ACTION
                },
                command.copy(action = NotificationIntents.ACTION_OPEN_CALL)
            )
        }
    }
}

@Composable
private fun IncomingCallScreen(
    command: NotificationCommand,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    val isVideo = command.callType == "video"
    val callerName = command.initiatorName.orEmpty()
        .ifBlank { command.chatName.orEmpty() }
        .ifBlank { "Контакт" }
    val chatLabel = command.chatName.orEmpty()
    val subtitle = if (command.isGroupCall && chatLabel.isNotBlank()) {
        "$callerName приглашает в $chatLabel"
    } else {
        "Входящий звонок"
    }

    Surface(color = Color.Black) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF07111F),
                            Color(0xFF0B1F35),
                            Color(0xFF030712)
                        )
                    )
                )
                .padding(horizontal = 24.dp, vertical = 32.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(36.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color(0xFF93C5FD),
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(20.dp))
                CallAvatar(
                    callerName = callerName,
                    avatarUrl = command.initiatorAvatarUrl
                )
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = callerName,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    textAlign = TextAlign.Center
                )
                if (chatLabel.isNotBlank() && command.isGroupCall) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = chatLabel,
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color(0xFFE2E8F0),
                        textAlign = TextAlign.Center
                    )
                }
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = if (isVideo) Icons.Default.Videocam else Icons.Default.Call,
                        contentDescription = null,
                        tint = Color(0xFF60A5FA)
                    )
                    Text(
                        text = if (isVideo) {
                            androidx.compose.ui.res.stringResource(R.string.call_video_label)
                        } else {
                            androidx.compose.ui.res.stringResource(R.string.call_audio_label)
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFF60A5FA)
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = onDecline,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFDC2626),
                            contentColor = Color.White
                        ),
                        shape = CircleShape,
                        modifier = Modifier.size(88.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CallEnd,
                            contentDescription = androidx.compose.ui.res.stringResource(R.string.notification_call_decline)
                        )
                    }
                    Button(
                        onClick = onAccept,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF16A34A),
                            contentColor = Color.White
                        ),
                        shape = CircleShape,
                        modifier = Modifier.size(88.dp)
                    ) {
                        Icon(
                            imageVector = if (isVideo) Icons.Default.Videocam else Icons.Default.Call,
                            contentDescription = androidx.compose.ui.res.stringResource(R.string.notification_call_accept)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(18.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(52.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = androidx.compose.ui.res.stringResource(R.string.notification_call_decline),
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Text(
                        text = androidx.compose.ui.res.stringResource(R.string.notification_call_accept),
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
        }
    }
}

@Composable
private fun CallAvatar(
    callerName: String,
    avatarUrl: String?
) {
    Box(
        modifier = Modifier
            .size(180.dp)
            .clip(CircleShape)
            .background(Color(0xFF1E293B)),
        contentAlignment = Alignment.Center
    ) {
        if (!avatarUrl.isNullOrBlank()) {
            AsyncImage(
                model = avatarUrl,
                contentDescription = callerName,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            Text(
                text = callerName.firstOrNull()?.uppercase() ?: "?",
                style = MaterialTheme.typography.displayMedium,
                color = Color.White
            )
        }
    }
}
