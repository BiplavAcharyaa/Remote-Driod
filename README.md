# Remote-Droid

<p align="center">
  <strong>Control Your Android Device Directly From Your Browser</strong>
</p>

<p align="center">
  Real-time screen streaming • Remote touch control • WebRTC • Accessibility Service
</p>

<p align="center">

![Android](https://img.shields.io/badge/Android-7.0%2B-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-2.x-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-Live%20Streaming-333333?style=for-the-badge)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-Server-339933?style=for-the-badge&logo=node.js&logoColor=white)

</p>

---

## Overview

**Remote-Droid** is a browser-based Android remote-control system that allows an Android phone to be viewed and controlled directly from a laptop.

The Android device streams its screen to the browser using **WebRTC**, providing a real-time live preview instead of repeatedly sending JPEG screenshots.

The laptop browser acts as the remote control interface, allowing the user to interact with the actual Android device.

```text
┌──────────────────────┐
│      Laptop          │
│                      │
│   Web Browser        │
│   React + WebRTC     │
└──────────┬───────────┘
           │
           │ WebSocket
           │ Signaling
           │
           ▼
┌──────────────────────┐
│    Node.js Server    │
│                      │
│ Pairing              │
│ Authentication       │
│ Signaling            │
│ Session Management   │
└──────────┬───────────┘
           │
           │ WebRTC
           │
           ▼
┌──────────────────────┐
│    Android Phone     │
│                      │
│ MediaProjection      │
│ AccessibilityService │
│ WebRTC                │
│ Remote Control       │
└──────────────────────┘
Features
Live Android Screen

View the actual Android screen directly inside the laptop browser.

Real-time video streaming
WebRTC-based transmission
Low-latency preview
Portrait and landscape support
No JPEG screenshot polling
Remote Touch Control

Interact with the Android screen using the laptop mouse.

Supported interactions include:

Laptop Interaction	Android Action
Click	Tap
Double Click	Double Tap
Hold	Long Press
Drag	Drag
Mouse Wheel	Scroll
Mouse Movement	Touch Coordinate Mapping
Android Navigation

Control the primary Android navigation actions:

Back
Home
Recent Apps
Keyboard Control

Use the laptop keyboard to interact with supported Android text fields.

For example:

Laptop Keyboard
       │
       ▼
Browser
       │
       ▼
Remote-Droid
       │
       ▼
Android Text Field
Application Control

Remote-Droid is designed to interact with applications installed on the Android phone.

Examples:

YouTube
Chrome
Facebook
Instagram
Messaging applications
Gallery
Settings
Other installed applications

Example:

Open YouTube
      ↓
Select Video
      ↓
Scroll
      ↓
Search
      ↓
Type
      ↓
Navigate

All actions occur on the actual Android device.

Architecture

Remote-Droid consists of three major components.

                    REMOTE-DROID
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
      Android         Node.js        Browser
       Agent          Server          Client
          │              │              │
          │              │              │
          └──────────────┼──────────────┘
                         │
                    WebRTC + WS
1. Android Application

Directory:

remote-droid/

The Android application runs on the phone.

Responsibilities:

Screen capture
WebRTC streaming
Touch interaction
Gesture handling
Accessibility interaction
Keyboard/text input
Android navigation
Pairing
Authentication
Remote session management
Foreground service
Technologies
Kotlin
Android SDK
MediaProjection
AccessibilityService
WebRTC
WebSocket
Foreground Service
2. Node.js Server

Directory:

remote-droid-project/

The server handles:

WebSocket communication
Pairing
Authentication
WebRTC signaling
Session management
Connection handling
Reconnection

The server does not store Android screen recordings.

3. Browser Client

The browser client provides the remote-control interface.

Responsibilities:

Display live Android video
Send touch commands
Send gestures
Send keyboard input
Send navigation commands
Display connection status
Handle pairing
Manage remote sessions
Technologies
React
TypeScript
WebRTC
WebSocket
Tailwind CSS
Project Structure
Remote-Droid/
│
├── remote-droid/
│   │
│   └── android/
│       ├── app/
│       │   ├── src/
│       │   └── build.gradle.kts
│       │
│       ├── build.gradle.kts
│       ├── settings.gradle.kts
│       ├── gradlew
│       ├── gradlew.bat
│       └── ...
│
├── remote-droid-project/
│   │
│   ├── src/
│   ├── package.json
│   └── ...
│
└── README.md
Requirements
Laptop
Windows, macOS or Linux
Node.js
npm
Modern browser
Network connection

Recommended browsers:

Google Chrome
Microsoft Edge
Firefox
Android
Android 7.0 or newer
Remote-Droid APK
Network connection
Accessibility Service enabled
Screen capture permission enabled
Android Installation
1. Build the APK

Navigate to:

remote-droid/android

Set the Java environment if required:

$env:JAVA_HOME="C:\Program Files\Java\jdk-20"

Build:

.\gradlew.bat assembleDebug

The APK will be generated at:

remote-droid/android/app/build/outputs/apk/debug/app-debug.apk
2. Install the APK

Transfer:

app-debug.apk

to the Android phone.

Open the APK and install it.

If Android blocks the installation, enable installation from unknown sources for the application being used to open the APK.

Android Permissions

Remote-Droid requires several Android capabilities to provide remote control.

Accessibility Service

Accessibility Service is required for remote interaction with the Android UI.

Open:

Settings
→ Accessibility
→ Installed Apps

On some devices:

Settings
→ Accessibility
→ Downloaded Apps

Find:

Remote-Droid

Enable the service.

Confirm the Android system warning.

Required for
Tap
Swipe
Scroll
Long press
Drag
Gestures
Back
Home
Recent Apps
Accessible UI interaction

Without Accessibility Service enabled, screen streaming may work but remote interaction will not function correctly.

Screen Capture Permission

Remote-Droid uses Android's MediaProjection API for screen capture.

When the Android system displays the screen-capture permission dialog:

Review the permission.
Allow screen capture.
Return to Remote-Droid.

The Android display can then be streamed to the browser through WebRTC.

Network Setup

For local testing, connect the laptop and Android phone to the same Wi-Fi network.

Example:

                Wi-Fi Router
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
       Laptop                 Phone
     192.168.1.10           192.168.1.25

The actual IP addresses depend on the network.

Find Android IP Address

On the Android phone:

Settings
→ Wi-Fi
→ Connected Network
→ Network Details
→ IP Address

Example:

192.168.1.25

Do not use:

127.0.0.1

when connecting from the laptop.

127.0.0.1 refers to the local device itself.

Start the Web System

Open PowerShell or a terminal in:

remote-droid-project/

Install dependencies:

npm install

Start the development server:

npm run dev

The terminal will display the local web address.

For example:

http://localhost:5173

Open the displayed address in the laptop browser.

Pairing
Step 1

Open:

Remote-Droid

on the Android phone.

Step 2

Start the pairing or remote session.

Step 3

Get the pairing code displayed by the Android application.

Example:

8F42-K92A
Step 4

Open the Remote-Droid web interface on the laptop.

Step 5

Enter the pairing code.

Step 6

Connect to the phone.

After successful authentication, the Android screen should appear in the browser.

Remote Control

Once connected, the browser becomes the remote interface.

Mouse Controls
Click
   ↓
Android Tap
Double Click
   ↓
Android Double Tap
Hold
   ↓
Android Long Press
Drag
   ↓
Android Drag
Mouse Wheel
   ↓
Android Scroll
Keyboard Controls

When a supported Android text field is focused:

Laptop Keyboard
       ↓
Browser
       ↓
Remote-Droid
       ↓
Android

This allows text to be entered using the laptop keyboard.

Android Navigation

The browser interface provides:

┌────────┬────────┬────────┐
│  Back  │  Home  │ Recent │
└────────┴────────┴────────┘

These commands are sent to the Android device through the remote session.

Live Streaming

Remote-Droid uses:

Android Display
      ↓
MediaProjection
      ↓
WebRTC Video
      ↓
Laptop Browser

The system does not rely on:

Android
   ↓
JPEG Screenshot
   ↓
Upload
   ↓
Browser

Instead, the Android display is continuously streamed as a live WebRTC video track.

Security

Remote-Droid provides direct control over an Android device.

Because of this, authentication and session security are important.

The system should use:

Pairing authentication
Session authentication
WebSocket authentication
WebRTC encryption
Secure session termination
Network access controls

Do not expose an unauthenticated remote-control service directly to the public internet.

Only connect devices that you own or are explicitly authorised to control.

Troubleshooting
Android screen is not visible

Check:

MediaProjection permission
Remote-Droid is running
Network connection
WebSocket connection
WebRTC connection
Server status
Browser connection status
Screen is visible but touch does not work

Check:

Settings
→ Accessibility
→ Installed Apps
→ Remote-Droid
→ Enabled

Restart Remote-Droid after enabling the Accessibility Service.

Phone cannot connect

Check:

Phone and laptop are on the same network
Server is running
Signaling address is correct
IP address is correct
Required port is available
Firewall is not blocking the connection
Keyboard does not work

Check:

A compatible text field is focused
Remote session is active
Accessibility Service is enabled
Android permissions are granted
Android Build

The Android application can be built without Android Studio using the Gradle wrapper.

From:

remote-droid/android

run:

$env:JAVA_HOME="C:\Program Files\Java\jdk-20"

Then:

.\gradlew.bat assembleDebug

The generated APK:

app/build/outputs/apk/debug/app-debug.apk
Development
Compile Kotlin
.\gradlew.bat compileDebugKotlin
Build Debug APK
.\gradlew.bat assembleDebug
Clean Build
.\gradlew.bat clean

Then:

.\gradlew.bat assembleDebug
Technology Stack
Android
Technology	Purpose
Kotlin	Android application
Android SDK	Android platform
MediaProjection	Screen capture
AccessibilityService	Remote interaction
WebRTC	Live screen streaming
WebSocket	Control/signaling
Foreground Service	Persistent remote session
Web
Technology	Purpose
React	User interface
TypeScript	Application logic
WebRTC	Live video
WebSocket	Communication
Tailwind CSS	UI styling
Node.js	Backend/server
System Flow
                    ┌───────────────────┐
                    │   Android Phone   │
                    │                   │
                    │  MediaProjection  │
                    │        │          │
                    │        ▼          │
                    │      WebRTC       │
                    │        │          │
                    └────────┼──────────┘
                             │
                             │ Live Video
                             ▼
                    ┌───────────────────┐
                    │   Laptop Browser  │
                    │                   │
                    │    Live Screen    │
                    │        │          │
                    │        ▼          │
                    │ Mouse / Keyboard  │
                    └────────┬──────────┘
                             │
                             │ Commands
                             ▼
                    ┌───────────────────┐
                    │    Node.js        │
                    │     Server        │
                    │                   │
                    │ WebSocket         │
                    │ Signaling         │
                    │ Authentication    │
                    └───────────────────┘
Remote Interaction Flow
Laptop Mouse
     │
     ▼
Browser
     │
     ▼
WebSocket
     │
     ▼
Android AccessibilityService
     │
     ▼
Android UI

Screen feedback:

Android UI
     │
     ▼
MediaProjection
     │
     ▼
WebRTC
     │
     ▼
Browser

This creates a continuous control loop:

        ┌──────────────────────────┐
        │                          │
        ▼                          │
    Android Screen                 │
        │                          │
        ▼                          │
      WebRTC                       │
        │                          │
        ▼                          │
      Browser                      │
        │                          │
        ▼                          │
   Mouse / Keyboard                │
        │                          │
        ▼                          │
    WebSocket                      │
        │                          │
        ▼                          │
     Android                       │
        │                          │
        └──────────────────────────┘
Current Scope

Remote-Droid is designed around the following core capabilities:

Real Android screen preview
Real-time WebRTC streaming
Remote touch interaction
Gesture control
Scrolling
Keyboard input
Android navigation
Application interaction
Pairing
Authentication
Browser-based control
Disclaimer

Remote-Droid should only be used on Android devices that you own or have explicit permission to control.

The project is intended for legitimate remote-device management, development, testing and authorised automation.
