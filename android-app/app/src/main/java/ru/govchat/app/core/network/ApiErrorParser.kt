package ru.govchat.app.core.network

import org.json.JSONObject
import retrofit2.HttpException

fun HttpException.extractMessageField(): String? {
    return runCatching {
        val rawBody = response()?.errorBody()?.string().orEmpty()
        if (rawBody.isBlank()) {
            null
        } else {
            JSONObject(rawBody).optString("message").takeIf { it.isNotBlank() }
        }
    }.getOrNull()
}
