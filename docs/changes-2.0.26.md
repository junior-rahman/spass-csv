# 2.0.26

Approved proposals A–F from the 2.0.25 audit, plus the Play Console edge-to-edge advisories. Tests: `web/test/audit-2026.test.ts`;
Android policy rules in `scripts/check-android.mjs`.

- **A · Google app links (safe part only).** For Google, an app login without a website gets the export's own
  `android://<hash>@<package>/` link instead of `no url`, but only when that link already passes Chromium's
  `FacetURI::IsValidAndroidFacetURI` (`components/affiliations/core/browser/affiliation_utils.cc`: non-empty hash of
  `[A-Za-z0-9-_=]` with valid base64 padding, package `[A-Za-z0-9._]`, no password / port / query / fragment, path empty or `/`).
  Chrome's importer accepts such a URL (`IsValidPasswordURL`). Not done: converting a standard-base64 hash (`+ /`) or building a
  link from `package_name` + `package_signature`. The real Samsung `origin_url` / signature format could not be verified (no
  decryptable real export; public format notes only say "Site URL"), and a wrong hash would import a credential that never fills.
  A website typed in Edit still wins. Other formats are unchanged.
- **B · Apple.** The no-website warning and the Apple import guide say Apple Passwords *may* skip a login without a website
  (not confirmed from Apple documentation).
- **C · Merge Show / Hide.** A Show button next to Password reveals both passwords (edge spaces shown in quotes); Hide masks them.
  Each merge preview starts hidden; FLAG_SECURE still blocks screenshots on Android.
- **D · Change file confirm.** In the unlocked vault, Change file opens "Leave and clear?" (Stay / Change file; notes an unsaved CSV).
  Change file goes to the home screen without leaving the app. On the password step it still resets straight away (nothing unlocked).
- **E · Delete returns to the list.** Deleting from Edit returns to Browse with the search kept (or to Needs a look), not the overview.
- **F · Blank usernames.** Google (Chromium `password_importer.cc` requires only a password and a valid URL) and Bitwarden
  (`BitwardenCsvImporter`: `login_username` optional) save a blank username with no warning. 1Password and Apple keep the
  `no username` requirement: no source or document confirms their importers take a blank username.
- **Edge-to-edge without deprecated APIs (Play advisories).** The deprecated calls came from androidx.activity's `enableEdgeToEdge()`
  (EdgeToEdgeApi26/28/29/35: `Window.setStatusBarColor` / `setNavigationBarColor`, `layoutInDisplayCutoutMode`) and the androidx.core
  insets controller it uses (`View.setSystemUiVisibility`), plus `android:statusBarColor` / `navigationBarColor` in the themes.
  Now: Android 15+ is edge-to-edge by the platform (target 36); Android 11–14 calls `Window.setDecorFitsSystemWindows(false)`;
  Android 10 keeps the system-fitted layout (only deprecated `SYSTEM_UI_FLAG_*` could opt in) with a charcoal status bar from
  `android:colorPrimaryDark`. Bar contrast scrims are off. Insets padding (bars, cutout, IME) applies when edge-to-edge.
  Release dex after R8: no `setStatusBarColor`, `setNavigationBarColor`, `setNavigationBarDividerColor`, `layoutInDisplayCutoutMode`
  or app/androidx `setSystemUiVisibility` left. One remains in Google's Play In-App Updates library
  (`PlayCoreDialogWrapperActivity.onCreate` → `View.setSystemUiVisibility`, app-update 2.1.0 is the latest); it can only go by
  dropping in-app updates.

Screenshot: `dist/changes-2.0.26/spcc-2.0.26-merge-show-and-change-file.png`.
