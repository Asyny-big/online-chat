package ru.govchat.app.service.call

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import ru.govchat.app.GovChatApp
import ru.govchat.app.MainActivity
import ru.govchat.app.core.notification.CallNotificationManager
import ru.govchat.app.core.notification.NotificationCommand
import ru.govchat.app.core.notification.NotificationIntents
import ru.govchat.app.core.notification.CallNotificationManager.INCOMING_CALL_TIMEOUT_MS
import ru.govchat.app.core.storage.ChatMessagesCacheStorage
import ru.govchat.app.domain.model.CallHistoryDirection
import ru.govchat.app.domain.model.CallHistoryDraft
import ru.govchat.app.domain.model.CallHistoryType
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.MessageDeliveryStatus
import ru.govchat.app.domain.model.MessageType
import ru.govchat.app.ui.call.IncomingCallActivity

class IncomingCallService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private var timeoutJob: Job? = null
    private var ringtone: Ringtone? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var currentCallId: String? = null
    private var isForegroundIncoming = false

    override fun onCreate() {
        super.onCreate()
        CallNotificationManager.ensureInitialized(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        when (action) {
            ACTION_SHOW_INCOMING_CALL -> handleShowIncomingCall(intent)
            ACTION_ACCEPT_INCOMING_CALL -> handleAccept(intent)
            ACTION_DECLINE_INCOMING_CALL -> handleDecline(intent)
            ACTION_CANCEL_INCOMING_CALL -> handleCancel(intent)
            else -> stopSelf(startId)
        }
        return if (action == ACTION_SHOW_INCOMING_CALL) START_REDELIVER_INTENT else START_NOT_STICKY
    }

    private fun handleShowIncomingCall(intent: Intent) {
        val command = NotificationIntents.toCommand(intent) ?: return
        if (command.callId.isNullOrBlank() || command.chatId.isNullOrBlank()) return
        if (CallForegroundService.isRunning()) {
            Log.i(TAG, "Ignoring incoming call because active call foreground service is already running")
            return
        }
        if (CallNotificationManager.wasCallRecentlyHandled(this, command.callId)) {
            Log.i(TAG, "Ignoring duplicate incoming call for recently handled callId=${command.callId}")
            return
        }

        val showNotification = intent.getBooleanExtra(EXTRA_SHOW_NOTIFICATION, true)
        val current = CallNotificationManager.currentIncomingCall(this)
        if (current?.callId == command.callId && timeoutJob?.isActive == true) {
            if (!showNotification) {
                launchIncomingCallActivity(command)
            }
            return
        }

        if (!current?.callId.isNullOrBlank() && current?.callId != command.callId) {
            CallNotificationManager.dismissIncomingCall(this, current?.callId)
        }

        CallNotificationManager.presentIncomingCall(this, command)
        applicationContainer().applicationScope.launch {
            applicationContainer().callHistoryRepository.createPendingCall(command.toIncomingHistoryDraft())
        }
        currentCallId = command.callId
        acquireWakeLock()
        scheduleTimeout(command)
        startAlerting()

        if (showNotification) {
            val notification = CallNotificationManager.showIncomingCallNotification(this, command)
            val foregroundStarted = startIncomingForeground(notificationId(command.callId), notification)
            isForegroundIncoming = foregroundStarted
        } else {
            if (isForegroundIncoming) {
                stopForeground(STOP_FOREGROUND_REMOVE)
                isForegroundIncoming = false
            }
            launchIncomingCallActivity(command)
        }
    }

    private fun handleAccept(intent: Intent) {
        val command = resolveCommand(intent) ?: return
        if (!hasRequiredCallPermissions(command)) {
            Log.w(TAG, "Accept requested without all runtime permissions for callId=${command.callId}")
            launchCallHost(command.copy(action = NotificationIntents.ACTION_OPEN_CALL))
            return
        }
        serviceScope.launch {
            preWarmRealtime()
            cleanupIncomingSurface(command.callId)
            launchCallHost(command.copy(action = NotificationIntents.ACTION_ACCEPT_CALL))
        }
    }

    private fun handleDecline(intent: Intent) {
        val command = resolveCommand(intent) ?: return
        cleanupIncomingSurface(command.callId)
        applicationContainer().applicationScope.launch {
            runCatching {
                applicationContainer().callHistoryRepository.markDeclined(command.callId.orEmpty())
                preWarmRealtime()
                applicationContainer().declineCallUseCase(command.callId.orEmpty())
            }.onFailure { error ->
                Log.w(TAG, "Failed to send call decline for callId=${command.callId}", error)
            }
        }
    }

    private fun handleCancel(intent: Intent) {
        val callId = NotificationIntents.toCommand(intent)?.callId
            ?: intent.getStringExtra(NotificationIntents.EXTRA_CALL_ID)
        cleanupIncomingSurface(callId)
    }

    private fun scheduleTimeout(command: NotificationCommand) {
        timeoutJob?.cancel()
        timeoutJob = serviceScope.launch {
            val presentedAtMillis = CallNotificationManager.pendingCallPresentedAtMillis(this@IncomingCallService)
                ?: System.currentTimeMillis()
            val elapsedMillis = (System.currentTimeMillis() - presentedAtMillis).coerceAtLeast(0L)
            val remainingMillis = (INCOMING_CALL_TIMEOUT_MS - elapsedMillis).coerceAtLeast(0L)
            if (remainingMillis > 0L) {
                delay(remainingMillis)
            }
            val current = CallNotificationManager.currentIncomingCall(this@IncomingCallService)
            if (current?.callId != command.callId) return@launch
            appendMissedCallSystemMessage(command)
            applicationContainer().callHistoryRepository.markMissed(command.callId.orEmpty())
            CallNotificationManager.markIncomingCallMissed(this@IncomingCallService, command)
            cleanupRuntimeOnly()
            stopSelf()
        }
    }

    private fun appendMissedCallSystemMessage(command: NotificationCommand) {
        val chatId = command.chatId.orEmpty()
        val callId = command.callId.orEmpty()
        if (chatId.isBlank() || callId.isBlank()) return

        val container = applicationContainer()
        container.applicationScope.launch(Dispatchers.IO) {
            val messageId = MISSED_CALL_MESSAGE_PREFIX + callId
            val storage: ChatMessagesCacheStorage = container.chatMessagesCacheStorage
            val cached = storage.readMessages(chatId)
            if (cached.any { it.id == messageId }) return@launch

            val currentUserId = container.sessionStorage.getUserId().orEmpty()
            val systemMessage = ChatMessage(
                id = messageId,
                chatId = chatId,
                senderId = SYSTEM_SENDER_ID,
                senderName = getString(ru.govchat.app.R.string.app_name),
                type = MessageType.System,
                text = CallNotificationManager.buildMissedCallMessageText(this@IncomingCallService, command),
                attachment = null,
                readByUserIds = currentUserId.takeIf { it.isNotBlank() }?.let(::setOf).orEmpty(),
                createdAtMillis = System.currentTimeMillis(),
                deliveryStatus = MessageDeliveryStatus.Delivered
            )
            val merged = (cached + systemMessage)
                .distinctBy { it.id }
                .sortedBy { it.createdAtMillis }
            storage.saveMessages(chatId = chatId, messages = merged)
        }
    }

    private fun cleanupIncomingSurface(callId: String?) {
        CallNotificationManager.dismissIncomingCall(this, callId)
        cleanupRuntimeOnly()
        stopSelf()
    }

    private fun cleanupRuntimeOnly() {
        timeoutJob?.cancel()
        timeoutJob = null
        currentCallId = null
        stopAlerting()
        releaseWakeLock()
        if (isForegroundIncoming) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            isForegroundIncoming = false
        }
    }

    private fun resolveCommand(intent: Intent?): NotificationCommand? {
        return NotificationIntents.toCommand(intent)
            ?: CallNotificationManager.currentIncomingCall(this)
    }

    private fun launchIncomingCallActivity(command: NotificationCommand) {
        val activityIntent = NotificationIntents.addCommandExtras(
            IncomingCallActivity.createIntent(this, command),
            command.copy(action = NotificationIntents.ACTION_OPEN_CALL)
        )
        runCatching {
            startActivity(activityIntent)
        }.onFailure { error ->
            Log.w(TAG, "Unable to launch IncomingCallActivity", error)
        }
    }

    private fun launchCallHost(command: NotificationCommand) {
        val intent = NotificationIntents.addCommandExtras(
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            command
        )
        runCatching {
            startActivity(intent)
        }.onFailure { error ->
            Log.e(TAG, "Unable to launch MainActivity for accepted call", error)
        }
    }

    private suspend fun preWarmRealtime() {
        applicationContainer().chatRepository.connectRealtime()
        delay(SOCKET_RECONNECT_DELAY_MS)
    }

    private fun hasRequiredCallPermissions(command: NotificationCommand): Boolean {
        val hasMic = ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        val hasCamera = command.callType != "video" || ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        return hasMic && hasCamera
    }

    private fun startAlerting() {
        stopAlerting()

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ringtone = RingtoneManager.getRingtone(this, ringtoneUri)?.apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                isLooping = true
            }
            this.audioAttributes = audioAttributes
            play()
        }

        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(Vibrator::class.java)
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        } ?: return

        val pattern = longArrayOf(0L, 700L, 450L, 700L)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, 0)
        }
    }

    private fun stopAlerting() {
        runCatching { ringtone?.stop() }
        ringtone = null

        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(Vibrator::class.java)
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        vibrator?.cancel()
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        releaseWakeLock()
        val powerManager = getSystemService(PowerManager::class.java) ?: return
        @Suppress("DEPRECATION")
        val flags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE
        wakeLock = powerManager.newWakeLock(flags, "$packageName:incoming_call").apply {
            acquire(WAKE_LOCK_TIMEOUT_MS)
        }
    }

    private fun releaseWakeLock() {
        runCatching {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        }
        wakeLock = null
    }

    private fun notificationId(callId: String?): Int {
        return FOREGROUND_NOTIFICATION_BASE_ID + callId.orEmpty().hashCode()
    }

    private fun startIncomingForeground(notificationId: Int, notification: android.app.Notification): Boolean {
        return runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
            } else {
                startForeground(notificationId, notification)
            }
            true
        }.getOrElse { error ->
            Log.e(TAG, "Unable to promote incoming call service to foreground; falling back to posted notification", error)
            NotificationManagerCompat.from(this).notify(notificationId, notification)
            false
        }
    }

    private fun applicationContainer() = (application as GovChatApp).container

    override fun onDestroy() {
        cleanupRuntimeOnly()
        serviceScope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "IncomingCallService"
        private const val ACTION_SHOW_INCOMING_CALL = "ru.govchat.app.call.SHOW_INCOMING"
        private const val ACTION_ACCEPT_INCOMING_CALL = "ru.govchat.app.call.ACCEPT_INCOMING"
        private const val ACTION_DECLINE_INCOMING_CALL = "ru.govchat.app.call.DECLINE_INCOMING"
        private const val ACTION_CANCEL_INCOMING_CALL = "ru.govchat.app.call.CANCEL_INCOMING"
        private const val EXTRA_SHOW_NOTIFICATION = "extra_show_notification"
        private const val FOREGROUND_NOTIFICATION_BASE_ID = 30_000
        private const val WAKE_LOCK_TIMEOUT_MS = 5_000L
        private const val SOCKET_RECONNECT_DELAY_MS = 300L
        private const val SYSTEM_SENDER_ID = "system"
        private const val MISSED_CALL_MESSAGE_PREFIX = "missed-call:"

        fun showIncomingCall(
            context: Context,
            command: NotificationCommand,
            showNotification: Boolean
        ) {
            val intent = NotificationIntents.addCommandExtras(
                Intent(context, IncomingCallService::class.java).apply {
                    action = ACTION_SHOW_INCOMING_CALL
                    putExtra(EXTRA_SHOW_NOTIFICATION, showNotification)
                },
                command.copy(action = NotificationIntents.ACTION_OPEN_CALL)
            )
            runCatching {
                if (showNotification) {
                    ContextCompat.startForegroundService(context, intent)
                } else {
                    context.startService(intent)
                }
            }.onFailure { error ->
                Log.e(TAG, "Unable to start incoming call service", error)
            }
        }

        fun cancelIncomingCall(context: Context, callId: String) {
            val intent = Intent(context, IncomingCallService::class.java).apply {
                action = ACTION_CANCEL_INCOMING_CALL
                putExtra(NotificationIntents.EXTRA_CALL_ID, callId)
            }
            runCatching {
                context.startService(intent)
            }.onFailure { error ->
                Log.w(TAG, "Unable to cancel incoming call surface for callId=$callId", error)
                CallNotificationManager.dismissIncomingCall(context, callId)
            }
        }

        fun acceptCall(context: Context, command: NotificationCommand) {
            runCatching {
                context.startService(createAcceptIntent(context, command))
            }.onFailure { error ->
                Log.e(TAG, "Unable to accept incoming call", error)
            }
        }

        fun declineCall(context: Context, command: NotificationCommand) {
            runCatching {
                context.startService(createDeclineIntent(context, command))
            }.onFailure { error ->
                Log.e(TAG, "Unable to decline incoming call", error)
                CallNotificationManager.dismissIncomingCall(context, command.callId)
            }
        }

        fun createAcceptIntent(context: Context, command: NotificationCommand): Intent {
            return NotificationIntents.addCommandExtras(
                Intent(context, IncomingCallService::class.java).apply {
                    action = ACTION_ACCEPT_INCOMING_CALL
                },
                command.copy(action = NotificationIntents.ACTION_ACCEPT_CALL)
            )
        }

        fun createDeclineIntent(context: Context, command: NotificationCommand): Intent {
            return NotificationIntents.addCommandExtras(
                Intent(context, IncomingCallService::class.java).apply {
                    action = ACTION_DECLINE_INCOMING_CALL
                },
                command.copy(action = NotificationIntents.ACTION_DECLINE_CALL)
            )
        }
    }
}

private fun NotificationCommand.toIncomingHistoryDraft(): CallHistoryDraft {
    return CallHistoryDraft(
        id = callId.orEmpty(),
        serverCallId = callId,
        chatId = chatId,
        userId = if (isGroupCall) chatId.orEmpty() else initiatorId.orEmpty().ifBlank { chatId.orEmpty() },
        userName = if (isGroupCall) {
            chatName.orEmpty().ifBlank { initiatorName.orEmpty() }
        } else {
            initiatorName.orEmpty().ifBlank { chatName.orEmpty() }
        },
        avatarUrl = initiatorAvatarUrl,
        direction = CallHistoryDirection.INCOMING,
        callType = if (callType == "video") CallHistoryType.VIDEO else CallHistoryType.AUDIO,
        startedAt = System.currentTimeMillis(),
        isGroupCall = isGroupCall
    )
}
