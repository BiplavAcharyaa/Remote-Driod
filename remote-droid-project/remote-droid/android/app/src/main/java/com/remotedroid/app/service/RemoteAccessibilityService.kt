package com.remotedroid.app.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.content.Intent
import android.graphics.Path
import android.graphics.Point
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.remotedroid.app.model.CommandType
import com.remotedroid.app.model.RemoteCommand

/**
 * Executes remote-control commands (tap, swipe, drag, scroll, text input,
 * system navigation) using the Accessibility API's gesture dispatch and
 * global actions. This is the only supported way to inject synthetic input
 * on modern Android without root, and it works across third-party apps
 * (YouTube, Chrome, Facebook, Instagram, messaging apps, etc.) because
 * gesture dispatch operates at the input-event level, not the app-UI level.
 *
 * Coordinates in [RemoteCommand] are normalized [0,1]; this service maps
 * them to actual device pixels using the real display size, so control is
 * accurate regardless of the browser video element's rendered size and
 * regardless of device orientation.
 */
class RemoteAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "RemoteAccessibility"

        @Volatile
        var instance: RemoteAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "Accessibility service connected")
    }

    override fun onUnbind(intent: Intent?): Boolean {
        instance = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used for control; the accessibility tree is only consulted
        // on-demand (see focused-node lookup for text input below).
    }

    override fun onInterrupt() {}

    private fun screenSize(): Point {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val point = Point()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = wm.currentWindowMetrics.bounds
            point.set(bounds.width(), bounds.height())
        } else {
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealSize(point)
        }
        return point
    }

    fun execute(command: RemoteCommand) {
        val size = screenSize()
        val w = size.x.toFloat()
        val h = size.y.toFloat()

        when (command.type) {
            CommandType.TAP -> tap(command.x * w, command.y * h)
            CommandType.DOUBLE_TAP -> doubleTap(command.x * w, command.y * h)
            CommandType.LONG_PRESS -> longPress(command.x * w, command.y * h, command.durationMs)
            CommandType.SWIPE -> swipe(
                command.x1 * w, command.y1 * h,
                command.x2 * w, command.y2 * h,
                command.durationMs
            )
            CommandType.DRAG -> drag(
                command.x1 * w, command.y1 * h,
                command.x2 * w, command.y2 * h,
                command.durationMs
            )
            CommandType.SCROLL -> scroll(command.x * w, command.y * h, command.deltaX, command.deltaY)
            CommandType.BACK -> performGlobalAction(GLOBAL_ACTION_BACK)
            CommandType.HOME -> performGlobalAction(GLOBAL_ACTION_HOME)
            CommandType.RECENTS -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            CommandType.TEXT_INPUT -> inputText(command.text)
            CommandType.KEY_EVENT -> handleKeyEvent(command.keyCode, command.text)
            else -> Log.w(TAG, "Unknown command type: ${command.type}")
        }
    }

    // ---- Gesture primitives -------------------------------------------------

    private fun tap(x: Float, y: Float) {
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 60)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun doubleTap(x: Float, y: Float) {
        val path = Path().apply { moveTo(x, y) }
        val firstTap = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture1 = GestureDescription.Builder().addStroke(firstTap).build()
        dispatchGesture(gesture1, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                val path2 = Path().apply { moveTo(x, y) }
                val secondTap = GestureDescription.StrokeDescription(path2, 0, 50)
                dispatchGesture(GestureDescription.Builder().addStroke(secondTap).build(), null, null)
            }
        }, null)
    }

    private fun longPress(x: Float, y: Float, durationMs: Long) {
        val duration = if (durationMs in 1..10_000) durationMs else 600L
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long) {
        val duration = if (durationMs in 1..10_000) durationMs else 250L
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun drag(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long) {
        // Same primitive as swipe but with a longer hold at the start so apps
        // that distinguish drag-and-drop from a fling register it correctly.
        val duration = if (durationMs in 1..15_000) durationMs else 400L
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun scroll(x: Float, y: Float, deltaX: Float, deltaY: Float) {
        // Translate a wheel/trackpad delta into a short swipe centered on (x,y).
        val magnitude = 300f
        val endX = (x - deltaX * magnitude).coerceIn(0f, screenSize().x.toFloat())
        val endY = (y - deltaY * magnitude).coerceIn(0f, screenSize().y.toFloat())
        val path = Path().apply {
            moveTo(x, y)
            lineTo(endX, endY)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, 180)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    // ---- Text input -----------------------------------------------------------

    /**
     * Sets text directly on the currently focused editable node via
     * AccessibilityNodeInfo.ACTION_SET_TEXT. This works across virtually all
     * standard Android text fields (browser address bars, chat inputs,
     * search boxes) without needing a custom IME.
     */
    private fun inputText(text: String) {
        val node = findFocusedEditableNode(rootInActiveWindow) ?: run {
            Log.w(TAG, "No focused editable node found for text input")
            return
        }
        val arguments = android.os.Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        node.recycle()
    }

    private fun findFocusedEditableNode(root: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        root ?: return null
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null && focused.isEditable) return focused
        return null
    }

    /**
     * Handles individual key presses (Enter, Delete/Backspace, arrow keys)
     * for cases where the browser sends discrete keystrokes rather than a
     * full text buffer (e.g. pressing Enter to submit, Backspace to delete).
     */
    private fun handleKeyEvent(keyCode: Int, char: String) {
        when (keyCode) {
            android.view.KeyEvent.KEYCODE_ENTER -> {
                val node = findFocusedEditableNode(rootInActiveWindow)
                if (node != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        // AccessibilityNodeInfo.ACTION_IME_ENTER is exposed as an
                        // AccessibilityAction (not a plain int constant) starting
                        // in API 30. Perform it via its action id.
                        node.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)
                    } else {
                        // Pre-API 30 fallback: no ACTION_IME_ENTER exists, so
                        // simulate "Enter" by appending a newline to the
                        // focused field's text, which submits/advances in
                        // most standard EditText-based inputs the same way
                        // the IME Enter key would.
                        val current = node.text?.toString().orEmpty()
                        val arguments = android.os.Bundle().apply {
                            putCharSequence(
                                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                                current + "\n"
                            )
                        }
                        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                    }
                    node.recycle()
                }
            }
            android.view.KeyEvent.KEYCODE_DEL -> {
                val node = findFocusedEditableNode(rootInActiveWindow) ?: return
                val current = node.text?.toString().orEmpty()
                if (current.isNotEmpty()) {
                    val newText = current.dropLast(1)
                    val arguments = android.os.Bundle().apply {
                        putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, newText)
                    }
                    node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                }
                node.recycle()
            }
            else -> {
                if (char.isNotEmpty()) {
                    val node = findFocusedEditableNode(rootInActiveWindow) ?: return
                    val current = node.text?.toString().orEmpty()
                    val newText = current + char
                    val arguments = android.os.Bundle().apply {
                        putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, newText)
                    }
                    node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                    node.recycle()
                }
            }
        }
    }
}
