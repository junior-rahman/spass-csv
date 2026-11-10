# 2.0.20

Owner-picked items from the 2.0.19 audit proposals.

- **(D) Clear file errors.** The picked file is checked before the password step: name, size (64 MB cap), and shape (plaintext Samsung Pass export, or base64 salt+IV+AES blocks). Wrong type, damaged/incomplete, empty, or too large files show an inline Ember caution callout on the file stage (`role="alert"`). Android no longer drops non-.spass picks silently in Kotlin; every pick reaches the page, which explains rejections. A real export whose provider reports a mangled name still opens (content decides).
- **(E) Back asks before clearing.** Android Back from the vault with no sheet open shows "Leave and clear?" — **Stay** (primary) or **Leave**. Back again = Stay. Leave wipes the vault and hands Back to Android (`{type:"leave"}` bridge message). Change file is unchanged (immediate reset).
- **(F) Dismiss merge suggestions.** Each row in Possible merges and the single merge preview has Dismiss. It hides that suggestion (same site + same username) for this session with an Undo snackbar; the overview line updates its count and disappears when none are left. Dismiss never deletes logins; Change file / leaving forgets dismissals.
- **Dependencies.** `androidx.fragment:fragment:1.9.1` declared explicitly (Play flagged the transitive 1.0.0 from Play app-update); `androidx.activity` 1.9.3 → 1.13.0, `androidx.webkit` 1.11.0 → 1.18.0. The lint suppression for the old fragment is removed.

Tests: `web/test/ddef-2020.test.ts`; Android policy checks in `scripts/check-android.mjs` (no Kotlin `isSpassUri` drop, `leave` handled, fragment declared).
