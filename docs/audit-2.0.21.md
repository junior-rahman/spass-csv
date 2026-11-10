# Audit — 2.0.21

Adversarial re-audit of 2.0.20 (after the 2.0.19 fixes and the 2.0.20 file check / Back confirm / Dismiss). Each fix has a regression test in `web/test/audit-2021.test.ts` or an Android policy check in `scripts/check-android.mjs`.

| Severity | Area | Bug | Fix |
|---|---|---|---|
| High | Parser | Passwords were trimmed on read: `" pw "` was exported as `"pw"`, so the imported password was wrong | Passwords read verbatim; CSV cells with edge whitespace are quoted |
| Medium | Android | **Other** saved as `samsung-pass.csv`: the Kotlin file-name gate rejected `passwords.csv` | `SAFE_NAME` accepts `passwords.csv`; policy check covers every name the page offers |
| Medium | Android | Spending over 60 s in the "Save to" picker showed "Couldn't save… Nothing was written" although the CSV was written (no guide, no delete reminder) | Save timeout pauses while the page is hidden; 15 s once back |
| Medium | Data | Undo while the Save confirm was open (Other → Delete all → Undo) wrote a CSV without the restored logins | Undo closes a stale primary Save confirm |
| Medium | Android | Android 10 (API 29) reports keyboard insets to edge-to-edge apps only in `adjustResize`; keyboard could cover inputs | `windowSoftInputMode="adjustResize"` |
| Low | Edit | A website Edit couldn't read (`münchen.de`, `localhost:8080`, a typo) was silently erased and the login dropped to Needs a look | IDN / punycode / localhost accepted; anything else shows an inline error and keeps the sheet |
| Low | Save | Save CSV with no logins wrote an empty file (0 bytes for 1Password) and showed the import guide | "No logins to save." (Bitwarden with notes still saves) |
| Low | a11y | Tab / TalkBack could leave an open sheet and reach the page behind it | Page behind a sheet is `inert` |
| Low | a11y | Input placeholders 4.1:1 on canvas | 55% cream, 5.5:1 |
| Low | Android | A cancelled file pick with no `cancel`/`focus` event left the page "pending", so Back on home did nothing | Pending pick cleared 1.5 s after the page is visible again |
| Low | Android | Very old WebView without the message bridge: Save fell back to a blob download that does nothing, yet reported success | Reports failure in a WebView |
| Low | Privacy | WebView usage metrics and Safe Browsing lookups were not opted out | Manifest `MetricsOptOut=true`, `EnableSafeBrowsing=false` |

## Checked, no bug
- New AndroidX deps support minSdk 29 (AAR metadata: activity 1.13.0 → 23, fragment 1.9.1 → 23, webkit 1.18.0 → 24).
- targetSdk 36 predictive back: AndroidX `OnBackPressedDispatcher` registers `OnBackInvokedCallback`; no manifest flag needed. Leave → `systemBack()` falls through to the Activity default.
- Release build: R8 on, no `@JavascriptInterface` (WebMessageListener only), assets present, signed with the upload key; Gradle 8.13 / AGP 8.11.1 build is warning-free.
- CSV headers vs current docs (Nov 2026): Google `name,url,username,password,note`; Bitwarden `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp`; Apple `Title,URL,Username,Password,Notes,OTPAuth`; 1Password Label step.
- Nasty fixtures (RTL, emoji ZWJ, quotes/commas/CRLF, 20 000-char values, formula leads) round-trip through all five exporters with an RFC 4180 parser. 5 000 logins: decrypt+parse ≈ 60 ms (node), unlock to overview ≈ 160 ms (Chrome).
- Real export (owner's file, not decrypted) passes the early shape check under odd provider names (`document`, `export.spass.txt`, `msf:…`, empty).
- Ember contrast: all text pairs ≥ 4.5:1 (muted 7.4–7.8, caution 8.5, danger 9.6, CTA label 8.1). Reduced motion slows the only animation. No overflow at 360 / 390 / 800 px.
- Dismiss + merge + undo ordering, undo after Change file (cleared), Back with snackbar / sheet / Leave open: behave as specified.

## Proposals (not changed)
- Google imports at most 3 000 passwords per file: split the Google CSV when a vault is larger.
- Browse with ~5 000 logins re-renders the whole list per keystroke (≈0.7 s in desktop Chrome, likely seconds on a phone): cap or virtualize the list.
- Browse group labels for international domains show punycode (`xn--…`).
- Return focus to the button that opened a sheet when it closes.
