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
        start(context, configJson, platformInterface, validateConfig = true)
    }

    fun validateConfig(context: Context, configJson: String) {
        initialize(context)
        Log.i(TAG, "Checking sing-box config. configLength=${configJson.length}")
        Libbox.checkConfig(configJson)
    }

    fun start(
        context: Context,
        configJson: String,
        platformInterface: PlatformInterface,
        validateConfig: Boolean
    ) {
        initialize(context)

        val service = synchronized(this) {
            if (running.get()) {
                Log.w(TAG, "Sing-box is already running")
                return
            }

            try {
                if (validateConfig) {
                    Log.i(TAG, "Checking sing-box config. configLength=${configJson.length}")
                    Libbox.checkConfig(configJson)
                }
                Log.i(TAG, "Creating sing-box service")
                val preparedService = Libbox.newService(configJson, platformInterface)
                boxService = preparedService
                running.set(true)
                preparedService
            } catch (error: Throwable) {
                running.set(false)
                boxService = null
                Log.e(TAG, "Critical error preparing sing-box", error)
                throw error
            }
        }

        try {
            Log.i(TAG, "Starting sing-box service")
            service.start()
            Log.i(
                TAG,
                "Sing-box start returned. configLength=${configJson.length}, stderr=${stderrLogFile?.absolutePath}"
            )
        } catch (error: Throwable) {
            Log.e(TAG, "Critical error starting sing-box", error)
            synchronized(this) {
                if (boxService === service) {
                    running.set(false)
                    boxService = null
                }
            }
            runCatching { service.close() }
                .onFailure { closeError -> Log.e(TAG, "Error closing sing-box after start failure", closeError) }
            throw error
        }
    }

    fun stop() {
        val serviceToClose = synchronized(this) {
            val service = boxService
            running.set(false)
            boxService = null
            service
        }

        try {
            serviceToClose?.close()
            Log.i(TAG, "Sing-box stopped")
        } catch (error: Throwable) {
            Log.e(TAG, "Error stopping sing-box", error)
        }
    }

    fun stderrLogTail(maxChars: Int = 4000): String? {
        val file = stderrLogFile ?: return null
        return runCatching {
            if (!file.exists() || file.length() <= 0L) return@runCatching null
            file.inputStream().use { input ->
                val skipBytes = (file.length() - maxChars).coerceAtLeast(0L)
                if (skipBytes > 0L) {
                    input.skip(skipBytes)
                }
                input.bufferedReader().use { it.readText().trim().takeIf(String::isNotBlank) }
            }
        }.onFailure { error ->
            Log.e(TAG, "Failed to read sing-box stderr tail", error)
        }.getOrNull()
    }

    fun isRunning(): Boolean = running.get()

    fun stderrLogPath(): String? = stderrLogFile?.absolutePath

    fun logLevel(): String = if (BuildConfig.DEBUG) "debug" else "info"
}
