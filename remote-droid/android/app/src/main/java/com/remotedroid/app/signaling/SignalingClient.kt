package com.remotedroid.app.signaling

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocketFactory

/**
 * Manages the WebSocket connection to the Node.js signaling server, including
 * registration/authentication and automatic reconnection with backoff.
 *
 * All inbound JSON messages are forwarded to [listener] on a background
 * coroutine; callers should dispatch UI updates to the main thread themselves.
 */
class SignalingClient(
    private var serverUrl: String,
    private val deviceId: String,
    private val pairingCode: String,
    private val deviceSecret: String,
    private val listener: Listener
) {
    interface Listener {
        fun onRegistered(sessionToken: String)
        fun onClientConnected()
        fun onClientDisconnected()
        fun onAnswer(sdp: String)
        fun onRemoteIceCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int)
        fun onControlCommand(command: JSONObject)
        fun onSessionTerminated()
        fun onSignalingError(message: String)
        fun onConnectionStateChanged(connected: Boolean, reconnecting: Boolean)
    }

    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var client: WebSocketClient? = null
    private val shouldRun = AtomicBoolean(false)
    private var reconnectAttempt = 0
    private var sessionToken: String? = null

    companion object {
        private const val TAG = "SignalingClient"
        private const val MAX_BACKOFF_MS = 15_000L
        private const val HEARTBEAT_INTERVAL_MS = 20_000L
    }

    fun updateServerUrl(url: String) {
        serverUrl = url
    }

    fun connect() {
        shouldRun.set(true)
        reconnectAttempt = 0
        openSocket()
        startHeartbeat()
    }

    fun disconnect() {
        shouldRun.set(false)
        client?.close()
        client = null
    }

    fun sendOffer(sdp: String) = send(JSONObject().apply {
        put("type", "offer")
        put("sdp", sdp)
    })

    fun sendIceCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int) = send(JSONObject().apply {
        put("type", "ice_candidate")
        put("candidate", candidate)
        put("sdpMid", sdpMid)
        put("sdpMLineIndex", sdpMLineIndex)
    })

    fun sendScreenInfo(width: Int, height: Int, rotation: Int, densityDpi: Int) = send(JSONObject().apply {
        put("type", "screen_info")
        put("width", width)
        put("height", height)
        put("rotation", rotation)
        put("densityDpi", densityDpi)
    })

    fun sendAppList(appsJson: String) = send(JSONObject().apply {
        put("type", "app_list")
        put("apps", org.json.JSONArray(appsJson))
    })

    private fun openSocket() {
        if (!shouldRun.get()) return
        try {
            val uri = URI(serverUrl)
            Log.i(TAG, "Connecting to signaling server: $serverUrl (attempt ${reconnectAttempt + 1})")

            client = object : WebSocketClient(uri) {
                override fun onOpen(handshakedata: ServerHandshake?) {
                    Log.i(TAG, "WebSocket open, registering device")
                    reconnectAttempt = 0
                    listener.onConnectionStateChanged(connected = true, reconnecting = false)
                    register()
                }

                override fun onMessage(message: String?) {
                    if (message == null) return
                    handleMessage(message)
                }

                override fun onClose(code: Int, reason: String?, remote: Boolean) {
                    Log.w(TAG, "WebSocket closed: code=$code reason=$reason remote=$remote")
                    listener.onConnectionStateChanged(connected = false, reconnecting = shouldRun.get())
                    scheduleReconnect()
                }

                override fun onError(ex: Exception?) {
                    Log.e(TAG, "WebSocket error", ex)
                }
            }

            if (uri.scheme == "wss") {
                val sslContext = SSLContext.getInstance("TLS")
                sslContext.init(null, null, null)
                client?.setSocketFactory(sslContext.socketFactory as SSLSocketFactory)
            }

            client?.connectionLostTimeout = 30
            client?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open signaling connection", e)
            scheduleReconnect()
        }
    }

    private fun register() {
        send(JSONObject().apply {
            put("type", "register_device")
            put("deviceId", deviceId)
            put("pairingCode", pairingCode)
            put("deviceSecret", deviceSecret)
            put("deviceName", android.os.Build.MODEL ?: "Android Device")
        })
    }

    private fun scheduleReconnect() {
        if (!shouldRun.get()) return
        reconnectAttempt++
        val backoff = minOf(1000L * (1 shl minOf(reconnectAttempt, 5)), MAX_BACKOFF_MS)
        Log.i(TAG, "Reconnecting in ${backoff}ms")
        scope.launch {
            delay(backoff)
            if (shouldRun.get()) openSocket()
        }
    }

    private fun startHeartbeat() {
        scope.launch {
            while (shouldRun.get()) {
                delay(HEARTBEAT_INTERVAL_MS)
                if (client?.isOpen == true) {
                    send(JSONObject().apply { put("type", "heartbeat") })
                }
            }
        }
    }

    private fun handleMessage(raw: String) {
        try {
            val json = JSONObject(raw)
            when (json.optString("type")) {
                "registered" -> {
                    sessionToken = json.optString("sessionToken")
                    listener.onRegistered(sessionToken ?: "")
                }
                "client_connected" -> listener.onClientConnected()
                "client_disconnected" -> listener.onClientDisconnected()
                "answer" -> listener.onAnswer(json.optString("sdp"))
                "remote_ice_candidate" -> listener.onRemoteIceCandidate(
                    json.optString("candidate"),
                    json.optString("sdpMid", null),
                    json.optInt("sdpMLineIndex", 0)
                )
                "control_command" -> listener.onControlCommand(json.optJSONObject("command") ?: JSONObject())
                "session_terminated" -> listener.onSessionTerminated()
                "error" -> listener.onSignalingError(json.optString("message"))
                else -> Log.d(TAG, "Unhandled message type: ${json.optString("type")}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse signaling message: $raw", e)
        }
    }

    private fun send(json: JSONObject) {
        try {
            client?.takeIf { it.isOpen }?.send(json.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send signaling message", e)
        }
    }
}
