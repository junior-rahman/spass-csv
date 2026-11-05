# Spcc Soft Grove Design Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved whole-app Warm Grove / P2 Soft usability, accessibility, flow-honesty, visual, and Play-artwork pass as Spcc 2.0.8 without changing conversion semantics or publishing anything.

**Architecture:** Use one integration branch, `soft-grove`, with serial application work **W0 → W1 → W2 → W3**; run **W4 artwork concurrently in a second worker/worktree after W0**, then integrate its asset-only commit before final verification. This is intentionally not four simultaneous app editors: `app.ts` contains one closure-owned state/render system and W1–W3 all change it and `styles.css`; parallel editing here is merge-hell, not useful decomposition. Add small typed sheet, undo, and guide modules instead of replacing the app architecture; keep the origin-gated Kotlin bridge and extend its result protocol only where required for honest outcomes and actual filenames.

**Tech Stack:** TypeScript strict/ES2022, direct DOM helpers, CSS system light/dark themes, Vitest 2/jsdom 25, esbuild 0.24, Kotlin/ComponentActivity/WebViewAssetLoader, Android SDK 34/minSdk 29/JDK 17, Gradle 8.7 (no wrapper in this repository), Pillow 13 for deterministic local artwork.

## Global Constraints

Authority: `docs/superpowers/specs/2026-11-05-soft-grove-design-pass-design.md` (approved; baseline 2.0.7) and `docs/brand/pass-to-csv-brand.md`. Product choices in the spec override the earlier critic audit.

- Warm Grove palette: Grove `#3F4F3A`, Olive `#6B8F71`, Fern `#A3C9A8`, Cream `#F7F4EF`, Soil `#1C1917`.
- P2 Soft overlap lockup and locked P-ring mark. Display name Spcc; subtitle Spass to CSV Converter.
- Device-controlled theme only; no theme toggle.
- Current import flow: destination picker before export and post-Save guidance. Destinations remain 1Password, Google Password Manager, Apple Passwords, and Bitwarden. Preserve default 1Password and last-choice persistence; changing destination never auto-saves.
- Existing conversion, editing, privacy, and CSV rules. Never invent websites or passwords. Preserve export-password versus Samsung-account clarity and the plaintext warning before Save.
- 1Password headerless Title,Website,Username,Password,Notes with blank missing websites and no OTP in Notes. Google retains its current headers, `no url` fallback and note/OTP behavior; Apple retains OTPAuth; Bitwarden retains its headers and login_totp. Existing placeholder behavior otherwise stays unchanged.
- Existing post-unlock Clear/Save affordances. No new cards/addresses onboarding screens.
- **Delete incomplete:** Delete N applies immediately to the unlocked vault and preview, then shows an undo toast with a clearly labeled Undo action.
- **Convert remains in the scroll pane, not sticky.** Do not apply the earlier audit's sticky-Convert suggestion.
- Native user cancellation says **Save cancelled — nothing written**.
- On web, use **Download started** when initiating a download; do not claim the file was written without confirmation.
- App icon: locked P-ring on a Warm Grove squircle; feature graphic exactly **1024 × 500 px**, Cream field, P2 Soft lockup, tagline **Samsung Pass → CSV for 1Password, Google, Apple, Bitwarden**, and a phone mock using fabricated, non-sensitive demo content only.
- Mention destination/product names as text only. Do not use competitor logos or imply endorsement/affiliation.
- Parser quote hardening, the www package, and phone formula-safe work remain carried items, not part of this pass.
- No package-name or pricing changes. No CSV-format redesign. Play Console identity/publishing belongs to the teammate.
- Implementation ships as **2.0.8**, with versionCode advanced from 2.0.7. This documentation commit does not bump versions or implement UI/artwork. Publishing remains separate.
- Public GitHub source precedes any eventual Play delivery; no APK/AAB in public git. **This plan authoring task and implementation steps below authorize no push, PR, Drive upload, Play upload, or publication.** Local build artifacts stay ignored. Obtain a separate delivery instruction before sharing them.
- Preserve CSP `connect-src 'none'`, text-node rendering for vault data, `FLAG_SECURE`, backup restrictions, asset-origin bridge gate, and Play-managed updates. Guide links open an external browser, never enable network access in the WebView.

---

## File structure and ownership map

All repository paths below are relative to `/workspace/spc/app`; commands run there unless a command explicitly supplies `-p android`.

| File | Action / responsibility | Owner |
|---|---|---|
| `web/src/ui/sheets.ts` | New sheet shell + rerender-aware modal focus controller | W0 |
| `web/src/ui/undo.ts` | New in-memory one-level undo slot + accessible toast renderer; no persistence | W0 |
| `web/test/sheets.test.ts`, `web/test/undo.test.ts` | New primitive contract tests in jsdom | W0 |
| `web/src/ui/app.ts` | Sheet adoption, delete/undo, empty results | W1, then W2, then W3 only |
| `web/src/ui/styles.css` | Sheet/undo CSS, destination redesign, quiet visual cleanup | W0, then W1, then W2, then W3 only |
| `web/test/ui.test.ts` | Real encrypted-fixture integration tests; keep its `setup`, `choose`, `unlock`, `q` helpers | W1, then W2, then W3 only |
| `web/test/ui-empty.test.ts` | New mock-unlock empty-vault tests | W1 |
| `web/src/ui/platform.ts` | Typed save outcomes + safe bridge settlement | W2 |
| `web/src/ui/guides.ts` | New immutable export context → guide content | W2 |
| `web/src/lib/formats.ts` | Preserve CSV metadata/import steps; add safe official guide-link metadata | W2 |
| `web/test/platform.test.ts`, `web/test/platform-web.test.ts`, `web/test/guides.test.ts`, `web/test/formats.test.ts` | Save protocol, guide matrix, immutable format behavior | W2 |
| `android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt` | Distinguish cancellation/error/written; report provider filename; open allowlisted external guides | W2 |
| `scripts/check-android.mjs`, `web/test/native-contract.test.ts` | Preserve security checks; static native-contract regression tests (not a substitute for device testing) | W2 |
| `web/src/ui/dom.ts`, `web/test/icons.test.ts`, `web/test/theme.test.ts` | Grove-line icon geometry/rendering and CSS contract checks | W3 |
| `docs/brand/pass-to-csv-brand.md` | Existing approved dark-glass/Olive rules remain; add usage/accessibility details | W3 |
| `docs/play/render-art.py` | New deterministic Pillow renderer, no browser/account dependency | W4 only |
| `docs/play/requirements-art.txt` | New pinned local renderer dependency (`Pillow==13.0.0`) | W4 only |
| `docs/play/assets/spcc-mark-source.png` | New byte-identical copy of locked mark for self-contained artwork builds | W4 only |
| `docs/play/assets/fonts/DejaVuSans.ttf`, `docs/play/assets/fonts/DejaVuSans-Bold.ttf`, `docs/play/assets/fonts/LICENSE` | Vendored rendering fonts + their actual upstream license | W4 only |
| `docs/play/icon-512.png`, `docs/play/feature-graphic-1024x500.png`, `docs/play/phone-demo.png` | New listing artwork + inspectable fabricated phone UI | W4 only |
| `docs/play/artwork.md`, `web/test/play-art.test.ts` | New art provenance, sizing/small-size review, deterministic asset tests | W4 only |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp` | Launcher export from same locked mark/squircle; keep existing manifest reference | W4 only |
| `android/app/build.gradle.kts`, `package.json`, `package-lock.json` | Final release version only | Final integration |
| `index.html`, `app.js`, `samsung-pass-to-csv.html`, `android/app/src/main/assets/index.html`, `android/app/src/main/assets/app.js` | Generated by `npm run build`, never hand-edited | Final integration only |
| `docs/superpowers/manual-smoke.md` | Refresh stale instructions and record light/dark/device/security matrix | Final integration |
| `web/test/release.test.ts` | New release-version gate | Final integration |

**Protected/no-change conversion files:** `web/src/lib/csv.ts`, parser/crypto/unlock/site logic and existing golden CSV expectations. `formats.ts` receives presentation link metadata only; no CSV settings change.

### Baseline observations that inform the plan

- `app.ts:395–466 sheet()` creates six kinds (`destination`, `incomplete`, `save` plaintext, `import-guide`, `clear`, `about`), currently with no accessible name or focus lifecycle. `render()` replaces the whole root and restores only element IDs; retaining a detached invoking element is not enough.
- `deleteIncomplete()` immediately filters `vault.logins` then calls `openSaveSheet()`. Keep that immediate flow; put Undo **inside the active modal** as well as on the preview after cancellation so the focus trap does not make it unreachable.
- `results()` replaces only `[data-testid=login-list]` on search. Put the live empty state inside that replaceable result region so it updates on each keystroke without stealing search focus.
- `Platform.save()` returns `Promise<boolean>`; the web path returns true on `a.click()`, Android currently sends only `{type:'saved',ok}`. Honest cancellation and actual saved filename require both sides to change together.
- `MainActivity.shouldOverrideUrlLoading()` simply blocks external hosts. A real anchor alone would remain broken on Android; add a narrowly allowlisted ACTION_VIEW path and preserve offline interception.
- Android baseline is `versionName = "2.0.7"`, `versionCode = 25`; npm metadata is currently `2.0.0`. Final task normalizes npm metadata and Android to **2.0.8 / code 26**; do not bump in W0.
- `scripts/build.mjs` produces five checked-in web/Android assets and hashes inline script CSP. Rebuild only at integration, not from several workstreams.
- JDK/Gradle are not currently on this box's PATH; Pillow 13.0.0 and DejaVu fonts are present. The repository uses `gradle -p android ...`, not `./gradlew`. A future executor must provision JDK 17, SDK 34 and compatible Gradle before claiming Android verification; do not read signing secrets to do a debug build.

## Execution graph and worker boundaries

```text
W0 Task 1 (sheet shell) → Task 2 (Undo primitive)
                            ├─ main worker: W1 Task 3 → Task 4
                            │                → W2 Task 5 → Task 6 → Task 7
                            │                → W3 Task 8 → Task 9
                            └─ art worker: W4 Task 10 → Task 11
both workers reviewed/integrated → final Task 12 (2.0.8, generated assets, full gate)
```

W0 is serial first. Create the isolated integration worktree using `using-git-worktrees` when execution is authorized, then start from its W0 commit. W4 uses a second worktree branch `soft-grove-w4`; use `git worktree add ../app-soft-grove-w4 -b soft-grove-w4 soft-grove` only if the native environment has not already provided an isolated worktree. W4 may read `web/src/ui/assets/spcc-mark.png` but may write **only** its file-map rows. It must not run `npm run build`, change package metadata, edit `app.ts`/CSS, or replace UI mark files. Its phone mock is a synthetic illustration conforming to the approved design, so no dependency on final app screenshots.

Main worker owns W1–W3 in order. Review each task before proceeding; integrate W4 with its asset-only commits after inspecting `git diff --name-only soft-grove...soft-grove-w4` and the PNGs. Do not create competing `soft-grove-w1/w2/w3` writers. If an execution system requires separate workers, give them serial tasks on the same integration branch with no overlapping active edits. Merge/cherry-pick locally only; never push as part of this plan.

Every task below uses Red → Green → Review → local commit. Do not weaken old assertions merely to get green: update the rail assertion only because approved behavior changes; retain CSV golden tests unchanged. Code blocks are implementation contracts and concrete patches; integrate them with the existing closure, not a second unused implementation.

---

## W0 — Shared foundation (serial first)

### Task 1: Rerender-safe named sheet shell and focus lifecycle

**Files:** Create `web/src/ui/sheets.ts`, `web/test/sheets.test.ts`; modify `web/src/ui/styles.css` sheet rules only.

**Interfaces:**
- Consumes `el()` from `web/src/ui/dom.ts`.
- Produces `SheetOptions`, `makeSheet(options: SheetOptions): HTMLElement`, `modalFocus(root: HTMLElement): { beforePaint(): void; afterPaint(): void; destroy(): void }`.
- Stable `data-focus-key` identifies controls recreated by `paint()`. A modal chain (`incomplete → save → guide`) retains the original invoking control until all sheets close; ID/selection restoration is only for nonmodal renders.

- [ ] **1. Write failing primitive tests** in `web/test/sheets.test.ts` (jsdom):

```ts
// @vitest-environment jsdom
import { makeSheet, modalFocus } from "../src/ui/sheets";
import { el } from "../src/ui/dom";

it("names a dialog, traps both directions, dismisses and restores a replaced opener", () => {
  const root = el("main"); document.body.replaceChildren(root);
  const opener = () => el("button", { "data-focus-key": "open-about" }, ["About"]);
  root.append(opener()); root.querySelector<HTMLElement>("button")!.focus();
  const focus = modalFocus(root);
  const dismiss = vi.fn(() => {
    focus.beforePaint(); root.replaceChildren(opener()); focus.afterPaint();
  });
  focus.beforePaint();
  root.replaceChildren(opener(), makeSheet({
    kind: "about", title: "About Spcc", body: [el("p", {}, ["Local conversion"])],
    actions: [el("button", {}, ["Done"]), el("button", {}, ["Cancel"])], onDismiss: dismiss
  }));
  focus.afterPaint();
  const dialog = root.querySelector<HTMLElement>("[role=dialog]")!;
  expect(root.querySelector(`#${dialog.getAttribute("aria-labelledby")}`)?.textContent).toBe("About Spcc");
  const buttons = dialog.querySelectorAll<HTMLButtonElement>("button");
  expect(document.activeElement).toBe(buttons[0]);
  buttons[1].focus(); buttons[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(buttons[0]);
  buttons[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(buttons[1]);
  buttons[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(dismiss).toHaveBeenCalledOnce();
  expect(document.activeElement?.getAttribute("data-focus-key")).toBe("open-about");
  focus.destroy();
});
```

Add independent cases for no actionable controls (focus `tabindex=-1` heading), disabled/hidden controls excluded, clicking outside the sheet dismisses only when target equals scrim, rerender of same sheet retains active keyed control, and replacing one sheet with another retains the original opener. Use the same DOM construction above for each, not a real vault.

- [ ] **2. Run red:** `npm test -- web/test/sheets.test.ts`; expect missing module/exports failure.
- [ ] **3. Implement shell** in `sheets.ts`:

```ts
import { el } from "./dom";
export interface SheetOptions {
  kind: string; title: string; body: HTMLElement[]; actions: HTMLElement[];
  onDismiss: () => void; notice?: HTMLElement;
}
const dismissals = new WeakMap<HTMLElement, () => void>();
export function makeSheet(o: SheetOptions): HTMLElement {
  const headingId = `sheet-title-${o.kind}`;
  const dialog = el("section", { class: "sheet", role: "dialog", "aria-modal": "true",
    "aria-labelledby": headingId, "data-testid": `sheet-${o.kind}` }, [
    el("div", { class: "handle", "aria-hidden": "true" }),
    el("h2", { id: headingId, tabindex: "-1", class: "title-large" }, [o.title]),
    el("div", { class: "sheet-body" }, o.body),
    o.notice ?? null,
    el("div", { class: "sheet-actions" }, o.actions)
  ]);
  dismissals.set(dialog, o.onDismiss);
  return el("div", { class: "scrim", onclick: (e: Event) => {
    if (e.target === e.currentTarget) o.onDismiss();
  } }, [dialog]);
}
const isVisible = (node: HTMLElement): boolean => {
  for (let current: HTMLElement | null = node; current; current = current.parentElement) {
    if (current.hidden || current.hasAttribute("inert") || current.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  }
  return true;
};
const controls = (dialog: HTMLElement): HTMLElement[] => Array.from(dialog.querySelectorAll<HTMLElement>(
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
)).filter(n => isVisible(n) && n.tabIndex >= 0);
const focusKey = (n: Element | null) => n?.getAttribute("data-focus-key") || n?.id || "";
export function modalFocus(root: HTMLElement) {
  let activeKind = "", openerKey = "", innerKey = "";
  const findKey = (key: string) => Array.from(root.querySelectorAll<HTMLElement>("[data-focus-key], [id]"))
    .find(n => focusKey(n) === key);
  const keydown = (event: KeyboardEvent) => {
    const dialog = root.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    if (event.key === "Escape") { event.preventDefault(); dismissals.get(dialog)?.(); return; }
    if (event.key !== "Tab") return;
    const nodes = controls(dialog), first = nodes[0], last = nodes.at(-1);
    if (!first) { event.preventDefault(); dialog.querySelector<HTMLElement>("h2")?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement as HTMLElement))) {
      event.preventDefault(); last!.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement as HTMLElement))) {
      event.preventDefault(); first.focus();
    }
  };
  root.addEventListener("keydown", keydown);
  return {
    beforePaint() {
      const dialog = root.querySelector<HTMLElement>('[role="dialog"]');
      if (!activeKind) openerKey = focusKey(document.activeElement);
      innerKey = dialog?.contains(document.activeElement) ? focusKey(document.activeElement) : "";
    },
    afterPaint() {
      const dialog = root.querySelector<HTMLElement>('[role="dialog"]');
      const kind = dialog?.getAttribute("data-testid") ?? "";
      const app = root.querySelector<HTMLElement>(".app");
      if (app) app.inert = !!dialog;
      if (dialog) {
        const previous = kind === activeKind && innerKey ? findKey(innerKey) : null;
        (previous && dialog.contains(previous) ? previous : controls(dialog)[0] ?? dialog.querySelector<HTMLElement>("h2"))?.focus();
      } else if (activeKind) {
        (findKey(openerKey) ?? root.querySelector<HTMLElement>('[data-testid="save"], [data-focus-key="choose-file"], button'))?.focus();
        openerKey = "";
      }
      activeKind = kind;
    },
    destroy() { root.removeEventListener("keydown", keydown); }
  };
}
```

Support roving radios through their `tabindex=0`; ignore the -1 radio siblings. The `isVisible` helper filters CSS visibility and hidden ancestors; assert it in the hidden-control test. Do not use `offsetParent` as the only visibility check (all jsdom controls appear unlaid out). Add an equivalent `focusin` guard if programmatic focus attempts can escape inert handling in the supported WebView; it must redirect into the sheet and be removed by `destroy()`.

- [ ] **3b. Add the responsive shell layout** in `styles.css`. Replace `.sheet` padding/layout and add these rules (retain existing colors/borders/shadows):

```css
.sheet { max-height: 85vh; max-height: 85dvh; min-height: 0; overflow: hidden;
  padding: 12px 18px max(12px, env(safe-area-inset-bottom)); }
.sheet > .title-large { flex: none; overflow-wrap: anywhere; }
.sheet-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 12px; }
.sheet-actions { flex: none; position: sticky; bottom: 0; background: var(--sheet-bg);
  display: flex; flex-wrap: wrap; gap: 8px; padding-top: 8px; }
.sheet-actions .btn { min-height: var(--touch); }
.sheet-actions.stack { flex-direction: column; align-items: stretch; }
.sheet h2:focus-visible { outline: 2px solid var(--fern); outline-offset: 3px; }
```

Keep heading/actions outside `.sheet-body`; remove nested 40vh overflow from `.gap-list` when adopted in Task 3. `dvh` is progressively enhanced after `vh`; real keyboard/viewport behavior is a manual gate, not something jsdom proves.

- [ ] **4. Green:** `npm test -- web/test/sheets.test.ts && npm run typecheck`; expect all primitive tests pass and no TS errors. Inspect helper exports against the Interfaces block.
- [ ] **5. Commit:** `git add web/src/ui/sheets.ts web/test/sheets.test.ts web/src/ui/styles.css && git commit -m "feat(ui): add named sheet shell and modal focus lifecycle"`.

### Task 2: Sensitive one-level Undo slot and keyboard-operable toast

**Files:** Create `web/src/ui/undo.ts`, `web/test/undo.test.ts`; modify `web/src/ui/styles.css` toast rules only.

**Interfaces:**
- Produces `undoSlot<T>(): { set(value:T):void; take():T|null; clear():void; has():boolean }`, `undoToast(message:string, onUndo:()=>void): HTMLElement`.
- W1 owns sensitive payload type and invalidation. The primitive stores nothing in DOM attributes, localStorage, timers, logs, or global state. Persistent until Undo/replacement/invalidation (no four-second action expiry); ordinary informational snackbar keeps its timer.

- [ ] **1. Red test:** create `web/test/undo.test.ts`:

```ts
// @vitest-environment jsdom
import { undoSlot, undoToast } from "../src/ui/undo";
it("takes once and invalidates sensitive snapshots", () => {
  const slot = undoSlot<{ password: string }>();
  slot.set({ password: "synthetic-only" });
  expect(slot.take()).toEqual({ password: "synthetic-only" });
  expect(slot.take()).toBeNull();
  slot.set({ password: "synthetic-only" }); slot.clear();
  expect(slot.has()).toBe(false); expect(slot.take()).toBeNull();
});
it("replaces the previous action and exposes a labeled keyboard button", () => {
  const slot = undoSlot<number>(); slot.set(1); slot.set(2); expect(slot.take()).toBe(2);
  const undo = vi.fn(), toast = undoToast("2 logins deleted", undo);
  document.body.replaceChildren(toast);
  expect(toast.querySelector('[role="status"]')?.textContent).toBe("2 logins deleted");
  const button = toast.querySelector<HTMLButtonElement>("button")!;
  expect(button.textContent).toBe("Undo"); button.focus(); button.click();
  expect(undo).toHaveBeenCalledOnce();
});
```

- [ ] **2. Run:** `npm test -- web/test/undo.test.ts`; expect unresolved new module.
- [ ] **3. Implement:**

```ts
import { el } from "./dom";
export function undoSlot<T>() {
  let value: T | null = null;
  return {
    set(next: T) { value = next; },
    take(): T | null { const previous = value; value = null; return previous; },
    clear() { value = null; }, has() { return value !== null; }
  };
}
export function undoToast(message: string, onUndo: () => void): HTMLElement {
  return el("div", { class: "undo-toast", "data-testid": "undo-toast" }, [
    el("p", { role: "status", "aria-live": "polite", "aria-atomic": "true" }, [message]),
    el("button", { type: "button", class: "btn outline", "data-focus-key": "undo-delete",
      "data-testid": "undo-delete", onclick: onUndo }, ["Undo"])
  ]);
}
```

```css
.undo-toast { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--snackbar-bg); color: var(--snackbar-fg); padding: 8px 12px;
  border-radius: 12px; flex: none; }
.undo-toast p { margin: 0; }
.undo-toast .btn { min-height: var(--touch); border-color: currentColor; }
.app > .undo-toast { margin: 8px var(--pad); }
```

Render one toast at a time (inside open sheet OR preview); no focus-stealing auto-focus. The live message contains counts only. Note release scaffolding in task notes: final Task 12 changes `versionName` 2.0.7→2.0.8 and code 25→26, with no W0 version edits or empty scaffolding files.

- [ ] **4. Green:** `npm test -- web/test/undo.test.ts web/test/sheets.test.ts && npm run typecheck`.
- [ ] **5. Commit:** `git add web/src/ui/undo.ts web/test/undo.test.ts web/src/ui/styles.css && git commit -m "feat(ui): add ephemeral undo action primitive"`.

## W1 — Sheets, accessibility, immediate deletion and empty states

### Task 3: Apply the shell to every sheet without breaking render focus

**Files:** Modify `web/src/ui/app.ts` (`ConsoleHandle`, `mount`, `sheet`, `render`, `paint`, invoking buttons), `web/src/ui/styles.css` (`.gap-list`); extend `web/test/ui.test.ts`.

**Interfaces:** Consumes `makeSheet`, `modalFocus` from Task 1. Produces unchanged six `[data-testid=sheet-KIND]` hooks, keyed controls, `ConsoleHandle.destroy(): void` for deterministic listener cleanup. `wipe()` remains public. W2 can replace sheet content without rebuilding focus handling.

- [ ] **1. Write failing integration test** using existing `setup`, `unlock`, `q` in `ui.test.ts`:

```ts
it("restores the original Save control after incomplete → plaintext → Escape", async () => {
  const { root } = setup(); await unlock(root);
  q<HTMLElement>(root, '[data-testid="save"]').focus();
  q<HTMLButtonElement>(root, '[data-testid="save"]').click();
  const incomplete = q(root, '[data-testid="sheet-incomplete"]');
  const heading = root.querySelector(`#${incomplete.getAttribute("aria-labelledby")}`);
  expect(heading?.textContent).toBe("Incomplete logins");
  q<HTMLButtonElement>(root, '[data-testid="incomplete-keep"]').click();
  q(root, '[data-testid="sheet-save"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(root.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement?.getAttribute("data-testid")).toBe("save");
});
```

Add a table of all six kinds: open About directly; unlock and open destination/Clear; use Save→incomplete→keep→save→confirm→guide. For each assert `aria-modal`, heading name, `.sheet-body`, actions outside scroll, focus inside, Tab/Shift+Tab containment, Escape normal close, and restoration to the correct keyed opener (save for chained sheets). Clear Escape must not wipe; save Escape must not call platform; destination Escape must not change choice. Track handles created in `setup()` and call `destroy()` in `afterEach`; restore visibility to `visible` after each test.

- [ ] **2. Run:** `npm test -- web/test/ui.test.ts`; new cases must fail with missing label/body/focus behavior, not an unrelated fixture error.
- [ ] **3. Adapt sheet branches:** import foundation helpers; change `sheet()` to collect heading, content and action arrays rather than one mixed `body`. End with:

```ts
return makeSheet({ kind: s.kind, title, body: content, actions, onDismiss: close });
```

Use these exact existing titles: `Incomplete logins`, `Save plaintext CSV?`, `Where are you importing?`, `Import into ${f.label}`, `Clear everything?`, `About & privacy`. Preserve incomplete cap 50, all warning text and test IDs. Move each existing `.sheet-actions` child's buttons to `actions` (do not nest another `.sheet-actions`); apply `.stack` to the incomplete shell action region after creation. Remove `.gap-list` max-height/overflow so `.sheet-body` is the only content scroll container.

Add stable `data-focus-key` to openers and controls: `open-about`, `save`, `clear`, `change-file`, `change-destination`, `choose-file`, `confirm-save`, `incomplete-keep`, `incomplete-delete`, `guide-done`, and `destination-${f.id}`. Focus keys are constants, never record contents. Instantiate `const focus = modalFocus(root)` once in `mount()`. Replace the modal portion of render's restore logic with this ordering:

```ts
const hadDialog = !!root.querySelector('[role="dialog"]');
focus.beforePaint();
paint();
const hasDialog = !!root.querySelector('[role="dialog"]');
if (!hadDialog && !hasDialog && focusId) {
  const next = root.querySelector<HTMLInputElement>(`#${CSS.escape(focusId)}`);
  next?.focus();
  try { if (next && sel && sel[0] !== null) next.setSelectionRange(sel[0], sel[1]); } catch { /* non-text input */ }
}
focus.afterPaint();
```

Retain the existing `focusId`/`sel` capture at render start. For safe testing, ensure supported `CSS.escape` or resolve ID via `getElementById` and root containment rather than adding a polyfill dependency. Keep `beforePaint()` before `paint()`. Make visibility listener a named function and clear the informational snackbar timeout on destroy; do not add listeners on every render. Extend interface and returned handle:

```ts
export interface ConsoleHandle { wipe(): void; destroy(): void; }
// in mount, after named visibility listener / snackbarTimer are defined:
return { wipe, destroy() {
  document.removeEventListener("visibilitychange", onVisibilityChange);
  if (snackbarTimer !== undefined) clearTimeout(snackbarTimer);
  focus.destroy();
  state = freshState(state.format);
  root.replaceChildren();
} };
```

- [ ] **3b. Add deterministic cleanup:** Declare `let snackbarTimer: ReturnType<typeof setTimeout> | undefined` at mount scope; before scheduling another timer clear the previous timer. Task 4 extends destroy/wipe with undo invalidation. Test mount/destroy twice to detect leaked visibility handlers.

- [ ] **4. Green:** `npm test -- web/test/ui.test.ts web/test/sheets.test.ts && npm run typecheck`. On a 320×568 viewport and simulated ~300px available height, inspect long incomplete/About/guide content: headings visible, body scrolls, all 48px actions reachable. Repeat with actual Android keyboard at final gate.
- [ ] **5. Commit:** `git add web/src/ui/app.ts web/src/ui/styles.css web/test/ui.test.ts && git commit -m "fix(ui): apply accessible scrollable shell to all sheets"`.

### Task 4: Immediate Delete with Undo, lifecycle invalidation, and live empty states

**Files:** Modify `web/src/ui/app.ts` (`deleteIncomplete`, `wipe`, change-file handler, file change, `results`, `sheet`, `paint`, `destroy`), `web/src/ui/styles.css` empty-state spacing; extend `web/test/ui.test.ts`; create `web/test/ui-empty.test.ts`.

**Interfaces:** Consumes `undoSlot<T>`, `undoToast`. Define app-local `DeletedRows = { vault: Vault; rows: {index:number; login:Login; draft?:string; revealed:boolean}[] }`. Produces one undo action per latest deletion, original row order and associated preview draft/reveal state. Cancel after deletion leaves deletion and Undo intact; Undo while plaintext is open closes it to prevent exporting stale CSV.

- [ ] **1. Add integration red test** in existing `ui.test.ts`:

```ts
it("deletes now, survives Save cancellation, and restores exact row order with Undo", async () => {
  const { root, saves } = setup(); await unlock(root);
  const titles = () => Array.from(root.querySelectorAll(".login-title")).map(n => n.textContent);
  const before = titles();
  q<HTMLButtonElement>(root, '[data-testid="save"]').click();
  q<HTMLButtonElement>(root, '[data-testid="incomplete-delete"]').click();
  expect(titles().length).toBeLessThan(before.length);
  expect(q(root, '[role="dialog"]').querySelector('[data-testid="undo-delete"]')).not.toBeNull();
  q(root, '[role="dialog"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(titles().length).toBeLessThan(before.length); expect(saves).toHaveLength(0);
  q<HTMLButtonElement>(root, '[data-testid="undo-delete"]').click();
  expect(titles()).toEqual(before);
  expect(root.querySelector('[data-testid="undo-delete"]')).toBeNull();
});
```

Also test Undo before cancelling plaintext closes stale sheet; count restoration; repeated deletion replaces rather than stacks actions; query and manual website drafts survive; Clear, change-file, new selection, direct `handle.wipe()`, background hiding, and `destroy()` invalidate. Keep a reference to an old Undo button, clear, call its `.click()`, and assert no recovered counts/vault. A later informational snackbar must not erase Undo.

For deterministic empty vaults, create this complete base test in `web/test/ui-empty.test.ts`:

```ts
// @vitest-environment jsdom
import { mount } from "../src/ui/app";
import { unlockText, type Vault } from "../src/lib";
vi.mock("../src/lib", async importOriginal => ({
  ...await importOriginal<typeof import("../src/lib")>(), unlockText: vi.fn()
}));
it("distinguishes an empty unlocked export without implying failure", async () => {
  const vault: Vault = { version:"demo",logins:[],cards:[],addresses:[],notes:[],
    passwordTable:null,otherTables:[],alreadyPlain:true };
  vi.mocked(unlockText).mockResolvedValue(vault);
  const root = document.createElement("main"); document.body.replaceChildren(root);
  const handle = mount(root);
  const file = root.querySelector<HTMLInputElement>("#spass-file")!;
  Object.defineProperty(file,"files",{value:[new File(["demo"],"demo.spass")],configurable:true});
  file.dispatchEvent(new Event("change"));
  const password = root.querySelector<HTMLInputElement>("#spass-password")!;
  password.value="fabricated-export-password"; password.dispatchEvent(new Event("input"));
  root.querySelector<HTMLButtonElement>('[data-testid="convert"]')!.click();
  await vi.waitFor(() => expect(root.querySelector(".empty-search")?.textContent).toBe("No records in this export."));
  expect(root.querySelector('[role="alert"]')).toBeNull();
  handle.destroy();
});
```

For the no-logins-with-extras case, use this exact synthetic card in the same empty vault's `cards` array, then assert `No logins in this export.` and a visible `Save cards` button:

```ts
{ id:"demo-card",nickname:"Example card",holder:"Demo Person",number:"",expMonth:"",expYear:"",code:"",note:"" }
```

For no matches, add to real fixture test:

```ts
const search = q<HTMLInputElement>(root, 'input[type="search"]');
search.value = "no-such-synthetic-record"; search.dispatchEvent(new Event("input"));
expect(q(root, ".empty-search").textContent).toBe("No logins match your search.");
expect(document.activeElement === search || document.activeElement === document.body).toBe(true);
search.value = ""; search.dispatchEvent(new Event("input"));
expect(root.querySelector(".empty-search")).toBeNull();
```

Focus search first in the real case and assert it stays focused. Do not call helpers private to another test file.

- [ ] **2. Red:** `npm test -- web/test/ui.test.ts web/test/ui-empty.test.ts`.
- [ ] **3. Implement deletion and restoration** inside mount:

```ts
const deleted = undoSlot<DeletedRows>();
function undoDeletion() {
  const snapshot = deleted.take();
  if (!snapshot || state.vault !== snapshot.vault) return;
  for (const row of snapshot.rows) {
    state.vault.logins.splice(row.index, 0, row.login);
    if (row.draft !== undefined) state.siteDrafts.set(row.login.id, row.draft);
    if (row.revealed) state.revealed.add(row.login.id);
  }
  state.sheet = null; // pending CSV was computed before restoration
  render();
}
function deleteIncomplete() {
  const vault = state.vault; if (!vault) return;
  const drop = new Set(incompleteLogins(vault.logins, state.format).map(login => login.id));
  const rows = vault.logins.flatMap((login, index) => drop.has(login.id)
    ? [{ index, login, draft: state.siteDrafts.get(login.id), revealed: state.revealed.has(login.id) }] : []);
  if (!rows.length) return;
  deleted.set({ vault, rows });
  for (const row of rows) { state.siteDrafts.delete(row.login.id); state.revealed.delete(row.login.id); }
  vault.logins = vault.logins.filter(login => !drop.has(login.id));
  openSaveSheet();
}
```

Retain `deletedCount` separately as a number (set `rows.length`, clear to zero whenever slot cleared/taken). A `deletionNotice(): HTMLElement | undefined` returns `deleted.has() ? undoToast(`${deletedCount} ${deletedCount === 1 ? "login" : "logins"} deleted`, undoDeletion) : undefined`. Pass that as `notice` to `makeSheet` while any sheet is open; otherwise render within `.app` above sticky footer. Never render the same live notice twice. If rows return after Undo, retain current search filtering and update counts, not a whole-vault snapshot that overwrites later edits.

Call `deleted.clear(); deletedCount = 0` before every `wipe`, change-file transition, picked-file change (valid or rejected), background wipe, and destroy; protect old button callbacks with `state.vault === snapshot.vault`. No toast timeout retains rows. On destroy clear all sensitive references. Keep invalidation ahead of render. Task 7 adds async generation checks so outstanding unlock/save cannot undo a security clear.

- [ ] **3b. Wire live empty states:** For empty results, keep the replaceable `ul[data-testid=login-list]` and render a `li.empty-search[role=status]` when no matching logins. Exact message logic:

```ts
const matches = vault.logins.filter(l => !q || `${l.name} ${l.username} ${l.url}`.toLowerCase().includes(q));
const empty = vault.logins.length > 0 ? "No logins match your search."
  : vault.cards.length + vault.addresses.length + vault.notes.length > 0
    ? "No logins in this export." : "No records in this export.";
const list = el("ul", { class: "list", "data-testid": "login-list" }, matches.length
  ? matches.map(loginRow)
  : [el("li", { class: "empty-search", role: "status" }, [empty])]);
```

Keep `.empty-search`, no error color, no password/OTP/record fragments in toast or empty copy. Empty vault is still an unlocked result; no invented error or new onboarding screen.

- [ ] **4. Green:** `npm test -- web/test/ui.test.ts web/test/ui-empty.test.ts web/test/undo.test.ts && npm run typecheck`. Manually keyboard-navigate to Undo within plaintext and after dismissal; screen reader announces deletion count and Undo button.
- [ ] **5. Commit:** `git add web/src/ui/app.ts web/src/ui/styles.css web/test/ui.test.ts web/test/ui-empty.test.ts && git commit -m "fix(ui): add immediate deletion undo and honest empty states"`.

## W2 — Voice/flow honesty and destination redesign (after W1)

### Task 5: Typed save outcomes on web and Android, including actual filename

**Files:** Modify `web/src/ui/platform.ts`, `web/src/ui/app.ts` (`confirmSave`, save sheet context), `android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt` (`createCsv`, bridge pending state), `web/test/platform.test.ts`, `web/test/ui.test.ts`, `web/test/icons.test.ts`; create `web/test/platform-web.test.ts`, `web/test/native-contract.test.ts`.

**Interfaces:**
- Replace boolean API with `SaveResult` below. `Platform.save(fileName:string,csv:string): Promise<SaveResult>`; all test doubles migrate in this task. For this task only, extend the existing import-guide Sheet variant to `{kind:"import-guide"; fileName:string; format:FormatId; outcome:"written"|"download-started"}`; Task 6 replaces those fields with `context:ExportContext`.
- Android request `{type:"save",id:string,fileName:string,csv:string}`; reply `{type:"saved",id:string,status:"written"|"cancelled"|"error",fileName?:string}`.
- `written` always has the actual provider display name, fallback to the requested safe name if the provider returns no display name. Web `download-started` has the requested download name. Cancellation and error never trigger a guide.

- [ ] **1. Add red tests** replacing boolean expectations in `platform.test.ts`:

```ts
it("distinguishes native cancel and failure and ignores a late different request", async () => {
  const b: { postMessage: (s:string) => void; onmessage: ((e:{data:string})=>void)|null } = {
    postMessage: vi.fn(), onmessage: null
  };
  (globalThis as { passBridge?: unknown }).passBridge = b;
  const pending = detectPlatform().save("samsung-pass-google.csv", "a,b");
  const request = JSON.parse(vi.mocked(b.postMessage).mock.calls[0][0]);
  b.onmessage?.({ data: JSON.stringify({ type:"saved", id:"old-request", status:"written", fileName:"wrong.csv" }) });
  b.onmessage?.({ data: JSON.stringify({ type:"saved", id:request.id, status:"cancelled" }) });
  await expect(pending).resolves.toEqual({ status:"cancelled" });
});
```

Add independent cases for `written` with provider-renamed `samsung-pass-google (1).csv`, `error`, malformed reply, timeout after `SAVE_TIMEOUT_MS`, `postMessage` throwing, duplicate reply, and second request not being settled by the first one's ID. Web tests go in the jsdom file `web/test/platform-web.test.ts` with `URL.createObjectURL` and `URL.revokeObjectURL` mocked and `HTMLAnchorElement.prototype.click` spied: expect `{status:"download-started",fileName}`; a throwing click returns error and still revokes URL/removes anchor. In UI tests inject results for cancelled/error/rejected promises and assert no guide; cancelled copy must be exactly `Save cancelled — nothing written`. Keep prior `saved`/reminder behavior only for successful initiation or confirmed write, never error.

Create static native tests that read `MainActivity.kt` and assert the reply contains `status` and request ID; null URI branches to cancelled, write exception branches to error, and display name uses `OpenableColumns.DISPLAY_NAME`. Static tests are a contract guard only; the device picker tests in Task 12 validate runtime behavior.

- [ ] **2. Run red:** `npm test -- web/test/platform.test.ts web/test/platform-web.test.ts web/test/native-contract.test.ts`; expect old API/protocol assertions fail.
- [ ] **3. Implement TypeScript protocol:**

```ts
export type SaveResult =
  | { status: "written"; fileName: string }
  | { status: "download-started"; fileName: string }
  | { status: "cancelled" }
  | { status: "error" };
export interface Platform { save(fileName: string, csv: string): Promise<SaveResult>; }
```

Keep `bridge()`, the origin-gated injection model, and `SAVE_TIMEOUT_MS = 60_000`. Implement `androidPlatform` with generated opaque request IDs (no vault content):

```ts
let requestSequence = 0;
const androidPlatform = (b: WebMessageBridge): Platform => ({
  save(fileName, csv) {
    const id = `save-${++requestSequence}`;
    return new Promise<SaveResult>(resolve => {
      let settled = false;
      const settle = (result: SaveResult) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (b.onmessage === receive) b.onmessage = null;
        resolve(result);
      };
      const timer = setTimeout(() => settle({ status:"error" }), SAVE_TIMEOUT_MS);
      const receive = (event: { data:string }) => {
        try {
          const r = JSON.parse(event.data) as {type?:unknown; id?:unknown; status?:unknown; fileName?:unknown};
          if (r.type !== "saved" || r.id !== id) return;
          if (r.status === "written" && typeof r.fileName === "string" && r.fileName.length > 0)
            settle({ status:"written", fileName:r.fileName });
          else if (r.status === "cancelled") settle({ status:"cancelled" });
          else settle({ status:"error" });
        } catch { settle({ status:"error" }); }
      };
      b.onmessage = receive;
      try { b.postMessage(JSON.stringify({ type:"save", id, fileName, csv })); }
      catch { settle({ status:"error" }); }
    });
  }
});
```

Guard concurrent requests at app level as currently; test a stale reply after timeout against a subsequent request. The receive closure references timer only after initialization. Move `WebMessageBridge` unchanged above these functions. For web preserve Blob download and delay revocation, but always cleanup on failure:

```ts
const webPlatform: Platform = {
  async save(fileName, csv) {
    let url: string | undefined, link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
      link = document.createElement("a"); link.href = url; link.download = fileName; link.rel = "noopener";
      document.body.appendChild(link); link.click();
      return { status:"download-started", fileName };
    } catch { return { status:"error" }; }
    finally {
      link?.remove();
      if (url) { const createdUrl = url; setTimeout(() => URL.revokeObjectURL(createdUrl), 1500); }
    }
  }
};
```

- [ ] **3b. Implement matching native replies:** In Kotlin add `pendingRequestId: String?`, `pendingFileName: String?`. Implement a helper to clear pending state and reply without sending CSV back:

```kotlin
private fun completeSave(status: String, fileName: String? = null) {
    val reply = pendingReply
    val id = pendingRequestId
    pendingCsv = null
    pendingReply = null
    pendingRequestId = null
    pendingFileName = null
    if (reply != null && id != null) {
        val result = JSONObject().put("type", "saved").put("id", id).put("status", status)
        if (fileName != null) result.put("fileName", fileName)
        reply.postMessage(result.toString())
    }
}
private fun savedDisplayName(uri: Uri, fallback: String): String = runCatching {
    contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    }
}.getOrNull()?.takeIf { it.isNotBlank() } ?: fallback
```

Replace `createCsv` callback:

```kotlin
private val createCsv = registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
    val csv = pendingCsv
    val name = pendingFileName ?: "samsung-pass.csv"
    when {
        uri == null -> completeSave("cancelled")
        csv == null -> completeSave("error")
        else -> {
            val written = runCatching {
                val output = contentResolver.openOutputStream(uri, "wt") ?: error("No output stream")
                output.use { it.write(csv.toByteArray(Charsets.UTF_8)) }
            }.isSuccess
            if (written) completeSave("written", savedDisplayName(uri, name)) else completeSave("error")
        }
    }
}
```

In origin-gated save listener require a nonblank ID, keep `SAFE_NAME`, complete an older pending request as error before recording new request; assign CSV/reply/ID/name, launch picker, and `completeSave("error")` on launch failure. Clear ID/name in `onDestroy` with pending CSV. This task does not introduce new bridge command types or loosen `isMainFrame`/`sourceOrigin`.

- [ ] **3c. Migrate the UI and every save test double:** In `confirmSave` use try/catch/finally around `await platform.save`; set externalPending false even on rejection. Capture `const format = state.format` before awaiting; for successful results set `state.saved = true; state.sheet = {kind:"import-guide",fileName:result.fileName,format,outcome:result.status}`. In the current guide branch resolve `FORMATS` from `s.format` and render the status using the written/download-started conditional and `s.fileName` (use the exact filename with `"Saved " + s.fileName + "."` or `"Download started: " + s.fileName + "."`). Task 6 replaces this temporary login-only guide with kind-specific context. Error shows `Couldn't save the file. Try again.` (do not assert no bytes were written after a partial write). Cancel shows exact approved copy. Begin successful guide state with recorded fileName and outcome, not `state.format` looked up later. Migrate test stubs in `ui.test.ts`/`icons.test.ts` from `return true` to `{status:"written", fileName}`.

- [ ] **4. Green:** `npm test -- web/test/platform.test.ts web/test/platform-web.test.ts web/test/native-contract.test.ts web/test/ui.test.ts web/test/icons.test.ts && npm run typecheck`. Run `gradle -p android assembleDebug` once JDK/SDK/Gradle are provisioned; expect BUILD SUCCESSFUL. No signing required.
- [ ] **5. Commit:** `git add web/src/ui/platform.ts web/src/ui/app.ts web/test/platform.test.ts web/test/platform-web.test.ts web/test/native-contract.test.ts web/test/ui.test.ts web/test/icons.test.ts android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt && git commit -m "fix(save): distinguish native cancel failure and web download initiation"`.

### Task 6: Export-specific guides, frozen context, meaningful tappable links

**Files:** Create `web/src/ui/guides.ts`, `web/test/guides.test.ts`; modify `web/src/lib/formats.ts`, `web/src/ui/app.ts` (`Sheet`, `primaryCsv`, extras, `confirmSave`, guide rendering), `web/src/ui/styles.css` (guide-link hit area), `web/test/ui.test.ts`, `web/test/formats.test.ts`, `android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt`, `scripts/check-android.mjs`, `web/test/native-contract.test.ts`.

**Interfaces:**
- `ExportKind = "logins" | "cards" | "addresses" | "notes"`.
- `ExportContext = {kind:ExportKind; format:FormatId; fileName:string}` is immutable metadata. `PendingExport = ExportContext & {csv:string}` exists only during warning/save; completed guide context must **not** retain CSV plaintext.
- `guideFor(context:ExportContext, outcome:"written"|"download-started"): {title:string; status:string; steps:readonly string[]; link?:{label:string;href:string}}`.
- `FormatInfo.guideLink: {label:string;href:string}`; existing `importSteps` remain strings and unchanged CSV metadata.

- [ ] **1. Red test** `guides.test.ts`:

```ts
import { guideFor } from "../src/ui/guides";
import { FORMATS } from "../src/lib/formats";
it.each(FORMATS)("keeps login guide tied to $id and actual filename", f => {
  const guide = guideFor({kind:"logins",format:f.id,fileName:"provider-renamed.csv"}, "written");
  expect(guide.title).toBe(`Import into ${f.label}`);
  expect(guide.status).toBe("Saved provider-renamed.csv.");
  expect(guide.steps).toEqual(f.importSteps);
  expect(guide.link?.href).toMatch(/^https:\/\//);
});
it.each(["cards", "addresses", "notes"] as const)("does not promise login import for %s", kind => {
  const guide = guideFor({kind,format:"1password",fileName:`samsung-pass-${kind}.csv`}, "download-started");
  expect(guide.status).toBe(`Download started: samsung-pass-${kind}.csv.`);
  expect(guide.title).toBe(`${kind[0].toUpperCase()}${kind.slice(1)} CSV`);
  expect(guide.steps.join(" ")).not.toMatch(/Label step|Import passwords|OTPAuth|my\.1password/);
  expect(guide.link).toBeUndefined();
});
```

Add all 4 login destinations × 2 outcomes, 3 auxiliary kinds × 4 formats × 2 outcomes, and integration clicks for each available Save cards/addresses/notes. Notes remain hidden for Bitwarden, whose primary export already includes notes. Assert warning's filename/context matches subsequent guide and provider-renamed actual filename; changing destination does not auto-save. A native cancel/error shows no guide or success reminder. Guides do not retain `csv` in their state.

- [ ] **2. Run red:** `npm test -- web/test/guides.test.ts web/test/ui.test.ts`.
- [ ] **3. Implement guide module** with the interfaces above:

```ts
import { FORMATS } from "../lib/formats";
import type { FormatId } from "../lib/types";
export type ExportKind = "logins" | "cards" | "addresses" | "notes";
export interface ExportContext { kind: ExportKind; format: FormatId; fileName: string; }
export type PendingExport = ExportContext & { csv: string };
export function guideFor(context: ExportContext, outcome: "written" | "download-started") {
  const status = outcome === "written" ? `Saved ${context.fileName}.` : `Download started: ${context.fileName}.`;
  if (context.kind === "logins") {
    const f = FORMATS.find(f => f.id === context.format)!;
    return { title:`Import into ${f.label}`, status, steps:f.importSteps, link:f.guideLink };
  }
  const noun = context.kind[0].toUpperCase() + context.kind.slice(1);
  return { title:`${noun} CSV`, status, steps:[
    `This is a separate ${context.kind} export, not a password-login CSV.`,
    "Check whether your chosen app supports importing this type of CSV before using it.",
    "Keep the file private, then delete it when you no longer need it."
  ], link:undefined };
}
```

- [ ] **3b. Add official link metadata:** Add link metadata to the four `FORMATS` records, respectively:

```ts
// Extend FormatInfo with guideLink: { label: string; href: string }.
// Record values in existing FORMATS order:
{ label:"Open 1Password in your browser", href:"https://my.1password.com/" }
{ label:"Open Google Password Manager", href:"https://passwords.google.com/" }
{ label:"Open Apple Passwords support", href:"https://support.apple.com/passwords" }
{ label:"Open Bitwarden import help", href:"https://bitwarden.com/help/import-data/" }
```

These are fixed official HTTPS destinations, not URLs interpolated from vault fields. Do not change importSteps/CSV behavior in this task. Validate a link's current public landing page before finalizing; retain the same official host/security allowlist if an official redirect requires updating the exact path. No account sign-in is necessary to verify a public help page.

- [ ] **3c. Carry immutable export context through warning/save/guide:** Change save Sheet to `{kind:"save"; export:PendingExport}` and import-guide Sheet to `{kind:"import-guide"; context:ExportContext; outcome:"written"|"download-started"}`. `primaryCsv(): PendingExport` returns `{kind:"logins",format:state.format,fileName:fileNameFor(state.format),csv:loginsToCsv(state.vault!.logins,state.vault!.notes,state.format)}`; each extra button supplies its precise kind and existing filename. `confirmSave(pending:PendingExport)` consumes that snapshot; after success create a new metadata-only context with `result.fileName`. Render title/status/steps from `guideFor` and a real link:

```ts
const guide = guideFor(s.context, s.outcome);
const link = guide.link ? el("a", { href:guide.link.href, rel:"noopener noreferrer",
  class:"guide-link" }, [guide.link.label]) : null;
```

Keep link content as text nodes. Add this guide-link styling in `styles.css`:

```css
.guide-link { display: inline-flex; align-items: center; min-height: var(--touch);
  padding: 10px 4px; color: var(--ink); text-decoration: underline;
  text-decoration-color: var(--olive); text-underline-offset: 3px; overflow-wrap: anywhere; }
.guide-link:focus-visible { outline: 3px solid var(--fern); outline-offset: 2px; }
```

Avoid turning arbitrary URLs from vault notes into links.

- [ ] **3d. Route guide links externally without WebView networking:** Android: import `ActivityNotFoundException` if caught explicitly; implement a private `openGuideUri(uri:Uri): Boolean` that requires `https`, no user info, and host in exact set `my.1password.com`, `passwords.google.com`, `support.apple.com`, `bitwarden.com`. Start `Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)` inside `runCatching`; do not add CSV, password, tokens or referrers. Return false to caller on no browser, not a crash. In `shouldOverrideUrlLoading`:

```kotlin
if (request.url.scheme == "https" && request.url.host == ASSET_HOST) return false
if (request.isForMainFrame) openGuideUri(request.url)
return true // all external WebView navigation remains blocked
```

The anchor above intentionally has no `target`, on both platforms, so Android does not require new-window support; keep `rel="noopener noreferrer"`. Do not rely on unsupported `onCreateWindow` handling. Use the no-target anchor consistently and test return via browser Back on web; native routes externally. Preserve selection persistence and background wiping on leaving app. Do not set externalPending for browser links: leaving the vault for a guide should still wipe sensitive data.

- [ ] **3e. Preserve native security checks:** Update `scripts/check-android.mjs`'s old literal `request.url.host != ASSET_HOST` check to assert the new positive HTTPS asset-host guard, `request.isForMainFrame`, `Intent.ACTION_VIEW`, `openGuideUri`, exact allowed hosts, and offline `shouldInterceptRequest`/asset loader. Keep every existing unrelated policy check. Extend native static tests to reject `http`, `javascript:`, user-info host tricks, subdomain suffix matching, and arbitrary external hosts in the allowlist logic. A static text check does not execute Kotlin; device gate includes allowed and blocked navigation cases.

- [ ] **4. Green:** `npm test -- web/test/guides.test.ts web/test/formats.test.ts web/test/ui.test.ts web/test/native-contract.test.ts && npm run typecheck && node scripts/check-android.mjs`; expected tests pass and `android policy: ok`. Device: each link launches external browser, WebView remains offline, returning shows background-clear explanation once Task 7 lands.
- [ ] **5. Commit:** `git add web/src/ui/guides.ts web/src/lib/formats.ts web/src/ui/app.ts web/src/ui/styles.css web/test/guides.test.ts web/test/formats.test.ts web/test/ui.test.ts web/test/native-contract.test.ts scripts/check-android.mjs android/app/src/main/java/com/jrrahman/passtocsv/MainActivity.kt && git commit -m "fix(guides): match export context and open safe external help"`.

### Task 7: Real progress, precise actions, background explanation and Soft Grove destinations

**Files:** Modify `web/src/ui/app.ts` (`State`, `convert`, `currentPhase`, `phaseRail`, `unlockedSummary`, `fileCard`, `destinationPicker`, `wipe`, visibility listener, `confirmSave`), `web/src/ui/styles.css` (`.dest*`, summary wrapping); extend `web/test/ui.test.ts`, `web/test/theme.test.ts`.

**Interfaces:**
- Phase identity remains `"file" | "unlock" | "save"` for stable hooks; working→unlock, any unlocked vault→save, otherwise file. Display steps `File`, `Unlocking…` during work (`Unlock` at rest), `Save`; `aria-current="step"` is authoritative.
- `chooseDestination(format:FormatId, dismiss:boolean):void` updates state + `storeFormat`, never starts a save. Arrow/Home/End updates selection/focus but keeps destination sheet open; click/Space/Enter may pick and close. One `tabindex=0` per radiogroup.
- `wipe(reason:"manual"|"background" = "manual")` internally; public no-argument `ConsoleHandle.wipe()` preserved. Ephemeral `backgroundCleared` boolean survives that security wipe, never persists vault data.
- `vaultGeneration:number` invalidates async unlock/save results across clear/new-file/background/destroy. No completed stale promise can render a previously cleared vault or guide.

- [ ] **1. Add red tests** to `ui.test.ts`:

```ts
it("uses a real working phase and marks Save ready only after unlock", async () => {
  const { root } = setup(); await choose(root, TEST_PASSWORD);
  q<HTMLButtonElement>(root, '[data-testid="convert"]').click();
  expect(q(root, '[aria-current="step"]').getAttribute("data-phase")).toBe("unlock");
  expect(q(root, '[aria-current="step"]').textContent).toContain("Unlocking…");
  await vi.waitFor(() => expect(root.querySelector('[data-testid="counts"]')).not.toBeNull());
  expect(q(root, '[aria-current="step"]').getAttribute("data-phase")).toBe("save");
  expect(q(root, '[data-testid="change-file"]').textContent).toBe("Change file");
  expect(q(root, '[data-testid="change-destination"]').textContent).toBe("Change destination");
});
it("moves the destination radio with arrows, wraps, persists, and does not save", () => {
  const { root, saves } = setup();
  q<HTMLElement>(root, '[data-format="1password"]').focus();
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowDown",bubbles:true,cancelable:true}));
  expect(q(root, '[aria-checked="true"]').getAttribute("data-format")).toBe("google");
  expect(document.activeElement?.getAttribute("data-format")).toBe("google");
  expect(root.querySelectorAll('[role="radio"][tabindex="0"]')).toHaveLength(1);
  expect(localStorage.getItem(FORMAT_KEY)).toBe("google"); expect(saves).toHaveLength(0);
});
```

Update the old `phase rail moves File → Unlock → Save` case: assert working unlock immediately after click and save after success; use `[aria-current=step]` rather than `.pill.active` so W3 can remove pills. Add ArrowUp/Left/Right wrap and Home/End, modal arrow moves without dismissal, Space/Enter activation, original full labels, file chooser trigger `.tabIndex === 0` and click dispatch, Convert under `[data-testid=pane]` and outside `.sticky`, background hidden→visible notice and no vault, no notice for picker-only suspension, and stale deferred save/unlock completion after `wipe` does not render a guide/vault. Use mock-unlock test file for deterministic deferred conversion; name it in task commit if extended. This is regression protection for existing privacy, not a new feature.

- [ ] **2. Run red:** `npm test -- web/test/ui.test.ts web/test/ui-empty.test.ts web/test/theme.test.ts`.
- [ ] **3. Implement flow:**

```ts
function currentPhase(): "file" | "unlock" | "save" {
  if (state.status === "working") return "unlock";
  return state.vault ? "save" : "file";
}
// phaseRail label map:
const labels = { file:"1 · File", unlock:state.status === "working" ? "2 · Unlocking…" : "2 · Unlock", save:"3 · Save" };
```

Set progress list `aria-busy` while working; visually retain textual step number/weight and `aria-current`, not color alone. After wrong password return to File. Rename the two summary button text nodes exactly. Keep Convert in existing `pane` list; do not change its position to footer or sticky CSS.

- [ ] **3b. Make the native file trigger keyboard-operable:** Replace the file-card `label.btn` with native `button[type=button]` keyed `choose-file` calling `input.click()`, accessible name `Choose .spass file`/`Change file`. Leave hidden `#spass-file` with `tabindex=-1`; picker click/cancel/change/externalPending logic stays on the input. A real button provides Enter/Space activation without custom key emulation.

- [ ] **3c. Add radio keyboard behavior:** Add this exact helper inside `mount()` and use it in both setup and modal:

```ts
function chooseDestination(format: FormatId, dismiss: boolean): void {
  const closingSheet = dismiss && state.sheet?.kind === "destination";
  state.format = format; storeFormat(format);
  if (closingSheet) state.sheet = null;
  render();
  if (!closingSheet) root.querySelector<HTMLElement>(`[data-format="${format}"]`)?.focus();
}
function destinationKey(event: Event, format: FormatId): void {
  const key = (event as KeyboardEvent).key;
  const at = FORMATS.findIndex(f => f.id === format);
  let next: number;
  if (key === "ArrowDown" || key === "ArrowRight") next = (at + 1) % FORMATS.length;
  else if (key === "ArrowUp" || key === "ArrowLeft") next = (at - 1 + FORMATS.length) % FORMATS.length;
  else if (key === "Home") next = 0;
  else if (key === "End") next = FORMATS.length - 1;
  else return;
  event.preventDefault(); chooseDestination(FORMATS[next].id, false);
}
```

Set each radio's `onclick` to `() => chooseDestination(f.id, true)` and `onkeydown` to `(event: Event) => destinationKey(event, f.id)`. Remove the old optional `onPick` callback parameter from `destinationPicker()` and its old destination-sheet invocation argument: closing is now centralized in the helper. Enter/Space use native button activation; do not implement a second key handler that double-clicks. No save function is called by either helper.

Use `chooseDestination` in both setup and modal. In keydown read current focused format index, normalize +1/-1/wrap and Home/End, `preventDefault`, call `chooseDestination(next,false)`, rerender, focus `destination-${next}`. Preserve the sheet's original opener across radio rerenders via Task 1 focus keys. `chooseDestination` focuses the new radio only after modal rerender; closing the destination sheet leaves focus restoration to Task 1. Do not close the sheet on arrows. Keep click pick behavior closing it and explicit checked indicator even when unselected:

```ts
el("span", { class:"dest-copy" }, [
  el("span", { class:"dest-label" }, [f.label]),
  el("span", { class:"dest-detail" }, [f.id === "bitwarden" ? "Logins + notes CSV" : "Login CSV"])
]);
// Per button: role radio, aria-checked, tabindex selected ? "0" : "-1", stable data-format/focus-key.
// Render a check mark for selected and a hollow ring for unselected; both aria-hidden.
```

- [ ] **3d. Redesign destination cards:** Destination redesign CSS (replace `.dest` old chip background; do not keep Fern selected fill):

```css
.dests { display: grid; gap: 8px; }
.dest { display: grid; grid-template-columns: minmax(0, 1fr) 24px; align-items: center;
  gap: 12px; min-height: 64px; width: 100%; padding: 12px 14px; border-radius: 16px;
  border: 1px solid var(--card-border); background: transparent; color: var(--ink);
  text-align: left; cursor: pointer; box-shadow: none; }
.dest-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dest-label { font-weight: 600; overflow-wrap: anywhere; white-space: normal; }
.dest-detail { font-size: 0.8125rem; font-weight: 400; color: var(--muted); }
.dest.selected { background: var(--olive); color: var(--soil); border-color: var(--grove); }
.dest.selected .dest-detail { color: var(--soil); }
.dest:focus-visible { outline: 3px solid var(--fern); outline-offset: 2px; }
.dest-indicator { width: 20px; height: 20px; border: 1.5px solid currentColor; border-radius: 50%; }
.dest.selected .dest-indicator { display: grid; place-items: center; }
.dest-summary { flex-wrap: wrap; }
.summary { flex-wrap: wrap; }
```

Use Soil text on Olive rather than Cream for small text contrast. Keep dark selected Olive/Soil as well; unselected surfaces inherit dark glass, focus stays Fern. Test 320px + 200% text sizing, full Google Password Manager label and 48px minimum controls. W3 replaces filled check_circle with line equivalent.

- [ ] **3e. Explain security clearing on return:** For background clear, name the visibility handler from Task 3; when hidden + vault + !externalPending set `backgroundCleared=true`, invoke security wipe preserving that boolean, invalidate undo, clear password/file/reveal/drafts/sheets. On visible render a one-line `role=status` notice `Unlocked data cleared when you left the app.`; do not auto-expire while hidden. Clear the notice on the next explicit new-file action; manual Clear shows no misleading background notice. Existing picker externalPending exception remains. Hidden while a conversion is working must invalidate the conversion too if no picker is active; clear in-memory password/file and prevent resurrection on resolution.

- [ ] **3f. Prevent stale async resurrection:** Add generation checks without storing an old vault in a long-lived closure:

```ts
// mount scope: let vaultGeneration = 0;
// At the beginning of every wipe/change-file/new-file/destroy: ++vaultGeneration.
// convert(): capture before asynchronous work; do not assign after invalidation:
const generation = vaultGeneration;
const file = state.file;
const password = state.password;
if (!file) return;
const text = await readFileText(file);
if (generation !== vaultGeneration) return;
const vault = await unlockText(text, password);
if (generation !== vaultGeneration) return;
state.vault = vault;
state.status = "done";
```

Apply the same check in convert catch before writing errors, and in confirmSave after `await`/catch/finally before updating any current state. Maintain `externalPending` only for the generation that owns it; a stale finalizer must not clear a newer picker's flag. Never log password/csv. `wipe` invalidates undo first. This guard is necessary to make Clear/background invalidation reliable across asynchronous work.

- [ ] **4. Green:** `npm test -- web/test/ui.test.ts web/test/ui-empty.test.ts web/test/theme.test.ts && npm run typecheck`. Manual keyboard tab/arrow and large-text visual review of setup and modal destination cards in both device themes.
- [ ] **5. Commit:** `git add web/src/ui/app.ts web/src/ui/styles.css web/test/ui.test.ts web/test/ui-empty.test.ts web/test/theme.test.ts && git commit -m "feat(ui): clarify progress and redesign accessible destination cards"`.

## W3 — Soft Grove icons, rail, surfaces and About (after W2)

### Task 8: Replace stock Material geometry with Grove-line icons

**Files:** Modify `web/src/ui/dom.ts`, `web/src/ui/styles.css` (`.icon svg` only), `web/test/icons.test.ts`.

**Interfaces:** Keep `icon(name:string):HTMLElement`, `ICON_NAMES`, `data-icon`, decorative `aria-hidden`, unknown-name empty-span behavior, and `pRingMark(size=56)` unchanged. All used names have one or more custom 24×24 line paths. Mark bitmap and P2 lockup are not icon substitutions.

- [ ] **1. Red test** in `icons.test.ts`:

```ts
it.each(["folder", "lock", "visibility", "visibility_off", "download", "delete", "more_vert", "check_circle", "info", "progress_activity"])(
  "%s uses Grove line rendering rather than a filled Material silhouette", name => {
    const node = icon(name), svg = node.querySelector("svg")!;
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("1.75");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.querySelector("path")?.getAttribute("d")).toBeTruthy();
    expect(node.getAttribute("aria-hidden")).toBe("true");
  }
);
```

Retain all existing inline SVG/path presence assertions and icon-button accessible-name checks. Add unknown name renders no SVG and existing mark source remains identical (no new generic lock in appbar).

- [ ] **2. Run red:** `npm test -- web/test/icons.test.ts`; expect filled SVG attributes do not match.
- [ ] **3. Implement custom path data** replacing `ICON_PATHS` values (keep names for stable callers):

```ts
/** Grove-line 24x24 paths, round stroke; no remote fonts or Material silhouettes. */
const ICON_PATHS: Record<string, string> = {
  folder: "M3 7V5h6l3 3h9v11H3V7Z M3 10h18",
  lock: "M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5Z M12 14v3",
  visibility: "M2 12c5-8 15-8 20 0-5 8-15 8-20 0Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  visibility_off: "M3 3l18 18 M2 12c1-2 3-4 5-5 M10 6c5-1 9 2 12 6-1 2-2 3-4 4 M14 18c-5 1-9-2-12-6 M10 10a3 3 0 0 0 4 4",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  delete: "M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
  more_vert: "M6 12h.01 M12 12h.01 M18 12h.01",
  check_circle: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M8 12l3 3 5-6",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 11v6 M12 7h.01",
  progress_activity: "M12 3a9 9 0 0 1 9 9 M12 21a9 9 0 0 1-9-9"
};
```

Add on the SVG before path insertion:

```ts
svg.setAttribute("fill", "none");
svg.setAttribute("stroke", "currentColor");
svg.setAttribute("stroke-width", "1.75");
svg.setAttribute("stroke-linecap", "round");
svg.setAttribute("stroke-linejoin", "round");
```

Replace `.icon svg` `fill:currentColor` with `fill:none; stroke:currentColor`. No `innerHTML`; keep text-only DOM policy. More control becomes three quiet horizontal line dots rather than stock vertical overflow. Privacy strip reuses new `lock` stroke at 16px and retains its textual privacy claim. Eye/hide eye remain visibly distinguishable; inspect at 16, 20, 24px and at 200% zoom. Use reduced-motion rule for any progress animation; text `Unlocking…` remains primary indicator.

- [ ] **4. Green:** `npm test -- web/test/icons.test.ts web/test/ui.test.ts && npm run typecheck`. Inspect all glyphs on light/dark surface, especially small privacy lock and filled→outline selected indicator. Ensure icon-only buttons retain existing aria-labels.
- [ ] **5. Commit:** `git add web/src/ui/dom.ts web/src/ui/styles.css web/test/icons.test.ts && git commit -m "style(ui): replace Material silhouettes with Grove line icons"`.

### Task 9: Quiet rail, restrained handles, sectional About and dead CSS cleanup

**Files:** Modify `web/src/ui/app.ts` (`phaseRail`, About branch only), `web/src/ui/styles.css` (rail, handle, About, remove dead chips), `web/test/ui.test.ts`, `web/test/theme.test.ts`, `docs/brand/pass-to-csv-brand.md`.

**Interfaces:** Preserve `data-phase`/`aria-current`/`aria-busy` from W2 and make `rail-step active|done` the visual class (no `.pill`). About remains one existing named sheet with four h3 sections; no new screen, theme toggle, or publishing/legal promises.

- [ ] **1. Red tests:**

```ts
// Add in existing ui.test.ts; setup() is local to that file.
it("shows factual About in four short sections and keeps the P-ring", () => {
  const { root } = setup();
  q<HTMLButtonElement>(root, '[aria-label="About and privacy"]').click();
  const about = q(root, '[data-testid="sheet-about"]');
  expect(Array.from(about.querySelectorAll("h3")).map(n => n.textContent)).toEqual([
    "What Spcc does", "Privacy", "Updates", "License"
  ]);
  expect(about.textContent).toContain("MIT");
  expect(about.textContent).toContain("Not affiliated with Samsung.");
  expect(about.textContent).not.toMatch(/now available|published on Play/i);
  expect(root.querySelector('[data-mark="p-ring"]')).not.toBeNull();
});
```

In `theme.test.ts`, read CSS/brand as existing tests do and assert `/\.chips?\b/` absent, `--chip-` absent, `.empty-search` present, `.rail-step` exists, `.pill` absent, `.handle` still present, brand text retains Olive selection/explicit indicator + dark glass. Assert CSS selected fill Olive/Soil and full-label wrapping from W2. Do not assert subjective beauty with source regex; manual visual gate covers that.

- [ ] **2. Run red:** `npm test -- web/test/theme.test.ts web/test/ui.test.ts`.
- [ ] **3. Implement:** change rail class expression from pill to `rail-step active`, `rail-step done`, `rail-step` and replace pill rules:

```css
.rail { list-style: none; display: flex; align-items: center; gap: 12px; margin: 0; padding: 0; }
.rail-step { color: var(--muted); font-size: 0.8125rem; padding: 4px 0; border: 0; background: none; }
.rail-step + .rail-step::before { content: "→"; margin-right: 12px; opacity: 0.6; }
.rail-step.active { color: var(--ink); font-weight: 700; text-decoration: underline;
  text-decoration-color: var(--olive); text-underline-offset: 5px; }
.rail-step.done { color: var(--ink); }
.handle { width: 28px; height: 3px; border-radius: 99px; background: var(--muted);
  opacity: 0.35; margin: 0 auto 4px; flex: none; }
.about-section { display: flex; flex-direction: column; gap: 6px; }
.about-section h3 { margin: 0; font-size: 0.9375rem; font-weight: 600; }
```

Use text/underline/weight in addition to color. Keep visible focus styling; the decorative handle has `aria-hidden=true` and is not a fake drag control. Remove entire `.chips`, `.chip`, `.chips.compact` rule groups, dead `--chip-*` tokens in both themes, `.chip` selector entries in hover/focus/active/transition lists, `.pill` transition entry; use `.rail-step` if transition needed. Destinations already stopped using chip tokens in W2. Preserve `.empty-search` and real `.dest*` styles. Retain dark glass/glow and system-only theme.

- [ ] **3b. Rewrite About with factual sections:** Replace About content with these four sections using `el` (no HTML string):

```ts
const aboutSection = (name: string, paragraphs: string[]) => el("section", { class:"about-section" }, [
  el("h3", {}, [name]), ...paragraphs.map(text => el("p", {}, [text]))
]);
content = [
  aboutSection("What Spcc does", [
    "Spcc (Spass to CSV Converter) converts a Samsung Pass .spass export into CSV on this device.",
    "Not affiliated with Samsung."
  ]),
  aboutSection("Privacy", [
    "Nothing is uploaded. No accounts, analytics, or telemetry. Conversion stays on-device; the WebView has no network access.",
    "CSV files are plaintext. Keep them private and delete them after importing."
  ]),
  aboutSection("Updates", [
    "The Android app may contact Google Play only to check for and apply Play In-App Updates. Google Play handles update delivery."
  ]),
  aboutSection("License", [
    "Source code: MIT License. © 2026 Juel Hossain.",
    "The license text is included in the source repository."
  ])
];
```

- [ ] **3c. Document and retain brand extensions:** Retain the existing heading `About & privacy`, named shell and Done action. This copy is supported by README, LICENSE and existing app behavior; it does not claim current Play publication or add a store/pricing statement. Brand doc already has approved Olive/dark-glass extension. Add usage notes: line weight 1.75/24px, selection Olive + explicit checked state, Fern focus, quieter numbered rail, contrast checked over final composited dark surfaces, privacy lock is not P-ring. Do not rewrite the locked geometry/palette/copyright.

- [ ] **4. Green:** `npm test -- web/test/ui.test.ts web/test/theme.test.ts web/test/icons.test.ts web/test/copy.test.ts && npm run typecheck`. Check About at short viewport, all four sections readable, Done/Escape reachable, links elsewhere still focusable. Check reduced-motion setting; screenshot light/dark synthetic setup/preview/sheets for integration review only.
- [ ] **5. Commit:** `git add web/src/ui/app.ts web/src/ui/styles.css web/test/ui.test.ts web/test/theme.test.ts docs/brand/pass-to-csv-brand.md && git commit -m "style(ui): quiet Grove chrome and rewrite sectional About"`.

## W4 — Play artwork (second worker, parallel-safe after W0)

W4 may run while the main worker executes W1–W3. Only the files marked W4 in the file map may change. The deliverable is local artwork, not a Play Console operation. Do not use screenshots of a real vault or turn off `FLAG_SECURE` to capture one.

### Task 10: Locked P-ring listing icon and deterministic art foundation

**Files:** Create `docs/play/render-art.py`, `docs/play/requirements-art.txt`, `docs/play/assets/spcc-mark-source.png`, `docs/play/assets/fonts/DejaVuSans.ttf`, `docs/play/assets/fonts/DejaVuSans-Bold.ttf`, `docs/play/assets/fonts/LICENSE`, `docs/play/icon-512.png`, `docs/play/artwork.md`, `web/test/play-art.test.ts`; modify `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp`.

**Interfaces:** `python3 docs/play/render-art.py` writes deterministic RGB PNG artwork and launcher WebP from a byte-identical locked PNG plus vendored fonts. No remote network/assets/fonts. Existing Android manifest continues to reference `@mipmap/ic_launcher`. Task 11 extends the same renderer for the phone/feature graphic, not a second asset pipeline.

- [ ] **1. Write red tests** `web/test/play-art.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const pngSize = (path:string) => {
  const b = readFileSync(path);
  expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
it("exports a 512px icon using the unchanged locked mark source", () => {
  expect(pngSize("docs/play/icon-512.png")).toEqual([512,512]);
  const sha = (path:string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  expect(sha("docs/play/assets/spcc-mark-source.png")).toBe(sha("web/src/ui/assets/spcc-mark.png"));
});
```

Add a source assertion that renderer uses the copied mark, not a new drawn lock or arbitrary P. Keep art tests node-only; no Pillow dependency in `npm test`. Verify PNG opacity/mode with Python in the green step.

- [ ] **2. Run red:** `npm test -- web/test/play-art.test.ts`; expect absent icon/source.
- [ ] **3. Prepare sources:** execute in the art worktree:

```bash
mkdir -p docs/play/assets/fonts
cp web/src/ui/assets/spcc-mark.png docs/play/assets/spcc-mark-source.png
cp /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf docs/play/assets/fonts/DejaVuSans.ttf
cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf docs/play/assets/fonts/DejaVuSans-Bold.ttf
cp /usr/share/doc/fonts-dejavu-core/copyright docs/play/assets/fonts/LICENSE
printf 'Pillow==13.0.0\n' > docs/play/requirements-art.txt
```

The font copyright file is present in this box and must be committed unmodified, not replaced with an invented license. If executing on another machine, obtain these exact DejaVu fonts/license from their upstream distribution before rendering. Use `python3 -m venv /tmp/spcc-art-venv && /tmp/spcc-art-venv/bin/pip install -r docs/play/requirements-art.txt` if the pinned Pillow is absent. This is a local build dependency only, not an app runtime package.

- [ ] **3b. Add the deterministic icon renderer:** Initial complete `render-art.py`:

```python
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/play"
ASSETS = OUT / "assets"
CREAM = "#F7F4EF"

def render_icon():
    mark = Image.open(ASSETS / "spcc-mark-source.png").convert("RGBA")
    icon = Image.new("RGB", (512, 512), CREAM)
    mark = mark.resize((512, 512), Image.Resampling.LANCZOS)
    icon.paste(mark, (0, 0), mark)
    icon.save(OUT / "icon-512.png", optimize=False)
    launcher = mark.resize((192, 192), Image.Resampling.LANCZOS)
    launcher.save(ROOT / "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp",
                  "WEBP", lossless=True, exact=True)

if __name__ == "__main__":
    render_icon()
```

Existing mark is a Warm Grove squircle with transparent corners; preserve P-ring geometry. RGB Cream outside its corners is an intentional opaque listing field, no second redraw/shadow. Launcher retains alpha and same mark. At 16/24/48/96px inspect P-ring remains legible; if optimization blurs the mark change only resampling/export parameters, not geometry.

- [ ] **3c. Write provenance:** Write `docs/play/artwork.md` with exact initial content:

```markdown
# Spcc Soft Grove artwork

Build: `python3 docs/play/render-art.py` (Pillow 13.0.0).

The P-ring source is a byte-identical copy of `web/src/ui/assets/spcc-mark.png`.
No mark geometry was redrawn. Listing icon: 512 × 512 RGB PNG; Android launcher:
192 × 192 lossless WebP at the existing mipmap-xxxhdpi path.

Fonts: vendored DejaVu Sans and DejaVu Sans Bold; original license in assets/fonts/LICENSE.
Artwork uses only local files. Product/destination names are text, not competitor logos.
These assets do not authorize uploading, publishing, pricing, or Play Console changes.
```

- [ ] **4. Green:** `python3 docs/play/render-art.py && npm test -- web/test/play-art.test.ts`; expected tests pass. `python3 -c "from PIL import Image; im=Image.open('docs/play/icon-512.png'); assert im.size == (512,512) and im.mode == 'RGB'"`. Read the PNG and small-size contact sheet locally with image reader; record small-size assessment in `artwork.md`. The worker must actually inspect, not merely state a generated file exists.
- [ ] **5. Commit:** `git add docs/play/render-art.py docs/play/requirements-art.txt docs/play/assets docs/play/icon-512.png docs/play/artwork.md web/test/play-art.test.ts android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp && git commit -m "art(play): prepare locked Warm Grove icon and reproducible sources"`.

### Task 11: Feature graphic with P2 lockup, exact tagline and synthetic phone mock

**Files:** Modify `docs/play/render-art.py`, `docs/play/artwork.md`, `web/test/play-art.test.ts`; create `docs/play/phone-demo.png`, `docs/play/feature-graphic-1024x500.png`.

**Interfaces:** The Task 10 render command now writes all three PNGs plus the launcher, deterministically. Feature is 1024×500 RGB PNG. Demo source is synthetic, locally drawn, contains only fabricated `Example Library`/`Demo account` labels and password bullets, no CSVs/OTPs/real records. Tagline string is exact in source and provenance doc; line wrapping affects layout only.

- [ ] **1. Red tests** append to `play-art.test.ts`:

```ts
it("exports the exact feature graphic size and a fabricated UI source", () => {
  expect(pngSize("docs/play/feature-graphic-1024x500.png")).toEqual([1024,500]);
  expect(pngSize("docs/play/phone-demo.png")).toEqual([276,460]);
  const script = readFileSync("docs/play/render-art.py", "utf8");
  expect(script).toContain("Samsung Pass → CSV for 1Password, Google, Apple, Bitwarden");
  expect(script).toContain("Example Library");
  expect(script).not.toMatch(/unlockText|sampleSpass|TEST_PASSWORD|encryptSpass/);
});
```

- [ ] **2. Run red:** `npm test -- web/test/play-art.test.ts`; missing graphic/phone files fail.
- [ ] **3. Extend renderer imports/constants** with `ImageDraw`, `ImageFont` and add these complete functions before the main block:

```python
GROVE = "#3F4F3A"
OLIVE = "#6B8F71"
FERN = "#A3C9A8"
SOIL = "#1C1917"
TAGLINE = "Samsung Pass → CSV for 1Password, Google, Apple, Bitwarden"

def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(str(ASSETS / "fonts" / name), size)

def wrapped(draw, text, xy, width, face, fill, spacing=8):
    x, y = xy
    lines = []
    for word in text.split():
        candidate = (lines[-1] + " " + word) if lines else word
        if lines and draw.textlength(candidate, font=face) <= width:
            lines[-1] = candidate
        else:
            lines.append(word)
    line_height = face.getbbox("Ag")[3] + spacing
    for line in lines:
        draw.text((x, y), line, font=face, fill=fill)
        y += line_height
    return y

def lockup(image, xy, scale=1):
    x, y = xy
    d = ImageDraw.Draw(image)
    size = round(84 * scale)
    panel = (x + round(62 * scale), y + round(8 * scale),
             x + round(400 * scale), y + round(78 * scale))
    d.rounded_rectangle(panel, radius=round(18 * scale), fill="white", outline="#D9DDD4")
    d.text((x + round(100 * scale), y + round(15 * scale)), "Spcc", font=font(round(28 * scale), True), fill=GROVE)
    d.text((x + round(100 * scale), y + round(49 * scale)), "Spass to CSV Converter",
           font=font(round(15 * scale)), fill="#5E5A52")
    mark = Image.open(ASSETS / "spcc-mark-source.png").convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    image.paste(mark, (x, y), mark)  # P2 Soft: mark overlaps the text panel

def phone_demo():
    phone = Image.new("RGB", (276, 460), CREAM)
    d = ImageDraw.Draw(phone)
    d.rounded_rectangle((0, 0, 275, 459), radius=32, fill=SOIL)
    d.rounded_rectangle((7, 7, 268, 452), radius=27, fill=CREAM)
    d.rounded_rectangle((103, 12, 173, 22), radius=5, fill=SOIL)
    lockup(phone, (20, 35), 0.57)
    d.text((22, 100), "1 File   →   2 Unlock   →   3 Save", font=font(11, True), fill=GROVE)
    d.line((193, 118, 249, 118), fill=OLIVE, width=2)
    d.rounded_rectangle((18, 130, 258, 160), radius=9, fill="#E9EFE6")
    d.text((26, 138), "On-device · nothing uploaded", font=font(11), fill=GROVE)
    d.rounded_rectangle((18, 171, 258, 224), radius=12, fill="white", outline="#E4DED3")
    d.text((28, 181), "demo-export.spass", font=font(12, True), fill=SOIL)
    d.text((28, 202), "Importing into 1Password", font=font(11), fill="#5E5A52")
    d.text((22, 238), "1 login     0 cards     0 notes", font=font(11), fill="#5E5A52")
    d.rounded_rectangle((18, 264, 258, 355), radius=12, fill="white", outline="#E4DED3")
    d.text((29, 278), "Example Library", font=font(14, True), fill=SOIL)
    d.text((29, 303), "Demo account", font=font(12), fill="#5E5A52")
    d.text((29, 326), "••••••••", font=font(15), fill=SOIL)
    d.rounded_rectangle((18, 378, 100, 423), radius=12, outline="#D9DDD4", width=1)
    d.text((40, 392), "Clear", font=font(12, True), fill=GROVE)
    d.rounded_rectangle((110, 378, 258, 423), radius=12, fill=GROVE)
    d.text((150, 392), "Save CSV", font=font(12, True), fill=CREAM)
    phone.save(OUT / "phone-demo.png", optimize=False)
    return phone

def feature_graphic():
    feature = Image.new("RGB", (1024, 500), CREAM)
    lockup(feature, (48, 92), 1.15)
    d = ImageDraw.Draw(feature)
    wrapped(d, TAGLINE, (48, 224), 585, font(30, True), GROVE, 10)
    d.text((48, 410), "Spass to CSV Converter", font=font(18), fill="#5E5A52")
    phone = phone_demo()
    feature.paste(phone, (708, 20))
    feature.save(OUT / "feature-graphic-1024x500.png", optimize=False)
```

Change final main block to `render_icon(); feature_graphic()`. Keep 40px right-side margin and Cream field visible; phone is 276×460 at (708,20), entirely within 1024×500. The left lockup spans 460px, copy width 585px, so no overlap with phone. Exact tagline is a single string rendered by word wrapping; no typo/omitted destination. This drawing uses the new quiet text rail, restrained cards, P2 header, trust strip and Clear/Save positioning; compare against W3 when integrating. If improving fidelity, draw in this renderer using the approved tokens only; do not add live screenshots or logos.

- [ ] **3b. Record synthetic-only provenance:** Append `artwork.md`:

```markdown
## Feature graphic

`feature-graphic-1024x500.png`: 1024 × 500 RGB, Cream field, locked P2 Soft
lockup on the left, fabricated phone UI on the right.

Tagline: Samsung Pass → CSV for 1Password, Google, Apple, Bitwarden

`phone-demo.png`: 276 × 460 synthetic illustration. Example Library and Demo
account are fabricated labels. The password line is decorative bullet text;
there is no decrypted vault, password, OTP, personal record, or imported export.
Destination/product names are text only; no competitor logos or endorsement.

Regenerate with `python3 docs/play/render-art.py`. No Play upload was performed.
```

- [ ] **4. Green:** run renderer twice and compare hashes; inspect actual images at full size and half scale:

```bash
python3 docs/play/render-art.py
sha256sum docs/play/icon-512.png docs/play/phone-demo.png docs/play/feature-graphic-1024x500.png > /tmp/spcc-art-before.sha
python3 docs/play/render-art.py
sha256sum --check /tmp/spcc-art-before.sha
npm test -- web/test/play-art.test.ts
python3 -c "from PIL import Image; im=Image.open('docs/play/feature-graphic-1024x500.png'); assert im.size == (1024,500) and im.mode == 'RGB'; assert im.getpixel((0,0)) == (247,244,239)"
```

Expected hash checks `OK`, tests green, Python no assertion. Actually read the PNG to check tagline fits, P2 overlap visible, mark not hidden, no text clipping, legible phone UI. Record review observations/provenance in `artwork.md` with actual review outcome, not an unchecked claim. Run `git diff --name-only` and confirm W4 changed only its mapped files; no UI sources/generated bundles/package metadata.

- [ ] **5. Commit:** `git add docs/play/render-art.py docs/play/artwork.md docs/play/phone-demo.png docs/play/feature-graphic-1024x500.png web/test/play-art.test.ts && git commit -m "art(play): add Cream feature graphic with synthetic phone mock"`. Send local commit hashes and asset paths to integration worker; do not push/upload.

## Final integration and release gate (after W1–W4)

### Task 12: Integrate artwork, version 2.0.8/code 26, regenerate and verify the whole app

**Files:** Integrate W4 asset/test/doc commits; modify `android/app/build.gradle.kts`, `package.json`, `package-lock.json`, `docs/superpowers/manual-smoke.md`; create `web/test/release.test.ts`; regenerate only through `scripts/build.mjs` the five generated outputs in the file map.

**Interfaces:** Final Android release `2.0.8 (26)` and npm package/lock root versions `2.0.8`. Public app package stays `com.jrrahman.passtocsv`; minSdk29/SDK34/pricing/permissions/update security unchanged. Generated linked and self-contained pages reflect the same source. Assets are source deliverables; APK/AAB remain ignored build outputs.

- [ ] **1. Integration boundary:** Review W4 file diff and images, then integrate locally with `git cherry-pick` of its two reported task commits or a local merge of `soft-grove-w4` (choose one, not both). Do not amend another worker's commit, reset uncommitted changes, force-push, or publish. Run `npm test -- web/test/play-art.test.ts` to prove assets arrived intact.
- [ ] **2. Write failing release test** `web/test/release.test.ts`:

```ts
import { readFileSync } from "node:fs";
it("releases Soft Grove as Android 2.0.8 code 26 and consistent npm metadata", () => {
  const gradle = readFileSync("android/app/build.gradle.kts", "utf8");
  expect(gradle).toMatch(/versionName = "2\.0\.8"/);
  expect(gradle).toMatch(/versionCode = 26\b/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  expect(pkg.version).toBe("2.0.8"); expect(lock.version).toBe("2.0.8");
  expect(lock.packages[""].version).toBe("2.0.8");
});
```

- [ ] **3. Red:** `npm test -- web/test/release.test.ts`; expect baseline version/code mismatch.
- [ ] **4. Version-only patch:** set these Gradle values and metadata (leave dependency versions/resolution untouched):

```kotlin
versionCode = 26
versionName = "2.0.8"
```

```bash
node --input-type=module - <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
for (const path of ['package.json', 'package-lock.json']) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  json.version = '2.0.8';
  if (path === 'package-lock.json') json.packages[''].version = '2.0.8';
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}
JS
```

Do not hand-edit generated files. Ensure `git diff package-lock.json` changes only the two root version values. If another release has legitimately advanced code 25 before execution begins, stop this version gate for release coordination rather than downgrading it; this plan's inspected baseline is code25.

- [ ] **5. Refresh `docs/superpowers/manual-smoke.md`** with the exact execution matrix below and record actual results. Correct its stale chip language to destination cards; rail after unlock is Save, not Unlock. Correct old no-INTERNET claim: INTERNET is permitted solely for Play-managed updates; conversion WebView stays offline. Correct 1Password OTP claim: no OTP in Notes; destination-specific Google/Apple/Bitwarden expectations below. Do not touch carried parser/www/formula work.
- [ ] **6. Run the automated source gate:**

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check
python3 docs/play/render-art.py
npm test -- web/test/play-art.test.ts web/test/release.test.ts
```

Expect all Vitest suites green, TypeScript no errors, `build: wrote 5 files`, `build: no drift`, `android policy: ok`, and artwork generation leaves committed images byte-identical. No build/test outcomes have been established by this planning document; executor must record actual output and counts. The existing golden suites `csv.test.ts`, `formats.test.ts`, `sites.test.ts`, `parse.test.ts`, `crypto.test.ts`, `header.test.ts` stay passing with no weakened CSV expectations.

- [ ] **7. Native toolchain gate:** Confirm `java -version` is JDK17, `gradle --version` is compatible (repo previously used Gradle8.7/AGP8.5.2), and SDK34/build-tools34.0.0 installed with `ANDROID_HOME`. Run:

```bash
gradle -p android assembleDebug lintDebug
"$ANDROID_HOME/build-tools/34.0.0/aapt2" dump badging android/app/build/outputs/apk/debug/app-debug.apk
"$ANDROID_HOME/build-tools/34.0.0/aapt2" dump permissions android/app/build/outputs/apk/debug/app-debug.apk
```

Expect BUILD SUCCESSFUL; badging `versionCode='26' versionName='2.0.8'`, package unchanged; no REQUEST_INSTALL_PACKAGES or storage permission, INTERNET only as already approved for Play. Debug build requires no signing credential. Do not read `keystore.properties`/private keys. If a trusted release environment already supplies signing, optional `gradle -p android assembleRelease bundleRelease` may validate optimized builds locally, but do not make a signed release a hidden requirement to finish this UI task. If native tools/device are unavailable, report that precise verification gap and do not claim native runtime success.

- [ ] **8. Execute whole-app manual acceptance matrix** below on Chrome web and Android10+ using fabricated exports, in device light and dark themes. Use 320×568, 360×640 and landscape/short-height cases; 200% text and keyboard visible; test reduced motion. Record per-surface pass/fail, device/browser version, viewport, theme, and any issue found. Fix in the owning serial task and rerun its tests before final approval. No screenshots of real vaults; never disable `FLAG_SECURE` to obtain Android review images.
- [ ] **9. Final local diff gate:**

```bash
git diff --check
git status --short
git diff --name-only
node scripts/check-android.mjs
```

Check no `.apk`, `.aab`, `.spass`, keystore, passwords, or decrypted CSV is staged; explicitly stage only expected files. Re-run `npm run check` after any source fix. Review the plan's requirement traceability against the final code/assets; a green source regex is not evidence of a working native link or screen reader.
- [ ] **10. Commit verified release sources/generated files:**

```bash
git add android/app/build.gradle.kts package.json package-lock.json web/test/release.test.ts docs/superpowers/manual-smoke.md index.html app.js samsung-pass-to-csv.html android/app/src/main/assets/index.html android/app/src/main/assets/app.js
git commit -m "release: finalize verified Soft Grove 2.0.8 (26) sources"
git status --short
```

Expect a clean worktree after all task changes are committed. Stop locally. Report commit(s), exact tests/builds performed, manual evidence and any blocked gates. Do not upload/publish or claim Play readiness solely because assets exist. The next separate delivery action follows user's Drive-build preference and source-before-Play rule, with actual authorization at that time.

### Manual acceptance matrix to copy into smoke document

| Surface / scenario | Required checks in both light and dark |
|---|---|
| Setup / choose file | P2 Soft + P-ring intact, full subtitle, keyboard native chooser button, only .spass accepted, invalid file error, export-password not Samsung-account explanation; Convert disabled until ready, scrolls with pane and not sticky |
| Destination cards (setup + modal) | Four full destination names in original order/equal weight; 1Password default, persisted last choice; 64px card rows/48px minimum controls, no truncation at narrow widths/200% text; Olive selected + Soil text + checked indicator; Fern visible focus; arrows wrap + Home/End, one tab stop, no auto-save |
| Unlock / progress | File before work, Unlocking… while promise pending, Save only after unlocked data; no color-only progress; wrong-password returns File; no file saved automatically; Clear/background stale async result cannot recover old vault |
| Unlocked summary / preview / search | Exact Change file/Change destination labels; counts reflect actual rows; search stays focused; reveal/hide meaningful line icons/labels; manual website still blank until typed, edits retained; no-match vs empty-vault vs no-logins-with-extras messages are distinct |
| Every sheet: destination, incomplete, plaintext, guide, Clear, About | Accessible name announced, focus moves inside, forward/reverse trap, Escape normal dismiss, scrim dismiss, original opener restored even after rerender/chain; only body scrolls, heading/actions reachable at 85vh/dvh and with keyboard; targets ≥48dp |
| Immediate Delete / Undo | Immediate preview/count reduction, toast count spoken, Undo keyboard-operable inside modal and after Cancel; restores original order/drafts/reveal/query/counts; Undo closes stale plaintext CSV; subsequent Save cancellation does not reverse deletion; repeated latest action defined; Clear/new file/background/direct wipe/destroy and old button callback cannot resurrect vault |
| Primary Save × all four formats | Plaintext warning first, actual export context/fileName; native cancel exact approved copy/no error guide; provider-renamed filename shown; write failure/timeout remains error/no guide; web says Download started, never unconfirmed Saved; delete-after-import reminder only for success |
| Cards / addresses / notes | Each available export gets its own filename and short guide without login column/import steps or unsupported import promises; notes separate export still hidden for Bitwarden; any save cancellation/error never shows success |
| Guide links / privacy | Meaningful link name + visible focus + 48px padded hit area; HTTPS official links open external browser on Android; other schemes/hosts blocked; browser navigation does not give WebView network access; return after backgrounding clears vault and explains once |
| Clear / background / pickers | Confirm Clear wipes file/password/vault/site drafts/reveal/undo; Escape Clear preserves; Home→return shows generic one-line clear notice only; SAF chooser/save does not trigger accidental wipe; ordinary switch away clears; late promise doesn't resurrect; background notice contains no record data |
| Grove visual cleanup | Custom folder/lock/eye/hide/download/delete/overflow/check line icons readable at small size, privacy line lock separate from P-ring; quiet numbered rail/active underline not pills; softer decorative handle; no dead chip CSS; no theme toggle; dark glass/glow retained with legible contrast |
| About | Four headings exactly What Spcc does, Privacy, Updates, License; correct MIT/copyright/nonaffiliation/update facts, no current-publication claim; fits short sheet and actions stay usable |
| CSV regression (synthetic only) | 1Password headerless five columns and OTP-free Notes/blank websites; Google current headers/no url/note-OTP; Apple OTPAuth; Bitwarden current headers/login_totp + notes; placeholders and editing behavior unchanged; no guessed URLs/passwords |
| Android security/update | On-device conversion in airplane mode, FLAG_SECURE blocks real screen/recents capture, backup restrictions remain; origin/main-frame bridge gate, no file/content access, no WebView network, Play updates retained; external guide browser may require network but conversion never does |
| Artwork | Icon small-size P-ring geometry; 512px opaque listing icon/launcher match; feature exactly1024×500 Cream/P2/exact tagline/phone mock, balanced hierarchy, no real credentials or competitor logos, names text-only; deterministic regeneration; no upload |

## Self-review: complete approved-spec traceability

This is the plan author's review against every spec section, not a claim implementation is already complete.

| Spec requirement | Implementing task(s) and verification |
|---|---|
| Intent: whole-app UX/a11y before polish; no CSV changes | Tasks1–7 before8–9; protected files/global constraints; Task12 manual matrix |
| Scope: setup, destination, unlock, preview/search, auxiliary, warnings, save, guide, Clear, About, empty, both themes, icon/feature | Tasks3–11 plus every matrix row in12 |
| Palette, P2 lockup, P-ring, Spcc/subtitle | Global constraints,8–11; existing lockup test retained;12 visual gate |
| Device theme/no toggle | Global constraints,7/9 CSS tests,12 both themes |
| Four destinations/default/persistence/no auto-save/current import flow | Tasks6–7, existing + expanded ui/formats tests;12 |
| Privacy/editing/export-password/plaintext/conversion | Tasks3–7 retain warning/copy/security;12 golden + manual tests |
| Exact per-destination CSV contracts and placeholders | Global constraints/protected files;6 metadata-only formats edits;12 unchanged regression suites |
| Clear/Save retained; no auxiliary onboarding | Tasks4/7/9 no new screens;12 footer/card checks |
| Named modal heading, initial focus, Tab/reverse trap, Escape, restore | Tasks1/3 primitive + six-kind integration tests;12 real AT gate |
| ~85vh/scroll body/sticky reachable actions/long content/keyboard | Tasks1/3 CSS;12 viewport/keyboard gate |
| ≥48dp, visible focus, checked radios/arrows, keyboard chooser | Tasks1/2/7/8;12 keyboard/large-text review |
| Immediate Delete + Undo, preview/count restore, Save cancel independent | Tasks2/4 tests and exact flow;12 |
| Undo sensitive data invalidation/no resurrect/repeated deletion | Tasks4/7 destroy/lifecycle/generation checks;12 old-callback/deferred-promise tests |
| Accessible operable toast | Tasks2/4 (inside active modal or preview, one instance, persistent action);12 AT |
| `.empty-search`, no match vs empty vault, no implied error | Task4 mock/full-fixture tests;12 |
| Exact Change file/destination labels | Task7 exact text assertions |
| Actual File→Unlocking…→Save | Tasks7/9; tests during pending promise + after success |
| Exact native cancel vs genuine failures | Task5 dual-side protocol + timeout/rejection/device tests |
| Login current destination/actual filename; all auxiliary-specific guides | Task6 frozen metadata; provider display name in5; matrix tests +12 |
| Web Download started | Tasks5/6 typed outcome/UI;12 no unconfirmed saved claim |
| Convert remains scroll pane | Task7 containment tests;12 keyboard/scroll manual gate |
| Tappable meaningful URLs | Task6 actual anchors AND native allowlisted ACTION_VIEW; security policy tests +12 |
| One-line background explanation, security wipe retained | Task7;12 hidden/visible/picker/stale-result tests |
| Custom line folder/lock/eye/download/delete/overflow; accessible icon controls | Task8 full dictionary + inline SVG tests;12 small-size visual gate |
| Quiet non-color-only rail, dead chips removed, softer handle | Task9 CSS/DOM checks and12 visual review |
| Privacy line lock not brand mark | Tasks8/9 keep pRingMark and trust lock separate;12 |
| Dark glass/glow documented/readable/no new theme | Brand already records approval;9 usage details/tests;12 contrast gate |
| Four factual About sections | Task9 exact section copy + License/README source;12 |
| Full destination hierarchy/redesign, Olive not Fern, full labels/explicit checked | Task7 card grid/detail layout + state/focus,8 indicator line treatment;12 narrow/200% review |
| Icon locked P-ring/Warm Grove squircle/small-size | Task10 unchanged bitmap + export/small-size checks |
| Feature1024×500 Cream/P2/exact tagline/phone | Task11 deterministic script + dimensions/source tests and actual image read |
| Fabricated nonsensitive mock; text names/no competitor logos/endorsement | Task11 isolated synthetic renderer/provenance and12 image gate |
| No Play changes/upload/publication | Global constraints/W4 restrictions/final stop |
| Carried parser/www/phone-formula work; no package/pricing change | Global constraints/protected files/release checks |
| Acceptance1–10 incl 2.0.8 + versionCode | Tasks1–12; task12 release test2.0.8/code26 and matrix |
| Documentation-only now; no versions/UI/art now | This file is the only intended planning commit; execution is gated on a new user choice |

**Self-review outcome:** All approved requirements have an implementing task and verification gate. No unresolved product decisions are introduced. The native save protocol, external link routing, modal-chain focus restoration, and sensitive-undo lifecycle are explicitly included rather than assumed to be solved by copy/CSS alone. Type names and signatures are defined before consumption; `PendingExport` is not retained in guide state; `SaveResult` migration includes all existing stubs. W4 is parallel-safe; shared render/CSS writers are serial by design.

## Execution handoff

Plan ready for user choice; **no app coding starts from writing this plan**.

1. **Subagent-driven execution (recommended):** use `subagent-driven-development`, one fresh task worker/review gate at a time on the serial app lane; launch the independent W4 worker after W0 and review its assets separately.
2. **Inline execution:** use `executing-plans` in this session, work through checkbox tasks with checkpoints; W4 can still run as the second independent worker.

Both choices preserve W0→W1→W2→W3 order, W4 parallelism, local commits, final verification, and the no-publication boundary. The parent should ask which execution approach Juel wants before any implementation.
