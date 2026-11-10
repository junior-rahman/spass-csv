# Audit 2.0.22 (third pass on 2.0.21, a1be34b)

Method (different from the 2.0.19/2.0.21 passes): end-to-end headless-Chrome journeys at 360 and 390 px for all five destinations
(edit → delete + undo → dismiss + undo → merge + undo → save → Change file → second file → fix a "needs a look" login → edit → save),
each saved CSV parsed with a strict RFC 4180 parser and compared field-by-field with an independent oracle; seeded property/fuzz tests
of the parser, decryptor and exporters; gradle lint; static review of `MainActivity.kt` and the bridge; every user-facing string re-read.

| Severity | Area | Finding | Fixed |
|---|---|---|---|
| High | Edit | Notes was a single-line `<input>`: opening Edit on a login with a multi-line note and saving any change collapsed the note's line breaks (e.g. recovery codes ran together). Reproduced by the e2e journey on 2.0.21 for all 5 destinations. | Notes is a 3-row `<textarea>`; `web/test/audit-2022.test.ts` |
| Medium | Android | No `onRenderProcessGone`: a WebView renderer crash or low-memory kill (likely while the app sits behind the file pickers) crashed the whole app. | Handler drops pending save/pick state, destroys the dead WebView and recreates the activity; lifecycle calls guarded; `check-android` policy rule |
| Low | Copy | Apple import steps pointed to Settings → Apps → Passwords (no import there). iPhone imports via Settings → Apps → Safari → Import; Mac via Passwords → File → Import Passwords. | Yes |
| Low | Copy | 1Password: menu is your name → Import data → CSV File; Google: Chrome → Settings → Google Password Manager → Settings → Import passwords. | Yes |
| Low | Copy | "plaintext" vs "plain text"; "set while exporting" vs "when exporting". | Unified |
| Low | Lint | RequiresFeature (reply `postMessage` not feature-gated), ObsoleteSdkInt (`SDK_INT >= O`, `mipmap-anydpi-v26`), VectorPath on launcher vectors. | 0 warnings (2 KTX hints remain) |

Checked with no regressions: all twelve 2.0.21 fixes (verbatim passwords + quoting, `passwords.csv` for Other, save timer paused while hidden,
undo closes stale Save sheet, adjustResize, IDN/punycode/localhost URLs + urlError, empty-save guard, inert background, placeholder contrast,
picking flag reset, WebView save fallback, metrics/Safe Browsing opt-out). Fuzz: 400 random logins × 5 formats round-trip exactly; 300 garbage /
truncated `.spass` inputs × 2 passwords only ever raise `SpassError`. Double save, process death mid-save (CSV deleted, page told ok=false) and
callbacks after destroy reviewed.

Screenshots: `dist/audit-2.0.22/` (compare-fix-1-edit-notes.png, compare-fix-2-import-steps-*.png).
