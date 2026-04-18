package ru.govchat.app.ui.screens.main

private val MESSAGE_LINK_REGEX = Regex(
    pattern = """(?i)https?://[^\s<>()]+|(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:/[^\s<>()]*)?"""
)

private val TRAILING_PUNCTUATION = setOf('.', ',', '!', '?', ':', ';', ')', ']', '}', '"', '\'', '»')

data class MessageTextPart(
    val text: String,
    val url: String? = null
)

fun parseMessageTextParts(text: String?): List<MessageTextPart> {
    val source = text.orEmpty()
    if (source.isEmpty()) return emptyList()

    val parts = mutableListOf<MessageTextPart>()
    var lastIndex = 0

    MESSAGE_LINK_REGEX.findAll(source).forEach { match ->
        val rawMatch = match.value
        val startIndex = match.range.first
        if (startIndex < lastIndex) return@forEach

        val previousChar = source.getOrNull(startIndex - 1)
        if (previousChar == '@') return@forEach

        val visibleText = trimTrailingPunctuation(rawMatch)
        if (visibleText.isEmpty()) return@forEach

        val visibleEnd = startIndex + visibleText.length
        if (startIndex > lastIndex) {
            parts += MessageTextPart(text = source.substring(lastIndex, startIndex))
        }

        parts += MessageTextPart(
            text = visibleText,
            url = normalizeLinkUrl(visibleText)
        )
        lastIndex = visibleEnd
    }

    if (lastIndex < source.length) {
        parts += MessageTextPart(text = source.substring(lastIndex))
    }

    return if (parts.isEmpty()) {
        listOf(MessageTextPart(text = source))
    } else {
        parts
    }
}

private fun trimTrailingPunctuation(value: String): String {
    var endIndex = value.length
    while (endIndex > 0 && value[endIndex - 1] in TRAILING_PUNCTUATION) {
        endIndex -= 1
    }
    return value.substring(0, endIndex)
}

private fun normalizeLinkUrl(value: String): String {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return ""
    return if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        trimmed
    } else {
        "https://$trimmed"
    }
}
