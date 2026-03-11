package ru.govchat.app.core.notification

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import ru.govchat.app.MainActivity
import ru.govchat.app.R
import ru.govchat.app.service.call.IncomingCallService
import ru.govchat.app.ui.call.IncomingCallActivity

sealed interface IncomingCallManagerEvent {
    data class Cleared(val callId: String) : IncomingCallManagerEvent
    data class Missed(val command: NotificationCommand) : IncomingCallManagerEvent
}

object CallNotificationManager {

    private val mutableIncomingCall = MutableStateFlow<NotificationCommand?>(null)
    val incomingCall = mutableIncomingCall.asStateFlow()

    private val mutableEvents = MutableSharedFlow<IncomingCallManagerEvent>(extraBufferCapacity = 8)
    val events = mutableEvents.asSharedFlow()

    @Volatile
    private var initialized = false

    fun ensureInitialized(context: Context) {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            mutableIncomingCall.value = readPersistedCommand(context.applicationContext)
            initialized = true
        }
    }

    fun currentIncomingCall(context: Context): NotificationCommand? {
        ensureInitialized(context)
        return mutableIncomingCall.value
    }

    fun presentIncomingCall(context: Context, command: NotificationCommand) {
        ensureInitialized(context)
        val appContext = context.applicationContext
        val existingStartedAt = currentIncomingCall(context)
            ?.callId
            ?.takeIf { it == command.callId }
            ?.let { pendingCallPresentedAtMillis(appContext) }
        persistCommand(
            context = appContext,
            command = command,
            presentedAtMillis = existingStartedAt ?: System.currentTimeMillis()
        )
        mutableIncomingCall.value = command
    }

    fun dismissIncomingCall(context: Context, callId: String?) {
        ensureInitialized(context)
        val current = mutableIncomingCall.value
        if (current != null && callId != null && current.callId != callId) {
            cancelIncomingNotification(context, callId)
            return
        }

        val clearedCallId = callId ?: current?.callId.orEmpty()
        cancelIncomingNotification(context, clearedCallId)
        clearPersistedCommand(context.applicationContext)
        mutableIncomingCall.value = null
        if (clearedCallId.isNotBlank()) {
            markCallHandled(context.applicationContext, clearedCallId)
            mutableEvents.tryEmit(IncomingCallManagerEvent.Cleared(clearedCallId))
        }
    }

    fun markIncomingCallMissed(context: Context, command: NotificationCommand) {
        showMissedCallNotification(context, command)
        mutableEvents.tryEmit(IncomingCallManagerEvent.Missed(command))
        dismissIncomingCall(context, command.callId)
    }

    @SuppressLint("MissingPermission")
    fun showIncomingCallNotification(context: Context, command: NotificationCommand): Notification {
        val activityIntent = PendingIntent.getActivity(
            context,
            requestCode(command.callId, "activity"),
            NotificationIntents.addCommandExtras(
                IncomingCallActivity.createIntent(context, command),
                command.copy(action = NotificationIntents.ACTION_OPEN_CALL)
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val acceptIntent = PendingIntent.getActivity(
            context,
            requestCode(command.callId, "accept"),
            NotificationIntents.addCommandExtras(
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                command.copy(action = NotificationIntents.ACTION_ACCEPT_CALL)
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val declineIntent = PendingIntent.getService(
            context,
            requestCode(command.callId, "decline"),
            IncomingCallService.createDeclineIntent(context, command),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val personName = command.initiatorName.orEmpty()
            .ifBlank { command.chatName.orEmpty() }
            .ifBlank { context.getString(R.string.call_contact_fallback) }
        val title = if (command.isGroupCall) {
            context.getString(R.string.push_group_call_title)
        } else {
            context.getString(R.string.push_call_title)
        }
        val body = if (command.isGroupCall) {
            context.getString(
                R.string.call_group_invite_body,
                personName,
                command.chatName.orEmpty().ifBlank { context.getString(R.string.app_name) }
            )
        } else {
            personName
        }

        return NotificationCompat.Builder(context, NotificationChannels.INCOMING_CALLS_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setOnlyAlertOnce(false)
            .setSilent(false)
            .setColorized(true)
            .setColor(0xFF1B5E20.toInt())
            .setTimeoutAfter(INCOMING_CALL_TIMEOUT_MS)
            .setStyle(
                NotificationCompat.CallStyle.forIncomingCall(
                    Person.Builder()
                        .setName(personName)
                        .setIcon(IconCompat.createWithResource(context, R.mipmap.ic_launcher))
                        .build(),
                    declineIntent,
                    acceptIntent
                )
            )
            .setFullScreenIntent(activityIntent, true)
            .setContentIntent(activityIntent)
            .build()
    }

    @SuppressLint("MissingPermission")
    fun showMissedCallNotification(context: Context, command: NotificationCommand) {
        val chatId = command.chatId.orEmpty()
        val chatName = command.chatName.orEmpty()
        val contentIntent = PendingIntent.getActivity(
            context,
            requestCode(command.callId, "missed"),
            NotificationIntents.addCommandExtras(
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                action = NotificationIntents.ACTION_OPEN_CHAT,
                chatId = chatId,
                chatName = chatName,
                callId = command.callId,
                callType = command.callType,
                isGroupCall = command.isGroupCall,
                initiatorId = command.initiatorId,
                initiatorName = command.initiatorName,
                initiatorAvatarUrl = command.initiatorAvatarUrl,
                participantCount = command.participantCount
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val caller = command.initiatorName.orEmpty()
            .ifBlank { chatName }
            .ifBlank { context.getString(R.string.call_contact_fallback) }
        val body = if (command.callType == "video") {
            context.getString(R.string.call_missed_video_body, caller)
        } else {
            context.getString(R.string.call_missed_audio_body, caller)
        }

        val notification = NotificationCompat.Builder(context, NotificationChannels.MESSAGES_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(context.getString(R.string.call_missed_title))
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setContentIntent(contentIntent)
            .build()

        val manager = NotificationManagerCompat.from(context)
        if (manager.areNotificationsEnabled()) {
            manager.notify(missedCallNotificationId(command.callId), notification)
        }
    }

    fun cancelIncomingNotification(context: Context, callId: String?) {
        if (callId.isNullOrBlank()) return
        NotificationManagerCompat.from(context).cancel(incomingCallNotificationId(callId))
    }

    fun pendingCallPresentedAtMillis(context: Context): Long? {
        val value = prefs(context.applicationContext)
            .getLong(PREF_PENDING_CALL_STARTED_AT, -1L)
        return value.takeIf { it > 0L }
    }

    fun wasCallRecentlyHandled(context: Context, callId: String?): Boolean {
        if (callId.isNullOrBlank()) return false
        val handled = pruneHandledCalls(context.applicationContext)
        return handled.has(callId)
    }

    fun canUseFullScreenIntent(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
        val manager = context.getSystemService(NotificationManager::class.java) ?: return false
        return manager.canUseFullScreenIntent()
    }

    fun openFullScreenIntentSettings(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        val intent = Intent(
            Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
            Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun isIncomingCallStillPending(context: Context, callId: String?): Boolean {
        if (callId.isNullOrBlank()) return false
        val appContext = context.applicationContext
        val currentCallId = currentIncomingCall(appContext)?.callId
        if (currentCallId != callId) return false
        val presentedAt = pendingCallPresentedAtMillis(appContext) ?: return true
        return System.currentTimeMillis() - presentedAt < INCOMING_CALL_TIMEOUT_MS
    }

    fun markCallHandled(context: Context, callId: String?) {
        if (callId.isNullOrBlank()) return
        val appContext = context.applicationContext
        val handled = pruneHandledCalls(appContext)
        handled.put(callId, System.currentTimeMillis())
        prefs(appContext).edit().putString(PREF_RECENTLY_HANDLED_CALLS, handled.toString()).apply()
    }

    fun buildMissedCallMessageText(context: Context, command: NotificationCommand): String {
        return if (command.callType == "video") {
            context.getString(R.string.call_missed_video_message)
        } else {
            context.getString(R.string.call_missed_audio_message)
        }
    }

    private fun persistCommand(context: Context, command: NotificationCommand, presentedAtMillis: Long) {
        val json = JSONObject()
            .put("eventId", command.eventId)
            .put("action", command.action)
            .put("chatId", command.chatId)
            .put("chatName", command.chatName)
            .put("callId", command.callId)
            .put("callType", command.callType)
            .put("isGroupCall", command.isGroupCall)
            .put("initiatorId", command.initiatorId)
            .put("initiatorName", command.initiatorName)
            .put("initiatorAvatarUrl", command.initiatorAvatarUrl)
            .put("participantCount", command.participantCount)
        prefs(context).edit()
            .putString(PREF_PENDING_CALL, json.toString())
            .putLong(PREF_PENDING_CALL_STARTED_AT, presentedAtMillis)
            .apply()
    }

    private fun clearPersistedCommand(context: Context) {
        prefs(context).edit()
            .remove(PREF_PENDING_CALL)
            .remove(PREF_PENDING_CALL_STARTED_AT)
            .apply()
    }

    private fun readPersistedCommand(context: Context): NotificationCommand? {
        val raw = prefs(context).getString(PREF_PENDING_CALL, null) ?: return null
        return runCatching {
            val json = JSONObject(raw)
            NotificationCommand(
                eventId = json.optString("eventId").ifBlank { NotificationIntents.newEventId() },
                action = json.optString("action").ifBlank { NotificationIntents.ACTION_OPEN_CALL },
                chatId = json.optString("chatId").ifBlank { null },
                chatName = json.optString("chatName").ifBlank { null },
                callId = json.optString("callId").ifBlank { null },
                callType = json.optString("callType").ifBlank { null },
                isGroupCall = json.optBoolean("isGroupCall"),
                initiatorId = json.optString("initiatorId").ifBlank { null },
                initiatorName = json.optString("initiatorName").ifBlank { null },
                initiatorAvatarUrl = json.optString("initiatorAvatarUrl").ifBlank { null },
                participantCount = json.optInt("participantCount")
            )
        }.getOrNull()
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun pruneHandledCalls(context: Context): JSONObject {
        val now = System.currentTimeMillis()
        val cutoff = now - RECENTLY_HANDLED_CALL_TTL_MS
        val raw = prefs(context).getString(PREF_RECENTLY_HANDLED_CALLS, null)
        val json = runCatching { JSONObject(raw ?: "{}") }.getOrElse { JSONObject() }
        val iterator = json.keys()
        val stale = mutableListOf<String>()
        while (iterator.hasNext()) {
            val key = iterator.next()
            if (json.optLong(key) < cutoff) {
                stale += key
            }
        }
        stale.forEach(json::remove)
        if (stale.isNotEmpty()) {
            prefs(context).edit().putString(PREF_RECENTLY_HANDLED_CALLS, json.toString()).apply()
        }
        return json
    }

    private fun incomingCallNotificationId(callId: String): Int {
        return INCOMING_CALL_NOTIFICATION_BASE_ID + callId.hashCode()
    }

    private fun missedCallNotificationId(callId: String?): Int {
        return MISSED_CALL_NOTIFICATION_BASE_ID + callId.orEmpty().hashCode()
    }

    private fun requestCode(callId: String?, suffix: String): Int {
        return (callId.orEmpty() + "|" + suffix).hashCode()
    }

    private const val PREFS_NAME = "govchat_call_notifications"
    private const val PREF_PENDING_CALL = "pending_call"
    private const val PREF_PENDING_CALL_STARTED_AT = "pending_call_started_at"
    private const val PREF_RECENTLY_HANDLED_CALLS = "recently_handled_calls"
    private const val INCOMING_CALL_NOTIFICATION_BASE_ID = 30_000
    private const val MISSED_CALL_NOTIFICATION_BASE_ID = 31_000
    private const val RECENTLY_HANDLED_CALL_TTL_MS = 2 * 60_000L
    const val INCOMING_CALL_TIMEOUT_MS = 35_000L
}
