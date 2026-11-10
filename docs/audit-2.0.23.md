# Audit 2.0.23 (fourth pass on 2.0.22, b4bc114)

Method: compared the decoder line by line with public `.spass` reverse-engineering (VictorLavalle/spass-tools `docs/FORMAT.md`,
misterpfister8/spasstocsv parser + crypto, 0xdeb7ef/spass-manager notes): base64(salt 20 | IV 16 | AES-256-CBC/PKCS7), PBKDF2-HMAC-SHA256 ×70 000,
CRLF plaintext, `version` / module flags / `false` / `next_table`, plain-text headers, base64 fields, base64 `&&&NULL&&&`, 35-column password table.
Decoded the spass-tools sample export (password published in its README) exactly. Shape-checked the owner's real export without decrypting it
(single line, unpadded base64, no BOM, block-aligned: passes). Code-reviewed every SAF / file-chooser / bridge path in `MainActivity.kt`,
memory wiping and storage, the CSP and build parity, and ran the save journey in Chromium and Firefox (WebKit could not start: its system
libraries can't be installed on the build box).

| Severity | Area | Finding | Fixed |
|---|---|---|---|
| Medium | Decoder | App logins without a `title` were named by package (`com.netflix.mediaclient`) although the export carries `app_name` ("Netflix"). That name goes into every CSV's title column. | `app_name` is used after `title`; `web/test/audit-2023.test.ts` |
| Medium | Privacy | The keyboard could learn usernames, notes, the export password and revealed passwords typed in the app (Chromium only sets no-learning in incognito). | `NoLearningWebView` adds `IME_FLAG_NO_PERSONALIZED_LEARNING`; `check-android` policy rule |
| Low | Edit | Username / website / revealed-password fields auto-capitalised the first letter and allowed autocorrect, silently changing what was typed (`Ada@…`). | `autocapitalize="off" autocorrect="off"` on those fields and the export password |

Checked, no change needed:
- Format variants: LF / CR / CRLF, BOM outside and inside the plaintext, line-wrapped base64, unpadded base64, zero logins with cards,
  empty password table, older exports without the third line, extra unknown tables, trailing blank lines (now regression tests).
- SAF: CreateDocument deletes the document on failure; "wt"→"w" fallback; a second save fails the first; picks after process death are dropped
  (vault is gone anyway); file chooser callbacks are always settled or the WebView is gone; rotation does not recreate (configChanges).
- Bridge: WebMessageListener goes over Mojo, not Binder (no TransactionTooLarge); JSON keeps surrogate pairs; CSV written as UTF-8 bytes.
- Memory/storage: Leave, Change file and background wipe the vault; only the chosen format id is in localStorage; no history entries,
  caches, IndexedDB or clipboard use; FLAG_SECURE on.
- Web: standalone script hash matches the CSP; standalone, `app.js` and Android assets identical; exact CSV in Chromium and Firefox.

Screenshots: `dist/audit-2.0.23/compare-fix-1-app-names.png`.
