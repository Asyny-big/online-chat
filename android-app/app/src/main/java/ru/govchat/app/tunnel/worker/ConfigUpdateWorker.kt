package ru.govchat.app.tunnel.worker

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.govchat.app.tunnel.TunnelManager
import ru.govchat.app.tunnel.data.ServerManager

class ConfigUpdateWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val WORK_NAME = "VlessConfigUpdateWorker"
        private const val TAG = "ConfigUpdateWorker"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val tunnelManager = TunnelManager.getInstance(applicationContext)

        if (!canFetchConfigNow(tunnelManager)) {
            Log.i(TAG, "Skipping config update: Wi-Fi or active GovChat VPN is required.")
            return@withContext Result.success()
        }

        Log.i(TAG, "Starting config update via allowed network path...")
        
        val serverManager = ServerManager(applicationContext)
        val success = serverManager.fetchAndCacheServers()
        
        if (success) {
            Log.i(TAG, "Config updated successfully. Triggering tunnel reload.")
            // Restart the tunnel if it's currently running to apply new configs
            if (tunnelManager.isTunnelActive()) {
                tunnelManager.restartTunnel()
            }
            Result.success()
        } else {
            Log.e(TAG, "Failed to update config from Github")
            Result.retry()
        }
    }

    private fun canFetchConfigNow(tunnelManager: TunnelManager): Boolean {
        if (tunnelManager.isTunnelActive()) return true

        val connectivityManager =
            applicationContext.getSystemService(ConnectivityManager::class.java) ?: return false
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false

        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }
}
