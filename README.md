Remote Droid

Remote Droid is an Android remote-control system that allows an Android phone to be viewed and controlled from a laptop browser.

The project is divided into two parts:

remote-droid-project/
├── remote-droid/          # Android APK
└── web-based-system/      # Laptop browser control system
Project Structure
1. remote-droid

Android application installed on the phone.

Main responsibilities:

Live Android screen capture using MediaProjection
Real-time screen streaming using WebRTC
Remote touch interaction using AccessibilityService
Tap, double-tap, long press and drag
Swipe and scrolling
Keyboard/text input
Back, Home and Recent Apps
Application interaction
Device pairing
Remote session management
WebSocket communication
Foreground service for remote operation
APK Location

After building the Android project, the APK is generated at:

remote-droid/android/app/build/outputs/apk/debug/app-debug.apk

To build the APK:

cd remote-droid/android
.\gradlew.bat assembleDebug

The generated APK can then be transferred directly to an Android phone and installed.

2. remote-droid-project

This is the web-based laptop control system.

It provides the browser interface used to:

View the Android screen live
Click/tap the phone screen
Double-click
Long press
Drag
Swipe
Scroll
Type using the laptop keyboard
Use Back, Home and Recent Apps
Interact with installed Android applications
Maintain the remote session

The browser receives the phone's screen through WebRTC, rather than JPEG screenshots.

Requirements
Laptop
Windows/macOS/Linux
Node.js
npm
Modern browser such as Chrome, Edge or Firefox
Laptop and phone connected to the same network for local testing
Android Phone
Android 7.0+ / API 24+
Remote Droid APK installed
Internet/Wi-Fi or local network connection as required by the server configuration
Accessibility permission enabled
Screen-capture permission granted when requested
Android Setup
1. Install the APK

Transfer:

app-debug.apk

to the Android phone.

Open the APK and install it.

If Android blocks the installation, allow installation of apps from the source you used to open the APK.

2. Open Remote Droid

Launch:

Remote Droid

The application will request the permissions required for remote control.

Grant the required permissions.

Accessibility Setup

Remote Droid uses Android's AccessibilityService for remote interaction with the phone.

Go to:

Settings
→ Accessibility
→ Installed apps

Depending on the Android manufacturer, it may instead appear under:

Settings
→ Accessibility
→ Downloaded apps

Find:

Remote Droid

Enable the Accessibility Service.

Confirm the Android warning when prompted.

This permission is required for remote actions such as:

Tapping
Swiping
Scrolling
Long pressing
Gestures
Back
Home
Recent Apps
Interacting with accessible UI elements

Without Accessibility permission, the browser may be able to receive the screen but remote interaction will not work correctly.

Screen Capture Permission

Remote Droid uses Android's MediaProjection API to capture the device display.

When Remote Droid requests screen-sharing/screen-capture permission:

Review the Android system prompt.
Select the option to allow screen capture.
Confirm the permission.

This permission is required for the browser to receive the live Android screen.

The screen is streamed as a real-time WebRTC video stream.

Remote Droid does not use periodic JPEG screenshots for the live preview.

Connect the Phone and Laptop

For local testing, connect both devices to the same Wi-Fi network.

Example:

Laptop
192.168.1.10

        │
        │ Wi-Fi
        │
        ▼

Phone
192.168.1.25

The exact IP addresses will be different on each network.

You can find the phone's local IP under its connected Wi-Fi network details.

Start the Web System

Open a terminal in:

remote-droid-project/

Install dependencies:

npm install

Start the development server:

npm run dev

If the project contains a separate server and browser application, start each according to its respective package configuration.

Open the displayed local URL in the laptop browser.

For example:

http://localhost:5173

The exact port depends on the project configuration.

Pair the Phone
Open Remote Droid on the Android phone.
Start the remote session/pairing process.
Obtain the pairing code shown by the phone.
Open the Remote Droid web interface on the laptop.
Enter the pairing code.
Connect to the phone.

After successful authentication:

Android Phone
      ↓
MediaProjection
      ↓
WebRTC
      ↓
Laptop Browser

The phone's actual screen should appear live in the browser.

Remote Control

Once connected, the browser can be used as the phone's remote interface.

Mouse
Left click       → Tap
Double click     → Double tap
Hold             → Long press
Drag             → Drag
Mouse wheel      → Scroll
Keyboard

Laptop keyboard input can be sent to the Android device when a compatible text field is focused.

Example:

Laptop keyboard
       ↓
Browser
       ↓
Remote Droid
       ↓
Android text field
Navigation

Use:

Back
Home
Recent Apps

to navigate the Android device.

Using Android Applications

After the connection is established, the phone can be operated through the browser.

For example:

Home
 ↓
Open YouTube
 ↓
Click a video
 ↓
Scroll
 ↓
Search
 ↓
Type using laptop keyboard

The browser displays the actual Android screen while the commands are executed on the physical Android device.

The same principle applies to other installed applications such as:

Chrome
YouTube
Facebook
Instagram
Messaging applications
Gallery
Settings
Other installed applications
Troubleshooting
Screen is not visible

Check:

MediaProjection/screen-capture permission
Android Remote Droid app is running
WebRTC connection
Network connectivity
Browser connection status
Screen is visible but cannot click

Check:

Settings
→ Accessibility
→ Remote Droid
→ Enabled

Restart Remote Droid after enabling Accessibility if necessary.

Phone cannot connect

Check that:

Phone and laptop are on the same network for local testing
The configured server/signaling address is correct
Required server is running
Windows Firewall is not blocking the required port
Keyboard does not work

Make sure:

A compatible text field is focused
Remote Droid's required permissions are enabled
The browser has an active remote session
Build APK From Source

From the Android project directory:

cd remote-droid/android

Set Java if required for the current PowerShell session:

$env:JAVA_HOME="C:\Program Files\Java\jdk-20"

Build:

.\gradlew.bat assembleDebug

APK:

remote-droid/android/app/build/outputs/apk/debug/app-debug.apk
Security

Remote Droid provides control over the Android device, so the remote connection must be protected.

Do not expose an unauthenticated remote-control endpoint to the public internet.

Use:

Pairing authentication
Secure session handling
WebSocket authentication
WebRTC encryption
Session termination
Network access controls

The user should always know when remote control is active.
