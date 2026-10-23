# Food India — Android Production Build Guide

This project is a native Android WebView wrapper for the [Food India](https://foodindia.sbs) web application, built using Capacitor.

## 1. Prerequisites
- **Java 17+** (JDK)
- **Android SDK** (Command line tools or Android Studio)
- **Gradle**

## 2. Setting up for Production Signing
1. **Generate a Keystore**:
   Run this command in the root directory to generate a signing key:
   ```bash
   keytool -genkey -v -keystore foodindia.keystore -alias foodindia_key -keyalg RSA -keysize 2048 -validity 10000
   ```
   Note down the alias, keystore password, and key password.

2. **Configure Credentials**:
   Add the following lines to your `android/gradle.properties` file:
   ```properties
   MYAPP_RELEASE_STORE_FILE=../foodindia.keystore
   MYAPP_RELEASE_STORE_PASSWORD=your_keystore_password
   MYAPP_RELEASE_KEY_ALIAS=foodindia_key
   MYAPP_RELEASE_KEY_PASSWORD=your_key_password
   ```

## 3. Building the Production AAB
From the `/android` directory:

```bash
cd android
./gradlew bundleRelease
```

The resulting App Bundle will be located at:
`android/app/build/outputs/bundle/release/app-release.aab`

You can now upload this file to the Google Play Console for internal testing or production release.
