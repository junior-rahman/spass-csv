# Pass to CSV — Full Redesign Spec

**Date:** 2026-11-05  
**Product:** Pass to CSV (Samsung Pass `.spass` → CSV)  
**Repo:** `junior-rahman/spass-csv`  
**Status:** Design locked — Hybrid A+B+C with system light/dark  
**Approach:** Hybrid — single-screen console + phase rail + glass/Material dual theme  
**Related:** Architecture audit `/workspace/spc/AUDIT.md`, Security audit `/workspace/spc/SECURITY.md`, Fix Plan Page (queued until this design ships into implementation)

---

## 1. Goals

- Publish broadly (Play Store + local web page + marketing/listing).
- Look premium enough that people will pay.
- Material / Android-native visual language.
- Security-first UX: explicit warnings and confirmations throughout.
- Equal support for 1Password, Google Password Manager, Apple Passwords, and Bitwarden.
- Absorb the queued security/architecture fixes into the product design (not a separate afterthought patch).

### Non-goals (this redesign)

- Full-page multi-step wizard (Approach A alone) — guidance is a phase rail on one screen, not separate pages.
- Pure MojaLoss media-app chrome (Approach C alone) — glass/glow only in dark theme; light stays Material.
- Server-side conversion or any upload of `.spass` / CSV.
- In-app APK auto-updater (removed; updates via Play / Releases only).
- Inventing websites from login names or package strings.
- Manual theme toggle (theme follows the phone / browser `prefers-color-scheme` only).

---

## 2. Product concept

One phone-width screen. Everything on one scroll. Hybrid of Approaches A + B + C:

- **From A:** compact phase rail — `1 · File` → `2 · Unlock` → `3 · Save` — updates in place (not separate wizard pages).
- **From B:** single-screen Material console, equal format chips, expand-in-place results, sticky Save/Clear, confirm sheets.
- **From C:** dark theme uses glass cards, glow lock mark, gradient primary CTAs.

**Idle / input region**

1. Top app bar: product name, lock mark, overflow (About, Privacy).
2. Phase rail (File / Unlock / Save) — File active while choosing file + password + format.
3. Trust strip: stays on this phone · nothing uploaded.
4. Card — Export file: choose `.spass`, show filename.
5. Card — Export password: field + show/hide; helper text that this is the export password, not the Samsung account password.
6. Card — Save as: four equal format chips (1Password, Google, Apple, Bitwarden).
7. Primary CTA: Convert.

**After successful unlock (same screen expands)**

8. Phase rail advances to Unlock.
9. Counts row (logins · cards · addresses · notes).
10. Search field for logins.
11. Login list: name, username, reveal/hide password; website field only when missing (blank, never auto-guessed).
12. Sticky bottom actions: Save CSV (opens confirm sheet) · Clear (opens confirm).
13. Secondary actions: Save cards / addresses / notes when present.
14. Persistent post-save reminder: delete the CSV after import.
15. Opening Save confirm advances phase rail to Save.

Sample preview lives under About / overflow, not on the primary path.

---

## 3. Visual system (Material 3 + dual theme)

- **Theme:** Follow the phone / browser default via `prefers-color-scheme` (WebView respects Android day/night). No in-app theme toggle.
  - **Light:** Material 3 surfaces, elevated white cards, teal primary `#1e3a34`, neutral ink.
  - **Dark:** Deep forest shell (`#0c1210`–`#121a18`), translucent glass cards, glow on lock mark, gradient primary CTAs (`#3d8f76` → `#1e3a34`).
- **Shape:** 16–28 dp corner radii on cards/buttons; 8 dp grid; phase pills fully rounded.
- **Padding:** 16 dp page padding; respect safe-area insets.
- **Color:** Deep teal-forest primary family based on `#1e3a34` in both themes. Danger for errors; amber callout for missing website.
- **Type:** System / Roboto. Title-large for app name; body-medium for body; label-large for chips.
- **Buttons:** Filled primary = Convert / Save; tonal = selected format chip; outline = Clear / secondary.
- **Icons:** Material Symbols only (folder, lock, download, delete, visibility).
- **Motion:** Short standard Material transitions; no decorative illustration clutter.
- **App bar:** Small lock mark + title; no large hero art (glow is subtle on the mark only in dark).

APK and local web page share the same visual tokens and layout.

---

## 4. Interaction & security UX

| Moment | Behavior |
|--------|----------|
| Wrong / empty password | Hard error; copy distinguishes export password vs Samsung account password. |
| Bad / non-`.spass` file | Hard error; accept `.spass` (and text) only — not `*/*`. |
| Missing website | Blank URL; optional manual field; curated package→site map only; never `<name>.com` inference; no “Allow all.” |
| Convert success | Expand results in place; **do not** write CSV yet. |
| Save CSV | Confirm bottom sheet: plaintext warning + delete-after-import; then write/share. |
| Clear | Confirm; wipe in-memory vault, file bytes, password field. |
| Background / pause (APK) | Clear vault from memory; `FLAG_SECURE` on activity. |
| About / Privacy | On-device only, no upload, no telemetry, no in-app updater. |

Wrong-password detection must require a real Samsung Pass header structure and `next_table` (not merely `;`). CSV cells neutralize spreadsheet formula prefixes (`=`, `+`, `-`, `@`) for note/name fields where import formats allow.

---

## 5. Format support (equal)

Four chips, equal visual weight; selection is filled tonal.

| Format | Primary columns | Notes |
|--------|-----------------|-------|
| 1Password | Title, Website, Username, Password, Notes | OTP appended into Notes when present. |
| Google | name, url, username, password, note | OTP in note. |
| Apple | Title, URL, Username, Password, Notes, OTPAuth | OTPAuth column when present. |
| Bitwarden | Bitwarden CSV login (+ notes as note type) | Cards remain a separate export. |

Default chip: last-used if stored locally; otherwise 1Password (current APK default). Changing chip after unlock rewrites the primary CSV preview/filename without re-decrypting.

Extra exports (cards, addresses, notes, full table) remain secondary buttons when data exists.

---

## 6. Surfaces

### Android APK

- Package continues as Pass to CSV (`com.jrrahman.passtocsv` unless Play requires a rename later).
- Load UI via **WebViewAssetLoader** only — no localhost HTTP server, no cleartext config for loopback.
- JS bridge (`window.Android`), if kept: origin-restricted; prefer WebCrypto for decrypt; bridge limited to file pick + Downloads write.
- Permissions: drop `REQUEST_INSTALL_PACKAGES`; keep storage/Downloads write path as required by target SDK; no unnecessary `INTERNET` if updater is gone (confirm whether any remaining network need exists — default: none).
- Release build, `allowBackup=false`, `FLAG_SECURE`, proper release signing (not debug `CN=Local`).

### Local web page

- Same UI assets (`index.html` + app bundle, plus single-file `samsung-pass-to-csv.html` generated from the same source).
- Works offline after load; `connect-src 'none'` CSP.

### Play Store listing / marketing

- **Title:** Pass to CSV  
- **Subtitle:** Samsung Pass export converter  
- Screenshots: idle console, unlocked with counts, save-confirm sheet.  
- Short description leads with on-device conversion / nothing uploaded.  
- Listing privacy text matches in-app Privacy.  
- Pricing is out of scope for UI code; design assumes paid-ready polish.

---

## 7. Architecture (redesign)

```
┌─────────────────────────────────────────┐
│  Shared UI (Material console)           │
│  mount() state: form | working | done   │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│  Client core                            │
│  crypto → parse → vault → CSV writers   │
└───────────────┬─────────────────────────┘
                │
     ┌──────────┴──────────┐
     ▼                     ▼
 WebViewAssetLoader     file:// / static
 (APK)                  (web / single HTML)
```

- **Single source of truth:** restore TypeScript (or clearly structured JS modules) under `web/`; Android project under `android/`; one build emits root web assets, inlined HTML, and APK `assets/`. CI fails on drift.
- **No in-app updater.** Updates via Play Store and/or GitHub Releases only.
- Queued Fix Plan Phases 0–3 are prerequisites or concurrent with implementing this UI (Phase 0 kill updater; stop domain guessing + auto-save; harden WebView; single source + tests).

---

## 8. Error handling

- Typed errors (`password`, `format`, `empty`) map to Material error text under the relevant field or a banner.
- Partial tables / unfinished Samsung exports: clear format error (existing APK copy direction).
- Share/save failures: snackbar; do not claim success.

---

## 9. Testing

- Unit: encrypt → decrypt → parse → each CSV format golden fixtures (no real user secrets in fixtures).
- Parser: header + `next_table` required; `&&&NULL&&&` handling; formula-safe `cell()`.
- UI smoke: Convert disabled until file+password; Save confirm required; Clear wipes state.
- Manual: real `.spass` on device (password never logged); Play screenshot set.

---

## 10. Acceptance criteria

- [ ] One-screen hybrid console matches Sections 2–4 visually and in flow (phase rail + light/dark).
- [ ] Four formats equal; no silent preference beyond last-used.
- [ ] No auto-save; no guessed websites; save + clear confirmations present.
- [ ] APK uses WebViewAssetLoader; no localhost server; no in-app updater.
- [ ] Web + APK + inlined HTML built from one source; CI drift check.
- [ ] Privacy/About + Play listing claim on-device only and match.
- [ ] Round-trip tests green; no secrets in repo fixtures.
- [ ] Release-signed APK with `FLAG_SECURE` and `allowBackup=false`.

---

## 11. Open decisions (explicit defaults)

| Topic | Default in this spec |
|-------|----------------------|
| Default format chip | Last-used, else 1Password |
| Dark theme | System `prefers-color-scheme` / Android day-night — required |
| Paid vs free on Play | Deferred (UI assumes paid-ready) |
| Package rename for Play | Keep `com.jrrahman.passtocsv` unless store policy forces change |
| Native Compose rewrite | Out of scope; WebView + shared web UI |

---

## 12. Out of scope

- Cloud sync, accounts, analytics, crash reporters that upload vault data.
- Converting other password managers *into* Samsung Pass.
- iOS app.
- Restoring the broken private-repo raw updater.

---

## Approval

Conversation approved Sections 1–6 (product, visual, layout, security UX, Play listing, architecture). This document is the written form for final review before the implementation plan.
