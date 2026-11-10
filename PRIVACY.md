# Spcc — Privacy

- Spcc (Spass to CSV Converter) reads the `.spass` file you choose and decrypts it on your device with the password you type.
- Nothing is uploaded. The Android app's INTERNET permission is used only by Google Play to check for and apply updates; the WebView that does the conversion has no network access. The web page blocks all network requests with its Content-Security-Policy.
- No accounts, analytics, crash reporting, or telemetry. The Android app also opts its WebView out of Android System WebView usage metrics and Safe Browsing lookups (it only shows the app's own bundled pages).
- The app stores one setting on your device: the last password-manager format you chose.
- Unlocked data stays in memory only and is cleared when you tap Change file or leave the app.
- The Android app turns Autofill off inside the app, so Google or Samsung Pass autofill services are not offered a chance to save or fill passwords while you edit logins. The export password also cannot be autofilled from a password manager.
- A CSV is written only when you tap Save CSV and confirm. It is plain text: delete it after you import it.
- The app never downloads or installs APKs itself. The Android app may contact Google Play only to check for and apply updates (Play In-App Updates); conversion stays on-device and the WebView has no network access. This repository does not publish prebuilt APKs or AABs.

Contact: open an issue at https://github.com/junior-rahman/spass-csv/issues
