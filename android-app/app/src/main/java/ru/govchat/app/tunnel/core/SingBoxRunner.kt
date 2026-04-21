package ru.govchat.app.tunnel.core

import android.util.Log

// NOTE: You will need to import libbox.aar and then replace these dummy implementations
// import io.nekohasekai.libbox.BoxService
// import io.nekohasekai.libbox.Libbox

class SingBoxRunner private constructor() {

    // private var boxService: BoxService? = null
    private var isRunningVar = false

    companion object {
        private const val TAG = "SingBoxRunner"
        @Volatile
        private var instance: SingBoxRunner? = null

        fun getInstance(): SingBoxRunner {
            return instance ?: synchronized(this) {
                instance ?: SingBoxRunner().also { instance = it }
            }
        }
    }

    fun start(fdInt: Int, configJson: String) {
        if (isRunningVar) {
            Log.w(TAG, "Sing-box is already running!")
            return
        }

        try {
            Log.d(TAG, "Starting sing-box with config length: ${configJson.length}")
            
            // TODO: Uncomment when libbox.aar is added
            // Libbox.setupEnvironment()
            // boxService = Libbox.newService(configJson)
            // boxService?.start()
            
            isRunningVar = true
            Log.i(TAG, "Sing-box started successfully!")

        } catch (e: Exception) {
            Log.e(TAG, "Critical error starting sing-box", e)
            stop()
        }
    }

    fun stop() {
        try {
            // TODO: Uncomment when libbox.aar is added
            // boxService?.close()
            Log.i(TAG, "Sing-box stopped.")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping sing-box", e)
        } finally {
            isRunningVar = false
            // boxService = null
        }
    }
    
    fun isRunning(): Boolean = isRunningVar
}
