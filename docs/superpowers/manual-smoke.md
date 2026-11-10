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
- [ ] Back closes an open sheet; back from Edit returns to the list; back on the password screen returns home; back from the vault asks "Leave and clear?" (see 2.0.20).
- [ ] Fold/unfold or resize in split-screen while unlocked → vault still shown (no reload).
- [ ] Cancel or fail a save (e.g. full storage) → no empty CSV left behind.
- [ ] 360 dp wide: overview tiles, merge sheet close button, and long notes all stay on screen.

## 2.0.20 checks (APK)
- [ ] Pick a photo / PDF / .zip → home stays, Ember caution callout explains it isn't a .spass. Pick a truncated `.spass` → "isn't a valid Samsung Pass export". Pick the real export → password screen.
- [ ] Vault, no sheet open, press Back → "Leave and clear?" sheet. Stay (or Back again) keeps the vault. Leave → app closes / goes to background; reopening shows home.
- [ ] Possible merges list: Dismiss on a row hides it, snackbar "Dismissed …" with Undo; the overview line count drops and disappears at zero. Merge preview: "Not the same login · Dismiss" does the same. Change file forgets dismissals.
- [ ] Play Console → App bundle explorer → dependencies list androidx.fragment 1.9.1 (no 1.0.0 warning).

## 2.0.21 checks (APK)
- [ ] Other → Save CSV: the system picker suggests `passwords.csv` (not `samsung-pass.csv`).
- [ ] Save CSV, wait over a minute in the "Save to" picker, then save: import guide + delete reminder appear (no "Couldn't save").
- [ ] Android 10 device: keyboard never covers the password field or Edit inputs (adjustResize).
- [ ] Edit → Website "my bank" → Save changes: red "That isn't a website…" under Website; nothing erased. `münchen.de` saves.
- [ ] Other → Save CSV → Delete all → Undo on the snackbar: Save confirm closes; tapping Save CSV again warns about the restored logins.
- [ ] Delete every login → Save CSV: "No logins to save." and no file.
- [ ] TalkBack / keyboard with a sheet open: focus never reaches the page behind it.
- [ ] Android 16 (API 36) gesture Back: predictive back still closes sheets and shows "Leave and clear?" from the vault.

## 2.0.22 checks (APK)
- [ ] Edit a login whose note has several lines → change the username → Save changes → Save CSV: the note keeps its line breaks in the CSV.
- [ ] Notes field in Edit grows to three lines; the keyboard's Enter adds a new line.
- [ ] Renderer kill: vault open → `adb shell am kill` is not enough; on a debug build run `adb shell dumpsys activity` to find the WebView sandboxed renderer and `adb shell kill <pid>` (root/emulator). App reloads to home instead of closing with "Spcc keeps stopping".
- [ ] Launcher icon (adaptive + themed) still shows after the `mipmap-anydpi` folder rename.
- [ ] Apple guide reads Settings → Apps → Safari → Import; 1Password guide reads your name → Import data → CSV File.
