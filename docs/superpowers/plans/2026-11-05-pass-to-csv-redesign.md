# Pass to CSV Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Pass to CSV as one tested TypeScript source that emits the web page, the single-file HTML, and the APK assets, with the locked Hybrid A+B+C console (phase rail File → Unlock → Save, Material light / glass dark following the system theme) and every P0/P1/P2 fix from the audit.

**Architecture:** `web/src/lib/*` is a pure, DOM-free client core (crypto → strict header check → parse → vault → four CSV writers) covered by vitest. `web/src/ui/*` mounts a single-screen console state machine (`form | working | done` + sheets) built with `textContent` only, saving through a `Platform` interface (Blob download on web, origin-gated `passBridge` WebMessage on Android). `scripts/build.mjs` bundles with esbuild into root `index.html` + `app.js`, inlined `samsung-pass-to-csv.html` (CSP script hash), and `android/app/src/main/assets/`; `--check` fails on drift. `android/` is a new Kotlin Gradle project that serves assets via `WebViewAssetLoader` with no network, no updater, `FLAG_SECURE`, `allowBackup=false`.

**Tech Stack:** TypeScript 5.6, esbuild 0.24, vitest 2.1 (+ jsdom 25 for UI tests), Node 22+ (WebCrypto), CSS custom properties + `prefers-color-scheme`; Android: Kotlin 1.9.24, AGP 8.5.2, Gradle 8.7, compileSdk/targetSdk 34, minSdk 29, `androidx.webkit:webkit:1.11.0`, `androidx.appcompat:appcompat:1.7.0` (DayNight).

## Global Constraints

- Product name **Spcc** (subtitle **Spass to CSV Converter**); package / applicationId `com.jrrahman.passtocsv` (unless Play forces a rename later). Copyright line: © 2026 Juel Hossain. All rights reserved. Mark: P-ring icon; marketing label: P2 Soft overlap.
- Hybrid A+B+C on one screen: phase rail `1 · File` → `2 · Unlock` → `3 · Save` updates in place (no wizard pages).
- Theme follows the system: `prefers-color-scheme` on web, Android day/night (`Theme.AppCompat.DayNight`, `values-night/`) in the APK. **No in-app theme toggle. Dark theme is required.**
- Light (Warm Grove): Material 3 surfaces, cream `#F7F4EF` / white elevated cards, primary Grove `#3F4F3A`, Olive `#6B8F71`, Fern `#A3C9A8`, Soil ink `#1C1917`.
- Dark: Soil/ink shell `#1C1917`–`#0F1410`, translucent glass cards (backdrop blur), glow on the P-ring mark only, gradient primary CTA Olive `#6B8F71` → Grove `#3F4F3A`.
- Corner radii 16–28dp (cards 24, buttons 20, sheet 28); 8dp grid; page padding 16dp; phase pills fully rounded; respect safe-area insets.
- Client-only; CSP `connect-src 'none'` in every HTML; nothing uploaded; no analytics/telemetry.
- No in-app APK updater; delete `version.json`; updates via Play / GitHub Releases only. No `INTERNET`, no `REQUEST_INSTALL_PACKAGES`.
- No auto-save; Save requires the confirm sheet; Clear requires confirm and wipes vault, file and password.
- Never invent websites from login names; curated package map (`APP_SITES`) or blank + optional manual field. No "Allow all".
- Four equal format chips in fixed order 1Password, Google, Apple, Bitwarden; default = last-used (`localStorage["passtocsv.format"]`) else 1Password.
- Wrong-password detection requires a real Samsung Pass header **and** a `next_table` line (never merely `;`).
- `cell()` prefixes `'` to cells starting with `= + - @ TAB CR`, except raw columns (passwords, TOTP, card number/expiry/CVV).
- No real secrets in the repo; fixtures only via `encryptSpass(samplePlaintext(), TEST_PASSWORD)`.
- Compose rewrite out of scope; WebView + shared web UI.
- TDD: failing test before implementation for every lib change. Commit after every task.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `package.json`, `package-lock.json` | Create | Scripts `test`, `typecheck`, `build`, `check`; dev deps |
| `tsconfig.json`, `vitest.config.ts` | Create | Strict TS; vitest node env (UI test opts into jsdom) |
| `.gitignore` | Modify | Add `node_modules/`, Android build outputs |
| `web/src/lib/bytes.ts` | Create | base64 ⇄ bytes, `asBuffer` |
| `web/src/lib/errors.ts` | Create | `SpassError` (`password`/`format`/`empty`), `WRONG_PASSWORD` copy |
| `web/src/lib/types.ts` | Create | `Login`, `Card`, `Address`, `Note`, `Vault`, `SpassTable`, `ParsedSpass`, `FormatId` |
| `web/src/lib/header.ts` | Create | `looksLikeSpassPlaintext()` strict header + `next_table` |
| `web/src/lib/crypto.ts` | Create | PBKDF2-SHA256 70000 → AES-256-CBC `decryptSpass` / `encryptSpass` |
| `web/src/lib/sample.ts` | Create | `samplePlaintext()` synthetic fixture (also About preview) |
| `web/src/lib/parse.ts` | Create | Table split, `;` records, base64 fields, `&&&NULL&&&` |
| `web/src/lib/sites.ts` | Create | Curated `APP_SITES` (from APK v1.6), `siteForPackage`, `extractPackage` |
| `web/src/lib/model.ts` | Create | `resolveUrl` (no guessing), `toVault`, `setManualSite`, `vaultCount` |
| `web/src/lib/csv.ts` | Create | Formula-safe `cell`, `toCsv`, four login writers + cards/addresses/notes/table |
| `web/src/lib/formats.ts` | Create | `FORMATS`, `DEFAULT_FORMAT`, `isFormatId`, `fileNameFor` |
| `web/src/lib/unlock.ts` | Create | `isPlaintextExport`, `unlockText` → `Vault` |
| `web/src/lib/index.ts` | Create | Barrel |
| `web/src/ui/dom.ts` | Create | `el()` / `icon()` textContent-only builders |
| `web/src/ui/prefs.ts` | Create | Last-used format in localStorage |
| `web/src/ui/platform.ts` | Create | `Platform.save()` for web (Blob) and Android (`passBridge`) |
| `web/src/ui/app.ts` | Create | `mount()` console: phase rail, cards, chips, results, sticky bar, sheets, wipe |
| `web/src/ui/styles.css` | Create | Dual-theme tokens + components |
| `web/src/main.ts` | Create | Entry: `mount(#app)` |
| `web/index.template.html` | Create | Shell with `%CSP%`, `%STYLES%`, `%SCRIPT%` |
| `web/test/*.test.ts`, `web/test/helpers.ts` | Create | header, crypto, parse, sites, csv, ui, theme |
| `scripts/build.mjs` | Create | Emit 5 artifacts; `--check` drift |
| `scripts/check-android.mjs` | Create | Static manifest/activity policy check |
| `index.html`, `app.js`, `samsung-pass-to-csv.html` | Regenerate | Build outputs (never hand-edited) |
| `android/**` | Create | Gradle project, `MainActivity.kt`, manifest, DayNight themes, backup rules, generated assets |
| `.github/workflows/ci.yml` | Create | typecheck, test, drift + policy check, `assembleRelease` |
| `version.json`, `Pass-to-CSV.apk` | Delete | Updater manifest and committed debug APK |
| `README.md`, `PRIVACY.md`, `docs/play/listing.md` | Modify/Create | Copy matching in-app About/Privacy |
| `docs/superpowers/manual-smoke.md` | Create | Device/browser smoke + acceptance checklist |

Reference only (not committed): APK v1.6 assets at `/tmp/spc-apk/assets/app.js`; sample export `/workspace/spc/2026_08_24_16_26_52_spass_export_data.spass`. The flat `app.js` section markers (`// src/lib/spass/*.ts`) are the origin of the TS modules below; the code here is the restored, fixed version — do not copy `absoluteSite`/`domainFromName`/`domainFromPackage` from the APK.

---

### Task 0: Toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run typecheck`, `npm run build`, `npm run check` used by every later task.

- [ ] **Step 1: Create config files**

`package.json`:

```json
{
  "name": "pass-to-csv",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "node scripts/build.mjs",
    "check": "node scripts/build.mjs --check && node scripts/check-android.mjs"
  },
  "devDependencies": {
    "@types/node": "^22.20.5",
    "esbuild": "^0.24.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "node"]
  },
  "include": ["web/src", "web/test"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["web/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000
  }
});
```

`.gitignore` (replace contents):

```text
.superpowers/
node_modules/
android/.gradle/
android/build/
android/app/build/
android/local.properties
android/keystore.properties
*.jks
*.keystore
```

- [ ] **Step 2: Install pinned deps**

Run: `cd /workspace/spc/app && npm install && npm install -D @types/node@^22`
Expected: `package-lock.json` created; `npx vitest --version` prints `vitest/2.1.x`.

- [ ] **Step 3: Verify runner works on an empty suite**

Run: `npx vitest run --passWithNoTests`
Expected: `No test files found, exiting with code 0`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "build: add TypeScript + vitest toolchain"
```

---

### Task 1: Core types, bytes, errors, strict header check (P1 wrong-password)

**Files:**
- Create: `web/src/lib/types.ts`, `web/src/lib/bytes.ts`, `web/src/lib/errors.ts`, `web/src/lib/header.ts`, `web/src/lib/sample.ts`
- Test: `web/test/header.test.ts`

**Interfaces:**
- Produces: `looksLikeSpassPlaintext(text: string): boolean`; `class SpassError { code: "password"|"format"|"empty" }`; `WRONG_PASSWORD: string`; `bytesToBase64(Uint8Array): string`, `base64ToBytes(string): Uint8Array`, `asBuffer(Uint8Array): ArrayBuffer`; `samplePlaintext(): string` (3 logins incl. one unknown package + formula note, 1 card, 1 address, 1 note); all types in `types.ts` incl. `FormatId = "1password"|"google"|"apple"|"bitwarden"`.
- Note: the test imports from `../src/lib` — create `web/src/lib/index.ts` exporting only what exists so far, and extend it in each later task (final barrel is in Task 6).

- [ ] **Step 1: Write the failing test**

`web/test/header.test.ts`:

```ts
import { looksLikeSpassPlaintext, samplePlaintext } from "../src/lib";

describe("looksLikeSpassPlaintext", () => {
  it("accepts the numeric-version header with next_table", () => {
    expect(looksLikeSpassPlaintext(samplePlaintext())).toBe(true);
  });

  it("accepts the samsung_pass_export header", () => {
    expect(looksLikeSpassPlaintext("samsung_pass_export\nversion:3\nnext_table\ntitle;password_value\n")).toBe(true);
  });

  it("rejects text that only contains a semicolon", () => {
    expect(looksLikeSpassPlaintext("garbage;more\nstuff\nhere")).toBe(false);
  });

  it("rejects a valid header without next_table", () => {
    expect(looksLikeSpassPlaintext("25\ntrue;true;true;true\nfalse\ntitle;password_value\n")).toBe(false);
  });

  it("rejects next_table without a real header", () => {
    expect(looksLikeSpassPlaintext("hello\nworld;x\nnext_table\na;b\n")).toBe(false);
  });

  it("never accepts 10k random strings", () => {
    const alphabet = "abc;,\n0123456789next_table";
    let accepted = 0;
    for (let i = 0; i < 10000; i++) {
      let s = "";
      const len = 8 + Math.floor(Math.random() * 120);
      for (let j = 0; j < len; j++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (looksLikeSpassPlaintext(s)) accepted++;
    }
    expect(accepted).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/test/header.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib"`

- [ ] **Step 3: Implement**

`web/src/lib/types.ts`:

```ts
export interface SpassTable {
  type: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface ParsedSpass {
  version: string;
  tables: SpassTable[];
}

export interface Login {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
  otp: string;
  otpUri: string;
  needsSite: boolean;
  appLabel: string;
}

export interface Card {
  id: string;
  nickname: string;
  holder: string;
  number: string;
  expMonth: string;
  expYear: string;
  code: string;
  note: string;
}

export interface Address {
  id: string;
  name: string;
  company: string;
  street: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  phone: string;
  email: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
}

export interface Vault {
  version: string;
  logins: Login[];
  cards: Card[];
  addresses: Address[];
  notes: Note[];
  passwordTable: SpassTable | null;
  otherTables: SpassTable[];
  alreadyPlain: boolean;
}

export type FormatId = "1password" | "google" | "apple" | "bitwarden";
```

`web/src/lib/bytes.ts`:

```ts
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 32768;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function asBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}
```

`web/src/lib/errors.ts`:

```ts
export type SpassErrorCode = "password" | "format" | "empty";

export class SpassError extends Error {
  readonly code: SpassErrorCode;
  constructor(code: SpassErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "SpassError";
  }
}

export const WRONG_PASSWORD =
  "Couldn't unlock this file. Use the password you set while exporting, not your Samsung account password.";
```

`web/src/lib/header.ts`:

```ts
/**
 * Strict Samsung Pass plaintext check. A decrypt with a wrong key that happens
 * to pass PKCS7 padding must never reach the parser.
 * Accepts either:
 *   line 1 "samsung_pass_export", line 2 "version:<n>"
 *   line 1 numeric version (e.g. "25"), line 2 data-type flags/names separated by ";" or ","
 * AND at least one line that is exactly "next_table".
 */
const TYPE_TOKEN = /^(true|false|passwords?|credentials?|cards?|address(es)?|identit(y|ies)|notes?|secure_notes?)$/i;

export function looksLikeSpassPlaintext(text: string): boolean {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
  if (lines.length < 3) return false;
  const [first, second] = lines;
  let headerOk = false;
  if (first === "samsung_pass_export" && /^version:\s*\S+$/i.test(second)) headerOk = true;
  if (/^\d{1,4}$/.test(first)) {
    const tokens = second.split(/[;,]/).map((token) => token.trim()).filter(Boolean);
    headerOk = tokens.length > 0 && tokens.every((token) => TYPE_TOKEN.test(token));
  }
  if (!headerOk) return false;
  return lines.slice(2).some((line) => line === "next_table");
}
```

`web/src/lib/sample.ts`:

```ts
import { bytesToBase64 } from "./bytes";

function b64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

/** Synthetic Samsung Pass plaintext. Fake data only — safe for tests and the About preview. */
export function samplePlaintext(): string {
  const login = [
    "title;host_url;username_value;password_value;credential_memo;otp",
    [
      b64("Sample Mail"),
      b64("https://mail.example.test"),
      b64("ada@example.test"),
      b64("sample-mailbox-pass"),
      b64("Fake entry for the preview"),
      b64("otpauth://totp/Sample:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Sample")
    ].join(";"),
    [b64("Sample Bank"), b64("com.chase.sig.android"), b64("j.lee"), b64("not-a-real-password"), "", ""].join(";"),
    [b64("Chase Bank Card"), b64("com.unknown.bankapp"), b64("lee"), b64("=x-pass"), b64("=HYPERLINK(\"http://evil.test\")"), ""].join(";")
  ];
  const card = [
    "name_on_card;card_number;expiration_month;expiration_year;security_code;reserved_5",
    [b64("Ada Example"), b64("4242424242424242"), b64("09"), b64("2030"), b64("123"), b64("Sample Visa")].join(";")
  ];
  const address = [
    "name;street_address;city;state;postal_code;country_code",
    [b64("Ada Example"), b64("1 Sample Street"), b64("Sample City"), b64("NY"), b64("10001"), b64("US")].join(";")
  ];
  const note = ["note_title;note_detail", [b64("Router note"), b64("This is sample text, not a real secret.")].join(";")];
  return ["25", "true;true;true;true", "false", "next_table", ...login, "next_table", ...card, "next_table", ...address, "next_table", ...note, ""].join("\n");
}
```

- [ ] **Step 4: Add a temporary barrel**

`web/src/lib/index.ts`:

```ts
export * from "./types";
export * from "./errors";
export * from "./header";
export * from "./sample";
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run web/test/header.test.ts`
Expected: PASS (all tests in the file green)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib web/test/header.test.ts
git commit -m "feat(lib): strict Samsung Pass header check"
```

---

### Task 2: Crypto round-trip with encryptSpass fixtures

**Files:**
- Create: `web/src/lib/crypto.ts`, `web/test/helpers.ts`
- Test: `web/test/crypto.test.ts`

**Interfaces:**
- Consumes: `looksLikeSpassPlaintext`, `SpassError`, `WRONG_PASSWORD`, bytes helpers (Task 1).
- Produces: `decryptSpass(fileText, password): Promise<string>` (throws `password` on bad key/padding/UTF-8/header); `encryptSpass(plaintext, password): Promise<string>`; constants `SALT_BYTES=20`, `IV_BYTES=16`, `ITERATIONS=70000`; test helper `sampleSpass()`, `TEST_PASSWORD`.
- The `unlockText` cases in this test file go green in Task 6; in this task run only the `decryptSpass` block: `npx vitest run web/test/crypto.test.ts -t decryptSpass`.

- [ ] **Step 1: Write the failing test**

`web/test/helpers.ts`:

```ts
import { encryptSpass, samplePlaintext } from "../src/lib";

export const TEST_PASSWORD = "correct horse battery";

/** Encrypted synthetic export. Never commit a real .spass. */
export async function sampleSpass(): Promise<string> {
  return encryptSpass(samplePlaintext(), TEST_PASSWORD);
}
```

`web/test/crypto.test.ts`:

```ts
import { SpassError, decryptSpass, encryptSpass, samplePlaintext, unlockText } from "../src/lib";
import { TEST_PASSWORD, sampleSpass } from "./helpers";

describe("decryptSpass", () => {
  it("round-trips encryptSpass output", async () => {
    const file = await sampleSpass();
    expect(await decryptSpass(file, TEST_PASSWORD)).toBe(samplePlaintext());
  });

  it("throws a password error for a wrong password", async () => {
    const file = await sampleSpass();
    await expect(decryptSpass(file, "wrong")).rejects.toMatchObject({ code: "password" });
  });

  it("never yields plaintext for 40 random wrong passwords", async () => {
    const file = await sampleSpass();
    for (let i = 0; i < 40; i++) {
      await expect(decryptSpass(file, `wrong-${i}-${Math.random()}`)).rejects.toBeInstanceOf(SpassError);
    }
  });

  it("rejects a correctly decrypted body that lacks a Samsung header", async () => {
    const file = await encryptSpass("junk;with;semicolons\nmore", TEST_PASSWORD);
    await expect(decryptSpass(file, TEST_PASSWORD)).rejects.toMatchObject({ code: "password" });
  });

  it("rejects an empty file and non-base64 input as format errors", async () => {
    await expect(decryptSpass("   ", "x")).rejects.toMatchObject({ code: "format" });
    await expect(decryptSpass("not base64 !!!", "x")).rejects.toMatchObject({ code: "format" });
  });
});

describe("unlockText", () => {
  it("returns a vault with all four kinds", async () => {
    const vault = await unlockText(await sampleSpass(), TEST_PASSWORD);
    expect([vault.logins.length, vault.cards.length, vault.addresses.length, vault.notes.length]).toEqual([3, 1, 1, 1]);
    expect(vault.alreadyPlain).toBe(false);
  });

  it("asks for a password when none is given", async () => {
    await expect(unlockText(await sampleSpass(), "")).rejects.toMatchObject({ code: "empty" });
  });

  it("opens a plaintext export without a password", async () => {
    const vault = await unlockText(samplePlaintext(), "");
    expect(vault.alreadyPlain).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/test/crypto.test.ts -t decryptSpass`
Expected: FAIL — `encryptSpass is not a function` / missing export

- [ ] **Step 3: Implement**

`web/src/lib/crypto.ts`:

```ts
import { asBuffer, base64ToBytes, bytesToBase64 } from "./bytes";
import { SpassError, WRONG_PASSWORD } from "./errors";
import { looksLikeSpassPlaintext } from "./header";

export const SALT_BYTES = 20;
export const IV_BYTES = 16;
export const ITERATIONS = 70000;

const encoder = new TextEncoder();

async function deriveKey(password: string, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBuffer(salt), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-CBC", length: 256 },
    false,
    [usage]
  );
}

export async function decryptSpass(fileText: string, password: string): Promise<string> {
  const compact = fileText.replace(/^\uFEFF/, "").replace(/\s+/g, "");
  if (!compact) throw new SpassError("format", "That file is empty.");
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(compact);
  } catch {
    throw new SpassError(
      "format",
      "This is not a Samsung Pass .spass file. Export again from Samsung Pass, or pick the .spass file rather than a screenshot."
    );
  }
  if (raw.length < SALT_BYTES + IV_BYTES + 16) {
    throw new SpassError("format", "This file is too small to be a Samsung Pass export.");
  }
  if ((raw.length - SALT_BYTES - IV_BYTES) % 16 !== 0) {
    throw new SpassError("format", "This file is not a complete Samsung Pass export.");
  }
  const salt = raw.subarray(0, SALT_BYTES);
  const iv = raw.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = raw.subarray(SALT_BYTES + IV_BYTES);
  let plain: ArrayBuffer;
  try {
    const key = await deriveKey(password, salt, "decrypt");
    plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: asBuffer(iv) }, key, asBuffer(ciphertext));
  } catch {
    throw new SpassError("password", WRONG_PASSWORD);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(plain);
  } catch {
    throw new SpassError("password", WRONG_PASSWORD);
  }
  if (!looksLikeSpassPlaintext(text)) throw new SpassError("password", WRONG_PASSWORD);
  return text;
}

export async function encryptSpass(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, "encrypt");
  const cipher = await crypto.subtle.encrypt({ name: "AES-CBC", iv: asBuffer(iv) }, key, asBuffer(encoder.encode(plaintext)));
  const cipherBytes = new Uint8Array(cipher);
  const out = new Uint8Array(SALT_BYTES + IV_BYTES + cipherBytes.length);
  out.set(salt, 0);
  out.set(iv, SALT_BYTES);
  out.set(cipherBytes, SALT_BYTES + IV_BYTES);
  return bytesToBase64(out);
}
```

- [ ] **Step 4: Export from the barrel**

Append to `web/src/lib/index.ts`:

```ts
export * from "./bytes";
export * from "./crypto";
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run web/test/crypto.test.ts -t decryptSpass`
Expected: PASS (all tests in the file green)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib web/test/helpers.ts web/test/crypto.test.ts
git commit -m "feat(lib): WebCrypto decrypt/encrypt with strict header gate"
```

---

### Task 3: Parser

**Files:**
- Create: `web/src/lib/parse.ts`
- Test: `web/test/parse.test.ts`

**Interfaces:**
- Consumes: `SpassError`, `ParsedSpass`, `SpassTable`.
- Produces: `parseSpassText(text): ParsedSpass`, `parseSemicolonRecords(input): string[][]`, `decodeField(field): string`, `parseDataTypes(line): string[]`, `NULL_SENTINEL`.

- [ ] **Step 1: Write the failing test**

`web/test/parse.test.ts`:

```ts
import { decodeField, parseSemicolonRecords, parseSpassText, samplePlaintext } from "../src/lib";

describe("parse", () => {
  it("maps tables by header hints", () => {
    const parsed = parseSpassText(samplePlaintext());
    expect(parsed.version).toBe("25");
    expect(parsed.tables.map((t) => t.type)).toEqual(["passwords", "cards", "addresses", "notes"]);
  });

  it("treats &&&NULL&&& as empty, raw or base64", () => {
    expect(decodeField("&&&NULL&&&")).toBe("");
    expect(decodeField(btoa("&&&NULL&&&"))).toBe("");
  });

  it("keeps non-base64 fields as-is", () => {
    expect(decodeField("hello world")).toBe("hello world");
  });

  it("splits quoted semicolons correctly", () => {
    expect(parseSemicolonRecords('a;"b;c";d')).toEqual([["a", "b;c", "d"]]);
  });

  it("throws a format error for an unfinished table header", () => {
    expect(() => parseSpassText("25\ntrue\nfalse\nnext_table\ntitle;;password_value\nx;y;z")).toThrow(/didn't finish/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/test/parse.test.ts`
Expected: FAIL — `parseSpassText` not exported

- [ ] **Step 3: Implement**

`web/src/lib/parse.ts`:

```ts
import { SpassError } from "./errors";
import type { ParsedSpass, SpassTable } from "./types";

const DEFAULT_TYPES = ["passwords", "cards", "addresses", "notes"];
const TYPE_ALIASES: Record<string, string> = {
  password: "passwords",
  passwords: "passwords",
  credential: "passwords",
  credentials: "passwords",
  card: "cards",
  cards: "cards",
  address: "addresses",
  addresses: "addresses",
  identity: "addresses",
  identities: "addresses",
  note: "notes",
  notes: "notes",
  secure_note: "notes",
  secure_notes: "notes"
};
const HEADER_HINTS: Record<string, string[]> = {
  passwords: ["password_value", "username_value", "origin_url", "host_url"],
  cards: ["card_number", "name_on_card", "expiration_month", "security_code"],
  addresses: ["street_address", "postal_code", "country_code"],
  notes: ["note_title", "note_detail"]
};
export const NULL_SENTINEL = "&&&NULL&&&";

function splitLines(text: string): string[] {
  const parts = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

export function parseDataTypes(line: string): string[] {
  const tokens = line.split(/[;,]/).map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.every((token) => token === "true" || token === "false")) {
    const enabled: string[] = [];
    tokens.slice(0, DEFAULT_TYPES.length).forEach((token, index) => {
      if (token === "true") enabled.push(DEFAULT_TYPES[index]);
    });
    return enabled;
  }
  const parsed: string[] = [];
  for (const token of tokens) {
    const alias = TYPE_ALIASES[token];
    if (alias) parsed.push(alias);
  }
  return parsed;
}

function readHeader(lines: string[]): { version: string; dataTypes: string[]; rest: string[] } {
  const first = (lines[0] ?? "").trim();
  const second = (lines[1] ?? "").trim();
  if (first === "samsung_pass_export" && second.toLowerCase().startsWith("version:")) {
    return { version: second, dataTypes: [], rest: lines.slice(2) };
  }
  return { version: first, dataTypes: parseDataTypes(second), rest: lines.slice(2) };
}

function splitTables(lines: string[]): string[][] {
  const tables: string[][] = [];
  let current: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "next_table") {
      if (current.length) tables.push(current);
      current = [];
      continue;
    }
    if (current.length === 0 && !line.includes(";")) continue;
    current.push(line);
  }
  if (current.length) tables.push(current);
  return tables;
}

export function parseSemicolonRecords(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ";") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

function isPrintable(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13 || code === 32) continue;
    if (code < 32 || code === 127) return false;
  }
  return true;
}

export function decodeField(field: string): string {
  if (field === "" || field === NULL_SENTINEL) return "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(field)) return field;
  const body = field.replace(/=+$/, "");
  if (body.length % 4 === 1) return field;
  const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text && isPrintable(text)) return text === NULL_SENTINEL ? "" : text;
  } catch {
    // not base64 text; keep raw field
  }
  return field;
}

function inferType(headers: string[]): string | null {
  const set = new Set(headers);
  for (const [type, hints] of Object.entries(HEADER_HINTS)) {
    if (hints.some((hint) => set.has(hint))) return type;
  }
  return null;
}

function parseTable(type: string, lines: string[]): SpassTable {
  const records = parseSemicolonRecords(lines.join("\n"));
  if (records.length === 0) return { type, headers: [], rows: [] };
  const headers = records[0].map((header) => header.trim());
  if (headers.length === 0 || headers.some((header) => !header)) {
    throw new SpassError("format", "This export has a table Samsung Pass didn't finish writing.");
  }
  const rows: Record<string, string>[] = [];
  for (const fields of records.slice(1)) {
    const width = Math.max(headers.length, fields.length);
    while (headers.length < width) headers.push(`extra_${headers.length + 1}`);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = decodeField(fields[i] ?? "");
    rows.push(row);
  }
  return { type, headers, rows };
}

export function parseSpassText(decrypted: string): ParsedSpass {
  const lines = splitLines(decrypted);
  if (lines.length < 3) throw new SpassError("format", "This file does not look like a Samsung Pass export.");
  const { version, dataTypes, rest } = readHeader(lines);
  const chunks = splitTables(rest);
  if (chunks.length === 0) throw new SpassError("format", "The file unlocked, but it has no password tables.");
  const tables = chunks.map((chunk, index) => {
    const headers = parseSemicolonRecords(chunk[0])[0]?.map((header) => header.trim()) ?? [];
    const type = inferType(headers) ?? dataTypes[index] ?? `table_${index + 1}`;
    return parseTable(type, chunk);
  });
  return { version, tables };
}
```

- [ ] **Step 4: Export from the barrel**

Append to `web/src/lib/index.ts`: `export * from "./parse";`

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run web/test/parse.test.ts`
Expected: PASS (all tests in the file green)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib web/test/parse.test.ts
git commit -m "feat(lib): restore Samsung Pass table parser"
```

---

### Task 4: Curated sites + vault model, no guessing (P0)

**Files:**
- Create: `web/src/lib/sites.ts`, `web/src/lib/model.ts`
- Test: `web/test/sites.test.ts`

**Interfaces:**
- Consumes: `ParsedSpass`, `Login`, `Vault` types; `parseSpassText`, `samplePlaintext` (tests).
- Produces: `APP_SITES`, `siteForPackage(pkg)`, `extractPackage(value)`, `normalizeUserUrl(input): string` ("" if not a site), `resolveUrl(raw, pkg): {url, needsSite, appLabel}`, `otpFields`, `toVault(parsed, alreadyPlain?): Vault`, `setManualSite(login, input): void`, `vaultCount(vault): number`.
- Must NOT contain `domainFromName`, `domainFromPackage`, or `absoluteSite`. Verify: `rg -n "domainFrom|absoluteSite" web/` → no matches.

- [ ] **Step 1: Write the failing test**

`web/test/sites.test.ts`:

```ts
import { APP_SITES, normalizeUserUrl, parseSpassText, resolveUrl, samplePlaintext, setManualSite, toVault } from "../src/lib";

describe("websites", () => {
  it("uses the curated map for known packages", () => {
    expect(resolveUrl("com.chase.sig.android", "")).toEqual({ url: "https://chase.com", needsSite: false, appLabel: "com.chase.sig.android" });
  });

  it("leaves unknown packages blank and flags them", () => {
    expect(resolveUrl("com.unknown.bankapp", "")).toEqual({ url: "", needsSite: true, appLabel: "com.unknown.bankapp" });
  });

  it("never turns a name into <name>.com", () => {
    const vault = toVault(parseSpassText(samplePlaintext()));
    const card = vault.logins.find((l) => l.name === "Chase Bank Card")!;
    expect(card.url).toBe("");
    expect(card.needsSite).toBe(true);
  });

  it("leaves non-URL text blank instead of copying it into the URL", () => {
    expect(resolveUrl("My Bank", "")).toEqual({ url: "", needsSite: true, appLabel: "" });
  });

  it("every URL in any CSV comes from the export or APP_SITES", () => {
    const vault = toVault(parseSpassText(samplePlaintext()));
    const allowed = new Set([...Object.values(APP_SITES), "https://mail.example.test", ""]);
    for (const login of vault.logins) expect(allowed.has(login.url)).toBe(true);
  });

  it("manual site accepts a domain and rejects free text", () => {
    const login = toVault(parseSpassText(samplePlaintext())).logins[2];
    setManualSite(login, "bank.example");
    expect(login.url).toBe("https://bank.example");
    expect(login.needsSite).toBe(false);
    setManualSite(login, "not a site");
    expect(login.url).toBe("");
    expect(login.needsSite).toBe(true);
    expect(normalizeUserUrl("http://x.test/a")).toBe("http://x.test/a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/test/sites.test.ts`
Expected: FAIL — `resolveUrl` not exported

- [ ] **Step 3: Implement**

`web/src/lib/sites.ts`:

```ts
/** Curated Android package → website map. Unknown packages stay blank. Never infer "<name>.com". */
export const APP_SITES: Readonly<Record<string, string>> = {
  "com.facebook.katana": "https://facebook.com",
  "com.facebook.orca": "https://messenger.com",
  "com.instagram.android": "https://instagram.com",
  "com.twitter.android": "https://x.com",
  "com.zhiliaoapp.musically": "https://tiktok.com",
  "com.ss.android.ugc.trill": "https://tiktok.com",
  "com.google.android.gm": "https://mail.google.com",
  "com.google.android.youtube": "https://youtube.com",
  "com.google.android.apps.maps": "https://maps.google.com",
  "com.whatsapp": "https://web.whatsapp.com",
  "com.snapchat.android": "https://snapchat.com",
  "com.spotify.music": "https://spotify.com",
  "com.netflix.mediaclient": "https://netflix.com",
  "com.amazon.mShop.android.shopping": "https://amazon.com",
  "com.amazon.avod.thirdpartyclient": "https://primevideo.com",
  "com.amazon.kindle": "https://amazon.com",
  "com.audible.application": "https://audible.com",
  "com.paypal.android.p2pmobile": "https://paypal.com",
  "com.ebay.mobile": "https://ebay.com",
  "com.linkedin.android": "https://linkedin.com",
  "com.pinterest": "https://pinterest.com",
  "com.reddit.frontpage": "https://reddit.com",
  "com.discord": "https://discord.com",
  "com.slack": "https://slack.com",
  "com.microsoft.office.outlook": "https://outlook.live.com",
  "com.microsoft.teams": "https://teams.microsoft.com",
  "com.microsoft.office.word": "https://office.com",
  "com.dropbox.android": "https://dropbox.com",
  "com.ubercab": "https://uber.com",
  "com.ubercab.eats": "https://ubereats.com",
  "com.airbnb.android": "https://airbnb.com",
  "com.venmo": "https://venmo.com",
  "com.chase.sig.android": "https://chase.com",
  "com.wf.wellsfargomobile": "https://wellsfargo.com",
  "com.infonow.bofa": "https://bankofamerica.com",
  "com.citi.citimobile": "https://citi.com",
  "com.capitalone.mobile": "https://capitalone.com",
  "com.americanexpress.android.acctsvcs.us": "https://americanexpress.com",
  "com.ally.MobileBanking": "https://ally.com",
  "com.schwab.mobile": "https://schwab.com",
  "com.fidelity.android": "https://fidelity.com",
  "com.robinhood.android": "https://robinhood.com",
  "com.coinbase.android": "https://coinbase.com",
  "org.telegram.messenger": "https://telegram.org",
  "com.viber.voip": "https://viber.com",
  "com.skype.raider": "https://skype.com",
  "com.yahoo.mobile.client.android.mail": "https://mail.yahoo.com",
  "com.disney.disneyplus": "https://disneyplus.com",
  "com.hulu.plus": "https://hulu.com",
  "com.wbd.stream": "https://max.com",
  "com.soundcloud.android": "https://soundcloud.com",
  "com.apple.android.music": "https://music.apple.com",
  "com.walmart.android": "https://walmart.com",
  "com.target.ui": "https://target.com",
  "com.bestbuy.android": "https://bestbuy.com",
  "com.starbucks.mobilecard": "https://starbucks.com",
  "com.dd.doordash": "https://doordash.com",
  "com.grubhub.android": "https://grubhub.com",
  "com.booking": "https://booking.com",
  "com.expedia.bookings": "https://expedia.com",
  "com.delta.mobile.android": "https://delta.com",
  "com.united.mobile.android": "https://united.com",
  "com.aa.android": "https://aa.com",
  "com.southwestairlines.mobile": "https://southwest.com",
  "com.etsy.android": "https://etsy.com",
  "com.zillow.android.zillowmap": "https://zillow.com",
  "com.duolingo": "https://duolingo.com",
  "com.android.vending": "https://play.google.com",
  "com.google.android.apps.walletnfcrel": "https://pay.google.com",
  "com.google.android.apps.docs": "https://docs.google.com",
  "com.google.android.apps.photos": "https://photos.google.com",
  "com.bitwarden": "https://bitwarden.com",
  "com.x8bit.bitwarden": "https://bitwarden.com",
  "com.lastpass.lpandroid": "https://lastpass.com",
  "com.onepassword.android": "https://1password.com",
  "com.dashlane": "https://dashlane.com",
  "proton.android.pass": "https://proton.me",
  "ch.protonmail.android": "https://proton.me",
  "com.github.android": "https://github.com",
  "com.todoist": "https://todoist.com",
  "com.evernote": "https://evernote.com",
  "com.nytimes.android": "https://nytimes.com",
  "com.samsung.android.spay": "https://samsung.com",
  "com.sec.android.app.sbrowser": "https://samsung.com"
};

const BY_LOWER = new Map<string, string>();
for (const [pkg, url] of Object.entries(APP_SITES)) BY_LOWER.set(pkg.toLowerCase(), url);

export function siteForPackage(pkg: string): string {
  const key = pkg.trim().toLowerCase();
  return key ? BY_LOWER.get(key) ?? "" : "";
}

export function extractPackage(value: string): string {
  const trimmed = value.trim();
  const android = trimmed.match(/^android(?:app)?:\/\/([^/\s]+)/i);
  if (android) return android[1];
  if (/^[A-Za-z][\w]*(\.[\w-]+){2,}$/.test(trimmed)) return trimmed;
  return "";
}
```

`web/src/lib/model.ts`:

```ts
import { extractPackage, siteForPackage } from "./sites";
import type { Address, Card, Login, Note, ParsedSpass, SpassTable, Vault } from "./types";

function clean(value: string | undefined): string {
  const v = (value ?? "").replace(/\u0000/g, "").trim();
  return v === "&&&NULL&&&" ? "" : v;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }
  return "";
}

const BARE_DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i;

/** Normalizes a URL the user typed, or a bare domain from the export. Returns "" when it is not a site. */
export function normalizeUserUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (BARE_DOMAIN.test(value)) return `https://${value}`;
  return "";
}

export interface ResolvedUrl {
  url: string;
  needsSite: boolean;
  appLabel: string;
}

/** URL comes only from the export itself or the curated package map. Never guessed. */
export function resolveUrl(raw: string, packageName: string): ResolvedUrl {
  const pkg = packageName || extractPackage(raw);
  const mapped = pkg ? siteForPackage(pkg) : "";
  if (mapped) return { url: mapped, needsSite: false, appLabel: pkg };
  if (/^https?:\/\//i.test(raw)) return { url: raw, needsSite: false, appLabel: "" };
  if (pkg) return { url: "", needsSite: true, appLabel: pkg };
  const normalized = normalizeUserUrl(raw);
  if (normalized) return { url: normalized, needsSite: false, appLabel: "" };
  return { url: "", needsSite: true, appLabel: "" };
}

export function otpFields(otp: string, name: string, username: string): { otp: string; otpUri: string } {
  const value = otp.trim();
  if (!value) return { otp: "", otpUri: "" };
  if (value.toLowerCase().startsWith("otpauth://")) return { otp: value, otpUri: value };
  const secret = value.replace(/\s+/g, "");
  if (/^[A-Za-z2-7]+=*$/.test(secret) && secret.replace(/=/g, "").length >= 16) {
    const label = encodeURIComponent(username ? `${name}:${username}` : name || "Account");
    const issuer = encodeURIComponent(name || "Account");
    return { otp: value, otpUri: `otpauth://totp/${label}?secret=${secret.replace(/=/g, "").toUpperCase()}&issuer=${issuer}` };
  }
  return { otp: value, otpUri: "" };
}

function table(parsed: ParsedSpass, type: string): SpassTable | null {
  return parsed.tables.find((item) => item.type === type) ?? null;
}

export function toVault(parsed: ParsedSpass, alreadyPlain = false): Vault {
  const passwordTable = table(parsed, "passwords");
  const logins: Login[] = [];
  (passwordTable?.rows ?? []).forEach((row, index) => {
    const packageName = pick(row, ["package_name", "app_package", "package"]);
    const rawUrl = pick(row, ["host_url", "origin_url", "url", "action_url"]);
    const resolved = resolveUrl(rawUrl, packageName);
    const username = pick(row, ["username_value", "username", "email", "user_id"]);
    const password = pick(row, ["password_value", "password"]);
    const note = pick(row, ["credential_memo", "note", "notes", "memo"]);
    const name = pick(row, ["title", "name", "display_name"]) || resolved.appLabel || rawUrl || username || "Untitled login";
    const otp = otpFields(pick(row, ["otp", "totp", "otp_secret", "one_time_password"]), name, username);
    if (!username && !password && !resolved.url && !note && !otp.otp && name === "Untitled login") return;
    logins.push({
      id: `login-${index}`,
      name,
      url: resolved.url,
      username,
      password,
      note,
      otp: otp.otp,
      otpUri: otp.otpUri,
      needsSite: resolved.needsSite,
      appLabel: resolved.appLabel
    });
  });
  const cards: Card[] = (table(parsed, "cards")?.rows ?? [])
    .map((row, index) => ({
      id: `card-${index}`,
      nickname: pick(row, ["reserved_5", "card_name", "nickname", "name"]) || "Card",
      holder: pick(row, ["name_on_card", "cardholder_name", "holder"]),
      number: pick(row, ["card_number", "number"]),
      expMonth: pick(row, ["expiration_month", "exp_month"]),
      expYear: pick(row, ["expiration_year", "exp_year"]),
      code: pick(row, ["security_code", "cvv", "cvc"]),
      note: pick(row, ["card_memo", "memo", "note", "notes"])
    }))
    .filter((card) => card.holder || card.number || card.nickname !== "Card");
  const addresses: Address[] = (table(parsed, "addresses")?.rows ?? [])
    .map((row, index) => ({
      id: `address-${index}`,
      name: pick(row, ["name", "full_name", "first_name"]),
      company: pick(row, ["company", "company_name"]),
      street: pick(row, ["street_address", "address1", "address", "street"]),
      city: pick(row, ["city"]),
      state: pick(row, ["state", "region", "province"]),
      postal: pick(row, ["postal_code", "zip", "zipcode"]),
      country: pick(row, ["country_code", "country"]),
      phone: pick(row, ["phone", "phone_number", "tel"]),
      email: pick(row, ["email"])
    }))
    .filter((item) => item.name || item.street || item.city);
  const notes: Note[] = (table(parsed, "notes")?.rows ?? [])
    .map((row, index) => ({
      id: `note-${index}`,
      title: pick(row, ["note_title", "title", "name"]) || "Note",
      body: pick(row, ["note_detail", "note", "notes", "detail", "content"])
    }))
    .filter((item) => item.title !== "Note" || item.body);
  const known = new Set(["passwords", "cards", "addresses", "notes"]);
  const otherTables = parsed.tables.filter((item) => !known.has(item.type) && item.rows.length > 0);
  return { version: parsed.version, logins, cards, addresses, notes, passwordTable, otherTables, alreadyPlain };
}

/** Applies a website the user typed for one login. Invalid input leaves the URL blank. */
export function setManualSite(login: Login, input: string): void {
  login.url = normalizeUserUrl(input);
  login.needsSite = login.url === "";
}

export function vaultCount(vault: Vault): number {
  return vault.logins.length + vault.cards.length + vault.addresses.length + vault.notes.length;
}
```

- [ ] **Step 4: Export from the barrel**

Append to `web/src/lib/index.ts`:

```ts
export * from "./sites";
export * from "./model";
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run web/test/sites.test.ts`
Expected: PASS (all tests in the file green)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib web/test/sites.test.ts
git commit -m "feat(lib): curated site map only; blank unknown websites"
```

---

### Task 5: Formula-safe CSV + four equal format writers (golden)

**Files:**
- Create: `web/src/lib/csv.ts`, `web/src/lib/formats.ts`
- Test: `web/test/csv.test.ts`

**Interfaces:**
- Consumes: `Login`, `Note`, `Card`, `Address`, `SpassTable`, `FormatId`; `toVault`.
- Produces: `cell(value, formulaSafe = true)`, `toCsv(headers, rows, rawColumns = [])`, `noteWithOtp(note, otp)`, `loginsToCsv(logins, notes, format: FormatId)`, `cardsToCsv`, `addressesToCsv`, `notesToCsv`, `tableToCsv`; `FORMATS: FormatInfo[]` (`{id,label,fileName,hint}`), `DEFAULT_FORMAT = "1password"`, `isFormatId(v)`, `fileNameFor(format)`.
- Column sets: 1Password `Title,Website,Username,Password,Notes` (OTP in Notes); Google `name,url,username,password,note` (OTP in note); Apple `Title,URL,Username,Password,Notes,OTPAuth`; Bitwarden login CSV + notes as `type=note` rows (cards separate).

- [ ] **Step 1: Write the failing test**

`web/test/csv.test.ts`:

```ts
import { DEFAULT_FORMAT, FORMATS, cardsToCsv, cell, fileNameFor, loginsToCsv, parseSpassText, samplePlaintext, toVault } from "../src/lib";

const vault = () => toVault(parseSpassText(samplePlaintext()));
const BOM = "\uFEFF";
const MAIL_OTP = "otpauth://totp/Sample:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Sample";
const EVIL = "\"'=HYPERLINK(\"\"http://evil.test\"\")\"";

describe("cell", () => {
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])("neutralizes formula lead %j", (value) => {
    expect(cell(value).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("does not touch raw cells", () => {
    expect(cell("=x-pass", false)).toBe("=x-pass");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(cell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});

describe("golden login CSVs", () => {
  it("1Password", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "1password")).toBe(
      `${BOM}Title,Website,Username,Password,Notes\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,"Fake entry for the preview\nOTP: ${MAIL_OTP}"\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL}\r\n`
    );
  });

  it("Google", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "google")).toBe(
      `${BOM}name,url,username,password,note\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,"Fake entry for the preview\nOTP: ${MAIL_OTP}"\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL}\r\n`
    );
  });

  it("Apple", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "apple")).toBe(
      `${BOM}Title,URL,Username,Password,Notes,OTPAuth\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,Fake entry for the preview,${MAIL_OTP}\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL},\r\n`
    );
  });

  it("Bitwarden", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "bitwarden")).toBe(
      `${BOM}folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\r\n` +
        `,0,login,Sample Mail,Fake entry for the preview,,0,https://mail.example.test,ada@example.test,sample-mailbox-pass,${MAIL_OTP}\r\n` +
        `,0,login,Sample Bank,,,0,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `,0,login,Chase Bank Card,${EVIL},,0,,lee,=x-pass,\r\n` +
        `,0,note,Router note,"This is sample text, not a real secret.",,0,,,,\r\n`
    );
  });

  it("cards", () => {
    expect(cardsToCsv(vault().cards)).toBe(
      `${BOM}nickname,name_on_card,number,exp_month,exp_year,security_code,note\r\nSample Visa,Ada Example,4242424242424242,09,2030,123,\r\n`
    );
  });
});

describe("formats", () => {
  it("has four equal formats in fixed order, 1Password default", () => {
    expect(FORMATS.map((f) => f.id)).toEqual(["1password", "google", "apple", "bitwarden"]);
    expect(DEFAULT_FORMAT).toBe("1password");
    expect(fileNameFor("apple")).toBe("samsung-pass-apple.csv");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/test/csv.test.ts`
Expected: FAIL — `cell` / `loginsToCsv` not exported

- [ ] **Step 3: Implement**

`web/src/lib/csv.ts`:

```ts
import type { Address, Card, FormatId, Login, Note, SpassTable } from "./types";

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Quotes a CSV cell. When formulaSafe, a leading = + - @ TAB CR is prefixed with ' so spreadsheets do not execute it. */
export function cell(value: string, formulaSafe = true): string {
  let v = value;
  if (formulaSafe && FORMULA_LEAD.test(v)) v = `'${v}`;
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** rawColumns: header names written verbatim (passwords, TOTP secrets, card numbers/codes). */
export function toCsv(headers: string[], rows: string[][], rawColumns: string[] = []): string {
  const raw = headers.map((header) => rawColumns.includes(header));
  const head = headers.map((header) => cell(header, false)).join(",");
  const body = rows.map((row) => headers.map((_, i) => cell(row[i] ?? "", !raw[i])).join(","));
  return `\uFEFF${[head, ...body].join("\r\n")}\r\n`;
}

export function noteWithOtp(note: string, otp: string): string {
  if (!otp) return note;
  if (note.includes(otp)) return note;
  const line = `OTP: ${otp}`;
  return note ? `${note}\n${line}` : line;
}

export function loginsToCsv(logins: Login[], notes: Note[], format: FormatId): string {
  if (format === "1password") {
    return toCsv(
      ["Title", "Website", "Username", "Password", "Notes"],
      logins.map((l) => [l.name || "Login", l.url, l.username, l.password, noteWithOtp(l.note, l.otp)]),
      ["Password"]
    );
  }
  if (format === "apple") {
    return toCsv(
      ["Title", "URL", "Username", "Password", "Notes", "OTPAuth"],
      logins.map((l) => [l.name, l.url, l.username, l.password, l.otpUri ? l.note : noteWithOtp(l.note, l.otp), l.otpUri]),
      ["Password", "OTPAuth"]
    );
  }
  if (format === "bitwarden") {
    const headers = [
      "folder", "favorite", "type", "name", "notes", "fields", "reprompt",
      "login_uri", "login_username", "login_password", "login_totp"
    ];
    const loginRows = logins.map((l) => [
      "", "0", "login", l.name, l.note, "", "0", l.url, l.username, l.password, l.otpUri || l.otp
    ]);
    const noteRows = notes.map((n) => ["", "0", "note", n.title, n.body, "", "0", "", "", "", ""]);
    return toCsv(headers, [...loginRows, ...noteRows], ["login_password", "login_totp"]);
  }
  return toCsv(
    ["name", "url", "username", "password", "note"],
    logins.map((l) => [l.name, l.url, l.username, l.password, noteWithOtp(l.note, l.otp)]),
    ["password"]
  );
}

export function cardsToCsv(cards: Card[]): string {
  return toCsv(
    ["nickname", "name_on_card", "number", "exp_month", "exp_year", "security_code", "note"],
    cards.map((c) => [c.nickname, c.holder, c.number, c.expMonth, c.expYear, c.code, c.note]),
    ["number", "exp_month", "exp_year", "security_code"]
  );
}

export function addressesToCsv(addresses: Address[]): string {
  return toCsv(
    ["name", "company", "street", "city", "state", "postal_code", "country", "phone", "email"],
    addresses.map((a) => [a.name, a.company, a.street, a.city, a.state, a.postal, a.country, a.phone, a.email]),
    ["phone"]
  );
}

export function notesToCsv(notes: Note[]): string {
  return toCsv(["title", "details"], notes.map((n) => [n.title, n.body]));
}

export function tableToCsv(table: SpassTable): string {
  return toCsv(table.headers, table.rows.map((row) => table.headers.map((header) => row[header] ?? "")));
}
```

`web/src/lib/formats.ts`:

```ts
import type { FormatId } from "./types";

export interface FormatInfo {
  id: FormatId;
  label: string;
  fileName: string;
  hint: string;
}

/** Equal order and weight. Default when nothing stored: 1Password. */
export const FORMATS: readonly FormatInfo[] = [
  { id: "1password", label: "1Password", fileName: "samsung-pass-1password.csv", hint: "Import this CSV at my.1password.com → Import → CSV. One-time codes go in Notes." },
  { id: "google", label: "Google", fileName: "samsung-pass-google.csv", hint: "Chrome → Password Manager → Settings → Import. One-time codes go in the note." },
  { id: "apple", label: "Apple", fileName: "samsung-pass-apple.csv", hint: "Settings → Apps → Passwords → Import passwords. One-time codes go in OTPAuth." },
  { id: "bitwarden", label: "Bitwarden", fileName: "samsung-pass-bitwarden.csv", hint: "Import as Bitwarden (csv). Logins and notes are in this file. Cards are separate." }
];

export const DEFAULT_FORMAT: FormatId = "1password";

export function isFormatId(value: unknown): value is FormatId {
  return FORMATS.some((format) => format.id === value);
}

export function fileNameFor(format: FormatId): string {
  return FORMATS.find((item) => item.id === format)!.fileName;
}
```

- [ ] **Step 4: Export from the barrel**

Append to `web/src/lib/index.ts`:

```ts
export * from "./csv";
export * from "./formats";
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run web/test/csv.test.ts`
Expected: PASS (all tests in the file green)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib web/test/csv.test.ts
git commit -m "feat(lib): formula-safe CSV and equal 1Password/Google/Apple/Bitwarden writers"
```

---

### Task 6: Unlock entry point + final barrel

**Files:**
- Create: `web/src/lib/unlock.ts`
- Modify: `web/src/lib/index.ts` (final form)
- Test: `web/test/crypto.test.ts` (`unlockText` block, already written in Task 2)

**Interfaces:**
- Consumes: `decryptSpass`, `looksLikeSpassPlaintext`, `parseSpassText`, `toVault`, `vaultCount`.
- Produces: `isPlaintextExport(text): boolean` (same strict check), `unlockText(fileText, password): Promise<Vault>` — note it returns the `Vault` directly (old code returned `{ vault }`).

- [ ] **Step 0: Run the pending unlock tests to verify they fail**

Run: `npx vitest run web/test/crypto.test.ts -t unlockText`
Expected: FAIL — `unlockText is not a function`

- [ ] **Step 1: Implement**

`web/src/lib/unlock.ts`:

```ts
import { decryptSpass } from "./crypto";
import { SpassError } from "./errors";
import { looksLikeSpassPlaintext } from "./header";
import { toVault, vaultCount } from "./model";
import { parseSpassText } from "./parse";
import type { Vault } from "./types";

export function isPlaintextExport(text: string): boolean {
  return looksLikeSpassPlaintext(text);
}

export async function unlockText(fileText: string, password: string): Promise<Vault> {
  const text = fileText.replace(/^\uFEFF/, "");
  if (isPlaintextExport(text)) {
    const vault = toVault(parseSpassText(text), true);
    if (vaultCount(vault) === 0) throw new SpassError("format", "The file opened, but it has no logins, cards, addresses, or notes.");
    return vault;
  }
  if (!password) throw new SpassError("empty", "Enter the export password you set in Samsung Pass.");
  if (!globalThis.crypto?.subtle) throw new SpassError("format", "This browser can't unlock files. Open the page in Chrome.");
  const plain = await decryptSpass(text, password);
  const vault = toVault(parseSpassText(plain), false);
  if (vaultCount(vault) === 0) throw new SpassError("format", "The file unlocked, but it has no logins, cards, addresses, or notes.");
  return vault;
}
```

`web/src/lib/index.ts`:

```ts
export * from "./types";
export * from "./errors";
export * from "./crypto";
export * from "./header";
export * from "./parse";
export * from "./sites";
export * from "./model";
export * from "./csv";
export * from "./formats";
export * from "./sample";
export * from "./unlock";
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run`
Expected: PASS (all tests in the file green)

- [ ] **Step 3: Commit**

```bash
git add web/src/lib
git commit -m "feat(lib): unlockText with strict plaintext detection"
```

---

### Task 7: Hybrid console UI: phase rail, cards, chips, results, sheets, wipe

**Files:**
- Create: `web/src/ui/dom.ts`, `web/src/ui/prefs.ts`, `web/src/ui/platform.ts`, `web/src/ui/app.ts`, `web/src/main.ts`
- Test: `web/test/ui.test.ts`

**Interfaces:**
- Consumes: everything in `web/src/lib/index.ts`.
- Produces: `mount(root: HTMLElement, options?: { platform?: Platform }): { wipe(): void }`; `interface Platform { save(fileName: string, csv: string): Promise<boolean> }`; `detectPlatform(): Platform` (uses `globalThis.passBridge` when present); `FORMAT_KEY = "passtocsv.format"`, `loadFormat()`, `storeFormat()`.
- Android bridge message contract (Task 10 implements the native side): JS → `{"type":"save","fileName":"samsung-pass-*.csv","csv":"…"}`; native → `{"type":"saved","ok":true|false}`.
- DOM hooks used by tests and screenshots: `[data-testid=rail|convert|counts|login-list|login|save|clear|confirm-save|confirm-clear|sheet-save|sheet-clear|sheet-about|snackbar|filename]`, `.pill.active[data-phase=file|unlock|save]`, `[data-format=<FormatId>]`, `#spass-file`, `#spass-password`, `.site-input`, `.reminder`.
- Phase rule: `save` if the save sheet is open or a save succeeded; else `unlock` once a vault exists; else `file`.
- `visibilitychange` → hidden wipes the vault unless a system picker/save is in flight (`externalPending`).

- [ ] **Step 1: Write the failing test**

`web/test/ui.test.ts`:

```ts
// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { mount } from "../src/ui/app";
import { FORMAT_KEY } from "../src/ui/prefs";
import type { Platform } from "../src/ui/platform";
import { TEST_PASSWORD, sampleSpass } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

function setup() {
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById("app")!;
  const saves: { fileName: string; csv: string }[] = [];
  const platform: Platform = { save: async (fileName, csv) => { saves.push({ fileName, csv }); return true; } };
  const handle = mount(root, { platform });
  return { root, saves, handle };
}

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector<T>(sel)!;

async function choose(root: HTMLElement, password: string) {
  const file = new File([await sampleSpass()], "export.spass", { type: "application/octet-stream" });
  const input = q<HTMLInputElement>(root, "#spass-file");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  const pw = q<HTMLInputElement>(root, "#spass-password");
  pw.value = password;
  pw.dispatchEvent(new Event("input"));
}

async function unlock(root: HTMLElement) {
  await choose(root, TEST_PASSWORD);
  q<HTMLButtonElement>(root, "[data-testid=convert]").click();
  await vi.waitFor(() => expect(root.querySelector("[data-testid=counts]")).not.toBeNull());
}

beforeEach(() => localStorage.clear());

describe("console UI", () => {
  it("defaults to 1Password with four equal chips", () => {
    const { root } = setup();
    const chips = [...root.querySelectorAll("[data-format]")];
    expect(chips.map((c) => c.getAttribute("data-format"))).toEqual(["1password", "google", "apple", "bitwarden"]);
    expect(q(root, ".chip.selected").getAttribute("data-format")).toBe("1password");
  });

  it("restores the last-used format", () => {
    localStorage.setItem(FORMAT_KEY, "apple");
    const { root } = setup();
    expect(q(root, ".chip.selected").getAttribute("data-format")).toBe("apple");
  });

  it("keeps Convert disabled until file and password exist", async () => {
    const { root } = setup();
    expect(q<HTMLButtonElement>(root, "[data-testid=convert]").disabled).toBe(true);
    await choose(root, TEST_PASSWORD);
    expect(q<HTMLButtonElement>(root, "[data-testid=convert]").disabled).toBe(false);
  });

  it("shows a password error for a wrong password", async () => {
    const { root } = setup();
    await choose(root, "nope");
    q<HTMLButtonElement>(root, "[data-testid=convert]").click();
    await vi.waitFor(() => expect(q(root, ".error").textContent).toMatch(/not your Samsung account password/));
  });

  it("phase rail moves File → Unlock → Save", async () => {
    const { root } = setup();
    expect(q(root, ".pill.active").getAttribute("data-phase")).toBe("file");
    await unlock(root);
    expect(q(root, ".pill.active").getAttribute("data-phase")).toBe("unlock");
    q<HTMLButtonElement>(root, "[data-testid=save]").click();
    expect(q(root, ".pill.active").getAttribute("data-phase")).toBe("save");
  });

  it("does not save on unlock and requires the confirm sheet", async () => {
    const { root, saves } = setup();
    await unlock(root);
    expect(saves).toHaveLength(0);
    q<HTMLButtonElement>(root, "[data-testid=save]").click();
    expect(root.querySelector("[data-testid=sheet-save]")).not.toBeNull();
    expect(saves).toHaveLength(0);
    q<HTMLButtonElement>(root, "[data-testid=confirm-save]").click();
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("samsung-pass-1password.csv");
    expect(saves[0].csv.startsWith("\uFEFFTitle,Website,Username,Password,Notes")).toBe(true);
    expect(root.querySelector(".reminder")).not.toBeNull();
  });

  it("changing chip after unlock rewrites the CSV without re-decrypting", async () => {
    const { root, saves } = setup();
    await unlock(root);
    q<HTMLButtonElement>(root, "[data-format=google]").click();
    q<HTMLButtonElement>(root, "[data-testid=save]").click();
    q<HTMLButtonElement>(root, "[data-testid=confirm-save]").click();
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("samsung-pass-google.csv");
  });

  it("shows a blank website field for unknown apps", async () => {
    const { root } = setup();
    await unlock(root);
    expect(root.querySelectorAll(".site-input")).toHaveLength(1);
    expect(root.textContent).not.toMatch(/chasebank\.com/);
  });

  it("Clear needs confirmation and wipes vault, file and password", async () => {
    const { root } = setup();
    await unlock(root);
    q<HTMLButtonElement>(root, "[data-testid=clear]").click();
    expect(root.querySelector("[data-testid=counts]")).not.toBeNull();
    q<HTMLButtonElement>(root, "[data-testid=confirm-clear]").click();
    expect(root.querySelector("[data-testid=counts]")).toBeNull();
    expect(root.querySelector("[data-testid=filename]")).toBeNull();
    expect(q<HTMLInputElement>(root, "#spass-password").value).toBe("");
  });

  it("wipes the vault when the page is hidden", async () => {
    const { root } = setup();
    await unlock(root);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(root.querySelector("[data-testid=counts]")).toBeNull();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/test/ui.test.ts`
Expected: FAIL — `Failed to resolve import "../src/ui/app"`

- [ ] **Step 3: Implement**

`web/src/ui/dom.ts`:

```ts
type Attrs = Record<string, string | boolean | ((event: Event) => void)>;

/** Builds DOM with textContent only. Never use innerHTML with export data. */
export function el(tag: string, attrs: Attrs = {}, children: (Node | string | null)[] = []): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "function") node.addEventListener(key.replace(/^on/, ""), value);
    else if (key === "class") node.className = String(value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false) node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function icon(name: string): HTMLElement {
  return el("span", { class: "icon", "aria-hidden": "true", "data-icon": name }, []);
}
```

`web/src/ui/prefs.ts`:

```ts
import { DEFAULT_FORMAT, isFormatId, type FormatId } from "../lib";

export const FORMAT_KEY = "passtocsv.format";

export function loadFormat(): FormatId {
  try {
    const stored = globalThis.localStorage?.getItem(FORMAT_KEY);
    return isFormatId(stored) ? stored : DEFAULT_FORMAT;
  } catch {
    return DEFAULT_FORMAT;
  }
}

export function storeFormat(format: FormatId): void {
  try {
    globalThis.localStorage?.setItem(FORMAT_KEY, format);
  } catch {
    // storage blocked; default applies next time
  }
}
```

`web/src/ui/platform.ts`:

```ts
/** Android injects `passBridge` via WebViewCompat.addWebMessageListener, origin-gated to the asset host. */
interface WebMessageBridge {
  postMessage(message: string): void;
  onmessage: ((event: { data: string }) => void) | null;
}

export interface Platform {
  /** Resolves true only after the file was actually written. */
  save(fileName: string, csv: string): Promise<boolean>;
}

function bridge(): WebMessageBridge | null {
  const candidate = (globalThis as unknown as { passBridge?: WebMessageBridge }).passBridge;
  return candidate && typeof candidate.postMessage === "function" ? candidate : null;
}

const androidPlatform = (b: WebMessageBridge): Platform => ({
  save(fileName, csv) {
    return new Promise((resolve) => {
      b.onmessage = (event) => {
        try {
          const reply = JSON.parse(event.data) as { type: string; ok: boolean };
          if (reply.type === "saved") resolve(reply.ok === true);
        } catch {
          resolve(false);
        }
      };
      b.postMessage(JSON.stringify({ type: "save", fileName, csv }));
    });
  }
});

const webPlatform: Platform = {
  async save(fileName, csv) {
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    } catch {
      return false;
    }
  }
};

export function detectPlatform(): Platform {
  const b = bridge();
  return b ? androidPlatform(b) : webPlatform;
}
```

`web/src/ui/app.ts`:

```ts
import {
  FORMATS,
  SpassError,
  addressesToCsv,
  cardsToCsv,
  fileNameFor,
  loginsToCsv,
  notesToCsv,
  setManualSite,
  unlockText,
  type FormatId,
  type Login,
  type Vault
} from "../lib";
import { el, icon } from "./dom";
import { detectPlatform, type Platform } from "./platform";
import { loadFormat, storeFormat } from "./prefs";

type Status = "form" | "working" | "done";
type Sheet = null | { kind: "save"; fileName: string; csv: string } | { kind: "clear" } | { kind: "about" };

interface State {
  file: File | null;
  password: string;
  showPassword: boolean;
  format: FormatId;
  status: Status;
  error: { field: "file" | "password" | "banner"; message: string } | null;
  vault: Vault | null;
  query: string;
  revealed: Set<string>;
  saved: boolean;
  sheet: Sheet;
  snackbar: string;
  /** True while a system picker is open, so visibilitychange does not wipe mid-flow. */
  externalPending: boolean;
}

export interface MountOptions {
  platform?: Platform;
}

export interface ConsoleHandle {
  wipe(): void;
}

function freshState(format: FormatId): State {
  return {
    file: null,
    password: "",
    showPassword: false,
    format,
    status: "form",
    error: null,
    vault: null,
    query: "",
    revealed: new Set(),
    saved: false,
    sheet: null,
    snackbar: "",
    externalPending: false
  };
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function mount(root: HTMLElement, options: MountOptions = {}): ConsoleHandle {
  const platform = options.platform ?? detectPlatform();
  let state = freshState(loadFormat());

  const wipe = () => {
    state = freshState(state.format);
    render();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && !state.externalPending && state.vault) wipe();
  });

  const canConvert = () => state.file !== null && (state.password.length > 0) && state.status !== "working";

  async function convert() {
    if (!state.file) return;
    state.status = "working";
    state.error = null;
    render();
    try {
      const text = await readFileText(state.file);
      state.vault = await unlockText(text, state.password);
      state.status = "done";
    } catch (error) {
      state.status = "form";
      const err = error instanceof SpassError ? error : new SpassError("format", "Something went wrong reading this file.");
      state.error = { field: err.code === "format" ? "file" : "password", message: err.message };
    }
    render();
  }

  function primaryCsv(): { fileName: string; csv: string } {
    const vault = state.vault!;
    return { fileName: fileNameFor(state.format), csv: loginsToCsv(vault.logins, vault.notes, state.format) };
  }

  async function confirmSave(fileName: string, csv: string) {
    state.sheet = null;
    state.externalPending = true;
    render();
    const ok = await platform.save(fileName, csv);
    state.externalPending = false;
    state.saved = state.saved || ok;
    state.snackbar = ok ? `Saved ${fileName}. Delete it after you import.` : "Couldn't save the file. Nothing was written.";
    render();
  }

  function topBar(): HTMLElement {
    return el("header", { class: "appbar" }, [
      icon("lock"),
      el("h1", { class: "title-large" }, ["Pass to CSV"]),
      el("button", { class: "icon-btn", type: "button", "aria-label": "About and privacy", onclick: () => { state.sheet = { kind: "about" }; render(); } }, [icon("more_vert")])
    ]);
  }

  function currentPhase(): "file" | "unlock" | "save" {
    if (state.sheet?.kind === "save" || state.saved) return "save";
    return state.vault ? "unlock" : "file";
  }

  function phaseRail(): HTMLElement {
    const phase = currentPhase();
    const order = ["file", "unlock", "save"] as const;
    const labels = { file: "1 · File", unlock: "2 · Unlock", save: "3 · Save" };
    const at = order.indexOf(phase);
    return el("ol", { class: "rail", "aria-label": "Progress", "data-testid": "rail" },
      order.map((p, i) => el("li", {
        class: i === at ? "pill active" : i < at ? "pill done" : "pill",
        "data-phase": p,
        "aria-current": i === at ? "step" : "false"
      }, [labels[p]])));
  }

  function trustStrip(): HTMLElement {
    return el("p", { class: "trust" }, [icon("lock"), "Stays on this phone · nothing uploaded"]);
  }

  function fieldError(field: "file" | "password"): HTMLElement | null {
    return state.error?.field === field ? el("p", { class: "error", role: "alert" }, [state.error.message]) : null;
  }

  function fileCard(): HTMLElement {
    const input = el("input", { type: "file", accept: ".spass,application/octet-stream,text/plain", id: "spass-file", class: "visually-hidden" }) as HTMLInputElement;
    input.addEventListener("click", () => { state.externalPending = true; });
    input.addEventListener("change", () => {
      state.externalPending = false;
      state.file = input.files?.[0] ?? null;
      state.error = null;
      render();
    });
    return el("section", { class: "card" }, [
      el("h2", { class: "label-large" }, ["Export file"]),
      input,
      el("label", { for: "spass-file", class: "btn outline" }, [icon("folder"), state.file ? "Change file" : "Choose .spass file"]),
      state.file ? el("p", { class: "filename", "data-testid": "filename" }, [state.file.name]) : null,
      fieldError("file")
    ]);
  }

  function passwordCard(): HTMLElement {
    const input = el("input", {
      type: state.showPassword ? "text" : "password",
      id: "spass-password",
      autocomplete: "off",
      spellcheck: "false",
      "aria-describedby": "pw-help"
    }) as HTMLInputElement;
    input.value = state.password;
    input.addEventListener("input", () => {
      state.password = input.value;
      const btn = root.querySelector<HTMLButtonElement>("[data-testid=convert]");
      if (btn) btn.disabled = !canConvert();
    });
    return el("section", { class: "card" }, [
      el("label", { for: "spass-password", class: "label-large" }, ["Export password"]),
      el("div", { class: "field-row" }, [
        input,
        el("button", { type: "button", class: "icon-btn", "aria-label": state.showPassword ? "Hide password" : "Show password", onclick: () => { state.showPassword = !state.showPassword; render(); } }, [icon(state.showPassword ? "visibility_off" : "visibility")])
      ]),
      el("p", { id: "pw-help", class: "helper" }, ["The password you set when exporting — not your Samsung account password."]),
      fieldError("password")
    ]);
  }

  function formatCard(): HTMLElement {
    const hint = FORMATS.find((f) => f.id === state.format)!.hint;
    return el("section", { class: "card" }, [
      el("h2", { class: "label-large" }, ["Save as"]),
      el("div", { class: "chips", role: "radiogroup", "aria-label": "Password manager" },
        FORMATS.map((f) => el("button", {
          type: "button",
          role: "radio",
          class: f.id === state.format ? "chip selected" : "chip",
          "aria-checked": f.id === state.format ? "true" : "false",
          "data-format": f.id,
          onclick: () => { state.format = f.id; storeFormat(f.id); render(); }
        }, [f.label]))
      ),
      el("p", { class: "helper" }, [hint])
    ]);
  }

  function countsRow(vault: Vault): HTMLElement {
    const item = (n: number, label: string) => el("div", { class: "count" }, [el("strong", {}, [String(n)]), el("span", {}, [label])]);
    return el("section", { class: "counts", "data-testid": "counts" }, [
      item(vault.logins.length, "logins"),
      item(vault.cards.length, "cards"),
      item(vault.addresses.length, "addresses"),
      item(vault.notes.length, "notes")
    ]);
  }

  function loginRow(login: Login): HTMLElement {
    const shown = state.revealed.has(login.id);
    const site = login.needsSite
      ? (() => {
          const input = el("input", { type: "url", class: "site-input", placeholder: "Website (optional)", "aria-label": `Website for ${login.name}` }) as HTMLInputElement;
          input.addEventListener("change", () => { setManualSite(login, input.value); render(); });
          return el("div", {}, [input, el("p", { class: "helper" }, ["No website in the export. Left blank unless you type one."])]);
        })()
      : el("p", { class: "site" }, [login.url]);
    return el("li", { class: "login", "data-testid": "login" }, [
      el("div", { class: "login-head" }, [
        el("strong", {}, [login.name]),
        el("button", { type: "button", class: "icon-btn", "aria-label": shown ? "Hide password" : "Show password", onclick: () => { shown ? state.revealed.delete(login.id) : state.revealed.add(login.id); render(); } }, [icon(shown ? "visibility_off" : "visibility")])
      ]),
      el("p", { class: "muted" }, [login.username]),
      el("p", { class: "mono" }, [shown ? login.password : "••••••••"]),
      site
    ]);
  }

  function results(vault: Vault): HTMLElement {
    const q = state.query.trim().toLowerCase();
    const list = el("ul", { class: "list", "data-testid": "login-list" },
      vault.logins.filter((l) => !q || `${l.name} ${l.username} ${l.url}`.toLowerCase().includes(q)).map(loginRow));
    const search = el("input", { type: "search", class: "search", placeholder: "Search logins", "aria-label": "Search logins" }) as HTMLInputElement;
    search.value = state.query;
    search.addEventListener("input", () => {
      state.query = search.value;
      const next = results(vault).querySelector("[data-testid=login-list]")!;
      root.querySelector("[data-testid=login-list]")?.replaceWith(next);
    });
    const extras: HTMLElement[] = [];
    const extra = (label: string, fileName: string, csv: string) =>
      el("button", { type: "button", class: "btn outline", onclick: () => { state.sheet = { kind: "save", fileName, csv }; render(); } }, [icon("download"), label]);
    if (vault.cards.length) extras.push(extra("Save cards", "samsung-pass-cards.csv", cardsToCsv(vault.cards)));
    if (vault.addresses.length) extras.push(extra("Save addresses", "samsung-pass-addresses.csv", addressesToCsv(vault.addresses)));
    if (vault.notes.length && state.format !== "bitwarden") extras.push(extra("Save notes", "samsung-pass-notes.csv", notesToCsv(vault.notes)));
    return el("div", { class: "results" }, [
      countsRow(vault),
      search,
      list,
      extras.length ? el("div", { class: "extras" }, extras) : null,
      state.saved ? el("p", { class: "reminder", role: "status" }, [icon("delete"), "Delete the CSV after you import it. It holds your passwords in plain text."]) : null
    ]);
  }

  function stickyBar(): HTMLElement {
    return el("footer", { class: "sticky" }, [
      el("button", { type: "button", class: "btn outline", "data-testid": "clear", onclick: () => { state.sheet = { kind: "clear" }; render(); } }, [icon("delete"), "Clear"]),
      el("button", { type: "button", class: "btn filled", "data-testid": "save", onclick: () => { state.sheet = { kind: "save", ...primaryCsv() }; render(); } }, [icon("download"), "Save CSV"])
    ]);
  }

  function sheet(): HTMLElement | null {
    const s = state.sheet;
    if (!s) return null;
    const close = () => { state.sheet = null; render(); };
    let body: (HTMLElement | null)[];
    if (s.kind === "save") {
      body = [
        el("h2", { class: "title-large" }, ["Save plaintext CSV?"]),
        el("p", {}, [`${s.fileName} will contain your passwords in plain text. Anyone with the file can read them.`]),
        el("p", { class: "strong" }, ["Import it into your password manager, then delete it."]),
        el("div", { class: "sheet-actions" }, [
          el("button", { type: "button", class: "btn outline", onclick: close }, ["Cancel"]),
          el("button", { type: "button", class: "btn filled", "data-testid": "confirm-save", onclick: () => void confirmSave(s.fileName, s.csv) }, ["Save"])
        ])
      ];
    } else if (s.kind === "clear") {
      body = [
        el("h2", { class: "title-large" }, ["Clear everything?"]),
        el("p", {}, ["Removes the unlocked data, the chosen file, and the password from this screen."]),
        el("div", { class: "sheet-actions" }, [
          el("button", { type: "button", class: "btn outline", onclick: close }, ["Cancel"]),
          el("button", { type: "button", class: "btn danger", "data-testid": "confirm-clear", onclick: wipe }, ["Clear"])
        ])
      ];
    } else {
      body = [
        el("h2", { class: "title-large" }, ["About & privacy"]),
        el("p", {}, ["Pass to CSV converts a Samsung Pass .spass export on this device. Nothing is uploaded. No accounts, analytics, or telemetry. The app never updates itself — get updates from Google Play or GitHub Releases."]),
        el("p", { class: "muted" }, ["Not affiliated with Samsung."]),
        el("div", { class: "sheet-actions" }, [el("button", { type: "button", class: "btn filled", onclick: close }, ["Done"])])
      ];
    }
    return el("div", { class: "scrim", onclick: (e: Event) => { if (e.target === e.currentTarget) close(); } }, [
      el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "data-testid": `sheet-${s.kind}` }, body)
    ]);
  }

  function render() {
    const vault = state.vault;
    const convertBtn = el("button", { type: "button", class: "btn filled wide", "data-testid": "convert", onclick: () => void convert() },
      [state.status === "working" ? "Unlocking…" : "Convert"]) as HTMLButtonElement;
    convertBtn.disabled = !canConvert();
    root.replaceChildren(
      el("div", { class: "shell" }, [
        topBar(),
        phaseRail(),
        trustStrip(),
        fileCard(),
        passwordCard(),
        formatCard(),
        vault ? null : convertBtn,
        vault ? results(vault) : null
      ]),
      vault ? stickyBar() : el("span"),
      sheet() ?? el("span"),
      state.snackbar ? el("div", { class: "snackbar", role: "status", "data-testid": "snackbar" }, [state.snackbar]) : el("span")
    );
    if (state.snackbar) {
      const text = state.snackbar;
      setTimeout(() => { if (state.snackbar === text) { state.snackbar = ""; render(); } }, 4000);
    }
  }

  render();
  return { wipe };
}
```

`web/src/main.ts`:

```ts
import { mount } from "./ui/app";

const root = document.getElementById("app");
if (root) mount(root);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run web/test/ui.test.ts`
Expected: PASS (all tests in the file green)

- [ ] **Step 5: Commit**

```bash
git add web/src/ui web/src/main.ts web/test/ui.test.ts
git commit -m "feat(ui): hybrid single-screen console with phase rail and confirm sheets"
```

---

### Task 8: Dual theme (system light/dark) + HTML template with CSP

**Files:**
- Create: `web/src/ui/styles.css`, `web/index.template.html`
- Test: `web/test/theme.test.ts`

**Interfaces:**
- Consumes: class names from Task 7 (`.appbar .rail .pill .trust .card .chip .counts .login .sticky .sheet .snackbar .btn.filled/.outline/.danger`).
- Produces: CSS tokens `--primary --cta --card --card-border --card-blur --mark-glow --radius-*`; template placeholders `%CSP%`, `%STYLES%`, `%SCRIPT%` consumed by Task 9.
- Light = Material surfaces; dark (`@media (prefers-color-scheme: dark)`) = forest gradient shell, glass cards (`backdrop-filter`), lock-mark glow, gradient CTA. No `[data-theme]`, no toggle.

- [ ] **Step 1: Write the failing test**

`web/test/theme.test.ts`:

```ts
import { readFileSync } from "node:fs";

const css = readFileSync("web/src/ui/styles.css", "utf8");
const template = readFileSync("web/index.template.html", "utf8");

describe("dual theme tokens", () => {
  it("light primary is #1e3a34", () => {
    expect(css).toMatch(/--primary:\s*#1e3a34/);
  });

  it("dark theme follows the system with glass, glow and gradient CTA", () => {
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(dark).toMatch(/#0c1210/);
    expect(dark).toMatch(/--card-blur:\s*blur\(/);
    expect(dark).toMatch(/--mark-glow:\s*0 0/);
    expect(dark).toMatch(/--cta:\s*linear-gradient\(135deg, #3d8f76 0%, #1e3a34 100%\)/);
  });

  it("has no in-app theme toggle", () => {
    expect(css).not.toMatch(/\[data-theme/);
    expect(readFileSync("web/src/ui/app.ts", "utf8")).not.toMatch(/data-theme|toggleTheme/);
  });

  it("template declares color-scheme and a CSP placeholder", () => {
    expect(template).toMatch(/name="color-scheme" content="light dark"/);
    expect(template).toMatch(/Content-Security-Policy" content="%CSP%"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/test/theme.test.ts`
Expected: FAIL — `ENOENT: web/src/ui/styles.css`

- [ ] **Step 3: Implement**

`web/src/ui/styles.css`:

```css
/* Pass to CSV — dual theme. Follows prefers-color-scheme (Android WebView day/night). No in-app toggle. */
:root {
  color-scheme: light dark;
  --primary: #1e3a34;
  --on-primary: #f4f1ea;
  --primary-container: #cfe6dd;
  --on-primary-container: #0b201b;
  --surface: #f6f8f6;
  --card: #ffffff;
  --card-border: #e1e6e3;
  --ink: #17201d;
  --muted: #56625e;
  --danger: #a3362b;
  --amber: #8a5a00;
  --amber-bg: #fff4dc;
  --cta: var(--primary);
  --card-blur: none;
  --card-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.05);
  --mark-glow: none;
  --radius-card: 24px;
  --radius-btn: 20px;
  --radius-sheet: 28px;
  --pad: 16px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: linear-gradient(180deg, #0c1210 0%, #121a18 100%);
    --card: rgba(255, 255, 255, 0.06);
    --card-border: rgba(255, 255, 255, 0.12);
    --ink: #e7efeb;
    --muted: #9fb1aa;
    --primary-container: rgba(61, 143, 118, 0.28);
    --on-primary-container: #d8f1e8;
    --danger: #ff8a7a;
    --amber: #ffcf70;
    --amber-bg: rgba(255, 191, 64, 0.12);
    --cta: linear-gradient(135deg, #3d8f76 0%, #1e3a34 100%);
    --card-blur: blur(16px) saturate(140%);
    --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    --mark-glow: 0 0 18px rgba(61, 143, 118, 0.75);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { background: var(--surface); background-attachment: fixed; color: var(--ink); font: 16px/1.5 Roboto, "Noto Sans", system-ui, sans-serif; }
button, input { font: inherit; color: inherit; }
.shell { max-width: 32rem; margin: 0 auto; padding: max(var(--pad), env(safe-area-inset-top)) var(--pad) calc(96px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: var(--pad); }
.appbar { display: flex; align-items: center; gap: 8px; }
.appbar .icon[data-icon="lock"] { border-radius: 50%; box-shadow: var(--mark-glow); }
.appbar .icon-btn { margin-left: auto; }
.title-large { font-size: 1.375rem; font-weight: 500; margin: 0; }
.label-large { font-size: 0.875rem; font-weight: 600; margin: 0; }
.rail { list-style: none; display: flex; gap: 8px; margin: 0; padding: 0; }
.pill { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--card-border); color: var(--muted); font-size: 0.8125rem; }
.pill.done { color: var(--ink); }
.pill.active { background: var(--primary-container); color: var(--on-primary-container); border-color: transparent; font-weight: 600; }
.trust { display: flex; gap: 6px; align-items: center; margin: 0; color: var(--muted); font-size: 0.875rem; }
.card { background: var(--card); border: 1px solid var(--card-border); border-radius: var(--radius-card); padding: var(--pad); display: flex; flex-direction: column; gap: 8px; box-shadow: var(--card-shadow); backdrop-filter: var(--card-blur); -webkit-backdrop-filter: var(--card-blur); }
.field-row { display: flex; gap: 8px; }
.field-row input, .search, .site-input { flex: 1; width: 100%; padding: 12px 16px; border-radius: 16px; border: 1px solid var(--card-border); background: transparent; }
.helper, .muted { color: var(--muted); font-size: 0.875rem; margin: 0; }
.error { color: var(--danger); font-size: 0.875rem; margin: 0; }
.filename, .site { margin: 0; font-size: 0.875rem; word-break: break-all; }
.mono { font-family: ui-monospace, Menlo, monospace; font-size: 0.875rem; margin: 0; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 24px; border-radius: var(--radius-btn); border: 1px solid transparent; cursor: pointer; font-weight: 600; }
.btn.filled { background: var(--cta); color: var(--on-primary); }
.btn.outline { background: transparent; border-color: var(--card-border); }
.btn.danger { background: var(--danger); color: #fff; }
.btn.wide { width: 100%; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.icon-btn { background: none; border: 0; padding: 8px; border-radius: 50%; cursor: pointer; }
.icon { display: inline-block; width: 20px; height: 20px; }
.icon::before { content: attr(data-icon); font-family: "Material Symbols Outlined", sans-serif; font-size: 0; }
.chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.chip { min-height: 40px; border-radius: 12px; border: 1px solid var(--card-border); background: transparent; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
.chip.selected { background: var(--primary-container); color: var(--on-primary-container); border-color: transparent; }
.counts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.count { background: var(--card); border: 1px solid var(--card-border); border-radius: 16px; padding: 8px; text-align: center; display: flex; flex-direction: column; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.login { background: var(--card); border: 1px solid var(--card-border); border-radius: 20px; padding: 12px var(--pad); backdrop-filter: var(--card-blur); }
.login-head { display: flex; justify-content: space-between; align-items: center; }
.login .site-input + .helper { color: var(--amber); }
.login:has(.site-input) { border-color: var(--amber); background: var(--amber-bg); }
.extras { display: flex; flex-wrap: wrap; gap: 8px; }
.reminder { display: flex; gap: 8px; color: var(--amber); background: var(--amber-bg); padding: 12px; border-radius: 16px; margin: 0; }
.sticky { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 8px; padding: 12px var(--pad) max(12px, env(safe-area-inset-bottom)); background: var(--card); border-top: 1px solid var(--card-border); backdrop-filter: var(--card-blur); }
.sticky .btn { flex: 1; }
.scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 32rem; background: var(--card); color: var(--ink); border-radius: var(--radius-sheet) var(--radius-sheet) 0 0; padding: 24px var(--pad) max(24px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; backdrop-filter: var(--card-blur); }
@media (prefers-color-scheme: dark) { .sheet { background: #16201d; } }
.sheet p { margin: 0; }
.strong { font-weight: 600; }
.sheet-actions { display: flex; gap: 8px; justify-content: flex-end; }
.snackbar { position: fixed; left: 50%; transform: translateX(-50%); bottom: 96px; background: #1b2522; color: #eef4f1; padding: 12px 16px; border-radius: 12px; max-width: 90vw; }
@media (prefers-reduced-motion: no-preference) { .btn, .chip, .pill { transition: background 150ms ease, opacity 150ms ease; } }
```

`web/index.template.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f8f6" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0c1210" />
    <meta http-equiv="Content-Security-Policy" content="%CSP%" />
    <title>Pass to CSV</title>
    <style>
%STYLES%
    </style>
  </head>
  <body>
    <main id="app"></main>
    %SCRIPT%
  </body>
</html>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run web/test/theme.test.ts`
Expected: PASS (all tests in the file green)

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/styles.css web/index.template.html web/test/theme.test.ts
git commit -m "feat(ui): Material light + glass dark tokens following system theme"
```

---

### Task 9: One build → all artifacts, drift check, CI

**Files:**
- Create: `scripts/build.mjs`, `.github/workflows/ci.yml`
- Regenerate: `index.html`, `app.js`, `samsung-pass-to-csv.html`, `android/app/src/main/assets/index.html`, `android/app/src/main/assets/app.js`

**Interfaces:**
- Consumes: `web/src/main.ts`, `web/src/ui/styles.css`, `web/index.template.html`.
- Produces: `npm run build` (writes 5 files) and `node scripts/build.mjs --check` (exit 1 + file list on drift). Linked pages use `script-src 'self'`; the inlined page uses `script-src 'sha256-<hash>'`. Every page: `default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`.

- [ ] **Step 1: Prove the drift check fails before the script exists**

Run: `node scripts/build.mjs --check`
Expected: FAIL — `Cannot find module '/workspace/spc/app/scripts/build.mjs'`

- [ ] **Step 2: Implement the build**

`scripts/build.mjs`:

```js
// One source → all artifacts. `node scripts/build.mjs` writes; `--check` fails on drift.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const check = process.argv.includes("--check");
const BASE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

const bundle = await build({
  entryPoints: ["web/src/main.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: false,
  legalComments: "none",
  write: false
});
const js = `"use strict";\n${bundle.outputFiles[0].text}`;
const styles = readFileSync("web/src/ui/styles.css", "utf8");
const template = readFileSync("web/index.template.html", "utf8");

const page = (csp, script) =>
  template.replace("%CSP%", csp).replace("%STYLES%", styles.trimEnd()).replace("%SCRIPT%", script);

const linked = page(`${BASE_CSP}; script-src 'self'`, '<script src="app.js"></script>');
const hash = createHash("sha256").update(js).digest("base64");
const inlined = page(`${BASE_CSP}; script-src 'sha256-${hash}'`, `<script>${js}</script>`);

const outputs = {
  "index.html": linked,
  "app.js": js,
  "samsung-pass-to-csv.html": inlined,
  "android/app/src/main/assets/index.html": linked,
  "android/app/src/main/assets/app.js": js
};

let drift = [];
for (const [path, contents] of Object.entries(outputs)) {
  if (check) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== contents) drift.push(path);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
}
if (check && drift.length) {
  console.error(`Generated files are out of date. Run npm run build.\n  ${drift.join("\n  ")}`);
  process.exit(1);
}
console.log(check ? "build: no drift" : `build: wrote ${Object.keys(outputs).length} files`);
```

- [ ] **Step 3: Check against the old hand-edited root files**

Run: `node scripts/build.mjs --check`
Expected: exit 1, lists `index.html`, `app.js`, `samsung-pass-to-csv.html`, and both android asset paths.

- [ ] **Step 4: Build and re-check**

Run: `npm run build && node scripts/build.mjs --check`
Expected: `build: wrote 5 files` then `build: no drift`.

- [ ] **Step 5: Verify CSP and no export-data sinks**

Run: `rg -c "connect-src 'none'" index.html samsung-pass-to-csv.html android/app/src/main/assets/index.html && rg -n "innerHTML" web/src || echo "no innerHTML"`
Expected: `1` for each file; `no innerHTML`.

- [ ] **Step 6: Browser check both themes**

Run: `npx --yes http-server -p 8080 . &` then open `http://localhost:8080/index.html` in Chrome DevTools device mode; toggle Rendering → "Emulate CSS prefers-color-scheme" light/dark. Also open `samsung-pass-to-csv.html` via `file://`.
Expected: no CSP violations in the console; light = white cards/solid teal Convert; dark = glass cards, glowing lock, gradient Convert; rail shows `1 · File` active. Stop the server with `kill %1`.

- [ ] **Step 7: Add CI**

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run check
  android:
    runs-on: ubuntu-latest
    needs: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: "8.7"
      - run: gradle -p android assembleRelease
```

(`npm run check` also runs `scripts/check-android.mjs`, added in Task 10; until then run `node scripts/build.mjs --check` locally.)

- [ ] **Step 8: Commit**

```bash
git add scripts/build.mjs .github/workflows/ci.yml index.html app.js samsung-pass-to-csv.html android/app/src/main/assets
git commit -m "build: single source emits web, inlined HTML and APK assets with drift check"
```

---

### Task 10: Android project — WebViewAssetLoader, origin-gated bridge, no updater (P0/P1)

`android/` does not exist in git; create it from scratch. The v1.6 APK (`/tmp/spc-apk/`) is reference only — do **not** port its `ServerSocket`, `network_security_config`, `addJavascriptInterface`, `unlockSpass`, `pickSpass`, `downloadAndInstall` or `version.json` code.

**Files:**
- Create: `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`, `android/.gitignore`, `android/app/build.gradle.kts`, `android/app/proguard-rules.pro`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt`, `android/app/src/main/res/values/themes.xml`, `android/app/src/main/res/values-night/themes.xml`, `android/app/src/main/res/xml/data_extraction_rules.xml`, `scripts/check-android.mjs`
- Delete: `version.json`

**Interfaces:**
- Consumes: generated `android/app/src/main/assets/{index.html,app.js}` (Task 9); bridge contract from Task 7 (`passBridge`, `save` → `saved`).
- Produces: `https://appassets.androidplatform.net/assets/index.html` as the only origin; `passBridge` only injected for that origin and main frame; SAF `ACTION_OPEN_DOCUMENT` via `<input type=file>` and SAF `CreateDocument("text/csv")` for saves (no storage permission); `FLAG_SECURE`; `webView.onPause()` on pause so the page's `visibilitychange` wipe runs; DayNight theme + algorithmic darkening off so the page's own dark tokens apply.

- [ ] **Step 1: Write the failing policy check**

`scripts/check-android.mjs`:

```js
// Static policy checks on the Android project. Runs without the Android SDK.
import { readFileSync, existsSync } from "node:fs";

const fail = [];
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const activity = readFileSync("android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt", "utf8");
const gradle = readFileSync("android/app/build.gradle.kts", "utf8");

for (const perm of ["android.permission.INTERNET", "android.permission.REQUEST_INSTALL_PACKAGES"]) {
  if (manifest.includes(perm)) fail.push(`manifest must not request ${perm}`);
}
if (!/android:allowBackup="false"/.test(manifest)) fail.push("allowBackup must be false");
if (!/android:dataExtractionRules=/.test(manifest)) fail.push("dataExtractionRules missing");
if (/usesCleartextTraffic="true"|networkSecurityConfig/.test(manifest)) fail.push("no cleartext / network security config allowed");
if (!activity.includes("FLAG_SECURE")) fail.push("FLAG_SECURE missing");
if (!activity.includes("WebViewAssetLoader")) fail.push("WebViewAssetLoader missing");
if (!activity.includes('"https://appassets.androidplatform.net"')) fail.push("bridge origin gate missing");
for (const banned of ["ServerSocket", "PackageInstaller", "version.json", "downloadAndInstall", "addJavascriptInterface", "unlockSpass", "http://127.0.0.1"]) {
  if (activity.includes(banned)) fail.push(`MainActivity must not contain ${banned}`);
}
if (!/allowFileAccess = false/.test(activity) || !/allowContentAccess = false/.test(activity)) fail.push("file/content access must be off");
if (!/isMinifyEnabled = true/.test(gradle)) fail.push("release must enable R8");
if (!/applicationId = "com.jrrahman.passtocsv"/.test(gradle)) fail.push("applicationId must stay com.jrrahman.passtocsv");
if (!existsSync("android/app/src/main/res/values-night/themes.xml")) fail.push("night theme missing");
if (existsSync("version.json")) fail.push("version.json updater manifest must be deleted");

if (fail.length) {
  console.error(`android policy check failed:\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
console.log("android policy: ok");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check-android.mjs`
Expected: FAIL — `ENOENT ... android/app/src/main/AndroidManifest.xml`

- [ ] **Step 3: Create the Gradle project**

`android/settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "PassToCsv"
include(":app")
```

`android/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
```

`android/gradle.properties`:

```properties
android.useAndroidX=true
org.gradle.jvmargs=-Xmx2g
kotlin.code.style=official
```

`android/.gitignore`:

```text
.gradle/
build/
app/build/
local.properties
keystore.properties
*.jks
*.keystore
```

`android/app/build.gradle.kts`:

```kotlin
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.jrrahman.passtocsv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.jrrahman.passtocsv"
        minSdk = 29
        targetSdk = 34
        versionCode = 20
        versionName = "2.0"
    }

    signingConfigs {
        create("release") {
            if (keystoreProps.isNotEmpty()) {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
                enableV1Signing = false
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystoreProps.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
```

`android/app/proguard-rules.pro`:

```text
# No JavascriptInterface classes; WebMessageListener is referenced directly. Nothing to keep.
```

- [ ] **Step 4: Manifest, themes, backup rules**

`android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- No INTERNET, no REQUEST_INSTALL_PACKAGES, no storage permission (SAF only). -->

    <application
        android:allowBackup="false"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="false"
        android:label="Pass to CSV"
        android:supportsRtl="true"
        android:theme="@style/Theme.PassToCsv">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|uiMode|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

`android/app/src/main/res/values/themes.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.PassToCsv" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">#1e3a34</item>
        <item name="android:windowBackground">#f6f8f6</item>
        <item name="android:statusBarColor">#f6f8f6</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>
</resources>
```

`android/app/src/main/res/values-night/themes.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.PassToCsv" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">#3d8f76</item>
        <item name="android:windowBackground">#0c1210</item>
        <item name="android:statusBarColor">#0c1210</item>
        <item name="android:windowLightStatusBar">false</item>
    </style>
</resources>
```

`android/app/src/main/res/xml/data_extraction_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" />
        <exclude domain="file" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" />
        <exclude domain="file" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </device-transfer>
</data-extraction-rules>
```

- [ ] **Step 5: MainActivity**

`android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt`:

```kotlin
package com.jrrahman.passtocsv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCsv: String? = null
    private var pendingReply: JavaScriptReplyProxy? = null

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(ASSET_HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private val pickFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data
        fileCallback?.onReceiveValue(if (result.resultCode == Activity.RESULT_OK && uri != null) arrayOf(uri) else null)
        fileCallback = null
    }

    private val createCsv = registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        val csv = pendingCsv
        pendingCsv = null
        val ok = uri != null && csv != null && runCatching {
            contentResolver.openOutputStream(uri, "wt")!!.use { it.write(csv.toByteArray(Charsets.UTF_8)) }
        }.isSuccess
        pendingReply?.postMessage(JSONObject().put("type", "saved").put("ok", ok).toString())
        pendingReply = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        WebView.setWebContentsDebuggingEnabled(false)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION") allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION") allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
        }
        // Follow Android day/night; the page's prefers-color-scheme drives light vs dark tokens.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != ASSET_HOST
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/octet-stream", "text/plain"))
                }
                pickFile.launch(intent)
                return true
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "passBridge", setOf(ASSET_ORIGIN)) { _, message, sourceOrigin, isMainFrame, reply ->
                if (!isMainFrame || sourceOrigin.toString() != ASSET_ORIGIN) return@addWebMessageListener
                val json = runCatching { JSONObject(message.data ?: "") }.getOrNull() ?: return@addWebMessageListener
                if (json.optString("type") != "save") return@addWebMessageListener
                val name = json.optString("fileName").takeIf { SAFE_NAME.matches(it) } ?: "samsung-pass.csv"
                pendingCsv = json.optString("csv")
                pendingReply = reply
                createCsv.launch(name)
            }
        }

        webView.loadUrl("$ASSET_ORIGIN/assets/index.html")
    }

    override fun onPause() {
        super.onPause()
        webView.onPause() // fires visibilitychange → page wipes vault unless a picker is open
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        pendingCsv = null
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val ASSET_ORIGIN = "https://appassets.androidplatform.net"
        private val SAFE_NAME = Regex("^samsung-pass-[a-z0-9-]+\\.csv$")
    }
}
```

- [ ] **Step 6: Kill the updater manifest**

Run: `git rm version.json`

- [ ] **Step 7: Run the policy check**

Run: `node scripts/check-android.mjs && npm run check`
Expected: `android policy: ok` and `build: no drift`.

- [ ] **Step 8: Compile (needs JDK 17 + Android SDK 34; `ANDROID_HOME` set)**

Run: `gradle -p android wrapper --gradle-version 8.7 && android/gradlew -p android assembleDebug`
Expected: `BUILD SUCCESSFUL`; `android/app/build/outputs/apk/debug/app-debug.apk` exists.
Then: `$ANDROID_HOME/build-tools/34.0.0/aapt2 dump permissions android/app/build/outputs/apk/debug/app-debug.apk`
Expected: no `android.permission.INTERNET`, no `REQUEST_INSTALL_PACKAGES`.

- [ ] **Step 9: Release signing (one-time, key never committed)**

```bash
keytool -genkeypair -v -keystore ~/passtocsv-release.jks -alias passtocsv -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Pass to CSV, O=Juel Hossain"
cat > android/keystore.properties <<'PROPS'
storeFile=/home/box/passtocsv-release.jks
storePassword=<typed by owner>
keyAlias=passtocsv
keyPassword=<typed by owner>
PROPS
android/gradlew -p android assembleRelease
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```
Expected: `Verified using v2 scheme (APK Signature Scheme v2): true`, v1 `false`; record the SHA-256 cert digest for the README/release notes. Back the `.jks` up offline — losing it blocks all future updates.

- [ ] **Step 10: Commit**

```bash
git add android scripts/check-android.mjs
git commit -m "feat(android): WebViewAssetLoader app with origin-gated save bridge, no updater, FLAG_SECURE"
```

---

### Task 11: Release hygiene and copy (README, Privacy, Play listing)

**Files:**
- Modify: `README.md`
- Create: `PRIVACY.md`, `docs/play/listing.md`
- Delete: `Pass-to-CSV.apk` (debug-signed `CN=Local`; future APKs ship only as GitHub Release assets)

**Interfaces:**
- Consumes: About & privacy sheet copy in `web/src/ui/app.ts` (Task 7) — Privacy text must say the same things: on-device, nothing uploaded, no telemetry, no in-app updater, delete the CSV.

- [ ] **Step 1: Write the failing copy check**

`web/test/copy.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";

describe("public copy", () => {
  const readme = readFileSync("README.md", "utf8");
  it("README points to Releases, verification and CSV deletion", () => {
    expect(readme).toMatch(/GitHub Releases/);
    expect(readme).toMatch(/apksigner verify/);
    expect(readme).toMatch(/Delete the CSV/);
    expect(readme).not.toMatch(/version\.json|allow install/i);
  });
  it("Privacy and Play listing exist and claim on-device only", () => {
    for (const p of ["PRIVACY.md", "docs/play/listing.md"]) {
      expect(readFileSync(p, "utf8")).toMatch(/[Nn]othing is uploaded|nothing uploaded/);
    }
  });
  it("no committed APK or updater manifest", () => {
    expect(existsSync("Pass-to-CSV.apk")).toBe(false);
    expect(existsSync("version.json")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run web/test/copy.test.ts`
Expected: FAIL — README lacks `GitHub Releases`; `PRIVACY.md` ENOENT; APK exists.

- [ ] **Step 3: Write the copy**

`README.md`:

````markdown
# Pass to CSV

Convert a Samsung Pass `.spass` export into a CSV for 1Password, Google Password Manager, Apple Passwords, or Bitwarden. Everything happens on your phone. Nothing is uploaded. No accounts, analytics, or telemetry.

Not affiliated with Samsung.

## Get it

- **Android app:** Google Play, or the signed APK on [GitHub Releases](https://github.com/junior-rahman/spass-csv/releases). The app never updates itself.
- **Web page:** download `samsung-pass-to-csv.html` from a release and open it in Chrome. It works offline and its Content-Security-Policy blocks all network requests (`connect-src 'none'`).

### Verify a downloaded APK

Each release lists the APK's SHA-256 and the signing certificate fingerprint.

```bash
sha256sum Pass-to-CSV-2.0.apk
apksigner verify --print-certs Pass-to-CSV-2.0.apk
```

Both must match the release notes. Do not install an APK that does not match.

## Use it

1. In Samsung Pass: Settings → Export data. Set an export password and save the `.spass` file.
2. Open Pass to CSV, choose the file, type the **export** password (not your Samsung account password).
3. Pick 1Password, Google, Apple, or Bitwarden and tap **Convert**.
4. Check the list. Logins with no website stay blank — type one if you want. The app never guesses websites.
5. Tap **Save CSV**, confirm, and import the file into your password manager.
6. **Delete the CSV** and the `.spass` file after importing. The CSV holds your passwords in plain text.

The app follows your phone's light or dark setting.

## Develop

```bash
npm ci
npm test          # vitest: crypto round-trip, parser, golden CSVs, UI
npm run build     # writes index.html, app.js, samsung-pass-to-csv.html, android/app/src/main/assets/
npm run check     # fails if generated files drift or Android policy is violated
gradle -p android assembleRelease   # needs JDK 17 + Android SDK 34 and android/keystore.properties
```

Sources live in `web/src` (TypeScript) and `android/` (Kotlin). Never edit the generated root files by hand.
````

`PRIVACY.md`:

```markdown
# Pass to CSV — Privacy

- Pass to CSV reads the `.spass` file you choose and decrypts it on your device with the password you type.
- Nothing is uploaded. The Android app has no internet permission. The web page blocks all network requests with its Content-Security-Policy.
- No accounts, analytics, crash reporting, or telemetry.
- The app stores one setting on your device: the last password-manager format you chose.
- Unlocked data stays in memory only and is cleared when you tap Clear or leave the app.
- A CSV is written only when you tap Save CSV and confirm. It is plain text: delete it after you import it.
- The app never downloads or installs updates. Updates come from Google Play or GitHub Releases.

Contact: open an issue at https://github.com/junior-rahman/spass-csv/issues
```

`docs/play/listing.md`:

```markdown
# Play Store listing — Pass to CSV

**Title:** Pass to CSV
**Subtitle / short description:** Samsung Pass export converter — on-device, nothing uploaded.

**Full description:**
Pass to CSV turns your Samsung Pass export into a CSV you can import into 1Password, Google Password Manager, Apple Passwords, or Bitwarden.

- Converts on your phone. No internet permission. Nothing is uploaded.
- Four formats, equal support.
- Never guesses websites — logins without one stay blank so your password manager can't autofill on the wrong site.
- Asks before saving, and reminds you to delete the CSV after import.
- Follows your phone's light or dark theme.

Not affiliated with Samsung.

**Data safety:** No data collected. No data shared. Data is not encrypted in transit because none is transmitted.

**Screenshots (light and dark each):** 1) idle console with phase rail on File, 2) unlocked with counts on Unlock, 3) Save confirm sheet on Save.

**Privacy policy:** PRIVACY.md (must match the in-app About & privacy sheet).
```

- [ ] **Step 4: Remove the committed APK**

Run: `git rm Pass-to-CSV.apk`

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run web/test/copy.test.ts && npm test`
Expected: PASS; whole suite green.

- [ ] **Step 6: Commit**

```bash
git add README.md PRIVACY.md docs/play/listing.md web/test/copy.test.ts
git commit -m "docs: Releases-only distribution, privacy policy and Play listing"
```

---

### Task 12: Manual smoke + acceptance checklist

**Files:**
- Create: `docs/superpowers/manual-smoke.md`

**Interfaces:**
- Consumes: built web page (Task 9), debug/release APK (Task 10). The real export `/workspace/spc/2026_08_24_16_26_52_spass_export_data.spass` is used **only on a device or local browser, never committed or logged**. CI uses `encryptSpass` fixtures only.

- [ ] **Step 1: Generate a synthetic test export for manual runs**

Run:
```bash
cat > /tmp/make-sample.mts <<'TS'
import { writeFileSync } from "node:fs";
import { encryptSpass, samplePlaintext } from "/workspace/spc/app/web/src/lib/index.ts";
writeFileSync("/tmp/sample.spass", await encryptSpass(samplePlaintext(), "correct horse battery"));
TS
npx --yes tsx /tmp/make-sample.mts && ls -l /tmp/sample.spass
```
Expected: `/tmp/sample.spass` exists (password `correct horse battery`). Do not add it to git.

- [ ] **Step 2: Write the checklist file**

`docs/superpowers/manual-smoke.md`:

```markdown
# Manual smoke — Pass to CSV 2.0

Run in Chrome (web, light + dark via DevTools Rendering) and on an Android 10+ device (APK, system dark mode on and off).

## Flow
- [ ] Rail shows `1 · File` active; Convert disabled until a file and password are entered.
- [ ] Wrong password → red text under the password field mentioning "not your Samsung account password".
- [ ] Non-.spass file (a PNG) → format error under the file card.
- [ ] Correct password (`/tmp/sample.spass`, `correct horse battery`) → results expand in place; rail on `2 · Unlock`; counts 3 · 1 · 1 · 1; **no file written**.
- [ ] "Chase Bank Card" shows an amber blank website field; nothing like `chasebank.com` anywhere.
- [ ] Search "bank" filters to 2 logins; reveal/hide toggles one password.
- [ ] Switch chip to Apple → Save CSV → sheet warns plaintext; rail on `3 · Save`; Cancel writes nothing.
- [ ] Confirm → `samsung-pass-apple.csv` saved (APK: system "Save to" picker); snackbar; delete-after-import reminder visible.
- [ ] Open the CSV in Sheets: the `=HYPERLINK` note shows as text starting with `'`.
- [ ] Import each of the four CSVs into 1Password, Google, Apple, Bitwarden test vaults — titles, URLs, usernames, passwords, OTP land correctly.
- [ ] Clear → confirm → file name, password field, and results gone.
- [ ] Unlock, press Home, return → results gone (APK). Recents thumbnail is blank; screenshot blocked (FLAG_SECURE).
- [ ] Reopen app → last chip (Apple) still selected.

## Themes
- [ ] Light: white cards, solid #1e3a34 Convert, no glow.
- [ ] Dark: forest gradient background, glass cards, lock glow, gradient Convert/Save; status bar dark.
- [ ] No theme toggle anywhere.

## Offline / security
- [ ] Airplane mode: everything above still works.
- [ ] `aapt2 dump permissions` shows no INTERNET / REQUEST_INSTALL_PACKAGES.
- [ ] `adb shell bmgr backupnow com.jrrahman.passtocsv` backs up nothing.
- [ ] Real export (owner's device only): unlocks; password never typed into logs or chat.

## Play screenshots (light + dark)
- [ ] Idle console (File), unlocked with counts (Unlock), save confirm sheet (Save).
```

- [ ] **Step 3: Run the full automated gate**

Run: `npm run typecheck && npm test && npm run check`
Expected: typecheck clean; all test files PASS; `build: no drift`; `android policy: ok`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/manual-smoke.md
git commit -m "docs: manual smoke and acceptance checklist"
```

---

## Acceptance traceability

| Requirement (spec §10 / FIX-PLAN) | Task |
|---|---|
| One-screen hybrid console, phase rail, light/dark | 7, 8, 12 |
| Four formats equal; default last-used else 1Password | 5, 7 |
| No auto-save; save + clear confirmations | 7 (ui tests), 12 |
| No guessed websites; every URL from export or curated map | 4, 5, 7 |
| WebViewAssetLoader; no localhost server; no in-app updater; no INTERNET / REQUEST_INSTALL_PACKAGES | 10 |
| Bridge rejects non-asset origins; file/content access off | 10 |
| CSP in every HTML; no innerHTML with export data | 8, 9 |
| Wrong password never yields a vault (10k fuzz on header gate + 40 real wrong keys) | 1, 2 |
| Formula-leading cells neutralized (golden) | 5 |
| FLAG_SECURE; vault cleared on background | 7, 10, 12 |
| One build, CI drift check, tests green, no secrets in fixtures | 0, 2, 9 |
| Privacy/About + Play listing match, on-device only | 7, 11 |
| Release-signed, non-debug, R8, allowBackup=false, v2/v3 only | 10 |
| README verify/delete guidance; picker accept filter | 7, 11 |

Execution note: the full suite was dry-run on a scratch copy of this plan's code (Node 24, vitest 2.1.9): 53 tests green, `tsc --noEmit` clean, `build --check` clean, `check-android` ok. The Kotlin was not compiled (no Android SDK on the box) — Task 10 Step 8 is the first compile.
