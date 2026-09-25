plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.remotedroid.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.remotedroid.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        // Default signaling server address baked in as a BuildConfig field.
        // Overridden at runtime from the in-app settings screen (persisted in
        // SharedPreferences), so this is only the first-run default.
        buildConfigField("String", "DEFAULT_SIGNALING_URL", "\"ws://10.0.2.2:8080\"")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            isDebuggable = true
            // Uses the Android Gradle Plugin's built-in "debug" SigningConfig,
            // which is backed by the standard auto-generated debug keystore
            // (~/.android/debug.keystore on this machine), created
            // automatically by the Android SDK on first build. No manual
            // signing setup is needed here.
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Reuses the built-in debug SigningConfig purely so this build
            // type runs without extra setup. Replace with your own release
            // keystore before distributing a release build.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            pickFirsts += "**/libjingle_peerconnection_so.so"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.cardview:cardview:1.0.0")
    implementation("androidx.lifecycle:lifecycle-service:2.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.localbroadcastmanager:localbroadcastmanager:1.1.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Kotlin coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

    // JSON
    implementation("org.json:json:20240303")

    // WebRTC prebuilt native library (Google's official published artifact
    // mirrored on Maven Central via the WebRTC.org build). Provides
    // PeerConnectionFactory, VideoTrack, DataChannel, SurfaceTextureHelper, etc.
    implementation("io.github.webrtc-sdk:android:125.6422.07")

    // Raw WebSocket client used for signaling with the Node.js server
    implementation("org.java-websocket:Java-WebSocket:1.5.6")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
