package com.remotedroid.app.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.remotedroid.app.R
import com.remotedroid.app.RemoteDroidApp
import com.remotedroid.app.model.CommandType
import com.remotedroid.app.model.RemoteCommand
import com.remotedroid.app.signaling.SignalingClient
import com.remotedroid.app.ui.MainActivity
import com.remotedroid.app.util.AppLauncher
import com.remotedroid.app.util.PreferencesManager
import com.remotedroid.app.webrtc.WebRtcStreamer
import org.json.JSONObject
import org.webrtc.IceCandidate
import org.webrtc.PeerConnection
import org.webrtc.SessionDescription

/**
 * Foreground service that owns the entire remote-session lifecycle:
 *  1. Holds the MediaProjection permission grant and starts screen capture.
 *  2. Drives the WebRTC pipeline (WebRtcStreamer) for live video streaming.
 *  3. Maintains the signaling WebSocket connection to the Node.js server.
 *  4. Dispatches incoming control commands to the AccessibilityService.
 *
 * Running as a foreground service with type "mediaProjection" is required by
 * Android 10+ to keep screen capture alive while the app is not in the
 * foreground, and keeps the user clearly informed (persistent notification)
 * that screen sharing is active, with an immediate Stop action.
 */
class ScreenCaptureService : Service(), SignalingClient.Listener, WebRtcStreamer.Listener {

    companion object {
        private const val TAG = "ScreenCaptureService"
        private const val NOTIFICATION_ID = 42

        const val ACTION_START = "com.remotedroid.app.action.START"
        const val ACTION_STOP = "com.remotedroid.app.action.STOP"
        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"

        const val BROADCAST_STATUS = "com.remotedroid.app.broadcast.STATUS"
        const val EXTRA_STATUS = "extra_status"

        // Status values broadcast to MainActivity for UI updates.
        const val STATUS_CONNECTING_SERVER = "connecting_server"
        const val STATUS_WAITING_PAIR = "waiting_pair"
        const val STATUS_STREAMING = "streaming"
        const val STATUS_RECONNECTING = "reconnecting"
        const val STATUS_STOPPED = "stopped"
        const val STATUS_ERROR = "error"

        @Volatile
        var isRunning = false
            private set
    }

    private lateinit var prefs: PreferencesManager
    private lateinit var signalingClient: SignalingClient
    private lateinit var webRtcStreamer: WebRtcStreamer
    private var mediaProjection: MediaProjection? = null
    private var mediaProjectionManager: MediaProjectionManager? = null

    private val mediaProjectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            Log.i(TAG, "MediaProjection stopped by system/user")
            stopSelfSession()
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = PreferencesManager(this)
        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> handleStart(intent)
            ACTION_STOP -> stopSelfSession()
        }
        return START_NOT_STICKY
    }

    private fun handleStart(intent: Intent) {
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1)
        val resultData: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }

        if (resultCode == -1 || resultData == null) {
            Log.e(TAG, "Missing MediaProjection grant, cannot start")
            stopSelf()
            return
        }

        startForeground(NOTIFICATION_ID, buildNotification(getString(R.string.status_waiting_pair)))
        isRunning = true
        broadcastStatus(STATUS_CONNECTING_SERVER)

        mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, resultData)
        mediaProjection?.registerCallback(mediaProjectionCallback, null)

        webRtcStreamer = WebRtcStreamer(this, this)
        webRtcStreamer.initialize()

        signalingClient = SignalingClient(
            serverUrl = prefs.serverUrl,
            deviceId = prefs.deviceId,
            pairingCode = prefs.pairingCode,
            deviceSecret = prefs.deviceSecret,
            listener = this
        )
        signalingClient.connect()
    }

    private fun stopSelfSession() {
        Log.i(TAG, "Stopping remote session")
        broadcastStatus(STATUS_STOPPED)
        try {
            if (::webRtcStreamer.isInitialized) webRtcStreamer.release()
        } catch (_: Exception) {}
        try {
            if (::signalingClient.isInitialized) signalingClient.disconnect()
        } catch (_: Exception) {}
        mediaProjection?.unregisterCallback(mediaProjectionCallback)
        mediaProjection?.stop()
        mediaProjection = null
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ---- Notification -----------------------------------------------------

    private fun buildNotification(statusText: String): Notification {
        val contentIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 0,
            Intent(this, ScreenCaptureService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, RemoteDroidApp.NOTIFICATION_CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title_active))
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .addAction(0, getString(R.string.notification_action_stop), stopIntent)
            .build()
    }

    private fun updateNotification(statusText: String) {
        val manager = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(statusText))
    }

    private fun broadcastStatus(status: String, extraMessage: String? = null) {
        val intent = Intent(BROADCAST_STATUS).apply {
            putExtra(EXTRA_STATUS, status)
            extraMessage?.let { putExtra("message", it) }
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    // ---- SignalingClient.Listener ------------------------------------------

    override fun onRegistered(sessionToken: String) {
        Log.i(TAG, "Registered with signaling server")
        broadcastStatus(STATUS_WAITING_PAIR)
        updateNotification(getString(R.string.status_waiting_pair))

        // Report current screen geometry immediately so the server/browser
        // know the aspect ratio before a viewer connects.
        val metrics = currentDisplayMetrics()
        signalingClient.sendScreenInfo(
            metrics.widthPixels, metrics.heightPixels,
            windowManager().defaultDisplay.rotation, metrics.densityDpi
        )
    }

    override fun onClientConnected() {
        Log.i(TAG, "Browser client connected — starting WebRTC capture")
        broadcastStatus(STATUS_STREAMING)
        updateNotification(getString(R.string.status_streaming))

        val projection = mediaProjection ?: return
        val metrics = currentDisplayMetrics()

        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )

        webRtcStreamer.start(
            mediaProjection = projection,
            screenWidth = metrics.widthPixels,
            screenHeight = metrics.heightPixels,
            screenDensity = metrics.densityDpi,
            iceServers = iceServers
        )
    }

    override fun onClientDisconnected() {
        Log.i(TAG, "Browser client disconnected")
        broadcastStatus(STATUS_WAITING_PAIR)
        updateNotification(getString(R.string.status_waiting_pair))
        webRtcStreamer.stop()
    }

    override fun onAnswer(sdp: String) {
        webRtcStreamer.setRemoteAnswer(sdp)
    }

    override fun onRemoteIceCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int) {
        webRtcStreamer.addRemoteIceCandidate(candidate, sdpMid, sdpMLineIndex)
    }

    override fun onControlCommand(command: JSONObject) {
        dispatchControlCommand(command)
    }

    override fun onSessionTerminated() {
        Log.i(TAG, "Session terminated by server")
        stopSelfSession()
    }

    override fun onSignalingError(message: String) {
        Log.e(TAG, "Signaling error: $message")
        broadcastStatus(STATUS_ERROR, message)
    }

    override fun onConnectionStateChanged(connected: Boolean, reconnecting: Boolean) {
        if (!connected && reconnecting) {
            broadcastStatus(STATUS_RECONNECTING)
            updateNotification(getString(R.string.status_reconnecting))
        }
    }

    // ---- WebRtcStreamer.Listener --------------------------------------------

    override fun onLocalIceCandidate(candidate: IceCandidate) {
        signalingClient.sendIceCandidate(candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex)
    }

    override fun onLocalOfferCreated(sdp: SessionDescription) {
        signalingClient.sendOffer(sdp.description)
    }

    override fun onPeerConnectionStateChanged(state: PeerConnection.PeerConnectionState) {
        Log.i(TAG, "PeerConnection state: $state")
        when (state) {
            PeerConnection.PeerConnectionState.CONNECTED -> {
                broadcastStatus(STATUS_STREAMING)
            }
            PeerConnection.PeerConnectionState.FAILED,
            PeerConnection.PeerConnectionState.DISCONNECTED -> {
                broadcastStatus(STATUS_RECONNECTING)
            }
            else -> {}
        }
    }

    override fun onControlDataChannelMessage(message: String) {
        try {
            dispatchControlCommand(JSONObject(message))
        } catch (e: Exception) {
            Log.e(TAG, "Bad control message on data channel: $message", e)
        }
    }

    // ---- Command dispatch ----------------------------------------------------

    private fun dispatchControlCommand(json: JSONObject) {
        val type = json.optString("type")

        if (type == CommandType.LAUNCH_APP) {
            val pkg = json.optString("packageName")
            AppLauncher.launchApp(this, pkg)
            return
        }
        if (type == CommandType.LIST_APPS) {
            val apps = AppLauncher.listLaunchableApps(this)
            signalingClient.sendAppList(apps.toString())
            return
        }

        val accessibilityService = RemoteAccessibilityService.instance
        if (accessibilityService == null) {
            Log.w(TAG, "Accessibility service not enabled; dropping command: $type")
            return
        }
        val command = RemoteCommand.fromJson(json)
        accessibilityService.execute(command)
    }

    private fun currentDisplayMetrics(): DisplayMetrics {
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        windowManager().defaultDisplay.getRealMetrics(metrics)
        return metrics
    }

    private fun windowManager(): WindowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
}
