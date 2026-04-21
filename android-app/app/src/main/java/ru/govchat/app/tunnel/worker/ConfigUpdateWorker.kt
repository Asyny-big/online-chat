package ru.govchat.app.tunnel.worker

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ru.govchat.app.tunnel.TunnelManager
import ru.govchat.app.tunnel.data.ServerManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ConfigUpdateWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val WORK_NAME = "VlessConfigUpdateWorker"
        private const val TAG = "ConfigUpdateWorker"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.i(TAG, "Starting config update via VPN...")
        
        val serverManager = ServerManager(applicationContext)
        val success = serverManager.fetchAndCacheServers()
        
        if (success) {
            Log.i(TAG, "Config updated successfully. Triggering tunnel reload.")
            // Restart the tunnel if it's currently running to apply new configs
            if (TunnelManager.getInstance(applicationContext).isTunnelActive()) {
                TunnelManager.getInstance(applicationContext).restartTunnel()
            }
            Result.success()
        } else {
            Log.e(TAG, "Failed to update config from Github")
            Result.retry()
        }
    }
}
