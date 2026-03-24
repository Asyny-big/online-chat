package ru.govchat.app.core.call

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.StandardCharsets

sealed interface RemoteControlCommand {
    val seq: Long

    data class ScreenInfo(
        override val seq: Long,
        val width: Int,
        val height: Int,
        val rotation: Int
    ) : RemoteControlCommand

    data class PointerDown(
        override val seq: Long,
        val x: Int,
        val y: Int
    ) : RemoteControlCommand

    data class PointerMove(
        override val seq: Long,
        val x: Int,
        val y: Int
    ) : RemoteControlCommand

    data class PointerUp(
        override val seq: Long,
        val x: Int,
        val y: Int
    ) : RemoteControlCommand

    data class Tap(
        override val seq: Long,
        val x: Int,
        val y: Int
    ) : RemoteControlCommand

    data class Swipe(
        override val seq: Long,
        val startX: Int,
        val startY: Int,
        val endX: Int,
        val endY: Int,
        val durationMs: Int
    ) : RemoteControlCommand

    data class Text(
        override val seq: Long,
        val value: String
    ) : RemoteControlCommand

    data class GlobalAction(
        override val seq: Long,
        val action: Int
    ) : RemoteControlCommand

    data class Heartbeat(
        override val seq: Long
    ) : RemoteControlCommand

    data class Stop(
        override val seq: Long
    ) : RemoteControlCommand
}

object RemoteControlProtocol {
    const val VERSION = 1
    private const val HEADER_SIZE = 19

    const val TYPE_SCREEN_INFO = 1
    const val TYPE_POINTER_DOWN = 2
    const val TYPE_POINTER_MOVE = 3
    const val TYPE_POINTER_UP = 4
    const val TYPE_TAP = 5
    const val TYPE_SWIPE = 6
    const val TYPE_TEXT = 7
    const val TYPE_GLOBAL_ACTION = 8
    const val TYPE_HEARTBEAT = 9
    const val TYPE_STOP = 10

    const val GLOBAL_ACTION_BACK = 1
    const val GLOBAL_ACTION_HOME = 2
    const val GLOBAL_ACTION_RECENTS = 3

    fun decode(buffer: ByteBuffer): RemoteControlCommand? {
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        val reader = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)
        if (reader.remaining() < HEADER_SIZE) return null

        val version = reader.get().toInt() and 0xFF
        if (version != VERSION) return null

        val type = reader.get().toInt() and 0xFF
        reader.get() // flags, reserved for future use
        val seq = reader.int.toLong() and 0xFFFF_FFFFL
        val x = reader.short.toInt() and 0xFFFF
        val y = reader.short.toInt() and 0xFFFF
        val x2 = reader.short.toInt() and 0xFFFF
        val y2 = reader.short.toInt() and 0xFFFF
        val arg = reader.short.toInt() and 0xFFFF
        val payloadLen = reader.short.toInt() and 0xFFFF
        if (reader.remaining() < payloadLen) return null

        val payload = ByteArray(payloadLen)
        if (payloadLen > 0) {
            reader.get(payload)
        }

        return when (type) {
            TYPE_SCREEN_INFO -> RemoteControlCommand.ScreenInfo(
                seq = seq,
                width = x,
                height = y,
                rotation = arg
            )
            TYPE_POINTER_DOWN -> RemoteControlCommand.PointerDown(seq = seq, x = x, y = y)
            TYPE_POINTER_MOVE -> RemoteControlCommand.PointerMove(seq = seq, x = x, y = y)
            TYPE_POINTER_UP -> RemoteControlCommand.PointerUp(seq = seq, x = x, y = y)
            TYPE_TAP -> RemoteControlCommand.Tap(seq = seq, x = x, y = y)
            TYPE_SWIPE -> RemoteControlCommand.Swipe(
                seq = seq,
                startX = x,
                startY = y,
                endX = x2,
                endY = y2,
                durationMs = arg
            )
            TYPE_TEXT -> RemoteControlCommand.Text(
                seq = seq,
                value = payload.toString(StandardCharsets.UTF_8)
            )
            TYPE_GLOBAL_ACTION -> RemoteControlCommand.GlobalAction(seq = seq, action = arg)
            TYPE_HEARTBEAT -> RemoteControlCommand.Heartbeat(seq = seq)
            TYPE_STOP -> RemoteControlCommand.Stop(seq = seq)
            else -> null
        }
    }
}
