# 2.0.24

Disable Android Autofill inside the app so Google / Samsung Pass autofill services do not offer to save or fill passwords while the user edits logins.

- **Android.** `importantForAutofill` is set to `IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS` on the WebView, the root `FrameLayout`, and the window decor view. The existing `IME_FLAG_NO_PERSONALIZED_LEARNING` keyboard flag is unchanged.
- **Web UI.** Username, website, password, notes, and the export-password fields keep `autocomplete="off"` (never `"new-password"`) and add `data-1p-ignore` / `data-lpignore` so browser and extension password managers also skip them. Auto-capitalisation, autocorrect, and no-personalized-learning settings are unchanged.
- **Trade-off (accepted).** The `.spass` export password cannot be autofilled from a password manager either.

Tests: `web/test/audit-2024.test.ts`; Android policy check in `scripts/check-android.mjs`.
