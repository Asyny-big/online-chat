package ru.govchat.app.tunnel.data

import android.content.Context
import android.util.Base64
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import ru.govchat.app.BuildConfig
import java.net.HttpURLConnection
import java.net.URL

class ServerManager(context: Context) {

    companion object {
        private const val TAG = "ServerManager"
        private const val PREFS_NAME = "secure_tunnel_prefs"
        private const val KEY_SERVERS = "cached_vless_servers"
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
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun fetchAndCacheServers(): Boolean = withContext(Dispatchers.IO) {
        try {
            require(BuildConfig.TUNNEL_CONFIG_URL.isNotBlank()) {
                "BuildConfig.TUNNEL_CONFIG_URL is blank"
            }

            val url = URL(BuildConfig.TUNNEL_CONFIG_URL)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "GovChat-Android/${BuildConfig.VERSION_NAME}")

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }

                val decodedServers = parseServersResponse(responseString)

                if (decodedServers.isNotEmpty()) {
                    val cacheJson = JSONObject().apply {
                        put("servers", decodedServers)
                    }
                    sharedPrefs.edit().putString(KEY_SERVERS, cacheJson.toString()).apply()
                    Log.i(TAG, "Cached ${decodedServers.size} VLESS servers from ${BuildConfig.TUNNEL_CONFIG_URL}")
                    return@withContext true
                }
            }
            Log.e(TAG, "Config fetch failed. responseCode=${connection.responseCode}")
            return@withContext false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch server config", e)
            return@withContext false
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
            .map(String::trim)
            .filter { it.isNotEmpty() }
            .filterNot { it.startsWith("#") }
            .filter { it.startsWith("vless://") }
            .distinct()
            .toList()
    }
    
    fun clearCache() {
        sharedPrefs.edit().remove(KEY_SERVERS).apply()
    }
}
