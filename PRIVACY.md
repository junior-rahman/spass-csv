# Spcc — Privacy

- Spcc (Spass to CSV Converter) reads the `.spass` file you choose and decrypts it on your device with the password you type.
- Nothing is uploaded. The Android app's INTERNET permission is used only by Google Play to check for and apply updates; the WebView that does the conversion has no network access. The web page blocks all network requests with its Content-Security-Policy.
- No accounts, analytics, crash reporting, or telemetry.
- The app stores one setting on your device: the last password-manager format you chose.
- Unlocked data stays in memory only and is cleared when you tap Clear or leave the app.
- A CSV is written only when you tap Save CSV and confirm. It is plain text: delete it after you import it.
- The app never downloads or installs APKs itself. The Android app may contact Google Play only to check for and apply updates (Play In-App Updates); conversion stays on-device and the WebView has no network access. Sideloaded builds update from GitHub Releases manually.

Contact: open an issue at https://github.com/junior-rahman/spass-csv/issues
