# Remote Droid

Turn an Android phone into a remotely controllable device from a laptop browser, using **live WebRTC video** (not screenshots) for the screen and an **AccessibilityService** for input injection.

The project has three parts, each independently runnable:

```
remote-droid/
├── android/   Kotlin Android app — screen capture + WebRTC + AccessibilityService
├── server/    Node.js signaling / pairing-auth / session-management server
└── browser/   React + TypeScript web client — live viewer + remote control UI
```

**How it fits together:** the phone and the browser never talk to each other directly for signaling — they both connect to the Node.js server over WebSocket, which relays pairing, SDP offers/answers and ICE candidates. Once WebRTC negotiation completes, the actual **video stream flows peer-to-peer** between phone and browser (or via a TURN relay if you configure one for NAT traversal) — the Node server never sees or stores a single video frame.

---

## 1. Architecture overview

```
┌─────────────┐        WebSocket (signaling only)        ┌─────────────┐
│   Android   │ ───────────────────────────────────────► │  Node.js    │
│   Phone     │ ◄─────────────────────────────────────── │  Server     │
│             │                                           │ (pairing +  │
│  - Media    │                                           │  relay)     │
│    Projec-  │        WebSocket (signaling only)         │             │
│    tion     │ ◄────────────────────────────────────────┤             │
│  - WebRTC   │                                           └─────────────┘
│  - Accessi- │                                                  ▲
│    bility   │                                                  │ pairing code
│    Service  │                                                  │ + signaling
└─────────────┘                                           ┌─────────────┐
       ▲                                                   │   Browser   │
       │        WebRTC media (SRTP) — peer-to-peer         │   (React)   │
       └───────────────────────────────────────────────────┤             │
                     live video + control data channel      └─────────────┘
```

- **Video path:** `MediaProjection` → `VirtualDisplay` (GPU surface) → WebRTC `VideoSource` → hardware H.264/VP8 encoder → SRTP → browser `<video>` element via `MediaStream`. No JPEG/PNG encoding, no bitmap copies, no disk writes anywhere in this path.
- **Control path:** browser mouse/keyboard events → normalized `RemoteCommand` JSON → WebRTC data channel (primary) or WebSocket relay (fallback) → Android `AccessibilityService` → real gesture/text/navigation injection.

---

## 2. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 18+ | Server and browser client |
| npm | 9+ (ships with Node) | Installing dependencies |
| JDK | 17 | Android Gradle build |
| Android SDK command-line tools | API 34, build-tools 34.0.0 | Compiling the APK |
| A phone or emulator | Android 7.0 (API 24) or newer | Running the app |

You do **not** need Android Studio. The steps below use only `sdkmanager` and the Gradle wrapper already included in `android/`.

---

## 3. Set up the Android SDK (command-line only, one-time)

If you already have an Android SDK installed (e.g. from a previous Android Studio install, or already have `ANDROID_HOME` set), skip to step 4 and just create `android/local.properties` pointing at it.

Otherwise, on Linux/macOS:

```bash
# 1. Download the command-line tools
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools
curl -o tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip tools.zip
mv cmdline-tools latest
rm tools.zip

# 2. Put sdkmanager on PATH for this shell
export ANDROID_HOME=~/android-sdk
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# 3. Accept licenses and install exactly what this project needs
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

On Windows (PowerShell), download the Windows command-line tools zip from the same Android developer site, extract to `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`, and run the equivalent `sdkmanager.bat` commands.

> The download URL above is Google's official `commandlinetools` distribution. If it has moved, search "Android command line tools" on developer.android.com and use the current link — the rest of these instructions don't change.

---

## 4. Build the Android APK

```bash
cd remote-droid/android

# Point Gradle at your SDK (one-time)
cp local.properties.example local.properties
# then edit local.properties and set sdk.dir to your actual SDK path

./gradlew assembleDebug
```

The first run downloads Gradle 8.7 (via the included wrapper) and all Android/WebRTC dependencies from Google's and Maven Central's repositories — this needs normal internet access and will take a few minutes.

**Output APK:**
```
app/build/outputs/apk/debug/app-debug.apk
```

Install it on a connected/USB-debugging-enabled phone with:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

...or just copy `app-debug.apk` to the phone (e.g. via a USB cable, email, or `python3 -m http.server` + downloading it in the phone's browser) and tap it to install (you'll need to allow "install from unknown sources" once).

### Notes on the debug build

- It's signed with the standard auto-generated Android **debug keystore** (`~/.android/debug.keystore`), which Gradle/the SDK create automatically the first time you build anything Android on your machine — no manual keystore setup needed for `assembleDebug`.
- For a release build (`./gradlew assembleRelease`) you'd normally configure your own signing key; the project currently reuses the debug signing config for `release` too, purely so the command runs without extra setup. Replace `signingConfigs.getByName("debug")` in `app/build.gradle.kts` with your own keystore before distributing a release build.

---

## 5. Run the Node.js signaling server

```bash
cd remote-droid/server
cp .env.example .env
npm install
npm start
```

You should see:

```
INFO  Remote Droid signaling server listening on port 8080
INFO  WebSocket endpoint: ws://<this-machine-ip>:8080
```

Find your machine's LAN IP (`ip addr` / `ifconfig` / `ipconfig`) — you'll need it for both the phone and the browser to reach this server. The phone and laptop must be on the same network (or otherwise able to route to this server's port, e.g. via a VPN or port-forward) since this is a self-hosted signaling server, not a cloud service.

The server never writes video or screen data to disk — it only relays small JSON signaling/control messages in memory. See `server/src/wsServer.js` and `server/src/sessionManager.js` for the full relay/session logic.

---

## 6. Run the browser client

```bash
cd remote-droid/browser
cp .env.example .env
# edit .env: VITE_SIGNALING_SERVER_URL=ws://<same LAN IP as above>:8080
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) in your laptop's browser.

For a production build instead of the dev server:

```bash
npm run build      # outputs to browser/dist
npm run preview    # serves the production build locally
```

You can also copy the contents of `browser/dist` into `server/public/` and the Node server will serve it directly (see `server/src/index.js`), so a single `npm start` in `server/` hosts both the API/WebSocket and the web UI.

---

## 7. Using it end-to-end

1. Start the Node.js server (step 5).
2. Install and open the **Remote Droid** app on the phone.
   - Tap **Enable Accessibility Service** and turn it on for "Remote Droid Control Service" in Android's accessibility settings (required for remote taps/gestures/text input to work).
   - Open **Server Settings** in the app and enter `ws://<server LAN IP>:8080` if it isn't already correct.
   - Note the 6-digit **pairing code** shown on screen.
   - Tap **Start Remote Session**. Android will prompt for screen-capture permission ("Remote Droid wants to start capturing everything on your screen") — accept it. A persistent notification appears confirming the session is active, with an immediate **Stop** action.
3. Open the browser client (step 6), enter the pairing code shown on the phone, and click **Connect**.
4. The phone's live screen appears in the browser within a couple of seconds (real-time WebRTC video, continuously updating — not periodic screenshots).
5. Interact normally:
   - **Click** = tap, **double-click** = double tap, **click-and-hold** = long press, **click-drag** = swipe/drag, **mouse wheel** = scroll.
   - **Type** on your keyboard to send text into whatever field is focused on the phone; **Enter** and **Backspace** are forwarded as discrete key events.
   - Use the **Back / Home / Recent Apps** buttons in the control bar for system navigation.
   - Use **Apps** to search and launch any installed app (YouTube, Chrome, Facebook, Instagram, messaging apps, etc.) — once launched it's fully interactive through the same tap/gesture/text pipeline, because the AccessibilityService operates at the input-event level, not per-app.
   - Click **Disconnect** at any time to end the session immediately from the browser, or tap **Stop Session** / the notification's **Stop** action on the phone.

If the phone's network drops or the app is backgrounded, both the Android `SignalingClient` and the browser's `RemoteSessionClient` automatically retry the WebSocket connection with exponential backoff, and the WebRTC layer re-negotiates once signaling is restored.

---

## 8. Security model

- **Pairing code**: a random 6-digit code, regenerable at any time from the phone UI, required to associate a browser session with a specific device.
- **Device secret**: a separate long-lived per-install secret (never shown in the UI) that the phone also sends on every registration, so a browser knowing an old/leaked pairing code alone cannot impersonate a device reconnect — the server enforces `deviceSecret` match on re-registration in `sessionManager.js`.
- **Session token**: issued by the server on registration, currently used for future extension (e.g. REST endpoints); the live control path is authorized by the active paired-socket relationship itself, which only exists after a successful pairing-code exchange.
- **One active viewer at a time**: pairing a new browser session immediately terminates any previous one for that device (`SESSION_TERMINATED`), so there's no ambiguity about who is in control.
- **No storage of screen data**: neither the Android app nor the Node server ever writes captured frames to disk — the Android side streams frames directly from GPU texture to the WebRTC encoder (see `ScreenCapturerAndroidBridge.kt`), and the server only ever sees JSON signaling messages.
- **Immediate stop**: the user can end the session instantly from either side — the notification's Stop action or in-app button on the phone, or the Disconnect button in the browser.

This is a self-hosted tool intended for controlling your own device on a trusted network. If exposing the signaling server beyond a LAN, put it behind TLS (`wss://`) and a reverse proxy, and consider adding rate limiting on pairing attempts.

---

## 9. Project structure reference

```
android/
  app/src/main/java/com/remotedroid/app/
    RemoteDroidApp.kt              Application class, notification channel
    ui/MainActivity.kt             Pairing UI, start/stop, accessibility prompt
    service/ScreenCaptureService.kt   Foreground service: orchestrates capture+WebRTC+signaling
    service/RemoteAccessibilityService.kt   Gesture/text/navigation injection
    service/BootReceiver.kt        Inert boot receiver (no silent auto-start, by design)
    webrtc/WebRtcStreamer.kt       PeerConnection, VideoTrack, data channel
    webrtc/ScreenCapturerAndroidBridge.kt   MediaProjection → WebRTC frame bridge
    signaling/SignalingClient.kt   WebSocket client with auto-reconnect
    model/                         Command + message model classes
    util/PreferencesManager.kt     Encrypted prefs: device id, pairing code, secret, server URL
    util/AppLauncher.kt            List/launch installed apps

server/
  src/index.js         HTTP + WebSocket bootstrap
  src/wsServer.js       Device/browser registration, pairing, signaling relay, heartbeat
  src/sessionManager.js In-memory device/session/pairing-code state
  src/protocol.js       Shared message-type constants
  src/logger.js         Logging helper

browser/
  src/App.tsx                      Top-level state machine (pairing → streaming)
  src/lib/RemoteSessionClient.ts   WebSocket signaling + RTCPeerConnection management
  src/lib/protocol.ts              Shared TypeScript message/command types
  src/hooks/useTouchMapper.ts      Mouse → normalized touch/gesture command mapping
  src/hooks/useKeyboardInput.ts    Keyboard capture → text_input/key_event commands
  src/components/RemoteScreen.tsx  <video> element + interaction wiring
  src/components/ControlBar.tsx    Back/Home/Recents, app launcher, disconnect
  src/components/PairingScreen.tsx Pairing code entry + server URL settings
  src/components/StatusBadge.tsx   Connection status indicator
```

---

## 10. Troubleshooting

- **"Waiting for live video stream…" never resolves** — check that the phone's Accessibility Service is enabled and that the phone can reach the server's WebSocket URL (same network, correct IP/port, no firewall blocking the port). Check `adb logcat` filtered on `ScreenCaptureService`/`WebRtcStreamer`/`SignalingClient` for errors.
- **Video connects but touches don't register** — the AccessibilityService likely isn't enabled; re-check Android Settings → Accessibility → Remote Droid Control Service.
- **Gradle can't find the SDK** — confirm `android/local.properties` has a correct `sdk.dir` for your machine, or that `ANDROID_HOME`/`ANDROID_SDK_ROOT` is exported in your shell.
- **Pairing fails immediately** — the code may have expired (default TTL 5 minutes idle with no browser attached) or been regenerated on the phone after you copied it down; get the current code from the phone screen and retry.
- **Works on Wi-Fi but not over the internet** — this setup assumes LAN reachability; connecting across networks needs a public/relay-reachable server (`wss://`) and typically a TURN server added to the ICE server list in both `WebRtcStreamer.kt` and `RemoteSessionClient.ts` for NAT traversal.
