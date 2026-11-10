# Audit — 2.0.19

Full re-audit of 2.0.18 (web UI, Android wrapper, parser, CSV exporters). Each fix has a regression test in `web/test/audit-2019.test.ts`, `web/test/audit-ui-2019.test.ts`, or an Android policy check in `scripts/check-android.mjs`.

| Severity | Area | Bug | Fix |
|---|---|---|---|
| High | Parser | `www.amazon.com`, `mail.google.com` and other 3-label hosts were read as Android package names, so the website was dropped | Host vs. package heuristic (`looksLikeHost`) |
| High | Android | Target 36 edge-to-edge: content under status/nav bars, keyboard covered inputs | Insets padding for system bars, cutout, IME |
| High | Android | Back exited the app instead of closing a sheet | `OnBackPressedCallback` → `spccBack()` |
| Medium | Parser | `android://<hash>@com.pkg/` app links not mapped | URI parser |
| Medium | Parser | IPv4 hosts (`192.168.1.1:8080`) lost | IPv4 accepted |
| Medium | Parser | Quoted multi-line fields (notes with blank lines) broke table splitting | Quote-aware splitter |
| Medium | CSV | `+44…` phone-number usernames got a `'` prefix and broke logins | Username written verbatim in every format |
| Medium | CSV | Card and address CSVs left phone/card fields open to formula injection | All cells formula-safe |
| Medium | Privacy | Unlock finishing while app hidden left vault in memory | Wipe if hidden after unlock |
| Medium | Privacy | Save result applied after Change file | Stale results discarded |
| Medium | Android | Fold / split-screen resize recreated the activity and lost the vault | `configChanges` widened |
| Medium | Android | Failed save left an empty file; no `"w"` fallback | Retry `"w"`, delete on failure |
| Medium | UI 360 | Long tile text overflowed, notes tile pushed off-screen | `minmax(0,1fr)` + ellipsis |
| Medium | UI 360 | Long merge title pushed the close button off-screen; long notes overflowed | `min-width:0`, `overflow-wrap:anywhere` |
| Low | UI | Emoji title avatar showed half a surrogate | Grapheme-safe initial |
| Low | UI | "1 Cards" | Pluralized counts |
| Low | a11y | Password error `aria-describedby` pointed at nothing; sheets had no focus/label; no Esc | Fixed |
| Low | Web | Favicon still old green | Ember favicon |
| Low | Safety | No size cap on `.spass` | 64 MB cap |
| Low | Build | Single-file HTML could break if JS contained `$'`/`` $` `` (String.replace patterns) | Function replacers + CSP-hash test |
| Low | Build | AGP 8.5.2 untested with compileSdk 36; Kotlin annotation warnings | AGP 8.11.1 / Gradle 8.13 / Kotlin 2.0.21, warning-free |
