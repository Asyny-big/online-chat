package ru.govchat.app.core.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.io.IOException

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "govchat_session"
)

class SessionStorage(
    private val appContext: Context,
    applicationScope: CoroutineScope
) {
    private object Keys {
        val jwtToken = stringPreferencesKey("jwt_token")
        val pendingFcmToken = stringPreferencesKey("pending_fcm_token")
    }

    private val tokenState = MutableStateFlow<String?>(null)

    val tokenFlow = appContext.sessionDataStore.data
        .catch {
            if (it is IOException) {
                emit(emptyPreferences())
            } else {
                throw it
            }
        }
        .map { it[Keys.jwtToken] }
        .distinctUntilChanged()

    init {
        applicationScope.launch {
            tokenFlow.collect { tokenState.value = it }
        }
    }

    fun currentToken(): String? = tokenState.value

    suspend fun awaitToken(): String? = tokenFlow.first()

    suspend fun saveToken(token: String) {
        appContext.sessionDataStore.edit { preferences ->
            preferences[Keys.jwtToken] = token
        }
    }

    suspend fun clearToken() {
        appContext.sessionDataStore.edit { preferences ->
            preferences.remove(Keys.jwtToken)
        }
    }

    suspend fun savePendingFcmToken(token: String) {
        appContext.sessionDataStore.edit { preferences ->
            preferences[Keys.pendingFcmToken] = token
        }
    }

    suspend fun getPendingFcmToken(): String? {
        return appContext.sessionDataStore.data
            .map { it[Keys.pendingFcmToken] }
            .first()
    }

    suspend fun clearPendingFcmToken() {
        appContext.sessionDataStore.edit { preferences ->
            preferences.remove(Keys.pendingFcmToken)
        }
    }
}
