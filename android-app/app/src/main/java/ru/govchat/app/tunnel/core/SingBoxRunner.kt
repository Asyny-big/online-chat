package ru.govchat.app.tunnel.core

import android.content.Context
import android.os.Build
import android.util.Log
import libbox.BoxService
import libbox.Libbox
import libbox.PlatformInterface
import ru.govchat.app.BuildConfig
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class SingBoxRunner private constructor() {

    private var boxService: BoxService? = null
    private var stderrLogFile: File? = null
    private val initialized = AtomicBoolean(false)
    private val running = AtomicBoolean(false)

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

    fun initialize(context: Context) {
        if (initialized.get()) return

        synchronized(this) {
            if (initialized.get()) return

            val appContext = context.applicationContext
            val baseDir = appContext.filesDir.apply { mkdirs() }
            val workingDir = (appContext.getExternalFilesDir(null) ?: baseDir).apply { mkdirs() }
            val tempDir = appContext.cacheDir.apply { mkdirs() }
            val logDir = File(workingDir, "tunnel-logs").apply { mkdirs() }
            stderrLogFile = File(logDir, "sing-box-stderr.log")

            try {
                Libbox.setup(
                    baseDir.absolutePath,
                    workingDir.absolutePath,
                    tempDir.absolutePath,
                    false
                )
                stderrLogFile?.let { Libbox.redirectStderr(it.absolutePath) }

                initialized.set(true)
                Log.i(
                    TAG,
                    "libbox initialized. version=${runCatching { Libbox.version() }.getOrDefault("unknown")}, log=${stderrLogFile?.absolutePath}"
                )
            } catch (error: UnsatisfiedLinkError) {
                Log.e(
                    TAG,
                    "libbox JNI load failed. supportedAbis=${Build.SUPPORTED_ABIS.joinToString()}",
                    error
                )
                throw error
            } catch (error: Throwable) {
                Log.e(TAG, "Failed to initialize libbox", error)
                throw error
            }
        }
    }

    fun start(context: Context, configJson: String, platformInterface: PlatformInterface) {
        initialize(context)

        synchronized(this) {
            if (running.get()) {
                Log.w(TAG, "Sing-box is already running")
                return
            }

            try {
                Libbox.checkConfig(configJson)
                boxService = Libbox.newService(configJson, platformInterface).also { it.start() }
                running.set(true)
                Log.i(
                    TAG,
                    "Sing-box started. configLength=${configJson.length}, stderr=${stderrLogFile?.absolutePath}"
                )
            } catch (error: Throwable) {
                Log.e(TAG, "Critical error starting sing-box", error)
                stop()
                throw error
            }
        }
    }

    fun stop() {
        synchronized(this) {
            try {
                boxService?.close()
                Log.i(TAG, "Sing-box stopped")
            } catch (error: Throwable) {
                Log.e(TAG, "Error stopping sing-box", error)
            } finally {
                running.set(false)
                boxService = null
            }
        }
    }

    fun isRunning(): Boolean = running.get()

    fun stderrLogPath(): String? = stderrLogFile?.absolutePath

    fun logLevel(): String = if (BuildConfig.DEBUG) "debug" else "info"
}
