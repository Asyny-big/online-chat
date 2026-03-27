package ru.govchat.app.core.update

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.appUpdateStore: DataStore<Preferences> by preferencesDataStore(
    name = "govchat_app_update"
)

class AppUpdateStorage(
    private val appContext: Context
) {
    private object Keys {
        val skippedVersionCode = longPreferencesKey("skipped_version_code")
        val activeDownloadId = longPreferencesKey("active_download_id")
        val activeDownloadVersionCode = longPreferencesKey("active_download_version_code")
        val activeDownloadPath = stringPreferencesKey("active_download_path")
        val pendingInstallVersionCode = longPreferencesKey("pending_install_version_code")
        val pendingInstallPath = stringPreferencesKey("pending_install_path")
    }

    suspend fun readSkippedVersionCode(): Long? {
        return data().map { it[Keys.skippedVersionCode] }.first()
    }

    suspend fun saveSkippedVersionCode(versionCode: Long) {
        appContext.appUpdateStore.edit { preferences ->
            preferences[Keys.skippedVersionCode] = versionCode
        }
    }

    suspend fun clearSkippedVersionCode() {
        appContext.appUpdateStore.edit { preferences ->
            preferences.remove(Keys.skippedVersionCode)
        }
    }

    suspend fun readActiveDownload(): PersistedAppUpdateDownload? {
        return data().map { preferences ->
            val downloadId = preferences[Keys.activeDownloadId] ?: return@map null
            val versionCode = preferences[Keys.activeDownloadVersionCode] ?: return@map null
            val apkPath = preferences[Keys.activeDownloadPath].orEmpty()
            if (apkPath.isBlank()) return@map null
            PersistedAppUpdateDownload(
                downloadId = downloadId,
                versionCode = versionCode,
                apkPath = apkPath
            )
        }.first()
    }

    suspend fun saveActiveDownload(downloadId: Long, versionCode: Long, apkPath: String) {
        appContext.appUpdateStore.edit { preferences ->
            preferences[Keys.activeDownloadId] = downloadId
            preferences[Keys.activeDownloadVersionCode] = versionCode
            preferences[Keys.activeDownloadPath] = apkPath
        }
    }

    suspend fun clearActiveDownload() {
        appContext.appUpdateStore.edit { preferences ->
            preferences.remove(Keys.activeDownloadId)
            preferences.remove(Keys.activeDownloadVersionCode)
            preferences.remove(Keys.activeDownloadPath)
        }
    }

    suspend fun readPendingInstall(): PersistedPendingInstall? {
        return data().map { preferences ->
            val versionCode = preferences[Keys.pendingInstallVersionCode] ?: return@map null
            val apkPath = preferences[Keys.pendingInstallPath].orEmpty()
            if (apkPath.isBlank()) return@map null
            PersistedPendingInstall(
                versionCode = versionCode,
                apkPath = apkPath
            )
        }.first()
    }

    suspend fun savePendingInstall(versionCode: Long, apkPath: String) {
        appContext.appUpdateStore.edit { preferences ->
            preferences[Keys.pendingInstallVersionCode] = versionCode
            preferences[Keys.pendingInstallPath] = apkPath
        }
    }

    suspend fun clearPendingInstall() {
        appContext.appUpdateStore.edit { preferences ->
            preferences.remove(Keys.pendingInstallVersionCode)
            preferences.remove(Keys.pendingInstallPath)
        }
    }

    private fun data() = appContext.appUpdateStore.data.catch { error ->
        if (error is IOException) {
            emit(emptyPreferences())
        } else {
            throw error
        }
    }
}
