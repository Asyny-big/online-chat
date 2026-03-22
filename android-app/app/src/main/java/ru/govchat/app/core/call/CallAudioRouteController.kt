package ru.govchat.app.core.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class CallAudioRoutingState(
    val availableRoutes: List<CallAudioRoute> = emptyList(),
    val currentRoute: CallAudioRoute? = null,
    val isSpeakerphoneEnabled: Boolean = false,
    val canToggleSpeakerphone: Boolean = false,
    val canSelectAudioRoute: Boolean = false
)

class CallAudioRouteController(
    private val appContext: Context
) {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val audioManager: AudioManager? =
        appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val powerManager: PowerManager? =
        appContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
    private val mutableState = MutableStateFlow(CallAudioRoutingState())
    val state: StateFlow<CallAudioRoutingState> = mutableState.asStateFlow()

    private var callActive = false
    private var videoCall = false
    private var userSelectedRoute: CallAudioRoute? = null

    private var previousAudioMode: Int? = null
    private var previousSpeakerphoneState: Boolean? = null
    private var previousMicrophoneMuteState: Boolean? = null
    private var previousBluetoothScoState: Boolean? = null

    private var audioDeviceCallback: AudioDeviceCallback? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var scoReceiverRegistered = false
    private var proximityWakeLock: PowerManager.WakeLock? = null

    private val audioFocusChangeListener =
        AudioManager.OnAudioFocusChangeListener { focusChange ->
            if (!callActive) return@OnAudioFocusChangeListener
            if (
                focusChange == AudioManager.AUDIOFOCUS_GAIN ||
                focusChange == AudioManager.AUDIOFOCUS_GAIN_TRANSIENT ||
                focusChange == AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
            ) {
                refreshAudioRoute(reason = "focus:$focusChange")
            }
        }

    private val scoStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (!callActive) return
            if (intent?.action != AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED) return
            refreshAudioRoute(
                reason = "sco:${intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, -1)}"
            )
        }
    }

    fun startSession(isVideoCall: Boolean) {
        ensureMainThread("startSession")
        val manager = audioManager ?: return
        if (!callActive) {
            previousAudioMode = manager.mode
            previousSpeakerphoneState = manager.isSpeakerphoneOn
            previousMicrophoneMuteState = manager.isMicrophoneMute
            previousBluetoothScoState = manager.isBluetoothScoOn
            requestAudioFocus(manager)
            registerAudioDeviceCallback(manager)
            registerScoReceiver()
            callActive = true
        }
        videoCall = isVideoCall
        userSelectedRoute = null
        refreshAudioRoute(reason = "start")
    }

    fun stopSession() {
        ensureMainThread("stopSession")
        val manager = audioManager ?: run {
            callActive = false
            videoCall = false
            userSelectedRoute = null
            mutableState.value = CallAudioRoutingState()
            return
        }

        unregisterAudioDeviceCallback(manager)
        unregisterScoReceiver()
        releaseProximityWakeLock()
        clearCommunicationDevice(manager)
        stopBluetoothSco(manager)

        previousAudioMode?.let { manager.mode = it }
        previousSpeakerphoneState?.let { manager.isSpeakerphoneOn = it }
        previousMicrophoneMuteState?.let { manager.isMicrophoneMute = it }
        previousBluetoothScoState?.let { wasEnabled ->
            if (wasEnabled) {
                startBluetoothSco(manager)
            } else {
                stopBluetoothSco(manager)
            }
        }

        abandonAudioFocus(manager)
        callActive = false
        videoCall = false
        userSelectedRoute = null
        previousAudioMode = null
        previousSpeakerphoneState = null
        previousMicrophoneMuteState = null
        previousBluetoothScoState = null
        mutableState.value = CallAudioRoutingState()
    }

    fun selectRoute(route: CallAudioRoute): Boolean {
        ensureMainThread("selectRoute")
        if (!callActive) return false
        userSelectedRoute = route
        refreshAudioRoute(reason = "manual:$route")
        return mutableState.value.currentRoute == route
    }

    fun toggleSpeakerphone(): Boolean {
        ensureMainThread("toggleSpeakerphone")
        if (!callActive) return false
        val availableRoutes = mutableState.value.availableRoutes.toSet()
        val targetRoute = when {
            mutableState.value.currentRoute == CallAudioRoute.Speaker &&
                availableRoutes.contains(CallAudioRoute.Earpiece) -> CallAudioRoute.Earpiece

            availableRoutes.contains(CallAudioRoute.Speaker) -> CallAudioRoute.Speaker
            availableRoutes.contains(CallAudioRoute.Earpiece) -> CallAudioRoute.Earpiece
            else -> return false
        }
        return selectRoute(targetRoute)
    }

    private fun refreshAudioRoute(reason: String) {
        ensureMainThread("refreshAudioRoute:$reason")
        val manager = audioManager ?: return
        if (!callActive) return

        manager.mode = AudioManager.MODE_IN_COMMUNICATION
        manager.isMicrophoneMute = false

        val availableRoutes = resolveAvailableRoutes(manager)
        val targetRoute = when {
            userSelectedRoute != null && availableRoutes.contains(userSelectedRoute) -> userSelectedRoute
            else -> resolveAutomaticRoute(availableRoutes)
        }
        val appliedRoute = applyRoute(
            manager = manager,
            targetRoute = targetRoute,
            availableRoutes = availableRoutes
        )
        val currentRoute = appliedRoute ?: resolveAutomaticRoute(availableRoutes)
        val canToggleSpeakerphone =
            availableRoutes.contains(CallAudioRoute.Speaker) &&
                availableRoutes.contains(CallAudioRoute.Earpiece) &&
                !availableRoutes.contains(CallAudioRoute.Bluetooth) &&
                !availableRoutes.contains(CallAudioRoute.WiredHeadset)

        updateProximityWakeLock(currentRoute == CallAudioRoute.Earpiece && !videoCall)
        mutableState.value = CallAudioRoutingState(
            availableRoutes = availableRoutes,
            currentRoute = currentRoute,
            isSpeakerphoneEnabled = currentRoute == CallAudioRoute.Speaker,
            canToggleSpeakerphone = canToggleSpeakerphone,
            canSelectAudioRoute = availableRoutes.size > 1
        )
    }

    private fun resolveAutomaticRoute(availableRoutes: List<CallAudioRoute>): CallAudioRoute? {
        return when {
            availableRoutes.contains(CallAudioRoute.Bluetooth) -> CallAudioRoute.Bluetooth
            availableRoutes.contains(CallAudioRoute.WiredHeadset) -> CallAudioRoute.WiredHeadset
            videoCall && availableRoutes.contains(CallAudioRoute.Speaker) -> CallAudioRoute.Speaker
            availableRoutes.contains(CallAudioRoute.Earpiece) -> CallAudioRoute.Earpiece
            availableRoutes.contains(CallAudioRoute.Speaker) -> CallAudioRoute.Speaker
            else -> availableRoutes.firstOrNull()
        }
    }

    private fun resolveAvailableRoutes(manager: AudioManager): List<CallAudioRoute> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val routes = manager.availableCommunicationDevices
                .mapNotNull(::mapCommunicationDeviceToRoute)
                .distinct()
                .toMutableList()
            if (!routes.contains(CallAudioRoute.Speaker)) {
                routes += CallAudioRoute.Speaker
            }
            return routes.sortedBy(::routeSortOrder)
        }

        val routes = mutableSetOf<CallAudioRoute>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = manager.getDevices(AudioManager.GET_DEVICES_INPUTS or AudioManager.GET_DEVICES_OUTPUTS)
            devices.forEach { device ->
                when (device.type) {
                    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> routes += CallAudioRoute.Speaker
                    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> routes += CallAudioRoute.Earpiece
                    AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> routes += CallAudioRoute.Bluetooth
                    AudioDeviceInfo.TYPE_WIRED_HEADSET,
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                    AudioDeviceInfo.TYPE_USB_HEADSET -> routes += CallAudioRoute.WiredHeadset
                }
            }
        }
        if (routes.isEmpty()) {
            routes += CallAudioRoute.Speaker
        }
        return routes.sortedBy(::routeSortOrder)
    }

    private fun applyRoute(
        manager: AudioManager,
        targetRoute: CallAudioRoute?,
        availableRoutes: List<CallAudioRoute>
    ): CallAudioRoute? {
        val route = targetRoute ?: return null
        if (!availableRoutes.contains(route)) return null

        return when (route) {
            CallAudioRoute.Speaker -> {
                stopBluetoothSco(manager)
                manager.isSpeakerphoneOn = true
                setCommunicationDevice(manager, CallAudioRoute.Speaker)
                CallAudioRoute.Speaker
            }

            CallAudioRoute.Earpiece -> {
                stopBluetoothSco(manager)
                manager.isSpeakerphoneOn = false
                setCommunicationDevice(manager, CallAudioRoute.Earpiece)
                CallAudioRoute.Earpiece
            }

            CallAudioRoute.WiredHeadset -> {
                stopBluetoothSco(manager)
                manager.isSpeakerphoneOn = false
                setCommunicationDevice(manager, CallAudioRoute.WiredHeadset)
                CallAudioRoute.WiredHeadset
            }

            CallAudioRoute.Bluetooth -> {
                manager.isSpeakerphoneOn = false
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (setCommunicationDevice(manager, CallAudioRoute.Bluetooth)) {
                        CallAudioRoute.Bluetooth
                    } else {
                        null
                    }
                } else {
                    startBluetoothSco(manager)
                    if (manager.isBluetoothScoOn || availableRoutes.contains(CallAudioRoute.Bluetooth)) {
                        CallAudioRoute.Bluetooth
                    } else {
                        null
                    }
                }
            }
        }
    }

    private fun mapCommunicationDeviceToRoute(device: AudioDeviceInfo): CallAudioRoute? {
        return when (device.type) {
            AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> CallAudioRoute.Speaker
            AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> CallAudioRoute.Earpiece
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_USB_HEADSET -> CallAudioRoute.WiredHeadset
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_BLE_HEADSET -> CallAudioRoute.Bluetooth
            else -> null
        }
    }

    private fun routeSortOrder(route: CallAudioRoute): Int {
        return when (route) {
            CallAudioRoute.Bluetooth -> 0
            CallAudioRoute.WiredHeadset -> 1
            CallAudioRoute.Earpiece -> 2
            CallAudioRoute.Speaker -> 3
        }
    }

    private fun requestAudioFocus(manager: AudioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setOnAudioFocusChangeListener(audioFocusChangeListener, mainHandler)
                .build()
            manager.requestAudioFocus(request)
            audioFocusRequest = request
        } else {
            @Suppress("DEPRECATION")
            manager.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            )
        }
    }

    private fun abandonAudioFocus(manager: AudioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = audioFocusRequest ?: return
            manager.abandonAudioFocusRequest(request)
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            manager.abandonAudioFocus(audioFocusChangeListener)
        }
    }

    private fun registerAudioDeviceCallback(manager: AudioManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        if (audioDeviceCallback != null) return

        val callback = object : AudioDeviceCallback() {
            override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
                mainHandler.post { refreshAudioRoute(reason = "devices-added") }
            }

            override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
                mainHandler.post { refreshAudioRoute(reason = "devices-removed") }
            }
        }
        audioDeviceCallback = callback
        manager.registerAudioDeviceCallback(callback, mainHandler)
    }

    private fun unregisterAudioDeviceCallback(manager: AudioManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val callback = audioDeviceCallback ?: return
        manager.unregisterAudioDeviceCallback(callback)
        audioDeviceCallback = null
    }

    private fun registerScoReceiver() {
        if (scoReceiverRegistered) return
        val filter = IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
        ContextCompat.registerReceiver(
            appContext,
            scoStateReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        scoReceiverRegistered = true
    }

    private fun unregisterScoReceiver() {
        if (!scoReceiverRegistered) return
        appContext.unregisterReceiver(scoStateReceiver)
        scoReceiverRegistered = false
    }

    private fun setCommunicationDevice(manager: AudioManager, route: CallAudioRoute): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false
        val target = manager.availableCommunicationDevices.firstOrNull { device ->
            mapCommunicationDeviceToRoute(device) == route
        } ?: return false
        return manager.setCommunicationDevice(target)
    }

    private fun clearCommunicationDevice(manager: AudioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            manager.clearCommunicationDevice()
        }
    }

    @Suppress("DEPRECATION")
    private fun startBluetoothSco(manager: AudioManager) {
        manager.startBluetoothSco()
        manager.isBluetoothScoOn = true
    }

    @Suppress("DEPRECATION")
    private fun stopBluetoothSco(manager: AudioManager) {
        manager.stopBluetoothSco()
        manager.isBluetoothScoOn = false
    }

    @Suppress("DEPRECATION")
    private fun updateProximityWakeLock(useEarpiece: Boolean) {
        if (!useEarpiece) {
            releaseProximityWakeLock()
            return
        }
        if (proximityWakeLock?.isHeld == true) return
        val manager = powerManager ?: return
        val wakeLock = runCatching {
            manager.newWakeLock(
                PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK,
                "${appContext.packageName}:call_audio_proximity"
            )
        }.getOrNull() ?: return
        wakeLock.acquire()
        proximityWakeLock = wakeLock
    }

    private fun releaseProximityWakeLock() {
        runCatching {
            if (proximityWakeLock?.isHeld == true) {
                proximityWakeLock?.release()
            }
        }
        proximityWakeLock = null
    }

    private fun ensureMainThread(step: String) {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "CallAudioRouteController must run on main thread: $step"
        }
    }
}
