import {
  FORMATS,
  GAP_LABEL,
  GAP_TAG,
  MAX_SPASS_BYTES,
  MERGE_FIELDS,
  NAMED_FORMATS,
  SpassError,
  TOO_LARGE,
  addressesToCsv,
  applyLoginEdit,
  cardsToCsv,
  defaultMergeChoice,
  duplicateGroups,
  fileNameFor,
  groupName,
  lookGaps,
  loginsToCsv,
  mergeLogins,
  needsLook,
  notesToCsv,
  resolvedTitle,
  siteKey,
  unlockText,
  type FormatId,
  type Login,
  type LoginEdit,
  type MergeChoice,
  type MergeField,
  type Vault
} from "../lib";
import { el, icon, pRingMark } from "./dom";
import { detectPlatform, type Platform } from "./platform";
import { loadFormat, storeFormat } from "./prefs";

type Status = "form" | "working" | "done";
type Stage = "home" | "password" | "unlocking" | "vault";
type AfterEdit = "look" | "browse";
type Sheet =
  | null
  | { kind: "save"; fileName: string; csv: string; primary: boolean }
  | { kind: "needs-look" }
  | { kind: "look" }
  | { kind: "browse"; query: string }
  | { kind: "about" }
  | { kind: "destination" }
  | { kind: "import-guide" }
  | { kind: "edit"; id: string; draft: LoginEdit; showPassword: boolean; after?: AfterEdit; browseQuery?: string }
  | { kind: "merges" }
  | { kind: "merge"; aId: string; bId: string; choice: MergeChoice; fromList?: boolean }
  | { kind: "extras"; which: "cards" | "notes" | "addresses" };

interface Toast { text: string; undo?: () => void }

interface State {
  file: File | null;
  password: string;
  showPassword: boolean;
  format: FormatId;
  status: Status;
  error: { field: "file" | "password"; message: string } | null;
  vault: Vault | null;
  saved: boolean;
  sheet: Sheet;
  toast: Toast | null;
  /** True while a system picker is open, so visibilitychange does not wipe mid-flow. */
  externalPending: boolean;
  /** Element id to focus after the next paint (e.g. the gap field in the edit sheet). */
  focusNext: string;
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
    saved: false,
    sheet: null,
    toast: null,
    externalPending: false,
    focusNext: ""
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

export function isSpassFileName(name: string): boolean {
  return /\.spass$/i.test(name.trim());
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function placeCount(logins: Login[]): number {
  return new Set(logins.map((l) => siteKey(l) || resolvedTitle(l).toLowerCase() || l.id)).size;
}

function matchesQuery(login: Login, q: string): boolean {
  if (!q) return true;
  const hay = [resolvedTitle(login), login.username, login.url, siteKey(login), login.note].join("\n").toLowerCase();
  return hay.includes(q);
}

function placeGroups(logins: Login[]): { label: string; items: Login[] }[] {
  const map = new Map<string, Login[]>();
  for (const l of logins) {
    const label = siteKey(l) || resolvedTitle(l) || "Other";
    const items = map.get(label);
    if (items) items.push(l);
    else map.set(label, [l]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, items]) => ({ label, items }));
}

const DOTS = "••••••••";

/** First user-perceived character (emoji, flags, accents) for avatars; never half a surrogate pair. */
export function initial(text: string): string {
  const t = text.trim();
  if (!t) return "?";
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) for (const part of new Seg(undefined, { granularity: "grapheme" }).segment(t)) return part.segment;
  return Array.from(t)[0];
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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

  const formatInfo = () => FORMATS.find((f) => f.id === state.format)!;
  const canConvert = () => state.file !== null && state.password.length > 0 && state.status !== "working";
  const stage = (): Stage => state.vault ? "vault" : state.status === "working" ? "unlocking" : state.file ? "password" : "home";
  const findLogin = (id: string) => state.vault?.logins.find((l) => l.id === id) ?? null;

  async function convert() {
    if (!canConvert() || !state.file) return;
    const s = state;
    s.status = "working";
    s.error = null;
    render();
    try {
      if (s.file!.size > MAX_SPASS_BYTES) throw new SpassError("format", TOO_LARGE);
      const text = await readFileText(s.file!);
      const vault = await unlockText(text, s.password);
      // Reset (Change file) or app left while unlocking: never surface the vault afterwards.
      if (state !== s) return;
      if (document.visibilityState === "hidden") { wipe(); return; }
      s.vault = vault;
      s.password = "";
      s.status = "done";
    } catch (error) {
      if (state !== s) return;
      s.status = "form";
      const err = error instanceof SpassError ? error : new SpassError("format", "Something went wrong reading this file.");
      s.error = { field: err.code === "format" ? "file" : "password", message: err.message };
    }
    render();
  }

  function openSaveSheet() {
    const vault = state.vault!;
    state.sheet = { kind: "save", fileName: fileNameFor(state.format), csv: loginsToCsv(vault.logins, vault.notes, state.format), primary: true };
    render();
  }

  function beginPrimarySave() {
    const vault = state.vault;
    if (!vault || state.externalPending) return;
    if (needsLook(vault.logins, state.format).length) {
      state.sheet = { kind: "needs-look" };
      render();
      return;
    }
    openSaveSheet();
  }

  async function confirmSave(fileName: string, csv: string, primary: boolean) {
    if (state.externalPending) return;
    const s = state;
    s.sheet = null;
    s.externalPending = true;
    render();
    const ok = await platform.save(fileName, csv);
    // Change file while the system save dialog was open: don't show the old file's guide on the new state.
    if (state !== s) return;
    state.externalPending = false;
    state.saved = state.saved || ok;
    if (ok && primary) state.sheet = { kind: "import-guide" };
    else if (ok) state.toast = { text: `Saved ${fileName}` };
    else state.toast = { text: "Couldn't save the file. Nothing was written." };
    render();
  }

  function openEdit(login: Login, after?: AfterEdit) {
    const browseQuery = state.sheet?.kind === "browse" ? state.sheet.query : "";
    state.sheet = {
      kind: "edit",
      id: login.id,
      showPassword: false,
      after,
      browseQuery,
      draft: { name: resolvedTitle(login), url: login.url, username: login.username, password: login.password, note: login.note }
    };
    const gap = lookGaps(login, state.format)[0];
    state.focusNext = gap === "url" ? "edit-url" : gap === "username" ? "edit-username" : gap === "title" ? "edit-title" : "";
    render();
  }

  function returnAfter(after?: AfterEdit, browseQuery = "") {
    if (after === "look") state.sheet = { kind: "look" };
    else if (after === "browse") state.sheet = { kind: "browse", query: browseQuery };
    else state.sheet = null;
  }

  function deleteLogin(id: string) {
    const vault = state.vault;
    if (!vault) return;
    const index = vault.logins.findIndex((l) => l.id === id);
    if (index < 0) return;
    const [login] = vault.logins.splice(index, 1);
    state.sheet = null;
    state.toast = {
      text: `Deleted ${resolvedTitle(login) || "Untitled login"}`,
      undo: () => { vault.logins.splice(Math.min(index, vault.logins.length), 0, login); }
    };
    render();
  }

  /** Remove every needs-look login (Other save warning). Undo restores the prior list. */
  function deleteNeedsLookLogins() {
    const vault = state.vault;
    if (!vault) return;
    const look = needsLook(vault.logins, state.format);
    if (!look.length) return;
    const ids = new Set(look.map((l) => l.id));
    const before = vault.logins.slice();
    vault.logins = vault.logins.filter((l) => !ids.has(l.id));
    state.toast = {
      text: `Deleted ${plural(look.length, "login")}`,
      undo: () => { vault.logins = before.slice(); }
    };
    if (vault.logins.length) openSaveSheet();
    else {
      state.sheet = null;
      render();
    }
  }

  function openMerge(group: Login[], fromList = false) {
    // A is the more complete record (fewest gaps), so defaults keep the better data.
    const [a, b] = [...group].sort((x, y) => lookGaps(x, state.format).length - lookGaps(y, state.format).length);
    state.sheet = { kind: "merge", aId: a.id, bId: b.id, choice: defaultMergeChoice(a, b), fromList };
    render();
  }

  /** One suggestion opens its merge preview; several open the list. */
  function openMergeSuggestions() {
    const groups = state.vault ? duplicateGroups(state.vault.logins) : [];
    if (groups.length === 1) openMerge(groups[0]);
    else if (groups.length > 1) { state.sheet = { kind: "merges" }; render(); }
  }

  function confirmMerge(aId: string, bId: string, choice: MergeChoice, fromList = false) {
    const vault = state.vault;
    const a = findLogin(aId);
    const b = findLogin(bId);
    if (!vault || !a || !b) return;
    const before = vault.logins.slice();
    const merged = mergeLogins(a, b, choice);
    vault.logins = vault.logins.filter((l) => l.id !== bId).map((l) => (l.id === aId ? merged : l));
    // From the list, go back to it while suggestions remain.
    state.sheet = fromList && duplicateGroups(vault.logins).length ? { kind: "merges" } : null;
    state.toast = {
      text: `Merged ${resolvedTitle(merged) || "login"}`,
      undo: () => { vault.logins = before.slice(); }
    };
    render();
  }

  function spliceExtra<T extends { id: string }>(list: T[], id: string, labelOf: (item: T) => string) {
    const index = list.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const [item] = list.splice(index, 1);
    if (list.length === 0) state.sheet = null;
    state.toast = {
      text: `Deleted ${labelOf(item)}`,
      undo: () => { list.splice(Math.min(index, list.length), 0, item); }
    };
    render();
  }

  function deleteExtra(which: "cards" | "notes" | "addresses", id: string) {
    const vault = state.vault;
    if (!vault) return;
    if (which === "addresses") spliceExtra(vault.addresses, id, (a) => a.name || a.street || "Address");
    else if (which === "cards") spliceExtra(vault.cards, id, (c) => c.nickname || "Card");
    else spliceExtra(vault.notes, id, (n) => n.title.trim() || "Note");
  }

  // ---------- pieces ----------

  function aboutButton(): HTMLElement {
    return el("button", { class: "icon-btn", type: "button", "aria-label": "About and privacy", "data-testid": "about", onclick: () => { state.sheet = { kind: "about" }; render(); } }, [icon("more_vert")]);
  }

  function rings(size: "lg" | "sm", busy = false): HTMLElement {
    return el("div", { class: busy ? `rings ${size} busy` : `rings ${size}`, "data-testid": "rings" }, [
      pRingMark(size === "lg" ? 116 : 76),
      busy ? el("span", { class: "arc", "aria-hidden": "true" }) : null
    ]);
  }

  function fieldError(field: "file" | "password"): HTMLElement | null {
    return state.error?.field === field ? el("p", { class: "error", role: "alert", id: `${field}-error` }, [state.error.message]) : null;
  }

  function fileInput(): HTMLInputElement {
    const input = el("input", { type: "file", accept: ".spass", id: "spass-file", class: "visually-hidden" }) as HTMLInputElement;
    input.addEventListener("click", () => {
      state.externalPending = true;
      // Picker cancel fires no change event on some WebViews; clear pending once focus returns.
      window.addEventListener("focus", () => setTimeout(() => { state.externalPending = false; }, 1000), { once: true });
    });
    input.addEventListener("cancel", () => { state.externalPending = false; });
    input.addEventListener("change", () => {
      state.externalPending = false;
      const picked = input.files?.[0] ?? null;
      if (picked && !isSpassFileName(picked.name)) {
        state.file = null;
        state.error = { field: "file", message: "Choose a .spass export from Samsung Pass." };
        input.value = "";
      } else {
        state.file = picked;
        state.password = "";
        state.error = null;
        if (picked) state.focusNext = "spass-password";
      }
      render();
    });
    return input;
  }

  // ---------- stages ----------

  function homeStage(): HTMLElement {
    return el("section", { class: "stage home", "data-testid": "stage-home" }, [
      el("div", { class: "top-actions" }, [aboutButton()]),
      rings("lg"),
      el("div", { class: "lockup", "data-testid": "lockup" }, [
        el("h1", { class: "lockup-title" }, ["Spcc"]),
        el("p", { class: "lockup-sub" }, ["Spass to CSV Converter"])
      ]),
      el("div", { class: "controls" }, [
        fileInput(),
        el("label", { for: "spass-file", class: "cta", "data-testid": "choose-file", tabindex: "0", role: "button",
          onkeydown: (e: Event) => { const k = (e as KeyboardEvent).key; if (k === "Enter" || k === " ") { e.preventDefault(); root.querySelector<HTMLInputElement>("#spass-file")?.click(); } }
        }, [icon("folder"), "Choose .spass file"]),
        fieldError("file") ?? el("p", { class: "helper" }, ["Samsung Pass export"])
      ])
    ]);
  }

  function passwordStage(): HTMLElement {
    const input = el("input", {
      type: state.showPassword ? "text" : "password",
      id: "spass-password",
      autocomplete: "off",
      spellcheck: "false",
      "aria-describedby": state.error?.field === "password" ? "password-error" : "pw-help",
      "aria-invalid": state.error?.field === "password" ? "true" : "false"
    }) as HTMLInputElement;
    input.value = state.password;
    input.addEventListener("input", () => {
      state.password = input.value;
      const btn = root.querySelector<HTMLButtonElement>("[data-testid=convert]");
      if (btn) btn.disabled = !canConvert();
    });
    input.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") void convert(); });
    const unlockBtn = el("button", { type: "button", class: "cta", "data-testid": "convert", onclick: () => void convert() }, ["Unlock"]) as HTMLButtonElement;
    unlockBtn.disabled = !canConvert();
    return el("section", { class: "stage password", "data-testid": "stage-password" }, [
      el("div", { class: "top-actions" }, [aboutButton()]),
      rings("sm"),
      el("div", { class: "stage-head" }, [
        el("h1", {}, ["Enter password"]),
        el("p", {}, ["Use the password you set when exporting"])
      ]),
      el("div", { class: "well file-well" }, [
        icon("description"),
        el("span", { class: "name", "data-testid": "filename" }, [state.file?.name ?? ""]),
        el("button", { type: "button", class: "text-btn", "data-testid": "change-file", onclick: wipe }, ["Change file"])
      ]),
      fieldError("file"),
      el("div", { class: "field" }, [
        el("label", { for: "spass-password" }, ["Export password"]),
        el("div", { class: "well pw-input" }, [
          input,
          el("button", { type: "button", class: "icon-btn", "aria-label": state.showPassword ? "Hide password" : "Show password", onclick: () => { state.showPassword = !state.showPassword; render(); } }, [icon(state.showPassword ? "visibility" : "visibility_off")])
        ]),
        fieldError("password") ?? el("p", { id: "pw-help", class: "hint" }, ["Your export password — not your Samsung account password."])
      ]),
      el("div", { class: "controls" }, [
        unlockBtn,
        el("p", { class: "helper" }, ["From the .spass export"])
      ])
    ]);
  }

  function unlockingStage(): HTMLElement {
    return el("section", { class: "stage unlocking", "data-testid": "unlocking", "aria-busy": "true" }, [
      rings("lg", true),
      el("h1", { role: "status" }, ["Unlocking…"]),
      el("p", {}, [state.file?.name ?? ""])
    ]);
  }

  function loginRow(login: Login, trailing: HTMLElement, testid: string, after?: AfterEdit): HTMLElement {
    const title = resolvedTitle(login);
    const host = hostOf(login.url);
    const sub = login.username ? `${login.username} · ${DOTS}` : host || login.note.split("\n")[0] || "";
    return el("li", {}, [
      el("button", { type: "button", class: "row", "data-testid": testid, "data-id": login.id, onclick: () => openEdit(login, after) }, [
        el("span", { class: "av", "aria-hidden": "true" }, [initial(title)]),
        el("span", { class: "t" }, [
          el("b", { class: title ? "" : "untitled" }, [title || "Untitled login"]),
          el("span", {}, [testid === "login" ? (login.username || host) : sub])
        ]),
        trailing
      ])
    ]);
  }

  function organize(vault: Vault): HTMLElement {
    const look = needsLook(vault.logins, state.format);
    const lookIds = new Set(look.map((l) => l.id));
    const complete = vault.logins.filter((l) => !lookIds.has(l.id));
    const tiles: HTMLElement[] = [];
    const tile = (testid: string, glyph: string, title: string, sub: string, which: "cards" | "notes" | "addresses" | null) =>
      el(which ? "button" : "div", {
        class: "tile", "data-testid": testid, ...(which ? { type: "button", onclick: () => { state.sheet = { kind: "extras", which }; render(); } } : {})
      }, [el("span", { class: "glyph", "aria-hidden": "true" }, [icon(glyph)]), el("span", { class: "t" }, [el("b", {}, [title]), el("span", {}, [sub])])]);
    if (vault.cards.length) {
      const c = vault.cards[0];
      const last4 = c.number.replace(/\D/g, "").slice(-4);
      tiles.push(tile("tile-cards", "credit_card", plural(vault.cards.length, "Card"), `${c.nickname}${last4 ? ` ••${last4}` : ""}`, "cards"));
    }
    if (vault.notes.length) {
      const inMain = state.format === "bitwarden";
      tiles.push(tile("tile-notes", "notes", plural(vault.notes.length, "Note"), inMain ? "In Bitwarden file" : vault.notes[0].title, "notes"));
    }
    if (vault.addresses.length) {
      const a = vault.addresses[0];
      tiles.push(tile("tile-addresses", "home", plural(vault.addresses.length, "Address", "Addresses"), a.city || a.street || a.name, "addresses"));
    }
    const places = placeCount(complete);
    const heroMeta = complete.length === 0
      ? (vault.logins.length ? "Fix the logins that need a look." : "No logins in this export.")
      : `across ${plural(places, "place")}`;
    const groups = duplicateGroups(vault.logins);
    return el("div", { class: "vault-main" }, [
      el("button", { type: "button", class: "chip", "data-testid": "destination-chip", onclick: () => { state.sheet = { kind: "destination" }; render(); } }, [
        el("span", { class: "dot", "aria-hidden": "true" }), "Save for ", el("b", {}, [formatInfo().label]), icon("chevron_right")
      ]),
      el("div", { class: "ov-hero", "data-testid": "overview" }, [
        el("span", { class: "ring-field", "aria-hidden": "true" }),
        el("div", { class: "ov-n", "data-testid": "logins-count" }, [String(complete.length)]),
        el("div", { class: "ov-sub" }, [complete.length === 1 ? "ready login" : "ready logins"]),
        el("p", { class: "ov-meta", "data-testid": "places-count" }, [heroMeta])
      ]),
      look.length ? el("button", { type: "button", class: "tray caution look-btn", "data-testid": "needs-look", onclick: () => { state.sheet = { kind: "look" }; render(); } }, [
        el("span", { class: "ring-field", "aria-hidden": "true" }),
        el("div", { class: "tray-lbl" }, [el("b", { "data-testid": "needs-look-count" }, [`Needs a look · ${look.length}`]), el("span", {}, ["Tap to fix"])])
      ]) : null,
      groups.length ? el("button", {
        type: "button", class: "merge-row", "data-testid": "merge-suggestions",
        "aria-label": groups.length === 1 ? `Possible merge: ${groupName(groups[0])}` : `${groups.length} possible merges`,
        onclick: openMergeSuggestions
      }, [
        el("span", { class: "two", "aria-hidden": "true" }),
        el("span", { class: "t" }, [
          el("b", { "data-testid": "merge-count" }, [groups.length === 1 ? "Possible merge" : `${groups.length} possible merges`]),
          el("span", {}, [groups.map(groupName).join(", ")])
        ]),
        icon("chevron_right")
      ]) : null,
      complete.length ? el("button", { type: "button", class: "browse-btn", "data-testid": "browse-logins", onclick: () => { state.sheet = { kind: "browse", query: "" }; render(); } }, [
        "Browse logins", icon("chevron_right")
      ]) : null,
      tiles.length ? el("div", { class: "tiles" }, tiles) : null,
      state.saved ? el("p", { class: "reminder", role: "status" }, [icon("delete"), "Delete the CSV after you import it. It holds your passwords in plain text."]) : null
    ]);
  }

  function vaultStage(vault: Vault): HTMLElement {
    return el("section", { class: "vault", "data-testid": "vault" }, [
      el("header", { class: "vault-head" }, [
        pRingMark(40),
        el("div", { class: "t" }, [el("b", {}, ["Unlocked"]), el("span", { "data-testid": "filename" }, [state.file?.name ?? "export.spass"])]),
        el("button", { type: "button", class: "text-btn", "data-testid": "change-file", onclick: wipe }, ["Change file"]),
        aboutButton()
      ]),
      organize(vault),
      el("footer", { class: "footer" }, [
        el("button", { type: "button", class: "cta", "data-testid": "save", onclick: beginPrimarySave }, ["Save CSV"])
      ])
    ]);
  }

  // ---------- sheets ----------

  function countsLine(vault: Vault): HTMLElement {
    const incomplete = needsLook(vault.logins, state.format).length;
    const item = (n: number, one: string, many: string, cls = "") => el("span", { class: cls }, [el("b", {}, [String(n)]), n === 1 ? one : many]);
    return el("div", { class: "counts", "data-testid": "counts" }, [
      item(vault.logins.length, "Login", "Logins"),
      item(vault.cards.length, "Card", "Cards"),
      vault.addresses.length ? item(vault.addresses.length, "Address", "Addresses") : null,
      item(vault.notes.length, "Note", "Notes"),
      incomplete ? item(incomplete, "Incomplete", "Incomplete", "warn") : null
    ]);
  }

  function destinationSheet(close: () => void): (HTMLElement | null)[] {
    const pick = (id: FormatId) => { state.format = id; storeFormat(id); state.sheet = null; render(); };
    const other = FORMATS.find((f) => f.id === "other")!;
    return [
      el("div", { class: "sheet-head" }, [el("h2", {}, ["Save CSV for"]), el("button", { type: "button", class: "x", "aria-label": "Close", onclick: close }, [icon("close")])]),
      el("div", { class: "ng-grid", role: "radiogroup", "aria-label": "Save CSV for" }, NAMED_FORMATS.map((f) => {
        const sel = f.id === state.format;
        return el("button", { type: "button", role: "radio", class: sel ? "ng-tile sel" : "ng-tile", "aria-checked": sel ? "true" : "false", "data-format": f.id, onclick: () => pick(f.id) }, [
          el("span", { class: "ring-field", "aria-hidden": "true" }),
          el("span", { class: "check", "aria-hidden": "true" }, [sel ? icon("check") : null]),
          el("span", { class: "ng-txt" }, [el("b", {}, [f.label]), el("span", {}, [f.fileName])])
        ]);
      })),
      el("button", { type: "button", role: "radio", class: state.format === "other" ? "ng-other sel" : "ng-other", "aria-checked": state.format === "other" ? "true" : "false", "data-format": "other", onclick: () => pick("other") }, [
        el("span", { class: "plus", "aria-hidden": "true" }, [state.format === "other" ? icon("check") : "+"]),
        el("span", { class: "t" }, [el("b", {}, ["Other ", el("span", {}, [`· ${other.fileName}`])]), el("span", {}, ["Any other app or spreadsheet"])]),
        icon("chevron_right")
      ]),
      state.vault ? countsLine(state.vault) : null
    ];
  }

  function editSheet(s: Extract<Sheet, { kind: "edit" }>, close: () => void): (HTMLElement | null)[] {
    const login = findLogin(s.id);
    if (!login) return [];
    const back = () => { returnAfter(s.after, s.browseQuery); render(); };
    const gaps = lookGaps(login, state.format);
    const title = s.draft.name || resolvedTitle(login);
    const field = (key: keyof LoginEdit, id: string, label: string, opts: { type?: string; placeholder?: string; hint?: string; trailing?: HTMLElement } = {}) => {
      const input = el("input", { id, type: opts.type ?? "text", autocomplete: "off", spellcheck: "false", placeholder: opts.placeholder ?? "" }) as HTMLInputElement;
      input.value = s.draft[key];
      input.addEventListener("input", () => { s.draft[key] = input.value; });
      return el("div", { class: "ef" }, [
        el("label", { for: id }, [label]),
        el("div", { class: "in" }, [input, opts.trailing ?? null]),
        opts.hint ? el("p", { class: "hint" }, [opts.hint]) : null
      ]);
    };
    const dest = state.format === "other" ? "your password manager" : formatInfo().label;
    return [
      el("div", { class: "sheet-head" }, [
        el("span", { class: "av", "aria-hidden": "true" }, [initial(title)]),
        el("h2", {}, [title || "Untitled login"]),
        el("button", { type: "button", class: "x", "aria-label": "Close", onclick: back }, [icon("close")])
      ]),
      field("name", "edit-title", "Title", { placeholder: "Add a title", hint: gaps.includes("title") ? "Add a title so you can find this login." : undefined }),
      field("url", "edit-url", "Website", { type: "url", placeholder: "example.com", hint: gaps.includes("url") ? `Add a website so ${dest} can match this login.` : undefined }),
      field("username", "edit-username", "Username", { placeholder: "Add a username", hint: gaps.includes("username") ? "Add the username or email you sign in with." : undefined }),
      field("password", "edit-password", "Password", {
        type: s.showPassword ? "text" : "password",
        trailing: el("button", { type: "button", class: "icon-btn", "aria-label": s.showPassword ? "Hide password" : "Show password", onclick: () => { s.showPassword = !s.showPassword; render(); } }, [icon(s.showPassword ? "visibility_off" : "visibility")])
      }),
      field("note", "edit-notes", "Notes", { placeholder: "Optional" }),
      el("div", { class: "acts" }, [
        el("button", { type: "button", class: "danger-btn", "data-testid": "edit-delete", onclick: () => deleteLogin(login.id) }, ["Delete"]),
        el("button", { type: "button", class: "cta", "data-testid": "edit-save", onclick: () => {
          applyLoginEdit(login, s.draft);
          returnAfter(s.after, s.browseQuery);
          render();
        } }, ["Save changes"])
      ])
    ];
  }

  function needsLookSheet(close: () => void): (HTMLElement | null)[] {
    const vault = state.vault!;
    const look = needsLook(vault.logins, state.format);
    const n = look.length;
    const websiteOnly = look.every((l) => lookGaps(l, state.format).every((g) => g === "url"));
    const isOther = state.format === "other";
    const CAP = 50;
    const otherCopy = n === 1
      ? "This login is missing a title, username, or website. Add the missing labels, delete those logins, or keep the fields blank."
      : "These logins are missing a title, username, or website. Add the missing labels, delete those logins, or keep the fields blank.";
    const namedCopy = websiteOnly
      ? state.format === "google"
        ? "These have no website. Add one, delete them, or save anyway — Google lists them as “no url”."
        : "These have no website. Add one, delete them, or save anyway with the website left blank."
      : "Add the missing title or username, or delete the login, before saving.";
    const addOrReview = () => {
      if (isOther && n > 1) {
        state.sheet = { kind: "look" };
        render();
      } else openEdit(look[0]);
    };
    return [
      el("h2", { class: "title" }, [`${plural(n, "login")} ${n === 1 ? "needs" : "need"} a look`]),
      el("p", {}, [isOther ? otherCopy : namedCopy]),
      el("ul", { class: "gap-list", "data-testid": "needs-look-list" }, look.slice(0, CAP).map((l) =>
        el("li", {}, [el("span", { class: "strong" }, [resolvedTitle(l) || "Untitled login"]), el("span", { class: "muted" }, [` — no ${lookGaps(l, state.format).map((g) => GAP_LABEL[g]).join(", no ")}`])]))),
      n > CAP ? el("p", { class: "muted" }, [`…and ${n - CAP} more`]) : null,
      el("div", { class: "acts stack" }, isOther
        ? [
          el("button", { type: "button", class: "cta", "data-testid": "add", onclick: addOrReview }, ["Add"]),
          el("button", { type: "button", class: "danger-btn", "data-testid": "delete-all", onclick: deleteNeedsLookLogins }, ["Delete all"]),
          el("button", { type: "button", class: "ghost", "data-testid": "keep-blank", onclick: openSaveSheet }, ["Keep them blank"]),
          el("button", { type: "button", class: "ghost", onclick: close }, ["Cancel"])
        ]
        : [
          el("button", { type: "button", class: "cta", "data-testid": "review", onclick: () => openEdit(look[0]) }, ["Review"]),
          websiteOnly ? el("button", { type: "button", class: "ghost", "data-testid": "save-anyway", onclick: openSaveSheet }, ["Save anyway"]) : null,
          el("button", { type: "button", class: "ghost", onclick: close }, ["Cancel"])
        ])
    ];
  }

  const FIELD_LABEL: Record<MergeField, string> = { name: "Title", url: "Website", username: "Username", password: "Password", note: "Notes" };

  function mergeSheet(s: Extract<Sheet, { kind: "merge" }>, close: () => void): (HTMLElement | null)[] {
    const a = findLogin(s.aId);
    const b = findLogin(s.bId);
    if (!a || !b) return [];
    const show = (f: MergeField, l: Login) => f === "password" ? "••••••" : f === "url" ? (hostOf(l.url) || l.url) : l[f].split("\n")[0];
    const rows = MERGE_FIELDS.map((f) => {
      const va = f === "url" ? hostOf(a.url) || a.url.trim() : a[f].trim();
      const vb = f === "url" ? hostOf(b.url) || b.url.trim() : b[f].trim();
      if (!va && !vb) return null;
      if (va === vb) {
        return el("div", { class: "mg-f" }, [el("span", { class: "lbl" }, [FIELD_LABEL[f]]), el("div", { class: "mg-same" }, [el("span", { class: f === "password" ? "dots" : "" }, [show(f, a)]), el("em", {}, ["Same in both"])])]);
      }
      const opt = (side: "a" | "b", l: Login) => {
        const sel = s.choice[f] === side;
        const value = l[f].trim();
        return el("button", { type: "button", class: sel ? "mg-o sel" : "mg-o", "data-testid": "merge-opt", "data-field": f, "data-side": side, "aria-pressed": sel ? "true" : "false", onclick: () => { s.choice[f] = side; render(); } }, [
          el("i", { "aria-hidden": "true" }, [sel ? icon("check") : null]),
          el("span", { class: f === "password" ? "v dots" : value ? "v" : "v muted" }, [value ? show(f, l) : "Empty"]),
          f === "password" ? el("span", { class: "muted" }, [`· ${side.toUpperCase()}`]) : null
        ]);
      };
      return el("div", { class: "mg-f" }, [el("span", { class: "lbl" }, [FIELD_LABEL[f]]), el("div", { class: "mg-opts" }, [opt("a", a), opt("b", b)])]);
    });
    return [
      el("div", { class: "sheet-head" }, [el("h2", {}, [`Merge ${groupName([a, b])}`]), el("button", { type: "button", class: "x", "aria-label": "Close", onclick: close }, [icon("close")])]),
      el("div", { class: "mg-hero", "aria-hidden": "true" }, [
        el("div", { class: "mg-ring a" }, [el("b", {}, ["A"]), el("span", {}, [resolvedTitle(a) || "Untitled"])]),
        el("div", { class: "mg-ring b" }, [el("b", {}, ["B"]), el("span", {}, [resolvedTitle(b) || "Untitled"])]),
        el("div", { class: "mg-core" }, ["1"])
      ]),
      el("p", { class: "mg-help" }, ["One login will be saved. The other will be removed."]),
      ...rows,
      el("div", { class: "acts" }, [
        el("button", { type: "button", class: "ghost", "data-testid": "merge-cancel", onclick: s.fromList ? () => { state.sheet = { kind: "merges" }; render(); } : close }, [s.fromList ? "Back" : "Cancel"]),
        el("button", { type: "button", class: "cta", "data-testid": "merge-confirm", onclick: () => confirmMerge(a.id, b.id, s.choice, s.fromList) }, ["Merge"])
      ])
    ];
  }

  function mergesSheet(close: () => void): (HTMLElement | null)[] {
    const groups = duplicateGroups(state.vault!.logins);
    return [
      el("div", { class: "sheet-head" }, [
        el("h2", {}, [groups.length ? `Possible merges · ${groups.length}` : "Possible merges"]),
        el("button", { type: "button", class: "x", "aria-label": "Close", onclick: close }, [icon("close")])
      ]),
      el("p", { class: "mg-help" }, ["Same website or app, same username. Tap one to choose what to keep."]),
      groups.length
        ? el("ul", { class: "rows", "data-testid": "merge-list" }, groups.map((g) => el("li", {}, [
          el("button", { type: "button", class: "row", "data-testid": "merge-item", onclick: () => openMerge(g, true) }, [
            el("span", { class: "two", "aria-hidden": "true" }),
            el("span", { class: "t" }, [
              el("b", {}, [groupName(g)]),
              el("span", {}, [`${g.length} logins · ${g.map((l) => resolvedTitle(l) || "Untitled").join(" · ")}`])
            ]),
            el("span", { class: "mg-go" }, ["Merge"]),
            icon("chevron_right")
          ])
        ])))
        : el("p", { class: "empty" }, ["No possible merges left."])
    ];
  }

  function lookSheet(close: () => void): (HTMLElement | null)[] {
    const vault = state.vault!;
    const look = needsLook(vault.logins, state.format);
    return [
      el("div", { class: "sheet-head" }, [
        el("h2", {}, [look.length ? `Needs a look · ${look.length}` : "Needs a look"]),
        el("button", { type: "button", class: "x", "aria-label": "Close", onclick: close }, [icon("close")])
      ]),
      look.length
        ? el("ul", { class: "rows look-rows", "data-testid": "look-list" }, look.map((l) =>
          loginRow(l, el("span", { class: "miss" }, [GAP_TAG[lookGaps(l, state.format)[0]]]), "needs-look-item", "look")))
        : el("p", { class: "empty" }, ["Every login looks ready."])
    ];
  }

  function browseSheet(s: Extract<Sheet, { kind: "browse" }>, close: () => void): (HTMLElement | null)[] {
    const vault = state.vault!;
    const lookIds = new Set(needsLook(vault.logins, state.format).map((l) => l.id));
    const ready = vault.logins.filter((l) => !lookIds.has(l.id));
    const q = s.query.trim().toLowerCase();
    const filtered = ready.filter((l) => matchesQuery(l, q));
    const groups = placeGroups(filtered);
    const search = el("input", {
      id: "browse-query",
      type: "search",
      "data-testid": "browse-query",
      placeholder: "Find a login",
      autocomplete: "off",
      spellcheck: "false"
    }) as HTMLInputElement;
    search.value = s.query;
    search.addEventListener("input", () => {
      if (state.sheet?.kind === "browse") {
        state.sheet.query = search.value;
        render();
      }
    });
    const list = filtered.length === 0
      ? el("p", { class: "empty" }, [q ? "No matching logins." : "No ready logins yet."])
      : el("div", { "data-testid": "browse-list" }, groups.flatMap((g) => [
        groups.length > 1 || g.items.length > 1 ? el("p", { class: "place-lbl" }, [g.label]) : null,
        el("ul", { class: "rows" }, g.items.map((l) => loginRow(l, icon("chevron_right"), "login", "browse")))
      ]));
    return [
      el("div", { class: "sheet-head" }, [
        el("h2", {}, ["Logins"]),
        el("button", { type: "button", class: "x", "aria-label": "Close", onclick: close }, [icon("close")])
      ]),
      el("div", { class: "browse-find" }, [search]),
      list
    ];
  }

  function extrasSheet(s: Extract<Sheet, { kind: "extras" }>, close: () => void): (HTMLElement | null)[] {
    const vault = state.vault!;
    const items: { id: string; heading: string; lines: string[] }[] = [];
    let title = "";
    let fileName = "";
    let csv = "";
    let help = "";
    if (s.which === "addresses") {
      title = plural(vault.addresses.length, "Address", "Addresses");
      fileName = "samsung-pass-addresses.csv";
      csv = addressesToCsv(vault.addresses);
      help = "This saves a plain-text CSV of these addresses — not your passwords.";
      for (const a of vault.addresses) {
        const city = [a.city, a.state].filter(Boolean).join(", ");
        const locality = [city, a.postal].filter(Boolean).join(" ");
        items.push({
          id: a.id,
          heading: a.name || a.street || "Address",
          lines: [a.company, a.street, locality, a.country, a.phone, a.email].filter(Boolean)
        });
      }
    } else if (s.which === "cards") {
      title = plural(vault.cards.length, "Card");
      fileName = "samsung-pass-cards.csv";
      csv = cardsToCsv(vault.cards);
      help = "This saves a plain-text CSV of these cards — not your login passwords.";
      for (const c of vault.cards) {
        const last4 = c.number.replace(/\D/g, "").slice(-4);
        const exp = c.expMonth && c.expYear ? `Expires ${c.expMonth}/${c.expYear}` : "";
        items.push({
          id: c.id,
          heading: c.nickname || "Card",
          lines: [c.holder, last4 ? `••${last4}` : "", exp].filter(Boolean)
        });
      }
    } else {
      title = plural(vault.notes.length, "Note");
      fileName = "samsung-pass-notes.csv";
      csv = notesToCsv(vault.notes);
      help = "This saves a plain-text CSV of these notes.";
      for (const n of vault.notes) {
        items.push({ id: n.id, heading: n.title.trim() || "Note", lines: n.body ? [n.body] : [] });
      }
    }
    return [
      el("h2", { class: "title" }, [title]),
      el("ul", { class: "extra-list", "data-testid": "extras-list" }, items.map((item) =>
        el("li", { "data-testid": "extra-item" }, [
          el("div", { class: "extra-head" }, [
            el("b", {}, [item.heading]),
            el("button", { type: "button", class: "danger-btn extra-del", "data-testid": "extra-delete", onclick: () => deleteExtra(s.which, item.id) }, ["Delete"])
          ]),
          ...item.lines.map((line) => el("p", {}, [line]))
        ])
      )),
      el("p", { class: "muted" }, [help]),
      el("div", { class: "acts" }, [
        el("button", { type: "button", class: "ghost", onclick: close }, ["Close"]),
        s.which === "notes" && state.format === "bitwarden"
          ? null
          : el("button", { type: "button", class: "cta", "data-testid": "confirm-save", onclick: () => void confirmSave(fileName, csv, false) }, ["Save CSV"])
      ])
    ];
  }

  /** Android back / Escape: step back inside a sheet, close it, or leave the password step. False = let the system handle it. */
  function goBack(): boolean {
    const s = state.sheet;
    if (state.externalPending) return true;
    if (s) {
      if (s.kind === "edit") returnAfter(s.after, s.browseQuery);
      else if (s.kind === "merge" && s.fromList) state.sheet = { kind: "merges" };
      else state.sheet = null;
      render();
      return true;
    }
    if (stage() === "password") { wipe(); return true; }
    return false;
  }
  (globalThis as unknown as { spccBack?: () => boolean }).spccBack = goBack;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.sheet) { e.preventDefault(); goBack(); }
  });

  function sheet(): HTMLElement | null {
    const s = state.sheet;
    if (!s) return null;
    const close = () => { state.sheet = null; render(); };
    let body: (HTMLElement | null)[];
    if (s.kind === "needs-look") body = needsLookSheet(close);
    else if (s.kind === "look") body = lookSheet(close);
    else if (s.kind === "browse") body = browseSheet(s, close);
    else if (s.kind === "edit") body = editSheet(s, close);
    else if (s.kind === "merge") body = mergeSheet(s, close);
    else if (s.kind === "merges") body = mergesSheet(close);
    else if (s.kind === "extras") body = extrasSheet(s, close);
    else if (s.kind === "destination") body = destinationSheet(close);
    else if (s.kind === "save") {
      body = [
        el("h2", { class: "title" }, ["Save plaintext CSV?"]),
        el("p", {}, [`${s.fileName} will contain your passwords in plain text. Anyone with the file can read them.`]),
        el("p", { class: "strong" }, ["Import it into your password manager, then delete it."]),
        el("div", { class: "acts" }, [
          el("button", { type: "button", class: "ghost", onclick: close }, ["Cancel"]),
          el("button", { type: "button", class: "cta", "data-testid": "confirm-save", onclick: () => void confirmSave(s.fileName, s.csv, s.primary) }, ["Save"])
        ])
      ];
    } else if (s.kind === "import-guide") {
      const f = formatInfo();
      body = [
        el("h2", { class: "title" }, [f.id === "other" ? "Import into your password manager" : `Import into ${f.label}`]),
        el("p", { class: "muted" }, [`Saved ${f.fileName}.`]),
        el("ol", { class: "guide-steps" }, f.importSteps.map((t) => el("li", {}, [t]))),
        el("div", { class: "acts" }, [el("button", { type: "button", class: "cta", "data-testid": "guide-done", onclick: close }, ["Done"])])
      ];
    } else {
      body = [
        el("h2", { class: "title" }, ["About & privacy"]),
        el("p", {}, ["Spcc (Spass to CSV Converter) converts a Samsung Pass .spass export on this device. Nothing is uploaded. No accounts, analytics, or telemetry. The Android app may contact Google Play only to check for and apply updates (Play In-App Updates); conversion stays on-device and the WebView has no network access."]),
        el("p", { class: "muted" }, ["Not affiliated with Samsung."]),
        el("div", { class: "acts" }, [el("button", { type: "button", class: "cta", onclick: close }, ["Done"])])
      ];
    }
    const label = body.find((n) => n?.tagName === "H2")?.textContent || body.map((n) => n?.querySelector("h2")?.textContent).find(Boolean) || "Dialog";
    return el("div", { class: "scrim", onclick: (e: Event) => { if (e.target === e.currentTarget) close(); } }, [
      el("div", { class: "sheet", id: "sheet", tabindex: "-1", role: "dialog", "aria-modal": "true", "aria-label": label, "data-testid": `sheet-${s.kind}` }, [el("div", { class: "handle", "aria-hidden": "true" }), ...body])
    ]);
  }

  function toast(): HTMLElement | null {
    const t = state.toast;
    if (!t) return null;
    return el("div", { class: "toast", role: "status", "data-testid": "snackbar" }, [
      el("span", {}, [t.text]),
      t.undo ? el("button", { type: "button", "data-testid": "undo", onclick: () => { t.undo!(); state.toast = null; render(); } }, ["Undo"]) : null
    ]);
  }

  // ---------- render ----------

  let lastSheet: Sheet = null;
  function render() {
    const active = document.activeElement as HTMLInputElement | null;
    // A sheet that just opened (or changed) takes focus so keyboard / TalkBack users land inside it.
    const sheetChanged = state.sheet !== lastSheet && state.sheet !== null && state.sheet.kind !== lastSheet?.kind;
    lastSheet = state.sheet;
    const focusId = state.focusNext || (active && root.contains(active) && !sheetChanged ? active.id : "") || (sheetChanged ? "sheet" : "");
    const sel = !state.focusNext && focusId && active && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
    state.focusNext = "";
    paint();
    if (focusId) {
      const next = document.getElementById(focusId) as HTMLInputElement | null;
      if (next) {
        next.focus();
        try { if (sel && sel[0] !== null) next.setSelectionRange(sel[0], sel[1]); } catch { /* type without selection */ }
      }
    }
  }

  function paint() {
    const current = stage();
    const view = current === "vault" ? vaultStage(state.vault!)
      : current === "unlocking" ? unlockingStage()
      : current === "password" ? passwordStage()
      : homeStage();
    root.replaceChildren(
      el("div", { class: "app", "data-stage": current }, [view]),
      sheet() ?? el("span"),
      toast() ?? el("span")
    );
    const t = state.toast;
    if (t) setTimeout(() => { if (state.toast === t) { state.toast = null; render(); } }, 5000);
  }

  render();
  return { wipe };
}
