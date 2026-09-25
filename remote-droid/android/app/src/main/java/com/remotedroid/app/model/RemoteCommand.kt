package com.remotedroid.app.model

import org.json.JSONObject

/**
 * Normalized representation of a single remote-control command received
 * from the browser. Coordinates (x, y, x1, y1, x2, y2) are always in the
 * NORMALIZED [0.0, 1.0] range relative to the streamed video frame; the
 * AccessibilityService maps them to actual device pixel coordinates using
 * the real screen size, which keeps behavior correct across portrait,
 * landscape and any browser-side video element size.
 */
data class RemoteCommand(
    val type: String,
    val x: Float = 0f,
    val y: Float = 0f,
    val x1: Float = 0f,
    val y1: Float = 0f,
    val x2: Float = 0f,
    val y2: Float = 0f,
    val durationMs: Long = 100,
    val text: String = "",
    val keyCode: Int = -1,
    val deltaX: Float = 0f,
    val deltaY: Float = 0f,
    val packageName: String = ""
) {
    companion object {
        fun fromJson(json: JSONObject): RemoteCommand {
            return RemoteCommand(
                type = json.optString("type"),
                x = json.optDouble("x", 0.0).toFloat(),
                y = json.optDouble("y", 0.0).toFloat(),
                x1 = json.optDouble("x1", 0.0).toFloat(),
                y1 = json.optDouble("y1", 0.0).toFloat(),
                x2 = json.optDouble("x2", 0.0).toFloat(),
                y2 = json.optDouble("y2", 0.0).toFloat(),
                durationMs = json.optLong("durationMs", 100),
                text = json.optString("text", ""),
                keyCode = json.optInt("keyCode", -1),
                deltaX = json.optDouble("deltaX", 0.0).toFloat(),
                deltaY = json.optDouble("deltaY", 0.0).toFloat(),
                packageName = json.optString("packageName", "")
            )
        }
    }
}
