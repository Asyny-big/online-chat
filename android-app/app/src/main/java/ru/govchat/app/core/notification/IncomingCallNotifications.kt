package ru.govchat.app.core.notification

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
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
            isGroup = incomingCall.isGroup,
            callType = incomingCall.type,
            initiatorId = incomingCall.initiatorId
        )
    }

    @SuppressLint("MissingPermission")
    fun show(
        context: Context,
        callId: String,
        chatId: String,
        chatName: String,
        initiatorName: String,
        isGroup: Boolean,
        callType: String = "audio",
        initiatorId: String = ""
    ) {
        val openIntent = PendingIntent.getActivity(
            context,
            requestCode(callId, NotificationIntents.ACTION_OPEN_CALL),
            NotificationIntents.addCommandExtras(
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                action = NotificationIntents.ACTION_OPEN_CALL,
                chatId = chatId,
                chatName = chatName,
                callId = callId,
                callType = callType,
                isGroupCall = isGroup,
                initiatorId = initiatorId,
                initiatorName = initiatorName
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val acceptIntent = PendingIntent.getActivity(
            context,
            requestCode(callId, NotificationIntents.ACTION_ACCEPT_CALL),
            NotificationIntents.addCommandExtras(
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                action = NotificationIntents.ACTION_ACCEPT_CALL,
                chatId = chatId,
                chatName = chatName,
                callId = callId,
                callType = callType,
                isGroupCall = isGroup,
                initiatorId = initiatorId,
                initiatorName = initiatorName
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val declineIntent = PendingIntent.getActivity(
            context,
            requestCode(callId, NotificationIntents.ACTION_DECLINE_CALL),
            NotificationIntents.addCommandExtras(
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                action = NotificationIntents.ACTION_DECLINE_CALL,
                chatId = chatId,
                chatName = chatName,
                callId = callId,
                callType = callType,
                isGroupCall = isGroup,
                initiatorId = initiatorId,
                initiatorName = initiatorName
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val title = if (isGroup) {
            context.getString(R.string.push_group_call_title)
        } else {
            context.getString(R.string.push_call_title)
        }
        val body = if (isGroup) {
            "$initiatorName - $chatName"
        } else {
            initiatorName
        }

        val notification = NotificationCompat.Builder(context, NotificationChannels.INCOMING_CALLS_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setColorized(true)
            .setColor(0xFF1B5E20.toInt())
            .setStyle(
                NotificationCompat.CallStyle.forIncomingCall(
                    Person.Builder()
                        .setName(body)
                        .setIcon(IconCompat.createWithResource(context, R.mipmap.ic_launcher))
                        .build(),
                    declineIntent,
                    acceptIntent
                )
            )
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

    private fun requestCode(callId: String, action: String): Int {
        return (callId + "|" + action).hashCode()
    }

    const val EXTRA_CHAT_ID = NotificationIntents.EXTRA_CHAT_ID
    const val EXTRA_CALL_ID = NotificationIntents.EXTRA_CALL_ID
    private const val CALL_NOTIFICATION_BASE_ID = 30_000
}
