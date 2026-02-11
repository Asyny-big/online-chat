package ru.govchat.app.core.network

import io.socket.client.IO
import io.socket.client.Ack
import io.socket.client.Socket
import io.socket.engineio.client.transports.Polling
import io.socket.engineio.client.transports.WebSocket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONArray
import org.json.JSONObject
import ru.govchat.app.domain.model.CallJoinParticipant
import ru.govchat.app.domain.model.CallSignalPayload
import ru.govchat.app.domain.model.ChatMessage
import ru.govchat.app.domain.model.RealtimeEvent
import kotlin.coroutines.resume

class SocketGateway(
    private val baseUrl: String,
    private val applicationScope: CoroutineScope
) {
    private val mutableEvents = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 64)
    val events: Flow<RealtimeEvent> = mutableEvents.asSharedFlow()

    private var socket: Socket? = null
    private var connectedToken: String? = null
    private val joinedChats = LinkedHashSet<String>()

    fun connect(token: String) {
        val currentSocket = socket
        if (currentSocket?.connected() == true && connectedToken == token) return

        disconnect()

        val options = IO.Options.builder()
            .setTransports(arrayOf(WebSocket.NAME, Polling.NAME))
            .setReconnection(true)
            .setAuth(mapOf("token" to token))
            .build()

        val nextSocket = IO.socket(baseUrl, options)
        bindListeners(nextSocket)
        nextSocket.connect()

        socket = nextSocket
        connectedToken = token
        joinedChats.clear()
    }

    fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
        connectedToken = null
        joinedChats.clear()
    }

    private fun bindListeners(socket: Socket) {
        socket.on(Socket.EVENT_CONNECT) {
            emit(RealtimeEvent.SocketConnected)
        }

        socket.on(Socket.EVENT_DISCONNECT) {
            emit(RealtimeEvent.SocketDisconnected)
        }

        socket.on("user:status") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            emit(
                RealtimeEvent.UserStatusChanged(
                    userId = payload.optString("userId"),
                    status = payload.optString("status")
                )
            )
        }

        socket.on("message:new") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val chatId = payload.optString("chatId")
            val messageJson = payload.optJSONObject("message") ?: payload
            val message = messageJson.toSocketMessage(chatIdHint = chatId) ?: return@on
            emit(
                RealtimeEvent.MessageCreated(
                    chatId = chatId.ifBlank { message.chatId },
                    message = message
                )
            )
        }

        socket.on("messages:read") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            emit(payload.toMessagesReadEvent() ?: return@on)
        }

        socket.on("message:read") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            emit(payload.toMessagesReadEvent() ?: return@on)
        }

        socket.on("typing:update") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val chatId = payload.optString("chatId")
            val userId = payload.optString("userId")
            if (chatId.isBlank() || userId.isBlank()) return@on

            emit(
                RealtimeEvent.TypingUpdated(
                    chatId = chatId,
                    userId = userId,
                    userName = payload.optString("userName"),
                    isTyping = payload.optBoolean("isTyping")
                )
            )
        }

        socket.on("chat:new") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val chat = payload.toSocketChatPreview() ?: return@on
            emit(RealtimeEvent.ChatCreated(chat))
        }

        socket.on("chat:deleted") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val chatId = payload.optString("chatId")
            if (chatId.isBlank()) return@on
            emit(RealtimeEvent.ChatDeleted(chatId = chatId))
        }

        socket.on("message:deleted") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val chatId = payload.optString("chatId")
            val messageId = payload.optString("messageId")
            if (chatId.isBlank() || messageId.isBlank()) return@on
            emit(RealtimeEvent.MessageDeleted(chatId = chatId, messageId = messageId))
        }

        socket.on("call:incoming") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val initiator = payload.optJSONObject("initiator")
            emit(
                RealtimeEvent.IncomingCall(
                    callId = payload.optString("callId"),
                    chatId = payload.optString("chatId"),
                    chatName = payload.optString("chatName"),
                    type = payload.optString("type"),
                    initiatorId = initiator?.optString("_id").orEmpty(),
                    initiatorName = initiator?.optString("name").orEmpty(),
                    initiatorAvatarUrl = initiator?.optString("avatarUrl")?.takeIf { it.isNotBlank() },
                    isGroup = false
                )
            )
        }

        socket.on("call:participant_joined") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val callId = payload.optString("callId")
            val userId = payload.optString("userId")
            if (callId.isBlank() || userId.isBlank()) return@on
            emit(
                RealtimeEvent.CallParticipantJoined(
                    callId = callId,
                    userId = userId,
                    userName = payload.optString("userName")
                )
            )
        }

        socket.on("call:participant_left") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val callId = payload.optString("callId")
            val userId = payload.optString("userId")
            if (callId.isBlank() || userId.isBlank()) return@on
            emit(
                RealtimeEvent.CallParticipantLeft(
                    callId = callId,
                    userId = userId,
                    callEnded = payload.optBoolean("callEnded")
                )
            )
        }

        socket.on("call:ended") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val callId = payload.optString("callId")
            if (callId.isBlank()) return@on
            emit(
                RealtimeEvent.CallEnded(
                    callId = callId,
                    reason = payload.optString("reason")
                )
            )
        }

        socket.on("group-call:incoming") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val initiator = payload.optJSONObject("initiator")
            emit(
                RealtimeEvent.IncomingCall(
                    callId = payload.optString("callId"),
                    chatId = payload.optString("chatId"),
                    chatName = payload.optString("chatName"),
                    type = payload.optString("type"),
                    initiatorId = initiator?.optString("_id").orEmpty(),
                    initiatorName = initiator?.optString("name").orEmpty(),
                    initiatorAvatarUrl = initiator?.optString("avatarUrl")?.takeIf { it.isNotBlank() },
                    isGroup = true,
                    participantCount = payload.optInt("participantCount")
                )
            )
        }

        socket.on("group-call:started") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val callId = payload.optString("callId")
            val chatId = payload.optString("chatId")
            if (callId.isBlank() || chatId.isBlank()) return@on
            emit(
                RealtimeEvent.GroupCallStarted(
                    callId = callId,
                    chatId = chatId,
                    type = payload.optString("type"),
                    participantCount = payload.optInt("participantCount")
                )
            )
        }

        socket.on("group-call:updated") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val callId = payload.optString("callId")
            val chatId = payload.optString("chatId")
            if (callId.isBlank() || chatId.isBlank()) return@on
            emit(
                RealtimeEvent.GroupCallUpdated(
                    callId = callId,
                    chatId = chatId,
                    participantCount = payload.optInt("participantCount")
                )
            )
        }

        socket.on("group-call:ended") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val callId = payload.optString("callId")
            val chatId = payload.optString("chatId")
            if (callId.isBlank() || chatId.isBlank()) return@on
            emit(
                RealtimeEvent.GroupCallEnded(
                    callId = callId,
                    chatId = chatId,
                    reason = payload.optString("reason")
                )
            )
        }

        socket.on("call:signal") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val callId = payload.optString("callId")
            val fromUserId = payload.optString("fromUserId")
            val signalJson = payload.optJSONObject("signal") ?: return@on
            if (callId.isBlank() || fromUserId.isBlank()) return@on

            val signal = when (signalJson.optString("type")) {
                "offer" -> CallSignalPayload.Offer(signalJson.optString("sdp"))
                "answer" -> CallSignalPayload.Answer(signalJson.optString("sdp"))
                "ice-candidate" -> {
                    val candidate = signalJson.optJSONObject("candidate")
                    CallSignalPayload.IceCandidate(
                        candidate = candidate?.optString("candidate").orEmpty(),
                        sdpMid = candidate?.optString("sdpMid")?.takeIf { it.isNotBlank() },
                        sdpMLineIndex = candidate?.optInt("sdpMLineIndex") ?: 0
                    )
                }
                "video-mode" -> CallSignalPayload.VideoMode(signalJson.optString("mode"))
                else -> CallSignalPayload.Unknown(signalJson.optString("type"))
            }

            emit(
                RealtimeEvent.CallSignalReceived(
                    callId = callId,
                    fromUserId = fromUserId,
                    signal = signal
                )
            )
        }
    }

    suspend fun sendTextMessage(chatId: String, text: String): Result<ChatMessage> {
        return sendMessage(
            chatId = chatId,
            type = "text",
            text = text,
            attachment = null
        )
    }

    suspend fun sendAttachmentMessage(
        chatId: String,
        type: String,
        attachment: JSONObject
    ): Result<ChatMessage> {
        return sendMessage(
            chatId = chatId,
            type = type,
            text = "",
            attachment = attachment
        )
    }

    fun startTyping(chatId: String) {
        val payload = JSONObject().put("chatId", chatId)
        socket?.emit("typing:start", payload)
    }

    fun stopTyping(chatId: String) {
        val payload = JSONObject().put("chatId", chatId)
        socket?.emit("typing:stop", payload)
    }

    suspend fun markMessagesRead(chatId: String, messageIds: List<String>) {
        val uniqueIds = messageIds.distinct().filter { it.isNotBlank() }
        if (uniqueIds.isEmpty()) return

        val payload = JSONObject()
            .put("chatId", chatId)
            .put("messageIds", JSONArray(uniqueIds))

        socket?.emit("messages:read", payload)
    }

    suspend fun joinChat(chatId: String) {
        if (chatId.isBlank()) return
        if (joinedChats.contains(chatId)) return
        val payload = JSONObject().put("chatId", chatId)
        socket?.emit("chat:join", payload)
        joinedChats.add(chatId)
    }

    suspend fun startCall(chatId: String, type: String): Result<String> {
        val payload = JSONObject()
            .put("chatId", chatId)
            .put("type", type)
        return emitWithAck("call:start", payload)
            .mapCatching { response ->
                response.optString("callId").takeIf { it.isNotBlank() }
                    ?: throw IllegalStateException("Server did not return callId")
            }
    }

    suspend fun startGroupCall(chatId: String, type: String): Result<String> {
        val payload = JSONObject()
            .put("chatId", chatId)
            .put("type", type)
        return emitWithAck("group-call:start", payload)
            .mapCatching { response ->
                response.optString("callId").takeIf { it.isNotBlank() }
                    ?: throw IllegalStateException("Server did not return group callId")
            }
    }

    suspend fun acceptCall(callId: String): Result<Unit> {
        val payload = JSONObject().put("callId", callId)
        return emitWithAck("call:accept", payload).map { Unit }
    }

    suspend fun leaveCall(callId: String): Result<Unit> {
        val payload = JSONObject().put("callId", callId)
        return emitWithAck("call:leave", payload).map { Unit }
    }

    suspend fun declineCall(callId: String): Result<Unit> {
        val payload = JSONObject().put("callId", callId)
        socket?.emit("call:decline", payload)
        return Result.success(Unit)
    }

    suspend fun joinGroupCall(chatId: String, callId: String): Result<List<CallJoinParticipant>> {
        val payload = JSONObject()
            .put("chatId", chatId)
            .put("callId", callId)
        return emitWithAck("group-call:join", payload)
            .mapCatching { response ->
                val participants = response.optJSONArray("participants") ?: JSONArray()
                buildList {
                    for (index in 0 until participants.length()) {
                        val item = participants.optJSONObject(index) ?: continue
                        val userId = item.optString("userId")
                            .ifBlank { item.optString("oderId") }
                            .ifBlank { item.optString("_id") }
                            .ifBlank { item.optString("id") }
                            .ifBlank {
                                item.optJSONObject("user")?.optString("_id")
                                    ?.takeIf { nested -> nested.isNotBlank() }
                                    .orEmpty()
                            }
                        if (userId.isBlank()) continue
                        add(
                            CallJoinParticipant(
                                userId = userId,
                                userName = item.optString("userName")
                            )
                        )
                    }
                }
            }
    }

    suspend fun leaveGroupCall(callId: String): Result<Unit> {
        val payload = JSONObject().put("callId", callId)
        return emitWithAck("group-call:leave", payload).map { Unit }
    }

    fun sendCallSignal(callId: String, targetUserId: String, signal: CallSignalPayload) {
        val signalPayload = when (signal) {
            is CallSignalPayload.Offer -> JSONObject()
                .put("type", "offer")
                .put("sdp", signal.sdp)
            is CallSignalPayload.Answer -> JSONObject()
                .put("type", "answer")
                .put("sdp", signal.sdp)
            is CallSignalPayload.IceCandidate -> JSONObject()
                .put("type", "ice-candidate")
                .put(
                    "candidate",
                    JSONObject()
                        .put("candidate", signal.candidate)
                        .put("sdpMid", signal.sdpMid)
                        .put("sdpMLineIndex", signal.sdpMLineIndex)
                )
            is CallSignalPayload.VideoMode -> JSONObject()
                .put("type", "video-mode")
                .put("mode", signal.mode)
            is CallSignalPayload.Unknown -> JSONObject()
                .put("type", signal.type)
        }

        val payload = JSONObject()
            .put("callId", callId)
            .put("targetUserId", targetUserId)
            .put("signal", signalPayload)
        socket?.emit("call:signal", payload)
    }

    private suspend fun sendMessage(
        chatId: String,
        type: String,
        text: String,
        attachment: JSONObject?
    ): Result<ChatMessage> {
        return suspendCancellableCoroutine { continuation ->
            val activeSocket = socket
            if (activeSocket == null || !activeSocket.connected()) {
                continuation.resume(Result.failure(IllegalStateException("Socket disconnected")))
                return@suspendCancellableCoroutine
            }

            val timeoutJob = applicationScope.launch {
                delay(SEND_ACK_TIMEOUT_MS)
                if (continuation.isActive) {
                    continuation.resume(Result.failure(IllegalStateException("Таймаут отправки сообщения")))
                }
            }
            continuation.invokeOnCancellation {
                timeoutJob.cancel()
            }

            val payload = JSONObject()
                .put("chatId", chatId)
                .put("type", type)
                .put("text", text)

            if (attachment != null) {
                payload.put("attachment", attachment)
            }

            activeSocket.emit("message:send", payload, Ack { args ->
                val result = args.firstOrNull() as? JSONObject
                val success = result?.optBoolean("success") == true
                if (!success) {
                    if (continuation.isActive) {
                        timeoutJob.cancel()
                        continuation.resume(
                        Result.failure(
                            IllegalStateException(
                                result?.optString("error").orEmpty().ifBlank { "Ошибка отправки" }
                            )
                        )
                    )
                    }
                    return@Ack
                }

                val messageJson = result.optJSONObject("message")
                val message = messageJson?.toSocketMessage(chatIdHint = chatId)
                if (message == null) {
                    if (continuation.isActive) {
                        timeoutJob.cancel()
                        continuation.resume(Result.failure(IllegalStateException("Некорректный ответ сервера")))
                    }
                } else {
                    if (continuation.isActive) {
                        timeoutJob.cancel()
                        continuation.resume(Result.success(message))
                    }
                }
            })
        }
    }

    private fun JSONObject.toMessagesReadEvent(): RealtimeEvent.MessagesRead? {
        val chatId = optString("chatId")
        val userId = optString("userId")
        if (chatId.isBlank() || userId.isBlank()) return null

        val ids = mutableListOf<String>()
        val array = optJSONArray("messageIds")
        if (array != null) {
            for (index in 0 until array.length()) {
                val id = array.optString(index)
                if (id.isNotBlank()) ids.add(id)
            }
        }

        return RealtimeEvent.MessagesRead(
            chatId = chatId,
            userId = userId,
            messageIds = ids
        )
    }

    private fun emit(event: RealtimeEvent) {
        applicationScope.launch {
            mutableEvents.emit(event)
        }
    }

    private suspend fun emitWithAck(event: String, payload: JSONObject): Result<JSONObject> {
        return suspendCancellableCoroutine { continuation ->
            val activeSocket = socket
            if (activeSocket == null || !activeSocket.connected()) {
                continuation.resume(Result.failure(IllegalStateException("Socket disconnected")))
                return@suspendCancellableCoroutine
            }

            val timeoutJob = applicationScope.launch {
                delay(SEND_ACK_TIMEOUT_MS)
                if (continuation.isActive) {
                    continuation.resume(Result.failure(IllegalStateException("Socket ack timeout: $event")))
                }
            }
            continuation.invokeOnCancellation {
                timeoutJob.cancel()
            }

            activeSocket.emit(event, payload, Ack { args ->
                if (!continuation.isActive) return@Ack
                timeoutJob.cancel()
                val response = args.firstOrNull() as? JSONObject ?: JSONObject()
                val errorMessage = response.optString("error").takeIf { it.isNotBlank() }
                if (errorMessage != null) {
                    continuation.resume(Result.failure(IllegalStateException(errorMessage)))
                    return@Ack
                }
                continuation.resume(Result.success(response))
            })
        }
    }

    private companion object {
        const val SEND_ACK_TIMEOUT_MS = 15_000L
    }
}

