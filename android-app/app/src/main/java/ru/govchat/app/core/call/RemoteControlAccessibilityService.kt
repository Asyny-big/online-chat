package ru.govchat.app.core.call

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class RemoteControlAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        if (instance === this) {
            instance = null
        }
        super.onDestroy()
    }

    private fun performTap(xPx: Float, yPx: Float): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        val path = Path().apply {
            moveTo(xPx, yPx)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0L, 60L)
        return dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun performSwipe(startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        val stroke = GestureDescription.StrokeDescription(
            path,
            0L,
            durationMs.coerceIn(80L, 1_200L)
        )
        return dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun inputText(text: String): Boolean {
        val node = findFocusedEditableNode(rootInActiveWindow) ?: return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    private fun findFocusedEditableNode(root: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (root == null) return null
        val focusedInput = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focusedInput?.isEditable == true) return focusedInput
        if (root.isFocused && root.isEditable) return root
        for (index in 0 until root.childCount) {
            val child = root.getChild(index) ?: continue
            val match = findFocusedEditableNode(child)
            if (match != null) return match
        }
        return null
    }

    companion object {
        @Volatile
        private var instance: RemoteControlAccessibilityService? = null

        fun isRunning(): Boolean = instance != null

        fun performTap(xPx: Float, yPx: Float): Boolean {
            return instance?.performTap(xPx, yPx) == true
        }

        fun performSwipe(startX: Float, startY: Float, endX: Float, endY: Float, durationMs: Long): Boolean {
            return instance?.performSwipe(startX, startY, endX, endY, durationMs) == true
        }

        fun inputText(text: String): Boolean {
            return instance?.inputText(text) == true
        }

        fun performGlobalActionCompat(action: Int): Boolean {
            return instance?.performGlobalAction(action) == true
        }
    }
}
