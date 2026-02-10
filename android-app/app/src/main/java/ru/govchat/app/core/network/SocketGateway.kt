package ru.govchat.app.core.network

import io.socket.client.IO
import io.socket.client.Socket
import io.socket.engineio.client.transports.WebSocket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import ru.govchat.app.domain.model.RealtimeEvent

class SocketGateway(
    private val baseUrl: String,
    private val applicationScope: CoroutineScope
) {
    private val mutableEvents = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 64)
    val events: Flow<RealtimeEvent> = mutableEvents.asSharedFlow()

    private var socket: Socket? = null
    private var connectedToken: String? = null

    fun connect(token: String) {
        val currentSocket = socket
        if (currentSocket?.connected() == true && connectedToken == token) return

        disconnect()

        val options = IO.Options.builder()
            .setTransports(arrayOf(WebSocket.NAME))
            .setReconnection(true)
            .setAuth(mapOf("token" to token))
            .build()

        val nextSocket = IO.socket(baseUrl, options)
        bindListeners(nextSocket)
        nextSocket.connect()

        socket = nextSocket
        connectedToken = token
    }

    fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
        connectedToken = null
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
            emit(
                RealtimeEvent.MessageCreated(
                    chatId = payload.optString("chatId")
                )
            )
        }

        socket.on("call:incoming") { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val initiator = payload.optJSONObject("initiator")
            emit(
                RealtimeEvent.IncomingCall(
                    callId = payload.optString("callId"),
                    chatId = payload.optString("chatId"),
                    type = payload.optString("type"),
                    initiatorName = initiator?.optString("name").orEmpty()
                )
            )
        }
    }

    private fun emit(event: RealtimeEvent) {
        applicationScope.launch {
            mutableEvents.emit(event)
        }
    }
}

