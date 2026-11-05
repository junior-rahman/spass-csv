# Spcc

**Spass to CSV Converter.** Convert a Samsung Pass `.spass` export into a CSV for 1Password, Google Password Manager, Apple Passwords, or Bitwarden. Everything happens on your phone. Nothing is uploaded. No accounts, analytics, or telemetry.

Not affiliated with Samsung.

## Get it

- **Android app:** Google Play, or the signed APK on [GitHub Releases](https://github.com/junior-rahman/spass-csv/releases). The app never updates itself.
- **Web page:** download `samsung-pass-to-csv.html` from a release and open it in Chrome. It works offline and its Content-Security-Policy blocks all network requests (`connect-src 'none'`).

### Verify a downloaded APK

Each release lists the APK's SHA-256 and the signing certificate fingerprint.

```bash
sha256sum Pass-to-CSV-2.0.apk
apksigner verify --print-certs Pass-to-CSV-2.0.apk
```

Both must match the release notes. Do not install an APK that does not match.

## Use it

1. In Samsung Pass: Settings → Export data. Set an export password and save the `.spass` file.
2. Open Spcc, choose the file, type the **export** password (not your Samsung account password).
3. Pick 1Password, Google, Apple, or Bitwarden and tap **Convert**.
4. Check the list. Logins with no website stay blank — type one if you want. The app never guesses websites.
5. Tap **Save CSV**, confirm, and import the file into your password manager.
6. **Delete the CSV** and the `.spass` file after importing. The CSV holds your passwords in plain text.

The app follows your phone's light or dark setting.

## Develop

```bash
npm ci
npm test          # vitest: crypto round-trip, parser, golden CSVs, UI
npm run build     # writes index.html, app.js, samsung-pass-to-csv.html, android/app/src/main/assets/
npm run check     # fails if generated files drift or Android policy is violated
gradle -p android assembleRelease   # needs JDK 17 + Android SDK 34 and android/keystore.properties
```

Sources live in `web/src` (TypeScript) and `android/` (Kotlin). Never edit the generated root files by hand.
