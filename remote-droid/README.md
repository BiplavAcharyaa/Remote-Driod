# Remote Droid — Web Client

A React + TypeScript browser client that pairs with an Android companion app
and lets you see and control the phone's real screen live, over WebRTC.
There are no screenshots, no polling, and no simulated UI anywhere in this
client — every pixel on screen is the phone's actual live video track, and
every click/tap/keystroke is relayed to the real device.

## Stack

- React 18 + TypeScript, Vite
- Tailwind CSS for styling
- Native `WebSocket` for signaling + control
- Native `RTCPeerConnection` (WebRTC) for the live video track

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

This repo is the **browser side only**. It expects an Android app ("the
Remote Droid APK") running a small WebSocket server on the phone that speaks
the protocol below. That APK is out of scope here, but the contract is fully
specified so a compatible server can be built or swapped in.

## How a session works

1. You open the web app and enter the phone's IP, port, and a 6-character
   pairing code that the Android app displays.
2. The browser opens `ws://<host>:<port>/remote-droid` and sends `pair`.
3. Once the phone accepts the code, it sends `paired` with device info, then
   creates an `RTCPeerConnection` around its screen-capture track and sends a
   WebRTC `offer` over the same socket.
4. The browser answers, ICE candidates are exchanged over the socket, and a
   direct (or STUN-assisted) WebRTC connection carries the live video —
   never routed through JPEG frames or REST polling.
5. From then on, every pointer gesture, scroll, keystroke, and nav button
   press is sent to the phone as a small JSON `input`/`nav` message; the
   phone is expected to inject it as a real `MotionEvent`/`KeyEvent`.
6. If the WebSocket drops, the client backs off exponentially (0.5s → 8s cap)
   and reconnects automatically; a heartbeat (`ping`/`pong`) detects silently
   dead sockets. A fresh `paired` event after a reconnect triggers a brand
   new WebRTC offer/answer cycle so video resumes.

## Coordinate mapping

The `<video>` element renders with `object-fit: contain`, so on any aspect
ratio mismatch the picture is letterboxed. `src/utils/coordinateMapping.ts`
computes the real picture rectangle inside the video box and maps pointer
positions into **device pixel space** (using the resolution reported in
`device-info`), discarding points that land in the letterbox bars. This is
what lets a click on the browser map to the exact right pixel on the phone
regardless of window size, and it re-derives itself automatically when the
phone rotates and sends updated `device-info`.

## Input gestures

Handled in `src/components/RemoteScreen.tsx` via the Pointer Events API (so
mouse and touch trackpads behave the same way):

| Gesture | Behavior |
|---|---|
| Click | `tap` |
| Two quick clicks, same spot | `double-tap` |
| Press and hold without moving | `long-press` (fires after 480ms) |
| Press, move past 8px, release | streamed `drag-start` → `drag-move`(throttled ~60Hz) → `drag-end`, i.e. real continuous touch motion for swipes, scrolling feeds, drag-and-drop |
| Mouse wheel | `scroll` at the pointer's mapped position |
| Typing (hidden input) | `text` events, IME-safe |
| Backspace / Enter / Tab / arrows / Esc | `key` with an Android `KEYCODE_*` name |
| Back / Home / Recents buttons | `nav` |

## Wire protocol (`src/types/index.ts`)

**Client → server**
```ts
{ type: "pair", code: string, clientName: string }
{ type: "webrtc-answer", sdp: string }
{ type: "ice-candidate", candidate: RTCIceCandidateInit }
{ type: "input", action: InputAction }   // tap/double-tap/long-press/drag-*/scroll/key/text
{ type: "nav", action: "back" | "home" | "recents" }
{ type: "request-keyframe" }
{ type: "ping", t: number }
```

**Server → client**
```ts
{ type: "paired", device: DeviceInfo }
{ type: "pair-rejected", reason: string }
{ type: "webrtc-offer", sdp: string }
{ type: "ice-candidate", candidate: RTCIceCandidateInit }
{ type: "device-info", device: DeviceInfo }   // re-sent on rotation
{ type: "pong", t: number }
{ type: "error", message: string }
```

See `src/types/index.ts` for the full `InputAction` and `DeviceInfo` shapes.

## Project layout

```
src/
  types/index.ts            protocol + shared types
  utils/coordinateMapping.ts letterbox-aware pointer → device pixel mapping
  hooks/useWebSocket.ts      pairing, reconnect/backoff, heartbeat
  hooks/useWebRTC.ts         RTCPeerConnection, SDP/ICE, live MediaStream, stats
  components/PairingScreen.tsx
  components/StatusBar.tsx
  components/RemoteScreen.tsx  video + all pointer/keyboard input handling
  components/ControlBar.tsx    Back / Home / Recents / keyboard toggle
  App.tsx                      wires it all together
```

## Notes on production hardening

- Add a TURN server to `ICE_SERVERS` in `useWebRTC.ts` for phones behind
  symmetric NAT / carrier CGNAT where STUN alone won't establish a path.
- The pairing code should be single-use and short-lived on the Android side;
  this client never persists it.
- Consider pinning the phone's TLS certificate if you enable `wss://` across
  untrusted networks.
