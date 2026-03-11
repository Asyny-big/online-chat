package ru.govchat.app.core.notification

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import ru.govchat.app.R

object NotificationChannels {
    const val CALLS_CHANNEL_ID = "govchat_calls_active"
    const val INCOMING_CALLS_CHANNEL_ID = "govchat_calls_incoming_v3"
    const val MESSAGES_CHANNEL_ID = "govchat_messages"

    fun ensureCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(NotificationManager::class.java)

        val activeCallsChannel = NotificationChannel(
            CALLS_CHANNEL_ID,
            context.getString(R.string.notifications_channel_calls),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.notifications_channel_calls_desc)
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(false)
            setSound(null, null)
        }

        val incomingCallsChannel = NotificationChannel(
            INCOMING_CALLS_CHANNEL_ID,
            context.getString(R.string.notifications_channel_incoming_calls),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.notifications_channel_incoming_calls_desc)
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0L, 1000L, 700L, 1000L)
            val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            setSound(ringtoneUri, audioAttributes)
        }

        val messagesChannel = NotificationChannel(
            MESSAGES_CHANNEL_ID,
            context.getString(R.string.notifications_channel_messages),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.notifications_channel_messages_desc)
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        }

        manager.createNotificationChannel(activeCallsChannel)
        manager.createNotificationChannel(incomingCallsChannel)
        manager.createNotificationChannel(messagesChannel)
    }
}

