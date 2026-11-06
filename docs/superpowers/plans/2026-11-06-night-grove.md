# Night Grove Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Night Grove UI (staged file → password → unlocking → organize vault with edit/delete-undo/merge, destination chip + sheet, new Other CSV) in the web app that the Android WebView loads.

**Architecture:** Pure helpers for duplicate detection, merge, edit and needs-a-look live in `web/src/lib/vault-ops.ts` (unit-tested, no DOM). `web/src/ui/app.ts` keeps its `el()`/state/sheet pattern but renders by *stage* (`home | password | unlocking | vault`). `styles.css` is rewritten to Night Grove tokens; Outfit TTFs are inlined by `scripts/build.mjs` as `data:` URIs.

**Tech Stack:** TypeScript, esbuild, vitest + jsdom, plain DOM, Kotlin WebView wrapper (unchanged except version/theme).

**Spec:** `docs/superpowers/specs/2026-11-06-night-grove-design.md`

## Global Constraints

- Tokens: Soil `#1C1917`, Grove `#3F4F3A`, Olive `#6B8F71`, Fern `#A3C9A8`, Cream `#F7F4EF`, Mist `#E8EDE6`, Caution `#B54708`, Danger `#FFB4A8`; sheet `#24201D`.
- CTA 58px / radius 18px / Olive fill / Soil text. Outfit 400/500/600 bundled locally.
- P-ring PNG used as-is (never recoloured).
- No trust strip, rail, Clear, search, "Keep with placeholders", P2 header chip.
- CSP stays offline: add only `font-src data:`.
- 1Password headerless; Google "no url"; Apple/Bitwarden/Other blank website; Other = headered `Title,Website,Username,Password,Notes`, file `passwords.csv`, no OTP in notes.
- Android `versionName = "2.0.8"`, `versionCode = 26`. Never commit APK/AAB/keystore.
- Parser/crypto untouched.

## File Structure

- Create `web/src/lib/vault-ops.ts` — siteKey, duplicateGroups, groupName, merge, edit, needsLook, GAP_TAG.
- Modify `web/src/lib/types.ts` — `FormatId` adds `"other"`.
- Modify `web/src/lib/formats.ts` — Other entry + `NAMED_FORMATS`.
- Modify `web/src/lib/csv.ts` — Other branch in `loginsToCsv`.
- Modify `web/src/lib/index.ts` — export vault-ops.
- Rewrite `web/src/ui/app.ts` — staged Night Grove UI.
- Modify `web/src/ui/dom.ts` — icons `close`, `chevron_right`, `check`, `description`, `credit_card`, `notes`, `home`.
- Rewrite `web/src/ui/styles.css` — Night Grove.
- Create `web/src/ui/assets/outfit-{400,500,600}.ttf` (copied from the mock assets).
- Modify `scripts/build.mjs` — inline fonts, `font-src data:`.
- Modify `web/index.template.html` — `color-scheme` dark, single theme-color.
- Modify `android/app/build.gradle.kts`, `android/app/src/main/res/values/themes.xml` — version + Soil.
- Tests: `web/test/vault-ops.test.ts` (new), `ui.test.ts`, `theme.test.ts`, `formats.test.ts`, `csv.test.ts`, `icons.test.ts`.

---

### Task 1: Spec + plan docs

**Files:** Create both docs. 

- [ ] **Step 1:** Write spec and this plan.
- [ ] **Step 2:** Commit: `git add docs/superpowers && git commit -m "docs(night-grove): spec and implementation plan"`

### Task 2: Vault operations + Other format (lib)

**Files:**
- Create: `web/src/lib/vault-ops.ts`
- Modify: `web/src/lib/types.ts`, `web/src/lib/formats.ts`, `web/src/lib/csv.ts`, `web/src/lib/index.ts`
- Test: `web/test/vault-ops.test.ts`, `web/test/formats.test.ts`, `web/test/csv.test.ts`

**Interfaces — Produces:**
- `siteKey(login: Pick<Login,"name"|"url">): string`
- `duplicateGroups(logins: Login[]): Login[][]`, `groupName(group: Login[]): string`
- `MERGE_FIELDS`, `MergeField`, `MergeSide`, `MergeChoice`, `defaultMergeChoice(a,b)`, `mergeLogins(a,b,choice): Login`
- `LoginEdit`, `applyLoginEdit(login, edit): void`
- `needsLook(logins, format): Login[]`, `lookGaps(login, format): LoginGap[]`, `GAP_TAG`
- `NAMED_FORMATS`; `FormatId` includes `"other"`.

- [ ] **Step 1: Write the failing test** — `web/test/vault-ops.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyLoginEdit, defaultMergeChoice, duplicateGroups, groupName, mergeLogins, needsLook, siteKey } from "../src/lib/vault-ops";
import { loginsToCsv } from "../src/lib/csv";
import type { Login } from "../src/lib/types";

const L = (over: Partial<Login>): Login => ({
  id: over.id ?? "x", name: "", url: "", username: "", password: "", note: "", otp: "", otpUri: "", needsSite: false, appLabel: "", ...over
});

describe("siteKey / duplicateGroups", () => {
  it("normalises amazon.com, www, Amazon and co.uk to one key", () => {
    expect(siteKey(L({ url: "https://www.amazon.com/login" }))).toBe("amazon");
    expect(siteKey(L({ name: "Amazon" }))).toBe("amazon");
    expect(siteKey(L({ name: "amazon.com" }))).toBe("amazon");
    expect(siteKey(L({ url: "https://www.amazon.co.uk" }))).toBe("amazon");
    expect(siteKey(L({}))).toBe("");
  });
  it("groups same-site logins only", () => {
    const a = L({ id: "a", name: "Amazon", url: "https://amazon.com", username: "shop@example.com" });
    const b = L({ id: "b", name: "amazon.com", url: "https://www.amazon.com" });
    const n = L({ id: "n", name: "Netflix", url: "https://netflix.com" });
    const groups = duplicateGroups([a, n, b]);
    expect(groups.map((g) => g.map((l) => l.id))).toEqual([["a", "b"]]);
    expect(groupName(groups[0])).toBe("Amazon");
  });
});

describe("mergeLogins", () => {
  const a = L({ id: "a", name: "Amazon", url: "https://amazon.com", username: "shop@example.com", password: "pa" });
  const b = L({ id: "b", name: "amazon.com", url: "https://amazon.com", username: "orders@example.com", password: "pb", note: "old", otp: "123" });
  it("defaults to A, but B when A is empty", () => {
    expect(defaultMergeChoice(a, b)).toEqual({ name: "a", url: "a", username: "a", password: "a", note: "b" });
  });
  it("keeps chosen fields under A's id without mutating inputs", () => {
    const m = mergeLogins(a, b, { name: "a", url: "a", username: "b", password: "b", note: "b" });
    expect(m).toMatchObject({ id: "a", name: "Amazon", username: "orders@example.com", password: "pb", note: "old", otp: "123" });
    expect(a.username).toBe("shop@example.com");
  });
});

describe("needsLook / applyLoginEdit", () => {
  it("counts website-missing as needing a look for every format, even after legacy keep", () => {
    const bank = L({ name: "Bank login", username: "jsmith", siteKeptBlank: true });
    for (const f of ["1password", "google", "apple", "bitwarden", "other"] as const) expect(needsLook([bank], f)).toHaveLength(1);
  });
  it("edit normalises website and clears the gap", () => {
    const bank = L({ name: "Bank login", username: "jsmith", needsSite: true });
    applyLoginEdit(bank, { name: "Bank login", url: "bank.example.com", username: "jsmith", password: "p", note: "" });
    expect(bank.url).toBe("https://bank.example.com");
    expect(needsLook([bank], "1password")).toHaveLength(0);
    applyLoginEdit(bank, { name: "Bank login", url: "not a site", username: "jsmith", password: "p", note: "" });
    expect(bank.url).toBe("");
    expect(bank.needsSite).toBe(true);
  });
});

describe("Other format", () => {
  it("writes headered Title,Website,Username,Password,Notes with blank website and no OTP", () => {
    const csv = loginsToCsv([L({ name: "Bank", username: "j", password: "p", note: "memo", otp: "JBSWY3DPEHPK3PXP" })], [], "other");
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Title,Website,Username,Password,Notes");
    expect(lines[1]).toBe("Bank,,j,p,memo");
    expect(csv).not.toContain("no url");
    expect(csv).not.toContain("JBSWY3DPEHPK3PXP");
  });
});
```

In `web/test/formats.test.ts` change the labels expectation to `["1Password", "Google Password Manager", "Apple Passwords", "Bitwarden", "Other"]` and add:

```ts
  it("Other is generic passwords.csv", () => {
    const o = FORMATS.find((f) => f.id === "other")!;
    expect(o.fileName).toBe("passwords.csv");
    expect(o.importSteps.join(" ")).toMatch(/password manager/);
  });
```

In `web/test/csv.test.ts` the fixed-order test expects `["1password", "google", "apple", "bitwarden", "other"]` and `formatRequiresUrl` false for `other`.

- [ ] **Step 2: Run** `npx vitest run web/test/vault-ops.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `web/src/lib/vault-ops.ts`:

```ts
import { loginGaps, normalizeUserUrl, resolvedTitle, type LoginGap } from "./model";
import type { FormatId, Login } from "./types";

const MULTI_PART_TLD = /^(co|com|org|net|gov|ac|edu)$/;

function hostOf(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(v) ? v : /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/.test(v) ? `https://${v}` : "";
  if (!withScheme) return "";
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostKey(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  let i = parts.length - 2;
  if (i > 0 && MULTI_PART_TLD.test(parts[i]) && parts[parts.length - 1].length === 2) i -= 1;
  return parts[i];
}

/** Site identity for duplicate detection: amazon.com, www.amazon.com, "Amazon" → "amazon". "" when unknown. */
export function siteKey(login: Pick<Login, "name" | "url">): string {
  const fromUrl = hostOf(login.url);
  if (fromUrl) return hostKey(fromUrl);
  const fromName = hostOf(login.name);
  if (fromName) return hostKey(fromName);
  return login.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Groups of ≥2 logins that look like the same site, in first-seen order. */
export function duplicateGroups(logins: Login[]): Login[][] {
  const map = new Map<string, Login[]>();
  for (const login of logins) {
    const key = siteKey(login);
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), login]);
  }
  return [...map.values()].filter((g) => g.length > 1);
}

/** Display name for a duplicate group: "Amazon". */
export function groupName(group: Login[]): string {
  const key = siteKey(group[0]);
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : resolvedTitle(group[0]);
}

export const MERGE_FIELDS = ["name", "url", "username", "password", "note"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeSide = "a" | "b";
export type MergeChoice = Record<MergeField, MergeSide>;

/** A unless A is empty and B is not. */
export function defaultMergeChoice(a: Login, b: Login): MergeChoice {
  const pick = (f: MergeField): MergeSide => (!a[f].trim() && b[f].trim() ? "b" : "a");
  return { name: pick("name"), url: pick("url"), username: pick("username"), password: pick("password"), note: pick("note") };
}

/** Returns one login (A's id) with the chosen fields; never mutates the inputs. */
export function mergeLogins(a: Login, b: Login, choice: MergeChoice): Login {
  const src = (f: MergeField) => (choice[f] === "a" ? a : b);
  const pw = src("password");
  const other = pw === a ? b : a;
  const url = src("url").url;
  return {
    ...a,
    name: src("name").name,
    url,
    username: src("username").username,
    password: pw.password,
    note: src("note").note,
    otp: pw.otp || other.otp,
    otpUri: pw.otp ? pw.otpUri : other.otpUri,
    appLabel: a.appLabel || b.appLabel,
    needsSite: url.trim() === "",
    siteKeptBlank: false
  };
}

export interface LoginEdit {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
}

/** Applies Edit-sheet values. Website is normalised; invalid text leaves it blank. */
export function applyLoginEdit(login: Login, edit: LoginEdit): void {
  login.name = edit.name.trim();
  login.url = normalizeUserUrl(edit.url);
  login.needsSite = login.url === "";
  login.siteKeptBlank = false;
  login.username = edit.username.trim();
  login.password = edit.password;
  login.note = edit.note;
}

/** Logins with any missing title, username or website (website counts for every format). */
export function needsLook(logins: Login[], format: FormatId): Login[] {
  return logins.filter((l) => lookGaps(l, format).length > 0);
}

export function lookGaps(login: Login, format: FormatId): LoginGap[] {
  return loginGaps({ ...login, siteKeptBlank: false }, format);
}

export const GAP_TAG: Record<LoginGap, string> = { title: "No title", username: "No username", url: "No website" };
```

`types.ts`: `export type FormatId = "1password" | "google" | "apple" | "bitwarden" | "other";`

`formats.ts` — append to `FORMATS` and export named list:

```ts
  { id: "other", label: "Other", fileName: "passwords.csv", hint: "Any other app or spreadsheet. Columns: Title, Website, Username, Password, Notes.", importSteps: ["Open your password manager’s import screen (often under Settings or Tools → Import).", "Choose a generic CSV import and pick the saved passwords.csv.", "Match the columns: Title, Website, Username, Password, Notes.", "Delete the CSV when the import finishes (it is plaintext)."] }
];
export const NAMED_FORMATS = FORMATS.filter((f) => f.id !== "other");
```

`csv.ts` — first branch after 1Password in `loginsToCsv`:

```ts
  if (format === "other") {
    return toCsv(["Title", "Website", "Username", "Password", "Notes"],
      logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, l.note]), ["Password"], false);
  }
```

`index.ts`: `export * from "./vault-ops";`

- [ ] **Step 4: Run** `npx vitest run` — Expected: lib tests PASS (ui "picker" test fails until Task 4).
- [ ] **Step 5: Commit** `git commit -am "feat(lib): vault ops (merge, edit, duplicates, needs-a-look) and Other CSV"`

### Task 3: Night Grove theme, Outfit bundling, build + Android

**Files:** `web/src/ui/styles.css` (rewrite), `web/src/ui/assets/outfit-*.ttf`, `scripts/build.mjs`, `web/index.template.html`, `web/test/theme.test.ts`, `android/app/build.gradle.kts`, `android/app/src/main/res/values/themes.xml`.

- [ ] **Step 1: Failing test** — replace `web/test/theme.test.ts` body:

```ts
import { existsSync, readFileSync } from "node:fs";
const css = readFileSync("web/src/ui/styles.css", "utf8");
const template = readFileSync("web/index.template.html", "utf8");
const build = readFileSync("scripts/build.mjs", "utf8");
describe("Night Grove tokens", () => {
  it("locks the palette", () => {
    for (const t of ["--soil: #1C1917", "--olive: #6B8F71", "--grove: #3F4F3A", "--fern: #A3C9A8", "--cream: #F7F4EF", "--mist: #E8EDE6", "--caution: #B54708", "--danger: #FFB4A8"]) expect(css).toContain(t);
  });
  it("CTA is 58px / radius 18px", () => {
    expect(css).toMatch(/\.cta\{[^}]*height: 58px/);
    expect(css).toMatch(/\.cta\{[^}]*border-radius: 18px/);
  });
  it("bundles Outfit locally and allows only data: fonts", () => {
    for (const w of ["400", "500", "600"]) expect(existsSync(`web/src/ui/assets/outfit-${w}.ttf`)).toBe(true);
    expect(css).toMatch(/font-family: Outfit/);
    expect(css).not.toMatch(/Inter|Roboto/);
    expect(build).toContain("font-src data:");
  });
  it("no in-app theme toggle; dark color-scheme", () => {
    expect(css).not.toMatch(/\[data-theme/);
    expect(template).toMatch(/name="color-scheme" content="dark"/);
    expect(template).toMatch(/Content-Security-Policy" content="%CSP%"/);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run web/test/theme.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Copy fonts: `cp ../dist/soft-grove-mockups/redesign-3/assets/outfit-*.ttf web/src/ui/assets/`. In `build.mjs` add `font-src data:` to `BASE_CSP` and before `transform` replace `url(assets/outfit-NNN.ttf)` with `url(data:font/ttf;base64,…)` read from `web/src/ui/assets/`. Rewrite `styles.css` with `:root` tokens above (written `--soil: #1C1917;` with a space), `@font-face` × 3, and classes used by Task 4: `.stage`, `.halo/.jewel` ring field (`.rings-lg` 280px/116px jewel, `.rings-sm` 180px/76px), `.cta`, `.text-btn`, `.well`, `.field`, `.vault-head`, `.chip`, `.tray.caution`, `.tray`, `.row`, `.av`, `.miss`, `.merge-banner`, `.tiles`, `.tile`, `.footer`, `.scrim/.sheet`, `.ng-grid/.ng-tile/.ng-other`, `.mg-*`, `.toast`, `.unlock-arc` (CSS `@keyframes spin`). Template: `color-scheme` `dark`, one `theme-color` `#1C1917`. Android: `versionCode = 26`, `versionName = "2.0.8"`; light `themes.xml` uses Soil window/status/nav bars and `windowLightStatusBar=false` (same as night).
- [ ] **Step 4:** `npx vitest run web/test/theme.test.ts && npm run build` — PASS.
- [ ] **Step 5:** Commit `feat(theme): Night Grove tokens, bundled Outfit, Soil Android bars, v2.0.8 (26)`.

### Task 4: Staged flow (home → password → unlocking → vault) + destination chip/sheet + Save

**Files:** `web/src/ui/app.ts`, `web/src/ui/dom.ts`, `web/test/ui.test.ts`, `web/test/icons.test.ts`.

**Interfaces — Consumes:** Task 2 exports. **Produces (testids):** `choose-file` (label for `#spass-file`), `filename`, `change-file`, `#spass-password`, `convert` (Unlock), `unlocking`, `vault`, `destination-chip`, `sheet-destination` with `[data-format]` tiles (`.ng-tile`, `.sel`, `role=radio`) + `[data-format=other]` row, `counts`, `needs-look` (+ `needs-look-item`), `merge-suggestion`, `logins` (+ `login`), `tile-cards`/`tile-notes`/`tile-addresses`, `save` (footer Save CSV), `sheet-needs-look` with `review` and optional `save-anyway`, `sheet-save` + `confirm-save`, `sheet-import-guide` + `guide-done`, `sheet-edit` (`#edit-title`, `#edit-url`, `#edit-username`, `#edit-password`, `#edit-notes`, `edit-save`, `edit-delete`), `snackbar` + `undo`, `sheet-merge` (`merge-opt[data-field][data-side]`, `merge-confirm`, `merge-cancel`), `about`.

- [ ] **Step 1: Failing tests** — rewrite `web/test/ui.test.ts` (full file committed in this task) covering: home shows only Choose file (no `#spass-password`, no `[data-format]`, no `trust`, no `rail`, no `clear`, no search input, no `save`); choosing a file shows password stage with filename and Unlock disabled until a password; wrong password error mentions "not your Samsung account password"; unlocking shows `unlocking`; unlock lands on `vault` with `destination-chip` "Save for 1Password" and footer `save`; chip opens sheet with 4 tiles + Other, picking `google` closes and updates chip + localStorage; Change file returns to home; Other save yields `passwords.csv` headered; needs-look count; Save with only website gaps offers `save-anyway`; no `incomplete-keep` anywhere; edit fills website → count drops; delete + undo; merge with a custom export that has two Amazon logins; About sheet; hidden page wipes.
- [ ] **Step 2:** `npx vitest run web/test/ui.test.ts` — FAIL.
- [ ] **Step 3: Implement** `app.ts`: `type Stage = "home" | "password" | "unlocking" | "vault"`, derived by `stage()` from `state.file / state.status / state.vault`. `paint()` switches on stage; `homeStage()`, `passwordStage()`, `unlockingStage()`, `vaultStage()`; sheets `destination | save | needs-look | edit | merge | import-guide | about`; `state.toast: { text: string; undo?: () => void } | null`. Change file = `wipe()`.
- [ ] **Step 4:** `npx vitest run` — PASS.
- [ ] **Step 5:** Commit `feat(ui): Night Grove staged flow, destination sheet, Save CSV footer`.

### Task 5: Organize, edit, delete-undo, merge

Same files as Task 4 (the tests listed under Task 4 for edit/delete/merge go green here).

- [ ] **Step 1:** Ensure the edit/delete/merge tests in `ui.test.ts` fail before implementation.
- [ ] **Step 2: Implement** `organize(vault)` (needs-look tray from `needsLook`, `GAP_TAG[lookGaps(l)[0]]`; merge banner from `duplicateGroups(vault.logins)[0]` with `groupName`; logins tray `complete of total`; tiles), `editSheet` (draft held on the sheet object, focus first gap field after paint, `applyLoginEdit` on Save, delete → splice + toast with undo re-inserting at the index), `mergeSheet` (`defaultMergeChoice`, option click sets choice and repaints, `mergeLogins` replaces A and removes B, toast "Merged {title}").
- [ ] **Step 3:** `npx vitest run && npm run typecheck` — PASS.
- [ ] **Step 4:** Commit `feat(ui): organize vault — needs a look, edit sheet, delete with undo, merge`.

### Task 6: Verify + capture

- [ ] `npm test`, `npm run typecheck`, `npm run build`, `npm run check` — all pass.
- [ ] Headless Chrome 390×844 @2x captures of home, password, unlocking, organize, edit, delete toast, merge, destination sheet into `../dist/soft-grove-mockups/redesign-3/shots/implemented-*.png` using a capture harness that mounts `app.js` with a fake platform and a synthetic sample export (harness lives outside the repo in `/workspace/spc/dist/...`).
- [ ] Compare to approved PNGs; fix spacing/copy; commit `fix(ui): Night Grove visual polish from capture review`.
