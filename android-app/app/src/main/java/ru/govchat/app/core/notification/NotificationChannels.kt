package ru.govchat.app.core.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import ru.govchat.app.R

object NotificationChannels {
    const val CALLS_CHANNEL_ID = "govchat_calls"
    const val MESSAGES_CHANNEL_ID = "govchat_messages"

    fun ensureCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(NotificationManager::class.java)

        val callsChannel = NotificationChannel(
            CALLS_CHANNEL_ID,
            context.getString(R.string.notifications_channel_calls),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.notifications_channel_calls_desc)
            setShowBadge(false)
        }

        val messagesChannel = NotificationChannel(
            MESSAGES_CHANNEL_ID,
            context.getString(R.string.notifications_channel_messages),
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = context.getString(R.string.notifications_channel_messages_desc)
        }

        manager.createNotificationChannel(callsChannel)
        manager.createNotificationChannel(messagesChannel)
    }
}

