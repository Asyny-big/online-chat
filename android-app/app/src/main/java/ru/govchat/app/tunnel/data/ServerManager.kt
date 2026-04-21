package ru.govchat.app.tunnel.data

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ServerManager(context: Context) {

    companion object {
        // Change this to your actual raw Github URL that returns the config
        private const val GITHUB_CONFIG_URL = "https://raw.githubusercontent.com/YourOrg/YourRepo/main/config_v1.json"
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
            val url = URL(GITHUB_CONFIG_URL)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.requestMethod = "GET"

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val responseString = connection.inputStream.bufferedReader().use { it.readText() }
                
                val responseJson = JSONObject(responseString)
                val base64Array = responseJson.getJSONArray("servers")
                
                val decodedServers = mutableListOf<String>()
                
                for (i in 0 until base64Array.length()) {
                    val base64String = base64Array.getString(i)
                    val decodedBytes = Base64.decode(base64String, Base64.DEFAULT)
                    decodedServers.add(String(decodedBytes, Charsets.UTF_8))
                }

                if (decodedServers.isNotEmpty()) {
                    val cacheJson = JSONObject().apply {
                        put("servers", decodedServers)
                    }
                    sharedPrefs.edit().putString(KEY_SERVERS, cacheJson.toString()).apply()
                    return@withContext true
                }
            }
            return@withContext false
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext false
        }
    }
    
    fun hasCachedServers(): Boolean {
        return sharedPrefs.contains(KEY_SERVERS)
    }
    
    fun clearCache() {
        sharedPrefs.edit().remove(KEY_SERVERS).apply()
    }
}
