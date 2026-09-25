/**
 * Wire protocol shared with the Node.js server (server/src/protocol.js) and
 * the Android app (android/.../model/SignalingMessages.kt). Keep in sync.
 */

export type ServerToClientMessage =
  | { type: 'paired'; deviceId: string; deviceName: string; screenInfo: ScreenInfo | null }
  | { type: 'pair_failed'; message: string }
  | { type: 'device_offer'; sdp: string }
  | { type: 'device_ice_candidate'; candidate: string; sdpMid: string | null; sdpMLineIndex: number }
  | { type: 'device_screen_info'; width: number; height: number; rotation: number; densityDpi: number }
  | { type: 'device_app_list'; apps: AppInfo[] }
  | { type: 'device_disconnected' }
  | { type: 'session_terminated' }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export type ClientToServerMessage =
  | { type: 'pair'; pairingCode: string }
  | { type: 'answer'; sdp: string }
  | { type: 'client_ice_candidate'; candidate: string; sdpMid: string | null; sdpMLineIndex: number }
  | { type: 'control'; command: RemoteCommand }
  | { type: 'disconnect' }
  | { type: 'heartbeat' };

export interface ScreenInfo {
  width: number;
  height: number;
  rotation: number;
  densityDpi: number;
}

export interface AppInfo {
  packageName: string;
  label: string;
  isSystem: boolean;
}

export type CommandType =
  | 'tap'
  | 'double_tap'
  | 'long_press'
  | 'swipe'
  | 'drag'
  | 'scroll'
  | 'key_event'
  | 'text_input'
  | 'back'
  | 'home'
  | 'recents'
  | 'launch_app'
  | 'list_apps';

/**
 * All coordinates are normalized to [0, 1] relative to the video frame, so
 * mapping is correct regardless of how large the <video> element is
 * rendered in the browser and regardless of the phone's actual resolution
 * or orientation — the Android side multiplies by its real screen size.
 */
export interface RemoteCommand {
  type: CommandType;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  durationMs?: number;
  text?: string;
  keyCode?: number;
  deltaX?: number;
  deltaY?: number;
  packageName?: string;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting_server'
  | 'awaiting_pairing_code'
  | 'pairing'
  | 'pair_failed'
  | 'negotiating'
  | 'streaming'
  | 'reconnecting'
  | 'disconnected'
  | 'error';
