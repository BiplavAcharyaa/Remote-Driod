package com.remotedroid.app.model

/**
 * Wire protocol shared with the Node.js signaling server (see server/src/protocol.js
 * for the authoritative definition — keep both sides in sync).
 *
 * All messages are JSON objects of the shape: { "type": "...", ...payload }
 */
object MessageType {
    // Device -> Server
    const val REGISTER_DEVICE = "register_device"        // { deviceId, pairingCode, deviceSecret, deviceName }
    const val OFFER = "offer"                              // { sdp }
    const val ICE_CANDIDATE = "ice_candidate"              // { candidate, sdpMid, sdpMLineIndex }
    const val SCREEN_INFO = "screen_info"                  // { width, height, rotation, densityDpi }
    const val HEARTBEAT = "heartbeat"

    // Server -> Device
    const val REGISTERED = "registered"                    // { sessionToken }
    const val CLIENT_CONNECTED = "client_connected"        // browser paired, ready for offer
    const val CLIENT_DISCONNECTED = "client_disconnected"
    const val ANSWER = "answer"                             // { sdp }
    const val REMOTE_ICE_CANDIDATE = "remote_ice_candidate" // { candidate, sdpMid, sdpMLineIndex }
    const val CONTROL_COMMAND = "control_command"           // { command: {...} }
    const val ERROR = "error"                               // { message }
    const val SESSION_TERMINATED = "session_terminated"

    // Browser -> Server (documented here for completeness; browser side implements this too)
    const val PAIR = "pair"                                 // { pairingCode }
}

/** Types of remote-control commands relayed from the browser to the accessibility service. */
object CommandType {
    const val TAP = "tap"
    const val DOUBLE_TAP = "double_tap"
    const val LONG_PRESS = "long_press"
    const val SWIPE = "swipe"
    const val DRAG = "drag"
    const val SCROLL = "scroll"
    const val KEY_EVENT = "key_event"
    const val TEXT_INPUT = "text_input"
    const val BACK = "back"
    const val HOME = "home"
    const val RECENTS = "recents"
    const val LAUNCH_APP = "launch_app"
    const val LIST_APPS = "list_apps"
}
