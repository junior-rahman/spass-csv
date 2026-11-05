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
import { el, icon, pRingMark } from "./dom";
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
      el("div", { class: "lockup", "data-testid": "lockup" }, [
        pRingMark(48),
        el("div", { class: "lockup-panel" }, [
          el("h1", { class: "lockup-title" }, ["Spcc"]),
          el("p", { class: "lockup-sub" }, ["Spass to CSV Converter"])
        ])
      ]),
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
    return el("p", { class: "trust", role: "note", "data-testid": "trust" }, [icon("lock"), "Stays on this phone · nothing uploaded"]);
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
        el("p", {}, ["Spcc (Spass to CSV Converter) converts a Samsung Pass .spass export on this device. Nothing is uploaded. No accounts, analytics, or telemetry. The Android app may contact Google Play only to check for and apply updates (Play In-App Updates); conversion stays on-device and the WebView has no network access."]),
        el("p", { class: "muted" }, ["Not affiliated with Samsung."]),
        el("div", { class: "sheet-actions" }, [el("button", { type: "button", class: "btn filled", onclick: close }, ["Done"])])
      ];
    }
    return el("div", { class: "scrim", onclick: (e: Event) => { if (e.target === e.currentTarget) close(); } }, [
      el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "data-testid": `sheet-${s.kind}` }, [el("div", { class: "handle", "aria-hidden": "true" }), ...body])
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
