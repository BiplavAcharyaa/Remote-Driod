package com.remotedroid.app.webrtc

import android.content.Context
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpParameters
import org.webrtc.RtpSender
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack

/**
 * Owns the full WebRTC pipeline that turns MediaProjection frames into a live
 * video track sent over a PeerConnection. There is no JPEG/PNG encoding step
 * anywhere in this path: frames go from the VirtualDisplay's Surface directly
 * into a VideoSource via SurfaceTextureHelper, then through the WebRTC H.264/VP8
 * hardware encoder pipeline straight to the RTP sender.
 */
class WebRtcStreamer(
    private val context: Context,
    private val listener: Listener
) {
    interface Listener {
        fun onLocalIceCandidate(candidate: IceCandidate)
        fun onLocalOfferCreated(sdp: SessionDescription)
        fun onPeerConnectionStateChanged(state: PeerConnection.PeerConnectionState)
        fun onControlDataChannelMessage(message: String)
    }

    companion object {
        private const val TAG = "WebRtcStreamer"
        private const val VIDEO_TRACK_ID = "remote_droid_screen_v0"
        private const val STREAM_ID = "remote_droid_stream"
        private const val CONTROL_CHANNEL_LABEL = "control"

        // Target encode parameters. Actual capture resolution follows the
        // device's real screen size (set at start()); this caps bitrate for
        // a responsive, low-latency stream over typical Wi-Fi/LAN links.
        private const val MAX_BITRATE_BPS = 6_000_000
        private const val MIN_BITRATE_BPS = 500_000
        private const val START_FRAMERATE = 30
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var eglBase: EglBase
    private lateinit var peerConnectionFactory: PeerConnectionFactory
    private var peerConnection: PeerConnection? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var controlDataChannel: DataChannel? = null
    private var localVideoSender: RtpSender? = null

    fun initialize() {
        eglBase = EglBase.create()

        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )

        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }

    /**
     * Starts capturing the given MediaProjection into a live VideoTrack and
     * creates the PeerConnection (with a data channel used as a secondary,
     * redundant control path). [iceServers] normally contains at least one
     * STUN server plus optionally a TURN server for NAT traversal.
     */
    fun start(
        mediaProjection: MediaProjection,
        screenWidth: Int,
        screenHeight: Int,
        screenDensity: Int,
        iceServers: List<PeerConnection.IceServer>
    ) {
        surfaceTextureHelper = SurfaceTextureHelper.create("RemoteDroidCaptureThread", eglBase.eglBaseContext)

        videoSource = peerConnectionFactory.createVideoSource(false)

        val screenCapturer = ScreenCapturerAndroidBridge(
            mediaProjection = mediaProjection,
            surfaceTextureHelper = surfaceTextureHelper!!,
            videoSource = videoSource!!
        )
        virtualDisplay = screenCapturer.createVirtualDisplay(
            context = context,
            width = screenWidth,
            height = screenHeight,
            densityDpi = screenDensity
        )

        videoTrack = peerConnectionFactory.createVideoTrack(VIDEO_TRACK_ID, videoSource)
        videoTrack?.setEnabled(true)

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            keyType = PeerConnection.KeyType.ECDSA
        }

        peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(newState: PeerConnection.SignalingState?) {}

            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
                Log.i(TAG, "ICE connection state: $newState")
            }

            override fun onIceConnectionReceivingChange(receiving: Boolean) {}

            override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) {}

            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let { mainHandler.post { listener.onLocalIceCandidate(it) } }
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}

            override fun onAddStream(stream: MediaStream?) {}

            override fun onRemoveStream(stream: MediaStream?) {}

            override fun onDataChannel(channel: DataChannel?) {
                channel?.registerObserver(buildDataChannelObserver(channel))
            }

            override fun onRenegotiationNeeded() {}

            override fun onAddTrack(receiver: org.webrtc.RtpReceiver?, mediaStreams: Array<out MediaStream>?) {}

            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
                newState?.let { mainHandler.post { listener.onPeerConnectionStateChanged(it) } }
            }
        })

        val streamIds = listOf(STREAM_ID)
        localVideoSender = peerConnection?.addTrack(videoTrack, streamIds)
        applyBitrateLimits(localVideoSender)

        controlDataChannel = peerConnection?.createDataChannel(
            CONTROL_CHANNEL_LABEL,
            DataChannel.Init().apply { ordered = true }
        )
        controlDataChannel?.registerObserver(buildDataChannelObserver(controlDataChannel!!))

        createOffer()
    }

    private fun applyBitrateLimits(sender: RtpSender?) {
        sender ?: return
        val parameters: RtpParameters = sender.parameters
        if (parameters.encodings.isNotEmpty()) {
            for (encoding in parameters.encodings) {
                encoding.maxBitrateBps = MAX_BITRATE_BPS
                encoding.minBitrateBps = MIN_BITRATE_BPS
                encoding.maxFramerate = START_FRAMERATE
            }
            sender.parameters = parameters
        }
    }

    private fun buildDataChannelObserver(channel: DataChannel) = object : DataChannel.Observer {
        override fun onBufferedAmountChange(previousAmount: Long) {}
        override fun onStateChange() {
            Log.i(TAG, "Data channel '${channel.label()}' state: ${channel.state()}")
        }
        override fun onMessage(buffer: DataChannel.Buffer?) {
            buffer ?: return
            val bytes = ByteArray(buffer.data.remaining())
            buffer.data.get(bytes)
            val text = String(bytes, Charsets.UTF_8)
            mainHandler.post { listener.onControlDataChannelMessage(text) }
        }
    }

    private fun createOffer() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
        }
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(desc: SessionDescription?) {
                desc ?: return
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onSetSuccess() {
                        mainHandler.post { listener.onLocalOfferCreated(desc) }
                    }
                    override fun onCreateFailure(p0: String?) {}
                    override fun onSetFailure(error: String?) {
                        Log.e(TAG, "setLocalDescription failed: $error")
                    }
                }, desc)
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "createOffer failed: $error")
            }
            override fun onSetFailure(p0: String?) {}
        }, constraints)
    }

    fun setRemoteAnswer(sdp: String) {
        val desc = SessionDescription(SessionDescription.Type.ANSWER, sdp)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onSetSuccess() {
                Log.i(TAG, "Remote answer applied")
            }
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(error: String?) {
                Log.e(TAG, "setRemoteDescription failed: $error")
            }
        }, desc)
    }

    fun addRemoteIceCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int) {
        peerConnection?.addIceCandidate(IceCandidate(sdpMid ?: "", sdpMLineIndex, candidate))
    }

    fun sendOverControlChannel(message: String) {
        val channel = controlDataChannel ?: return
        if (channel.state() == DataChannel.State.OPEN) {
            val buffer = DataChannel.Buffer(
                java.nio.ByteBuffer.wrap(message.toByteArray(Charsets.UTF_8)),
                false
            )
            channel.send(buffer)
        }
    }

    /** Tears down capture + peer connection. Safe to call multiple times. No frames are ever written to disk. */
    fun stop() {
        try {
            virtualDisplay?.release()
            virtualDisplay = null

            videoTrack?.dispose()
            videoTrack = null

            videoSource?.dispose()
            videoSource = null

            surfaceTextureHelper?.dispose()
            surfaceTextureHelper = null

            controlDataChannel?.close()
            controlDataChannel = null

            peerConnection?.close()
            peerConnection?.dispose()
            peerConnection = null
        } catch (e: Exception) {
            Log.e(TAG, "Error during WebRTC teardown", e)
        }
    }

    fun release() {
        stop()
        if (::peerConnectionFactory.isInitialized) {
            peerConnectionFactory.dispose()
        }
        if (::eglBase.isInitialized) {
            eglBase.release()
        }
    }
}
