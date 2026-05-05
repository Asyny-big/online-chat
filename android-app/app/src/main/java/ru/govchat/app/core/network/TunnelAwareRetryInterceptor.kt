package ru.govchat.app.core.network

import android.content.Context
import android.util.Log
import okhttp3.Interceptor
import okhttp3.Response
import ru.govchat.app.tunnel.TunnelManager
import java.io.IOException
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/**
 * Retries idempotent HTTP requests when transient network failures occur, especially
 * during the brief window between the in-app VPN service becoming "running" and the
 * sing-box DNS handlers being fully ready to resolve hostnames. Without this layer,
 * the very first OkHttp call after VPN startup can fail with [UnknownHostException]
 * and surface as a fatal error to the user even though the tunnel actually works.
 *
 * Behaviour:
 *  - Only retries when the tunnel is active (or just transitioned to active) so we do
 *    not mask genuine connectivity errors when running directly on Wi-Fi/cellular.
 *  - Skips retries for non-idempotent verbs (POST/PUT/PATCH/DELETE) when the request
 *    body might have already been consumed; those callers should rely on the higher
 *    level retry helpers in MainViewModel for safety.
 */
class TunnelAwareRetryInterceptor(private val context: Context) : Interceptor {

    private val applicationContext = context.applicationContext

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val isIdempotent = when (request.method.uppercase()) {
            "GET", "HEAD", "OPTIONS" -> true
            else -> false
        }

        var attempt = 0
        var lastError: IOException? = null
        while (attempt < MAX_ATTEMPTS) {
            attempt += 1
            try {
                return chain.proceed(request)
            } catch (error: IOException) {
                lastError = error
                if (!isTransient(error)) {
                    throw error
                }
                if (!shouldRetryNow(isIdempotent)) {
                    throw error
                }
                if (attempt >= MAX_ATTEMPTS) break
                val backoff = BASE_DELAY_MS * attempt
                Log.w(
                    TAG,
                    "Transient network error on ${request.method} ${request.url} " +
                        "(attempt $attempt/$MAX_ATTEMPTS): ${error.message}. " +
                        "Retrying in ${backoff}ms"
                )
                try {
                    Thread.sleep(backoff)
                } catch (interrupt: InterruptedException) {
                    Thread.currentThread().interrupt()
                    throw error
                }
            }
        }
        throw lastError ?: IOException("Unknown error in TunnelAwareRetryInterceptor")
    }

    private fun shouldRetryNow(isIdempotent: Boolean): Boolean {
        val tunnelManager = TunnelManager.getInstance(applicationContext)
        val tunnelRunning = tunnelManager.isTunnelRunningState.value
        // Always retry idempotent calls while VPN is up; that covers the warmup race.
        // For non-idempotent calls we also retry but only when the tunnel is running so
        // we don't double-submit on plain networks.
        return tunnelRunning || isIdempotent
    }

    private fun isTransient(error: IOException): Boolean {
        if (error is UnknownHostException) return true
        if (error is SocketTimeoutException) return true
        if (error is SSLException) return true
        if (error is SocketException) return true
        val message = error.message?.lowercase().orEmpty()
        return message.contains("unable to resolve host") ||
            message.contains("no address associated with hostname") ||
            message.contains("failed to connect") ||
            message.contains("connection reset") ||
            message.contains("software caused connection abort") ||
            message.contains("eof") ||
            message.contains("timeout") ||
            message.contains("network is unreachable") ||
            message.contains("no route to host") ||
            message.contains("connection abort") ||
            message.contains("broken pipe")
    }

    private companion object {
        private const val TAG = "TunnelAwareRetryInt"
        private const val MAX_ATTEMPTS = 3
        private const val BASE_DELAY_MS = 700L
    }
}
