package ru.govchat.app.core.network

import org.json.JSONObject
import retrofit2.HttpException

data class ApiErrorInfo(
    val message: String?,
    val code: String?
)

fun HttpException.extractMessageField(): String? {
    return extractApiErrorInfo().message
}

fun HttpException.extractApiErrorInfo(): ApiErrorInfo {
    return runCatching {
        val rawBody = response()?.errorBody()?.string().orEmpty()
        if (rawBody.isBlank()) {
            ApiErrorInfo(
                message = null,
                code = null
            )
        } else {
            val json = JSONObject(rawBody)
            ApiErrorInfo(
                message = json.optString("message")
                    .takeIf { it.isNotBlank() }
                    ?: json.optString("error").takeIf { it.isNotBlank() },
                code = json.optString("code").takeIf { it.isNotBlank() }
            )
        }
    }.getOrDefault(ApiErrorInfo(message = null, code = null))
}
