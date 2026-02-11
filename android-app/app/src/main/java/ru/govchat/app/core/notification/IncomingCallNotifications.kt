package ru.govchat.app.core.notification

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import ru.govchat.app.MainActivity
import ru.govchat.app.R
import ru.govchat.app.ui.screens.main.IncomingCallUi

object IncomingCallNotifications {

    @SuppressLint("MissingPermission")
    fun show(context: Context, incomingCall: IncomingCallUi) {
        show(
            context = context,
            callId = incomingCall.callId,
            chatId = incomingCall.chatId,
            chatName = incomingCall.chatName,
            initiatorName = incomingCall.initiatorName,
            isGroup = incomingCall.isGroup
        )
    }

    @SuppressLint("MissingPermission")
    fun show(
        context: Context,
        callId: String,
        chatId: String,
        chatName: String,
        initiatorName: String,
        isGroup: Boolean
    ) {
        val openIntent = PendingIntent.getActivity(
            context,
            callId.hashCode(),
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(EXTRA_CHAT_ID, chatId)
                putExtra(EXTRA_CALL_ID, callId)
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val title = if (isGroup) {
            context.getString(R.string.push_group_call_title)
        } else {
            context.getString(R.string.push_call_title)
        }
        val body = if (isGroup) {
            "$initiatorName • $chatName"
        } else {
            initiatorName
        }

        val notification = NotificationCompat.Builder(context, NotificationChannels.CALLS_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(false)
            .setFullScreenIntent(openIntent, true)
            .setContentIntent(openIntent)
            .build()

        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return
        manager.notify(notificationId(callId), notification)
    }

    fun cancel(context: Context, callId: String) {
        NotificationManagerCompat.from(context).cancel(notificationId(callId))
    }

    private fun notificationId(callId: String): Int = CALL_NOTIFICATION_BASE_ID + callId.hashCode()

    const val EXTRA_CHAT_ID = "extra_chat_id"
    const val EXTRA_CALL_ID = "extra_call_id"
    private const val CALL_NOTIFICATION_BASE_ID = 30_000
}
