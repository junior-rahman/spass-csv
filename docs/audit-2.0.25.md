# Audit 2.0.25 (fifth pass on 2.0.24, e604c51)

Method (new for this pass): read Chromium's Google Password Manager CSV importer (`components/password_manager/core/browser/import/`
`password_importer.cc`, `csv_password_sequence.cc`, `password_manager_constants.h`, `credential_utils.cc`) and checked every Google
row against its per-row rejection rules; jsdom journeys of the undo stacks across edit / merge / delete / dismiss with sheets open;
rapid-tap and double-submit review of every handler; seeded mutation fuzz of the parser (6,000 cases × parse, all exporters and
`unlockText`); Android lifecycle / save-intent / secret-hygiene review of `MainActivity.kt`; `npm audit`, Maven metadata for every Gradle
dependency; gradle lint; headless Chrome at 360 / 390 px. Each fix has a regression test in `web/test/audit-2025.test.ts`.

| Severity | Area | Finding | Fixed |
|---|---|---|---|
| Medium | Google CSV | Google Password Manager does not import a row whose URL is missing or not http(s)/android:// (`MISSING_URL` / `INVALID_URL`). The app promised "Save anyway — Google lists them as “no url”" and the import guide said they "show as no url": in fact those logins are left out. | Copy says Google skips them (sheet + guide); `no url` rows stay in the file so Google's "not imported" list names them |
| Medium | Google CSV | Google also rejects a row whose note is over 1,000 bytes (`LONG_NOTE`, UTF-8; Spcc appends the OTP line to Google notes). A login with long recovery codes was silently not imported, with no warning. | Google-only "Note too long" gap: Needs a look lists it, Review focuses Notes with a hint, Save anyway still allowed |
| Medium | Undo | Merge A+B → open the merged login in Browse → Undo: the Edit sheet stayed open on A holding the merged draft; Save changes wrote B's password over A, so A's original password was lost. | Undo closes an open Edit / Merge sheet whose login the undo replaced; unrelated edits keep their typing |
| Low | Merge | Passwords differing only by leading/trailing spaces (kept verbatim since 2.0.21) were shown as "Same in both", so B's password could not be chosen. | Compared verbatim; both shown with "spaces differ" |
| Low | Decoder | A website login without a title was named after the browser that saved it (`app_name` "Samsung Internet" since 2.0.23, or `com.sec.android.app.sbrowser`), or the full sign-in URL. That went into every CSV title. | Website logins use the host; app logins keep `app_name` (2.0.23 behaviour); OTP label follows |
| Low | UI | Edit's show/hide password eye was the reverse of the export-password field (open eye while hidden). | Crossed-out eye while hidden in both |
| Low | a11y | Browse search box had no accessible name (placeholder only). | `aria-label="Find a login"` |
| Low | Deps (dev only) | `npm audit`: 6 advisories (2 critical) in vitest 2 / tinypool / vite / esbuild 0.24 dev tooling; nothing ships (0 runtime deps). | vitest 4.1.12, esbuild 0.25.12 → 0 vulnerabilities; build output unchanged in behaviour |

Checked, no change needed:
- 2.0.23 / 2.0.24 regressions: export password keeps `type=password`, `autocomplete="off"` and no `readonly`/`onpaste` handlers, so typing and paste
  are unaffected (Autofill flags only remove the Autofill service; the IME clipboard and long-press Paste are separate). App logins keep `app_name`.
  `autocapitalize`/`autocorrect` off on username, website, password and export password; title and notes keep normal typing.
- CSV headers vs each importer: Google `name,url,username,password,note` (Chromium column map), Apple `Title,URL,Username,Password,Notes,OTPAuth`,
  Bitwarden 11-column `login_*` layout, 1Password headerless 5 columns, Other headered. Quoting: `"`, `,`, CR, LF, edge whitespace.
- Rapid taps: Unlock (status guard), Save confirm (`externalPending`), Merge / Delete / Delete all / Undo (second call finds nothing or the
  button is gone after re-render). Undo of delete / delete-all / dismiss / extras with any sheet open restores the same objects.
- Fuzz: 6,000 mutated exports raise only `SpassError`; every exporter accepts whatever parses.
- Secrets: vault, drafts and export password live only in `state` and the DOM; Leave / Change file / page hidden (WebView `onPause`) wipe
  them; `pendingCsv` cleared after the write, on renderer death and in `onDestroy`; FLAG_SECURE; nothing in storage but the format id.
- Android: lint 0 errors / 0 warnings (2 KTX hints). Runtime deps current (activity 1.13.0, webkit 1.18.0, fragment 1.9.1, app-update 2.1.0).
  AGP 9 / Kotlin 2.5 are majors and are not needed for target 36.
- Not verified (no device or KVM on the build box): IME composition in the Browse search box, which re-renders per keystroke; added to the
  manual smoke list.

Screenshots: `dist/audit-2.0.25/compare-fix-1-google-skips.png`, `dist/audit-2.0.25/after/edit-long-note-360.png`.
