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
        var connection: HttpURLConnection? = null
        try {
            require(BuildConfig.TUNNEL_CONFIG_URL.isNotBlank()) {
                "BuildConfig.TUNNEL_CONFIG_URL is blank"
            }

            val url = URL(BuildConfig.TUNNEL_CONFIG_URL)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "text/plain, application/json")
            connection.setRequestProperty("User-Agent", "GovChat-Android/${BuildConfig.VERSION_NAME}")

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }

                val decodedServers = parseServersResponse(responseString)

                if (decodedServers.isNotEmpty()) {
                    val cacheJson = JSONObject().apply {
                        put("servers", JSONArray(decodedServers))
                    }
                    sharedPrefs.edit()
                        .putString(KEY_SERVERS, cacheJson.toString())
                        .putLong(KEY_LAST_FETCH_ATTEMPT_AT, System.currentTimeMillis())
                        .putLong(KEY_LAST_FETCH_SUCCESS_AT, System.currentTimeMillis())
                        .putInt(KEY_LAST_FETCH_PARSED_COUNT, decodedServers.size)
                        .putInt(KEY_LAST_RESPONSE_SIZE, responseString.length)
                        .remove(KEY_LAST_FETCH_ERROR)
                        .remove(KEY_LAST_READ_ERROR)
                        .apply()
                    Log.i(TAG, "Cached ${decodedServers.size} VLESS servers from ${BuildConfig.TUNNEL_CONFIG_URL}")
                    return@withContext true
                }
            }
            val errorMessage = "Config fetch failed. responseCode=${connection.responseCode}"
            sharedPrefs.edit()
                .putLong(KEY_LAST_FETCH_ATTEMPT_AT, System.currentTimeMillis())
                .putString(KEY_LAST_FETCH_ERROR, errorMessage)
                .putInt(KEY_LAST_RESPONSE_SIZE, 0)
                .apply()
            Log.e(TAG, errorMessage)
            return@withContext false
        } catch (e: Exception) {
            sharedPrefs.edit()
                .putLong(KEY_LAST_FETCH_ATTEMPT_AT, System.currentTimeMillis())
                .putString(KEY_LAST_FETCH_ERROR, e.message ?: e.javaClass.simpleName)
                .putInt(KEY_LAST_RESPONSE_SIZE, 0)
                .apply()
            Log.e(TAG, "Failed to fetch server config", e)
            return@withContext false
        } finally {
            connection?.disconnect()
        }
    }
    
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
