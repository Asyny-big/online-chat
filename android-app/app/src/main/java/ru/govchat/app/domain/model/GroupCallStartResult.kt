package ru.govchat.app.domain.model

data class GroupCallStartResult(
    val callId: String,
    val type: String,
    val alreadyActive: Boolean
)
