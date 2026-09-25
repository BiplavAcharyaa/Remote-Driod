package com.remotedroid.app.webrtc

import android.content.Context
import android.hardware.display.VirtualDisplay
import android.media.projection.MediaProjection
import android.util.Log
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoFrame
import org.webrtc.VideoSource

/**
 * Bridges Android's MediaProjection VirtualDisplay directly to a WebRTC
 * VideoSource's capture observer. Frames flow:
 *
 *   VirtualDisplay -> SurfaceTexture -> SurfaceTextureHelper (GL) -> VideoFrame -> VideoSource
 *
 * This is a raw GPU texture hand-off — at no point is a frame decoded to a
 * Bitmap, encoded as JPEG/PNG, or written to storage. The WebRTC video
 * encoder (H.264/VP8 via MediaCodec, wired up in WebRtcStreamer) picks the
 * frames up straight from the VideoSource for RTP transmission.
 */
class ScreenCapturerAndroidBridge(
    private val mediaProjection: MediaProjection,
    private val surfaceTextureHelper: SurfaceTextureHelper,
    private val videoSource: VideoSource
) {
    companion object {
        private const val TAG = "ScreenCapturerBridge"
        private const val VIRTUAL_DISPLAY_NAME = "RemoteDroidCapture"
    }

    fun createVirtualDisplay(context: Context, width: Int, height: Int, densityDpi: Int): VirtualDisplay {
        val capturerObserver = videoSource.capturerObserver

        surfaceTextureHelper.setTextureSize(width, height)
        surfaceTextureHelper.startListening { videoFrame: VideoFrame ->
            // Deliver each captured frame straight into the WebRTC pipeline.
            // videoFrame wraps a GPU texture (TextureBuffer) — no CPU bitmap
            // copy, no compression to an image format, no disk I/O.
            capturerObserver.onFrameCaptured(videoFrame)
        }

        capturerObserver.onCapturerStarted(true)

        val surface = android.view.Surface(surfaceTextureHelper.surfaceTexture)

        val virtualDisplay = mediaProjection.createVirtualDisplay(
            VIRTUAL_DISPLAY_NAME,
            width,
            height,
            densityDpi,
            android.hardware.display.DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            surface,
            object : VirtualDisplay.Callback() {
                override fun onStopped() {
                    Log.i(TAG, "VirtualDisplay stopped")
                    capturerObserver.onCapturerStopped()
                }
            },
            null
        )

        Log.i(TAG, "VirtualDisplay created: ${width}x${height}@${densityDpi}dpi")
        return virtualDisplay
    }
}
