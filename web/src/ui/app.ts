import {
  FORMATS,
  GAP_LABEL,
  GAP_TAG,
  NAMED_FORMATS,
  SpassError,
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
  MERGE_FIELDS,
  needsLook,
  notesToCsv,
  resolvedTitle,
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
type Sheet =
  | null
  | { kind: "save"; fileName: string; csv: string; primary: boolean }
  | { kind: "needs-look" }
  | { kind: "about" }
  | { kind: "destination" }
  | { kind: "import-guide" }
  | { kind: "edit"; id: string; draft: LoginEdit; showPassword: boolean }
  | { kind: "merge"; aId: string; bId: string; choice: MergeChoice };

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

const DOTS = "••••••••";
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
    state.status = "working";
    state.error = null;
    render();
    try {
      const text = await readFileText(state.file);
      state.vault = await unlockText(text, state.password);
      state.password = "";
      state.status = "done";
    } catch (error) {
      state.status = "form";
      const err = error instanceof SpassError ? error : new SpassError("format", "Something went wrong reading this file.");
      state.error = { field: err.code === "format" ? "file" : "password", message: err.message };
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
    state.sheet = null;
    state.externalPending = true;
    render();
    const ok = await platform.save(fileName, csv);
    state.externalPending = false;
    state.saved = state.saved || ok;
    if (ok && primary) state.sheet = { kind: "import-guide" };
    else if (ok) state.toast = { text: `Saved ${fileName}` };
    else state.toast = { text: "Couldn't save the file. Nothing was written." };
    render();
  }

  function openEdit(login: Login) {
    state.sheet = {
      kind: "edit",
      id: login.id,
      showPassword: false,
      draft: { name: resolvedTitle(login), url: login.url, username: login.username, password: login.password, note: login.note }
    };
    const gap = lookGaps(login, state.format)[0];
    state.focusNext = gap === "url" ? "edit-url" : gap === "username" ? "edit-username" : gap === "title" ? "edit-title" : "";
    render();
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

  function openMerge(group: Login[]) {
    // A is the more complete record (fewest gaps), so defaults keep the better data.
    const [a, b] = [...group].sort((x, y) => lookGaps(x, state.format).length - lookGaps(y, state.format).length);
    state.sheet = { kind: "merge", aId: a.id, bId: b.id, choice: defaultMergeChoice(a, b) };
    render();
  }

  function confirmMerge(aId: string, bId: string, choice: MergeChoice) {
    const vault = state.vault;
    const a = findLogin(aId);
    const b = findLogin(bId);
    if (!vault || !a || !b) return;
    const merged = mergeLogins(a, b, choice);
    vault.logins = vault.logins.filter((l) => l.id !== bId).map((l) => (l.id === aId ? merged : l));
    state.sheet = null;
    state.toast = { text: `Merged ${resolvedTitle(merged) || "login"}` };
    render();
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
    return state.error?.field === field ? el("p", { class: "error", role: "alert" }, [state.error.message]) : null;
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
      "aria-describedby": "pw-help"
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

  function loginRow(login: Login, trailing: HTMLElement, testid: string): HTMLElement {
    const title = resolvedTitle(login);
    const host = hostOf(login.url);
    const sub = login.username ? `${login.username} · ${DOTS}` : host || login.note.split("\n")[0] || "";
    return el("li", {}, [
      el("button", { type: "button", class: "row", "data-testid": testid, "data-id": login.id, onclick: () => openEdit(login) }, [
        el("span", { class: "av", "aria-hidden": "true" }, [title ? title.charAt(0) : "?"]),
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
    const groups = duplicateGroups(vault.logins);
    const tiles: HTMLElement[] = [];
    const tile = (testid: string, glyph: string, title: string, sub: string, csv: { fileName: string; csv: string } | null) =>
      el(csv ? "button" : "div", {
        class: "tile", "data-testid": testid, ...(csv ? { type: "button", onclick: () => { state.sheet = { kind: "save", ...csv, primary: false }; render(); } } : {})
      }, [el("span", { class: "glyph", "aria-hidden": "true" }, [icon(glyph)]), el("span", { class: "t" }, [el("b", {}, [title]), el("span", {}, [sub])])]);
    if (vault.cards.length) {
      const c = vault.cards[0];
      const last4 = c.number.replace(/\D/g, "").slice(-4);
      tiles.push(tile("tile-cards", "credit_card", plural(vault.cards.length, "Card"), `${c.nickname}${last4 ? ` ••${last4}` : ""}`, { fileName: "samsung-pass-cards.csv", csv: cardsToCsv(vault.cards) }));
    }
    if (vault.notes.length) {
      const inMain = state.format === "bitwarden";
      tiles.push(tile("tile-notes", "notes", plural(vault.notes.length, "Note"), inMain ? "In Bitwarden file" : vault.notes[0].title, inMain ? null : { fileName: "samsung-pass-notes.csv", csv: notesToCsv(vault.notes) }));
    }
    if (vault.addresses.length) {
      const a = vault.addresses[0];
      tiles.push(tile("tile-addresses", "home", plural(vault.addresses.length, "Address", "Addresses"), a.city || a.street || a.name, { fileName: "samsung-pass-addresses.csv", csv: addressesToCsv(vault.addresses) }));
    }
    return el("div", { class: "vault-main" }, [
      el("button", { type: "button", class: "chip", "data-testid": "destination-chip", onclick: () => { state.sheet = { kind: "destination" }; render(); } }, [
        el("span", { class: "dot", "aria-hidden": "true" }), "Save for ", el("b", {}, [formatInfo().label]), icon("chevron_right")
      ]),
      look.length ? el("section", { class: "tray caution", "data-testid": "needs-look" }, [
        el("span", { class: "ring-field", "aria-hidden": "true" }),
        el("div", { class: "tray-lbl" }, [el("b", { "data-testid": "needs-look-count" }, [`Needs a look · ${look.length}`]), el("span", {}, ["Tap to fix"])]),
        el("ul", { class: "rows" }, look.map((l) => loginRow(l, el("span", { class: "miss" }, [GAP_TAG[lookGaps(l, state.format)[0]]]), "needs-look-item")))
      ]) : null,
      ...groups.map((group) => el("button", { type: "button", class: "merge-banner", "data-testid": "merge-suggestion", onclick: () => openMerge(group) }, [
        el("span", { class: "two", "aria-hidden": "true" }),
        el("span", { class: "t" }, [`${group.length} ${groupName(group)} logins look like`, el("span", {}, ["the same site"])]),
        el("b", {}, ["Merge ›"])
      ])),
      el("section", { class: "tray", "data-testid": "logins" }, [
        el("div", { class: "tray-lbl" }, [el("b", {}, ["Logins"]), el("span", { "data-testid": "logins-count" }, [`${complete.length} of ${vault.logins.length}`])]),
        complete.length
          ? el("ul", { class: "rows" }, complete.map((l) => loginRow(l, icon("chevron_right"), "login")))
          : el("p", { class: "empty" }, [vault.logins.length ? "Fix the logins above to finish." : "No logins in this export."])
      ]),
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
    const item = (n: number, label: string, cls = "") => el("span", { class: cls }, [el("b", {}, [String(n)]), label]);
    return el("div", { class: "counts", "data-testid": "counts" }, [
      item(vault.logins.length, "Logins"),
      item(vault.cards.length, "Cards"),
      vault.addresses.length ? item(vault.addresses.length, "Addresses") : null,
      item(vault.notes.length, "Notes"),
      incomplete ? item(incomplete, "Incomplete", "warn") : null
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
        el("span", { class: "av", "aria-hidden": "true" }, [title ? title.charAt(0) : "?"]),
        el("h2", {}, [title || "Untitled login"]),
        el("button", { type: "button", class: "x", "aria-label": "Close", onclick: close }, [icon("close")])
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
          state.sheet = null;
          render();
        } }, ["Save changes"])
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
        el("button", { type: "button", class: "ghost", "data-testid": "merge-cancel", onclick: close }, ["Cancel"]),
        el("button", { type: "button", class: "cta", "data-testid": "merge-confirm", onclick: () => confirmMerge(a.id, b.id, s.choice) }, ["Merge"])
      ])
    ];
  }

  function needsLookSheet(close: () => void): (HTMLElement | null)[] {
    const vault = state.vault!;
    const look = needsLook(vault.logins, state.format);
    const n = look.length;
    const websiteOnly = look.every((l) => lookGaps(l, state.format).every((g) => g === "url"));
    const CAP = 50;
    return [
      el("h2", { class: "title" }, [`${plural(n, "login")} ${n === 1 ? "needs" : "need"} a look`]),
      el("p", {}, [websiteOnly
        ? state.format === "google"
          ? "These have no website. Add one, delete them, or save anyway — Google lists them as “no url”."
          : "These have no website. Add one, delete them, or save anyway with the website left blank."
        : "Add the missing title or username, or delete the login, before saving."]),
      el("ul", { class: "gap-list", "data-testid": "needs-look-list" }, look.slice(0, CAP).map((l) =>
        el("li", {}, [el("span", { class: "strong" }, [resolvedTitle(l) || "Untitled login"]), el("span", { class: "muted" }, [` — no ${lookGaps(l, state.format).map((g) => GAP_LABEL[g]).join(", no ")}`])]))),
      n > CAP ? el("p", { class: "muted" }, [`…and ${n - CAP} more`]) : null,
      el("div", { class: "acts stack" }, [
        el("button", { type: "button", class: "cta", "data-testid": "review", onclick: () => openEdit(look[0]) }, ["Review"]),
        websiteOnly ? el("button", { type: "button", class: "ghost", "data-testid": "save-anyway", onclick: openSaveSheet }, ["Save anyway"]) : null,
        el("button", { type: "button", class: "ghost", onclick: close }, ["Cancel"])
      ])
    ];
  }

  function sheet(): HTMLElement | null {
    const s = state.sheet;
    if (!s) return null;
    const close = () => { state.sheet = null; render(); };
    let body: (HTMLElement | null)[];
    if (s.kind === "needs-look") body = needsLookSheet(close);
    else if (s.kind === "edit") body = editSheet(s, close);
    else if (s.kind === "merge") body = mergeSheet(s, close);
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
    return el("div", { class: "scrim", onclick: (e: Event) => { if (e.target === e.currentTarget) close(); } }, [
      el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "data-testid": `sheet-${s.kind}` }, [el("div", { class: "handle", "aria-hidden": "true" }), ...body])
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

  function render() {
    const active = document.activeElement as HTMLInputElement | null;
    const focusId = state.focusNext || (active && root.contains(active) ? active.id : "");
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
