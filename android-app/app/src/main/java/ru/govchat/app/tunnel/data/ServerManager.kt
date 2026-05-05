package ru.govchat.app.tunnel.data

import android.content.Context
import android.util.Base64
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import ru.govchat.app.BuildConfig
import java.net.HttpURLConnection
import java.net.URL

class ServerManager(context: Context) {

    companion object {
        private const val TAG = "ServerManager"
        private const val PREFS_NAME = "secure_tunnel_prefs"
        private const val KEY_SERVERS = "cached_vless_servers"
        private const val KEY_LAST_FETCH_ATTEMPT_AT = "last_fetch_attempt_at"
        private const val KEY_LAST_FETCH_SUCCESS_AT = "last_fetch_success_at"
        private const val KEY_LAST_FETCH_ERROR = "last_fetch_error"
        private const val KEY_LAST_FETCH_PARSED_COUNT = "last_fetch_parsed_count"
        private const val KEY_LAST_READ_ERROR = "last_read_error"
        private const val KEY_LAST_RESPONSE_SIZE = "last_response_size"
    }

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPrefs = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun getCachedServers(): List<String> {
        val serversString = sharedPrefs.getString(KEY_SERVERS, null) ?: return emptyList()
        return try {
            val jsonArray = JSONObject(serversString).getJSONArray("servers")
            val list = mutableListOf<String>()
            for (i in 0 until jsonArray.length()) {
                list.add(jsonArray.getString(i))
            }
            sharedPrefs.edit().remove(KEY_LAST_READ_ERROR).apply()
            list
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read cached VLESS servers", e)
            sharedPrefs.edit()
                .putString(KEY_LAST_READ_ERROR, e.message ?: e.javaClass.simpleName)
                .apply()
            emptyList()
        }
    }

    fun getCacheStats(): ServerCacheStats {
        return ServerCacheStats(
            cachedServerCount = getCachedServers().size,
            lastFetchAttemptAtMillis = sharedPrefs.getLong(KEY_LAST_FETCH_ATTEMPT_AT, 0L).takeIf { it > 0L },
            lastSuccessfulFetchAtMillis = sharedPrefs.getLong(KEY_LAST_FETCH_SUCCESS_AT, 0L).takeIf { it > 0L },
            lastFetchError = sharedPrefs.getString(KEY_LAST_FETCH_ERROR, null)?.takeIf { it.isNotBlank() },
            lastFetchParsedCount = sharedPrefs.getInt(KEY_LAST_FETCH_PARSED_COUNT, -1).takeIf { it >= 0 },
            lastReadError = sharedPrefs.getString(KEY_LAST_READ_ERROR, null)?.takeIf { it.isNotBlank() },
            lastResponseSizeBytes = sharedPrefs.getInt(KEY_LAST_RESPONSE_SIZE, -1).takeIf { it >= 0 },
            sourceUrl = BuildConfig.TUNNEL_CONFIG_URL
        )
    }

    suspend fun fetchAndCacheServers(): Boolean = withContext(Dispatchers.IO) {
        val sources = resolveConfigSources()
        if (sources.isEmpty()) {
            Log.e(TAG, "No TUNNEL_CONFIG_URLS configured")
            sharedPrefs.edit()
                .putLong(KEY_LAST_FETCH_ATTEMPT_AT, System.currentTimeMillis())
                .putString(KEY_LAST_FETCH_ERROR, "No TUNNEL_CONFIG_URLS configured")
                .apply()
            return@withContext false
        }

        // Deduplicate by full vless:// URI: collisions across mirrors are common
        // and we don't want URLTest to waste time stress-testing the same proxy
        // multiple times with slightly different cosmetic params.
        val merged = LinkedHashSet<String>()
        val perSourceLog = StringBuilder()
        var totalBytes = 0
        val sourceErrors = mutableListOf<String>()

        for (source in sources) {
            val (links, bytes, error) = fetchSingleSource(source)
            totalBytes += bytes
            if (error != null) {
                sourceErrors += "$source: $error"
                perSourceLog.append("$source -> ERROR ${error.take(80)}; ")
            } else {
                val before = merged.size
                merged.addAll(links)
                val added = merged.size - before
                perSourceLog.append("$source -> +$added (raw=${links.size}); ")
            }
        }

        if (merged.isEmpty()) {
            val existingCacheSize = getCachedServers().size
            val errorMessage = "All ${sources.size} VLESS config sources failed: ${sourceErrors.take(3).joinToString(" | ")}"
            if (existingCacheSize > 0) {
                // Refresh failed (likely the user is on a Russian carrier with
                // GitHub blocked and VPN not yet up), BUT we still have a valid
                // cache from a previous successful fetch. Keep the cache, do
                // NOT surface this as a fatal error to the UI — the user is
                // perfectly capable of running the tunnel from the existing
                // cache. Just record a non-blocking note in logcat and clear
                // the previously saved error so the UI doesn't keep showing
                // stale red banners.
                Log.w(
                    TAG,
                    "Background refresh failed but $existingCacheSize cached servers are still usable. Ignoring. cause=$errorMessage"
                )
                sharedPrefs.edit()
                    .putLong(KEY_LAST_FETCH_ATTEMPT_AT, System.currentTimeMillis())
                    .putInt(KEY_LAST_RESPONSE_SIZE, totalBytes)
                    .remove(KEY_LAST_FETCH_ERROR)
                    .apply()
                return@withContext false
            }
            // No cache AND no fetch: this is genuinely fatal, surface to UI.
            sharedPrefs.edit()
                .putLong(KEY_LAST_FETCH_ATTEMPT_AT, System.currentTimeMillis())
                .putString(KEY_LAST_FETCH_ERROR, errorMessage)
                .putInt(KEY_LAST_RESPONSE_SIZE, totalBytes)
                .apply()
            Log.e(TAG, errorMessage)
            return@withContext false
        }

        val decodedServers = merged.toList()
        val cacheJson = JSONObject().apply {
            put("servers", JSONArray(decodedServers))
        }
        sharedPrefs.edit()
            .putString(KEY_SERVERS, cacheJson.toString())
            .putLong(KEY_LAST_FETCH_ATTEMPT_AT, System.currentTimeMillis())
            .putLong(KEY_LAST_FETCH_SUCCESS_AT, System.currentTimeMillis())
            .putInt(KEY_LAST_FETCH_PARSED_COUNT, decodedServers.size)
            .putInt(KEY_LAST_RESPONSE_SIZE, totalBytes)
            .also { editor ->
                if (sourceErrors.isEmpty()) {
                    editor.remove(KEY_LAST_FETCH_ERROR)
                } else {
                    editor.putString(
                        KEY_LAST_FETCH_ERROR,
                        "Partial fetch ok: cached=${decodedServers.size}, failed sources=${sourceErrors.size}"
                    )
                }
                editor.remove(KEY_LAST_READ_ERROR)
            }
            .apply()
        Log.i(
            TAG,
            "Cached ${decodedServers.size} unique VLESS servers from ${sources.size} sources. Per-source: $perSourceLog"
        )
        return@withContext true
    }

    private fun resolveConfigSources(): List<String> {
        val multi = runCatching { BuildConfig.TUNNEL_CONFIG_URLS }.getOrNull().orEmpty()
        if (multi.isNotBlank()) {
            return multi.split('|', '\n', ';')
                .map { it.trim() }
                .filter { it.isNotBlank() && it.startsWith("http") }
                .distinct()
        }
        return listOfNotNull(BuildConfig.TUNNEL_CONFIG_URL.takeIf { it.isNotBlank() })
    }

    private fun fetchSingleSource(sourceUrl: String): SingleSourceResult {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(sourceUrl)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "text/plain, application/json")
            connection.setRequestProperty("User-Agent", "GovChat-Android/${BuildConfig.VERSION_NAME}")
            val code = connection.responseCode
            if (code != HttpURLConnection.HTTP_OK) {
                SingleSourceResult(emptyList(), 0, "HTTP $code")
            } else {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }
                val parsed = parseServersResponse(responseString)
                SingleSourceResult(parsed, responseString.length, null)
            }
        } catch (e: Exception) {
            SingleSourceResult(emptyList(), 0, e.message ?: e.javaClass.simpleName)
        } finally {
            connection?.disconnect()
        }
    }

    private data class SingleSourceResult(
        val links: List<String>,
        val responseSizeBytes: Int,
        val error: String?
    )
    
    fun hasCachedServers(): Boolean {
        return getCachedServers().isNotEmpty()
    }

    private fun parseServersResponse(responseString: String): List<String> {
        val trimmed = responseString.trim()
        if (trimmed.isEmpty()) return emptyList()

        return if (trimmed.startsWith("{")) {
            parseJsonServers(trimmed)
        } else {
            parsePlainTextServers(trimmed)
        }
    }

    private fun parseJsonServers(responseString: String): List<String> {
        val responseJson = JSONObject(responseString)
        val base64Array = responseJson.getJSONArray("servers")
        val decodedServers = mutableListOf<String>()

        for (i in 0 until base64Array.length()) {
            val base64String = base64Array.getString(i)
            val decodedBytes = Base64.decode(base64String, Base64.DEFAULT)
            val decoded = String(decodedBytes, Charsets.UTF_8).trim()
            if (decoded.startsWith("vless://")) {
                decodedServers.add(decoded)
            }
        }

        return decodedServers
    }

    private fun parsePlainTextServers(responseString: String): List<String> {
        return responseString
            .lineSequence()
            .map { it.removePrefix("\uFEFF").trim() }
            .filter { it.isNotEmpty() }
            .filterNot { it.startsWith("#") }
            .filter { it.lowercase().startsWith("vless://") }
            .distinct()
            .toList()
    }
    
    fun clearCache() {
        sharedPrefs.edit()
            .remove(KEY_SERVERS)
            .remove(KEY_LAST_FETCH_ATTEMPT_AT)
            .remove(KEY_LAST_FETCH_SUCCESS_AT)
            .remove(KEY_LAST_FETCH_ERROR)
            .remove(KEY_LAST_FETCH_PARSED_COUNT)
            .remove(KEY_LAST_READ_ERROR)
            .remove(KEY_LAST_RESPONSE_SIZE)
            .apply()
    }
}

data class ServerCacheStats(
    val cachedServerCount: Int,
    val lastFetchAttemptAtMillis: Long?,
    val lastSuccessfulFetchAtMillis: Long?,
    val lastFetchError: String?,
    val lastFetchParsedCount: Int?,
    val lastReadError: String?,
    val lastResponseSizeBytes: Int?,
    val sourceUrl: String
)
