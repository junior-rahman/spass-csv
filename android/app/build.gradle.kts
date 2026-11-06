import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.jrrahman.passtocsv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.jrrahman.passtocsv"
        minSdk = 29
        targetSdk = 34
        versionCode = 27
        versionName = "2.0.9"
        // English-only UI: drop library translations.
        resourceConfigurations += listOf("en")
    }

    signingConfigs {
        create("release") {
            if (keystoreProps.isNotEmpty()) {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
                enableV1Signing = false
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystoreProps.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }

    packaging {
        resources {
            excludes += listOf("kotlin/**", "META-INF/*.version", "META-INF/*.kotlin_module", "META-INF/**/*.properties", "DebugProbesKt.bin", "kotlin-tooling-metadata.json")
        }
    }

    // Dependency metadata is for Play only; keep it out of sideloaded APKs.
    dependenciesInfo {
        includeInApk = false
        includeInBundle = true
    }

    // Play app-update drags in fragment 1.0.0 transitively, but no Fragment is ever used
    // (ComponentActivity only), so the Fragment-version result-API check is a false positive.
    lint { disable += "InvalidFragmentVersionForActivityResult" }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.activity:activity:1.9.3")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("com.google.android.play:app-update:2.1.0")
}
