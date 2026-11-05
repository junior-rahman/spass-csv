# Import UX + public OSS + size — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship destination-based import UX (picker + post-Save guide + 1Password Notes without OTP), publish the repo as MIT open source without binaries, shrink the Android install, and keep Play at $2.99 one-time.

**Architecture:** Keep `FormatId` / `FORMATS` as the destination model; replace chip UI with a “Where are you importing?” control; on successful `platform.save`, open an `import-guide` sheet driven by per-format step copy. Strip OTP from 1Password Notes in `loginsToCsv`. Add MIT `LICENSE`, rewrite README for source-only public repo, harden `.gitignore` against APK/AAB, minify/trim Android assets, bump to 2.0.7.

**Tech Stack:** TypeScript web UI (`web/src`), Vitest, Android WebView (`android/`), GitHub (`junior-rahman/spass-csv`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-05-import-ux-polish-design.md`
- Warm Grove / P2 Soft / device theme only — no theme toggle
- Never invent websites or passwords
- 1Password CSV: headerless Title,Website,Username,Password,Notes; blank missing websites; **no OTP in Notes**
- Google only: `no url` placeholder when website missing
- Public repo: MIT; **no** `.apk` / `.aab` / keystore secrets in git
- Play price $2.99 one-time (Play Console bot owns Console UI)
- Version after ship: `2.0.7` / versionCode 25
- Package: `com.jrrahman.passtocsv`

### File map

| File | Responsibility |
|------|----------------|
| `web/src/lib/formats.ts` | Destination labels, hints, **importSteps[]** |
| `web/src/lib/csv.ts` | 1Password Notes without OTP |
| `web/src/ui/app.ts` | Destination picker UI; `import-guide` sheet; confirmSave → guide |
| `web/src/ui/styles.css` | Picker + guide styles |
| `web/test/csv.test.ts` | Golden + OTP-absent assertions |
| `web/test/` (UI if present) | Guide sheet / picker smoke |
| `LICENSE` | MIT |
| `README.md` | Public source + Play $2.99; no “download APK from repo” |
| `.gitignore` | `*.apk` `*.aab` `dist/` |
| `android/app/build.gradle.kts` | versionName/Code; minify if safe |
| `docs/play/listing.md` | $2.99 price note |

---

### Task 1: Strip OTP from 1Password Notes (TDD)

**Files:**
- Modify: `web/src/lib/csv.ts`
- Test: `web/test/csv.test.ts`

**Interfaces:**
- Consumes: `noteWithOtp`, `loginsToCsv`
- Produces: 1Password rows use `l.note` only (not `noteWithOtp`); Apple/Bitwarden/Google OTP behavior unchanged

- [ ] **Step 1: Write failing test**

In `web/test/csv.test.ts`, add:

```ts
it("1password: Notes has no OTP line", () => {
  const out = loginsToCsv(vault().logins, vault().notes, "1password");
  expect(out).not.toMatch(/OTP:/);
  expect(out).not.toMatch(/otpauth:/i);
  const mail = out.trim().split("\r\n")[0];
  expect(mail).toContain("Fake entry for the preview");
  expect(mail).not.toContain("OTP:");
});
```

Update the existing 1Password golden expectation so Sample Mail Notes are only `Fake entry for the preview` (no OTP suffix).

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd /workspace/spc/app && npx vitest run web/test/csv.test.ts -t "1password"`

- [ ] **Step 3: Implement**

In `loginsToCsv` for `"1password"`, map Notes to `l.note` only:

```ts
logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, l.note]),
```

Update `formats.ts` 1Password `hint` to remove “One-time codes are in Notes.”

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run web/test/csv.test.ts`

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/csv.ts web/src/lib/formats.ts web/test/csv.test.ts
git commit -m "fix(csv): strip OTP from 1Password Notes for cleaner Label step"
```

---

### Task 2: Import steps data on FORMATS

**Files:**
- Modify: `web/src/lib/formats.ts`
- Test: `web/test/csv.test.ts` or new `web/test/formats.test.ts`

**Interfaces:**
- Produces: `FormatInfo.importSteps: readonly string[]`; optional `importTitle: string`

- [ ] **Step 1: Failing test** — every format has `importSteps.length >= 3`; 1Password steps include the exact Label order string `Title, Website, Username, Password, Notes`.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Add to `FormatInfo` and fill steps**

```ts
export interface FormatInfo {
  id: FormatId;
  label: string;
  fileName: string;
  hint: string;
  /** Post-Save checklist (ordered). */
  importSteps: readonly string[];
}
```

1Password steps (exact intent):
1. Open my.1password.com and sign in
2. Import → CSV File → upload the saved CSV
3. On Label, set columns left→right: Title, Website, Username, Password, Notes
4. Continue, then delete the CSV (it is plaintext)

Include a step that blank Website cells are OK; add real URLs later for autofill.

Google / Apple / Bitwarden: expand current hints into 3–5 short steps each.

Also set display labels: Google → `Google Password Manager`, Apple → `Apple Passwords` in `label` (or add `pickerLabel` if short chips still needed — prefer full names in the new picker).

- [ ] **Step 4: PASS + commit**

```bash
git commit -m "feat(formats): per-destination importSteps for post-Save guide"
```

---

### Task 3: Destination picker UI

**Files:**
- Modify: `web/src/ui/app.ts` (`formatCard`, compact strip)
- Modify: `web/src/ui/styles.css`

**Interfaces:**
- Consumes: `FORMATS`, `storeFormat`, `loadFormat`
- Produces: UI control labeled “Where are you importing?”; no chip radiogroup

- [ ] **Step 1: Replace `formatCard()` chips with a vertical list of full-width buttons (role=radiogroup, aria-label=`Where are you importing?`), heading text exactly `Where are you importing?`. Selected uses existing `.chip.selected` / new `.dest selected` Olive/Fern styles.

- [ ] **Step 2: Replace compact post-unlock chip strip with a single summary line + **Change** that reopens the same picker (sheet or inline). Do not leave four chips.

- [ ] **Step 3: Manual/CSS: 48dp targets, Fern focus rings, dark contrast.

- [ ] **Step 4: `npm run build` + vitest; commit

```bash
git commit -m "feat(ui): Where are you importing? destination picker"
```

---

### Task 4: Post-Save import guide sheet

**Files:**
- Modify: `web/src/ui/app.ts` (state.sheet kinds, `confirmSave`, `sheet()`)
- Modify: `web/src/ui/styles.css`

**Interfaces:**
- Sheet kind: `{ kind: "import-guide" }` (uses `state.format` for copy)
- On `confirmSave` success (`ok === true`): set `state.sheet = { kind: "import-guide" }` (prefer guide over snackbar-only; snackbar optional one-liner)

- [ ] **Step 1: Extend sheet union with `import-guide`**

- [ ] **Step 2: In `confirmSave`, when `ok`, open import-guide sheet listing `FORMATS.find(...).importSteps` as `<ol>`, title like `Import into {label}`, Done button clears sheet.

- [ ] **Step 3: UI test if harness exists: after mocked save success, sheet kind import-guide present.

- [ ] **Step 4: Commit

```bash
git commit -m "feat(ui): post-Save import guide sheet per destination"
```

---

### Task 5: MIT + public README + no binaries in git

**Files:**
- Create: `LICENSE` (MIT, Copyright 2026 Juel Hossain)
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `docs/play/listing.md` (price $2.99)

- [ ] **Step 1: Add MIT LICENSE**

- [ ] **Step 2: Rewrite Get it section:** Play Store paid **$2.99** one-time; build from source for developers; **do not** host APK/AAB in the repo or promise GitHub Release APKs as the primary path. Keep privacy / on-device claims.

- [ ] **Step 3: `.gitignore` add:**

```
*.apk
*.aab
/dist/
```

Confirm no APK/AAB currently tracked (`git ls-files '*.apk' '*.aab'` empty).

- [ ] **Step 4: listing.md note default Play price USD 2.99 one-time.**

- [ ] **Step 5: Commit**

```bash
git commit -m "docs: MIT license, public source README, ignore APK/AAB, Play \$2.99"
```

- [ ] **Step 6: Make repo public** (if `gh` auth allows):

```bash
gh repo edit junior-rahman/spass-csv --visibility public --accept-visibility-change-consequences
```

If this fails (permissions), report blocker; do not force.

---

### Task 6: App size pass

**Files:**
- `android/app/build.gradle.kts`
- Asset pipeline / `npm run build`
- Possibly enable `isMinifyEnabled` for release + shrinkResources if ProGuard rules already safe for WebView

- [ ] **Step 1: Measure** current debug APK and release AAB sizes; note asset sizes under `android/app/src/main/assets/`.

- [ ] **Step 2: Ensure release uses minify/shrink if not already; remove unused mipmaps/density duplicates if any; ensure web bundle is minified on build.

- [ ] **Step 3: Rebuild release AAB; report before/after sizes. Do not break WebViewAssetLoader or IAU.

- [ ] **Step 4: Commit size-related gradle/asset changes only if measurable.

---

### Task 7: Version 2.0.7 + artifacts + push

**Files:**
- `android/app/build.gradle.kts` versionName `2.0.7` versionCode `25`
- Any About string if version shown (spec said avoid inventing About version — skip unless already present)

- [ ] **Step 1: Bump versions**

- [ ] **Step 2: `npm test && npm run build && npm run check`**

- [ ] **Step 3: `bundleRelease` → `/workspace/spc/dist/Spcc-2.0.7-release.aab`; `assembleDebug` → `/workspace/spc/dist/Spcc-2.0.7-debug.apk` (local dist only, gitignored)

- [ ] **Step 4: Push `main`; notify that Play Console should use 2.0.7 AAB and $2.99**

- [ ] **Step 5: Final commit if needed: `chore: Spcc 2.0.7`

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Destination picker | 3 |
| Post-Save full steps | 2+4 |
| 1Password OTP stripped | 1 |
| Blank websites non-Google | already 2.0.6 |
| Warm Grove / no extra product | 3–4 |
| MIT + no binaries + public | 5 |
| Size | 6 |
| 2.0.7 | 7 |
| Play $2.99 | 5 (docs) + Play Console bot |

## Out of scope

Play Console identity verify, Create app, upload (Play Console agent). Decrypting user `.spass`.
