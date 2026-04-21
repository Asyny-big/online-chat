package ru.govchat.app.tunnel

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.govchat.app.tunnel.core.InvisibleVpnService
import ru.govchat.app.tunnel.data.ServerManager
import ru.govchat.app.tunnel.network.NetworkStateTracker
import ru.govchat.app.tunnel.worker.ConfigUpdateWorker
import java.util.concurrent.TimeUnit

class TunnelManager private constructor(private val context: Context) {

    private val applicationContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val networkStateTracker = NetworkStateTracker(applicationContext)
    private val serverManager = ServerManager(applicationContext)
    
    private var isTracking = false
    private var isVpnRunning = false
    private var pendingTunnelStart = false
    private val _vpnPermissionRequired = MutableStateFlow(false)
    val vpnPermissionRequired: StateFlow<Boolean> = _vpnPermissionRequired

    companion object {
        private const val TAG = "TunnelManager"

        @Volatile
        private var instance: TunnelManager? = null

        fun getInstance(context: Context): TunnelManager {
            return instance ?: synchronized(this) {
                instance ?: TunnelManager(context).also { instance = it }
            }
        }
    }

    fun initialize() {
        if (isTracking) return
        isTracking = true

        Log.i(TAG, "Initializing TunnelManager...")
        
        networkStateTracker.startTracking()

        // Observe network state to decide whether to start or stop VPN
        networkStateTracker.isConnected
            .combine(networkStateTracker.isRestrictedNetwork) { isConnected, isRestricted ->
                Pair(isConnected, isRestricted)
            }
            .onEach { (isConnected, isRestricted) ->
                handleNetworkStateChange(isConnected, isRestricted)
            }
            .launchIn(scope)

        scheduleConfigUpdate()
    }

    private suspend fun handleNetworkStateChange(isConnected: Boolean, isRestricted: Boolean) {
        if (!isConnected) {
            Log.d(TAG, "No network connection. Stopping VPN if running.")
            stopTunnel()
            return
        }

        if (isRestricted) {
            Log.d(TAG, "Restricted network detected. Checking cache...")
            if (serverManager.hasCachedServers()) {
                Log.d(TAG, "Starting VPN tunnel.")
                startTunnel()
            } else {
                Log.e(TAG, "Restricted network, but no cached servers found! Cannot connect.")
                // TODO: Show UI notification here asking user to connect to Wi-Fi
            }
        } else {
            Log.d(TAG, "Unrestricted network detected.")
            if (!serverManager.hasCachedServers()) {
                Log.d(TAG, "First time on unrestricted network. Fetching config...")
                val success = serverManager.fetchAndCacheServers()
                if (success) {
                    Log.i(TAG, "Config fetched and cached successfully.")
                } else {
                    Log.e(TAG, "Failed to fetch initial config.")
                }
            }
            
            // If we are on unrestricted network, we might not need VPN.
            stopTunnel()
        }
    }

    private fun startTunnel() {
        if (isVpnRunning) return
        if (VpnService.prepare(applicationContext) != null) {
            pendingTunnelStart = true
            _vpnPermissionRequired.value = true
            Log.w(TAG, "VPN permission has not been granted yet")
            return
        }

        val intent = Intent(applicationContext, InvisibleVpnService::class.java).apply {
            action = InvisibleVpnService.ACTION_START
        }
        ContextCompat.startForegroundService(applicationContext, intent)
    }

    private fun stopTunnel() {
        if (!isVpnRunning) return
        val intent = Intent(applicationContext, InvisibleVpnService::class.java).apply {
            action = InvisibleVpnService.ACTION_STOP
        }
        ContextCompat.startForegroundService(applicationContext, intent)
    }
    
    fun restartTunnel() {
        stopTunnel()
        // Simple delay to ensure previous instance is cleaned up, in production use proper binding/callbacks
        scope.launch {
            kotlinx.coroutines.delay(1000)
            startTunnel()
        }
    }

    fun isTunnelActive() = isVpnRunning

    fun onVpnPermissionResult(granted: Boolean) {
        _vpnPermissionRequired.value = false
        val shouldStartTunnel = pendingTunnelStart
        pendingTunnelStart = false

        if (!granted) {
            Log.w(TAG, "VPN permission request was denied")
            return
        }

        if (shouldStartTunnel) {
            Log.i(TAG, "VPN permission granted. Resuming tunnel start.")
            startTunnel()
        }
    }

    fun markTunnelRunning(isRunning: Boolean) {
        isVpnRunning = isRunning
        if (isRunning) {
            pendingTunnelStart = false
            _vpnPermissionRequired.value = false
        }
    }

    private fun scheduleConfigUpdate() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodicWork = PeriodicWorkRequestBuilder<ConfigUpdateWorker>(12, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            ConfigUpdateWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodicWork
        )
    }
}
