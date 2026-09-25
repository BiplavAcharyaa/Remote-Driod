/**
 * Wire protocol shared conceptually with the Android app
 * (see android/app/.../model/SignalingMessages.kt) and the browser client
 * (see browser/src/lib/protocol.ts). Keep all three in sync when changing
 * message shapes.
 *
 * IMPORTANT: This server is a pure signaling/relay/auth layer. It never
 * receives, stores, or forwards video frames — the WebRTC media stream
 * (SRTP) flows directly between the Android device and the browser once
 * ICE negotiation completes. Only small JSON control/signaling messages
 * pass through this process, and none of them are persisted to disk.
 */

const MessageType = Object.freeze({
  // Device -> Server
  REGISTER_DEVICE: 'register_device',
  OFFER: 'offer',
  ICE_CANDIDATE: 'ice_candidate',
  SCREEN_INFO: 'screen_info',
  HEARTBEAT: 'heartbeat',
  APP_LIST: 'app_list',

  // Server -> Device
  REGISTERED: 'registered',
  CLIENT_CONNECTED: 'client_connected',
  CLIENT_DISCONNECTED: 'client_disconnected',
  ANSWER: 'answer',
  REMOTE_ICE_CANDIDATE: 'remote_ice_candidate',
  CONTROL_COMMAND: 'control_command',
  ERROR: 'error',
  SESSION_TERMINATED: 'session_terminated',

  // Browser -> Server
  PAIR: 'pair',
  CONTROL: 'control',
  DISCONNECT: 'disconnect',

  // Server -> Browser
  PAIRED: 'paired',
  PAIR_FAILED: 'pair_failed',
  DEVICE_OFFER: 'device_offer',
  DEVICE_ICE_CANDIDATE: 'device_ice_candidate',
  DEVICE_SCREEN_INFO: 'device_screen_info',
  DEVICE_APP_LIST: 'device_app_list',
  DEVICE_DISCONNECTED: 'device_disconnected',
  PONG: 'pong',
});

const CommandType = Object.freeze({
  TAP: 'tap',
  DOUBLE_TAP: 'double_tap',
  LONG_PRESS: 'long_press',
  SWIPE: 'swipe',
  DRAG: 'drag',
  SCROLL: 'scroll',
  KEY_EVENT: 'key_event',
  TEXT_INPUT: 'text_input',
  BACK: 'back',
  HOME: 'home',
  RECENTS: 'recents',
  LAUNCH_APP: 'launch_app',
  LIST_APPS: 'list_apps',
});

module.exports = { MessageType, CommandType };
