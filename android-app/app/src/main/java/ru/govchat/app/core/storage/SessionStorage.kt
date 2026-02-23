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
import org.json.JSONArray
import org.json.JSONObject
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.MessageAttachment
import ru.govchat.app.domain.model.MessageDeliveryStatus
import ru.govchat.app.domain.model.MessageType
import java.io.IOException

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "govchat_session"
)
private val Context.messagesCacheStore: DataStore<Preferences> by preferencesDataStore(
    name = "govchat_messages_cache"
)

class SessionStorage(
    private val appContext: Context,
    applicationScope: CoroutineScope
) {
    private object Keys {
        val jwtToken = stringPreferencesKey("jwt_token")
        val userId = stringPreferencesKey("user_id")
        val pendingFcmToken = stringPreferencesKey("pending_fcm_token")
        val currentFcmToken = stringPreferencesKey("current_fcm_token")
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

    suspend fun saveUserId(userId: String) {
        appContext.sessionDataStore.edit { preferences ->
            preferences[Keys.userId] = userId
        }
    }

    suspend fun getUserId(): String? {
        return appContext.sessionDataStore.data
            .map { it[Keys.userId] }
            .first()
    }

    suspend fun clearToken() {
        appContext.sessionDataStore.edit { preferences ->
            preferences.remove(Keys.jwtToken)
            preferences.remove(Keys.userId)
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

    suspend fun saveCurrentFcmToken(token: String) {
        appContext.sessionDataStore.edit { preferences ->
            preferences[Keys.currentFcmToken] = token
        }
    }

    suspend fun getCurrentFcmToken(): String? {
        return appContext.sessionDataStore.data
            .map { it[Keys.currentFcmToken] }
            .first()
    }
}

class ChatMessagesCacheStorage(
    private val appContext: Context
) {
    suspend fun readMessages(chatId: String): List<ChatMessage> {
        if (chatId.isBlank()) return emptyList()

        val key = messagesKey(chatId)
        val raw = appContext.messagesCacheStore.data
            .catch {
                if (it is IOException) {
                    emit(emptyPreferences())
                } else {
                    throw it
                }
            }
            .first()[key]
            ?: return emptyList()

        return decodeMessages(raw)
    }

    suspend fun saveMessages(chatId: String, messages: List<ChatMessage>, maxCount: Int = 100) {
        if (chatId.isBlank()) return

        val key = messagesKey(chatId)
        val payload = encodeMessages(messages.takeLast(maxCount))
        appContext.messagesCacheStore.edit { preferences ->
            preferences[key] = payload
        }
    }

    private fun messagesKey(chatId: String) = stringPreferencesKey("messages_$chatId")

    private fun encodeMessages(messages: List<ChatMessage>): String {
        val array = JSONArray()
        messages.forEach { message ->
            val item = JSONObject()
                .put("id", message.id)
                .put("chatId", message.chatId)
                .put("senderId", message.senderId)
                .put("senderName", message.senderName)
                .put("type", message.type.name)
                .put("text", message.text)
                .put("createdAtMillis", message.createdAtMillis)
                .put("deliveryStatus", message.deliveryStatus.name)
            val readByArray = JSONArray()
            message.readByUserIds.forEach { readByArray.put(it) }
            item.put("readByUserIds", readByArray)
            item.put("attachment", message.attachment?.toJson())
            array.put(item)
        }
        return array.toString()
    }

    private fun decodeMessages(raw: String): List<ChatMessage> {
        return runCatching {
            val array = JSONArray(raw)
            buildList(array.length()) {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    add(item.toChatMessageOrNull() ?: continue)
                }
            }
        }.getOrDefault(emptyList())
    }
}

private fun JSONObject.toChatMessageOrNull(): ChatMessage? {
    val id = optString("id").takeIf { it.isNotBlank() } ?: return null
    val chatId = optString("chatId").takeIf { it.isNotBlank() } ?: return null
    val type = optString("type").toMessageTypeOrDefault()
    val deliveryStatus = optString("deliveryStatus").toDeliveryStatusOrDefault()

    val readBy = LinkedHashSet<String>()
    val readByArray = optJSONArray("readByUserIds")
    if (readByArray != null) {
        for (idx in 0 until readByArray.length()) {
            val userId = readByArray.optString(idx)
            if (userId.isNotBlank()) readBy.add(userId)
        }
    }

    return ChatMessage(
        id = id,
        chatId = chatId,
        senderId = optString("senderId"),
        senderName = optString("senderName"),
        type = type,
        text = optString("text"),
        attachment = optJSONObject("attachment")?.toAttachment(),
        readByUserIds = readBy,
        createdAtMillis = optLong("createdAtMillis"),
        deliveryStatus = deliveryStatus
    )
}

private fun MessageAttachment.toJson(): JSONObject {
    return JSONObject()
        .put("url", url)
        .put("originalName", originalName)
        .put("mimeType", mimeType)
        .put("sizeBytes", sizeBytes)
}

private fun JSONObject.toAttachment(): MessageAttachment? {
    val url = optString("url").takeIf { it.isNotBlank() } ?: return null
    return MessageAttachment(
        url = url,
        originalName = optString("originalName"),
        mimeType = optString("mimeType").takeIf { it.isNotBlank() },
        sizeBytes = optLong("sizeBytes").takeIf { it > 0L }
    )
}

private fun String.toMessageTypeOrDefault(): MessageType {
    return runCatching { MessageType.valueOf(this) }.getOrDefault(MessageType.Text)
}

private fun String.toDeliveryStatusOrDefault(): MessageDeliveryStatus {
    return runCatching { MessageDeliveryStatus.valueOf(this) }.getOrDefault(MessageDeliveryStatus.Delivered)
}
