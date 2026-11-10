# Manual smoke — Spcc 2.0

Run in Chrome (web, light + dark via DevTools Rendering) and on an Android 10+ device (APK, system dark mode on and off).

Synthetic export: generate `/tmp/sample.spass` with `encryptSpass(samplePlaintext(), "correct horse battery")` from `web/src/lib/index.ts`. Never commit it.

## Flow
- [ ] Rail shows `1 · File` active; Convert disabled until a file and password are entered.
- [ ] Wrong password → red text under the password field mentioning "not your Samsung account password".
- [ ] Non-.spass file (a PNG) → format error under the file card.
- [ ] Correct password (`/tmp/sample.spass`, `correct horse battery`) → results expand in place; rail on `2 · Unlock`; counts 3 · 1 · 1 · 1; **no file written**.
- [ ] "Chase Bank Card" shows an amber blank website field; nothing like `chasebank.com` anywhere.
- [ ] Search "bank" filters to 2 logins; reveal/hide toggles one password.
- [ ] Switch chip to Apple → Save CSV → sheet warns plaintext; rail on `3 · Save`; Cancel writes nothing.
- [ ] Confirm → `samsung-pass-apple.csv` saved (APK: system "Save to" picker); snackbar; delete-after-import reminder visible.
- [ ] Open the CSV in Sheets: the `=HYPERLINK` note shows as text starting with `'`.
- [ ] Import each of the four CSVs into 1Password, Google, Apple, Bitwarden test vaults — titles, URLs, usernames, passwords, OTP land correctly.
- [ ] Clear → confirm → file name, password field, and results gone.
- [ ] Unlock, press Home, return → results gone (APK). Recents thumbnail is blank; screenshot blocked (FLAG_SECURE).
- [ ] Reopen app → last chip (Apple) still selected.

## Themes (Warm Grove)
- [ ] Light: white cards, solid Grove `#3F4F3A` Convert, no glow.
- [ ] Dark: forest gradient background, glass cards, lock glow, Olive→Grove gradient Convert/Save CTA; status bar dark.
- [ ] No theme toggle anywhere.

## Offline / security
- [ ] Airplane mode: everything above still works.
- [ ] `aapt2 dump permissions` shows no INTERNET / REQUEST_INSTALL_PACKAGES.
- [ ] `adb shell bmgr backupnow com.jrrahman.passtocsv` backs up nothing.
- [ ] Real export (owner's device only): unlocks; password never typed into logs or chat.

## Play screenshots (light + dark)
- [ ] Idle console (File), unlocked with counts (Unlock), save confirm sheet (Save).

## 2.0.19 audit checks (APK)
- [ ] Status bar, navigation bar, and cutout never cover content; the keyboard never covers the password field or edit inputs.
- [ ] Back closes an open sheet; back from Edit returns to the list; back on the password screen returns home; back from the vault leaves the app (and clears it).
- [ ] Fold/unfold or resize in split-screen while unlocked → vault still shown (no reload).
- [ ] Cancel or fail a save (e.g. full storage) → no empty CSV left behind.
- [ ] 360 dp wide: overview tiles, merge sheet close button, and long notes all stay on screen.
