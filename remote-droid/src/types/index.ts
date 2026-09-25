/**
 * Remote Droid — shared types and the WebSocket signaling/control protocol.
 *
 * This client talks directly to a WebSocket server embedded in the Android
 * companion app (the "Remote Droid APK"). The APK is the WebRTC offerer
 * (it owns the screen-capture video track); the browser is the answerer.
 * All control input flows browser -> phone over the same WebSocket used
 * for signaling. This file is the contract the APK-side server must speak.
 */

export type Orientation = "portrait" | "landscape";

export interface DeviceInfo {
  name: string; // e.g. "Pixel 8 Pro"
  model: string; // e.g. "Google Pixel 8 Pro"
  androidVersion: string; // e.g. "14"
  screenWidth: number; // physical pixels, in CURRENT orientation
  screenHeight: number;
  orientation: Orientation;
  batteryLevel?: number; // 0-100
}

export type NavAction = "back" | "home" | "recents";

export type InputAction =
  | { kind: "tap"; x: number; y: number }
  | { kind: "double-tap"; x: number; y: number }
  | { kind: "long-press"; x: number; y: number; durationMs: number }
  | { kind: "swipe"; x1: number; y1: number; x2: number; y2: number; durationMs: number }
  | { kind: "drag-start"; x: number; y: number }
  | { kind: "drag-move"; x: number; y: number }
  | { kind: "drag-end"; x: number; y: number }
  | { kind: "scroll"; x: number; y: number; deltaX: number; deltaY: number }
  | { kind: "key"; keyCode: AndroidKeyCode }
  | { kind: "text"; text: string };

/** Subset of Android KEYCODE_* values the client can send for hardware-style keys. */
export type AndroidKeyCode =
  | "BACK"
  | "HOME"
  | "APP_SWITCH"
  | "ENTER"
  | "DEL"
  | "FORWARD_DEL"
  | "TAB"
  | "SPACE"
  | "MOVE_HOME"
  | "MOVE_END"
  | "DPAD_LEFT"
  | "DPAD_RIGHT"
  | "DPAD_UP"
  | "DPAD_DOWN"
  | "VOLUME_UP"
  | "VOLUME_DOWN"
  | "POWER"
  | "ESCAPE";

// ---------------------------------------------------------------------------
// WebSocket message envelope: client -> server
// ---------------------------------------------------------------------------
export type ClientMessage =
  | { type: "pair"; code: string; clientName: string }
  | { type: "webrtc-answer"; sdp: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "input"; action: InputAction }
  | { type: "nav"; action: NavAction }
  | { type: "request-keyframe" }
  | { type: "ping"; t: number };

// ---------------------------------------------------------------------------
// WebSocket message envelope: server -> client
// ---------------------------------------------------------------------------
export type ServerMessage =
  | { type: "paired"; device: DeviceInfo }
  | { type: "pair-rejected"; reason: string }
  | { type: "webrtc-offer"; sdp: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "device-info"; device: DeviceInfo }
  | { type: "pong"; t: number }
  | { type: "error"; message: string };

export type WsStatus =
  | "idle"
  | "connecting"
  | "awaiting-pair"
  | "paired"
  | "reconnecting"
  | "disconnected"
  | "error";

export type RtcStatus = "idle" | "negotiating" | "connected" | "disconnected" | "failed";

export interface ConnectionConfig {
  host: string; // IP or hostname of the phone, e.g. 192.168.1.42
  port: number; // WebSocket server port advertised by the APK
  pairingCode: string;
  useTls: boolean;
}

/** Rectangle of the video's actual picture area within its rendered box (object-fit: contain). */
export interface ContentRect {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}
