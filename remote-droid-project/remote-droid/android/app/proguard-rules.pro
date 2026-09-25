# WebRTC
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Java-WebSocket
-keep class org.java_websocket.** { *; }
-dontwarn org.java_websocket.**

# JSON
-keep class org.json.** { *; }

# Keep our own model / service classes referenced via reflection-free code
-keep class com.remotedroid.app.** { *; }
