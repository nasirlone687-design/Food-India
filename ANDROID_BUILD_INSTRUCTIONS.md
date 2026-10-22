# Food India — Android APK / AAB Build & Deployment Guide

This project includes:
1. **Responsive Mobile Web & Backend Server (`/src` + `/server.ts`)**: Runs directly in AI Studio Preview on port `3000` with Express + Vite, Firebase Authentication, Cloud Firestore, Firebase Cloud Storage, Google Maps Platform, and Razorpay Payment Links + Webhook verification.
2. **React Native + Expo Android Project (`/expo-android`)**: Native Android project configured with `expo-location`, `expo-image-picker`, and Firebase JS SDK connected to the same Firestore database (`firebase-applet-config.json`).

---

## 1. Prerequisites for Building the Android APK / AAB

1. **Node.js 20+** and **npm** installed on your build machine.
2. **EAS CLI** installed globally:
   ```bash
   npm install -g eas-cli
   ```
3. **Expo Account**:
   ```bash
   eas login
   ```

---

## 2. Building an Installable Android APK (For Testing / Sideloading)

From the `/expo-android` directory:

```bash
cd expo-android
npm install
npm run build:apk
# Equivalent to: eas build -p android --profile preview
```

When the build completes, EAS provides a direct download link and QR code for the `.apk` file that can be installed on any Android device.

---

## 3. Building a Production Android App Bundle (`.aab` for Google Play Store)

From the `/expo-android` directory:

```bash
cd expo-android
npm run build:aab
# Equivalent to: eas build -p android --profile production
```

---

## 4. Local Native Android Build (Android Studio / Gradle)

If you want to generate the native `android/` folder and build locally with Gradle without EAS Cloud:

```bash
cd expo-android
npx expo prebuild --platform android
cd android
./gradlew assembleRelease     # Outputs APK at android/app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease       # Outputs AAB at android/app/build/outputs/bundle/release/app-release.aab
```

---

## 5. External Credential & Permission Checklist

To run live external integrations in production, ensure the following credentials and permissions are configured:

1. **Razorpay Payment Links & Webhook (`/server.ts`)**:
   - Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in your `.env` environment variables.
   - Configure your Razorpay Dashboard Webhook URL to point to `https://<your-domain>/api/razorpay-webhook` with events `payment_link.paid` and `payment.captured`.
   - *Note*: When `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are not set in `.env`, the backend automatically runs in **Razorpay Test / Sandbox Mode** and exposes a test webhook simulator (`POST /api/razorpay-test-webhook`) so you can test the entire end-to-end HMAC-SHA256 webhook signature verification and admin subscription activation flow.
2. **Firebase Authentication & Google Sign-In**:
   - Ensure the **Google** Sign-In provider is enabled in Firebase Console → Authentication → Sign-in method, and add your deployment domain to **Authorized domains**.
3. **Firebase Cloud Storage (`/storage.rules`)**:
   - Enable Firebase Cloud Storage in the Firebase Console and deploy `/storage.rules`.
   - If the default Storage bucket is not yet provisioned in your Firebase Console, product image uploads and verification document uploads automatically fall back to secure inline Data URLs so uploads never fail.
4. **Google Maps Platform (`VITE_GOOGLE_MAPS_API_KEY`)**:
   - If you supply a custom `VITE_GOOGLE_MAPS_API_KEY`, ensure **Maps JavaScript API**, **Places API (New)**, and **Routes API** are enabled on your Google Cloud project. If Routes API is not enabled on a custom key, `Cart.tsx` automatically falls back to a road-adjusted Haversine distance calculation so delivery charge calculation never breaks.
