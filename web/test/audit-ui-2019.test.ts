// @vitest-environment jsdom
// UI regressions from the 2.0.19 audit. Fake data only.
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { encryptSpass, MAX_SPASS_BYTES } from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import { initial, mount } from "../src/ui/app";
import type { Platform } from "../src/ui/platform";
import { TEST_PASSWORD, sampleSpass } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector<T>(sel)!;
const all = (root: Element, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const click = (root: Element, sel: string) => q<HTMLButtonElement>(root, sel).click();
const back = () => (globalThis as unknown as { spccBack: () => boolean }).spccBack();
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "visibilityState", { value: hidden ? "hidden" : "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

function setup(platform?: Platform) {
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById("app")!;
  mount(root, { platform: platform ?? { save: async () => true } });
  return root;
}
async function choose(root: HTMLElement, content?: string, size?: number) {
  const file = new File([content ?? await sampleSpass()], "Pass_20261110.spass", { type: "application/octet-stream" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  const input = q<HTMLInputElement>(root, "#spass-file");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  const pw = q<HTMLInputElement>(root, "#spass-password");
  pw.value = TEST_PASSWORD;
  pw.dispatchEvent(new Event("input"));
}
async function unlock(root: HTMLElement, content?: string) {
  await choose(root, content);
  click(root, "[data-testid=convert]");
  await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
}
function exportWith(rows: string[][]): Promise<string> {
  const row = (cells: string[]) => cells.map((c) => (c ? b64(c) : "")).join(";");
  return encryptSpass(["25", "true;true;true;true", "false", "next_table", "title;host_url;username_value;password_value;credential_memo;otp", ...rows.map(row), ""].join("\n"), TEST_PASSWORD);
}

afterEach(() => setHidden(false));

describe("privacy races", () => {
  it("an unlock that finishes after the app was left never shows the vault", async () => {
    const root = setup();
    await choose(root);
    click(root, "[data-testid=convert]");
    setHidden(true);
    await vi.waitFor(() => expect(root.querySelector("[data-testid=unlocking]")).toBeNull(), { timeout: 10000 });
    expect(root.querySelector("[data-testid=vault]")).toBeNull();
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
  });

  it("a save that settles after Change file does not leak the import guide into the new session", async () => {
    let finish: (ok: boolean) => void = () => {};
    const root = setup({ save: () => new Promise((r) => { finish = r; }) });
    await unlock(root, await exportWith([["Bank", "https://bank.example", "ada", "p", "", ""]]));
    click(root, "[data-testid=save]");
    q<HTMLButtonElement>(document.body, "[data-testid=confirm-save]").click();
    click(root, "[data-testid=change-file]");
    click(document.body, "[data-testid=leave]");
    finish(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector("[data-testid=sheet-import-guide]")).toBeNull();
    expect(document.querySelector("[data-testid=snackbar]")).toBeNull();
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
  });

  it("refuses an absurdly large file without reading it", async () => {
    const root = setup();
    const file = new File(["x"], "Pass_20261110.spass");
    Object.defineProperty(file, "size", { value: MAX_SPASS_BYTES + 1 });
    const input = q<HTMLInputElement>(root, "#spass-file");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(root.querySelector(".error")?.textContent).toMatch(/too large/i));
    expect(root.querySelector("#spass-password")).toBeNull();
  });
});

describe("Android back / Escape", () => {
  it("steps back through sheets, then to home, then lets the system exit", async () => {
    const root = setup();
    await choose(root);
    expect(root.querySelector("[data-testid=stage-password]")).not.toBeNull();
    expect(back()).toBe(true);
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
    expect(back()).toBe(false);
  });

  it("edit returns to its list, merge preview returns to the merge list, other sheets close", async () => {
    const root = setup();
    await unlock(root, await exportWith([
      ["Amazon", "https://amazon.com", "shop@example.com", "a1", "", ""], ["Amazon 2", "https://www.amazon.com", "shop@example.com", "a2", "", ""],
      ["Netflix", "https://netflix.com", "n@example.com", "n1", "", ""], ["Netflix 2", "com.netflix.mediaclient", "n@example.com", "n2", "", ""],
      ["No site", "", "x@example.com", "p", "", ""]
    ]));
    click(root, "[data-testid=needs-look]");
    click(document.body, "[data-testid=needs-look-item]");
    expect(document.querySelector("[data-testid=sheet-edit]")).not.toBeNull();
    expect(back()).toBe(true);
    expect(document.querySelector("[data-testid=sheet-look]")).not.toBeNull();
    expect(back()).toBe(true);
    expect(document.querySelector(".sheet")).toBeNull();
    click(root, "[data-testid=merge-suggestions]");
    click(document.body, "[data-testid=merge-item]");
    expect(back()).toBe(true);
    expect(document.querySelector("[data-testid=sheet-merges]")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".sheet")).toBeNull();
    // 2.0.20: Back from the vault asks "Leave and clear?" instead of exiting straight away.
    expect(back()).toBe(true);
    expect(document.querySelector("[data-testid=sheet-leave]")).not.toBeNull();
  });
});

describe("a11y and unicode", () => {
  it("an opened sheet takes focus and is labelled by its heading", async () => {
    const root = setup();
    await unlock(root);
    click(root, "[data-testid=destination-chip]");
    const sheet = q(document.body, ".sheet");
    expect(document.activeElement).toBe(sheet);
    expect(sheet.getAttribute("aria-label")).toBe("Save CSV for");
  });

  it("wrong-password error is announced and linked to the field", async () => {
    const root = setup();
    await choose(root);
    const pw = q<HTMLInputElement>(root, "#spass-password");
    pw.value = "wrong"; pw.dispatchEvent(new Event("input"));
    click(root, "[data-testid=convert]");
    await vi.waitFor(() => expect(root.querySelector("#password-error")).not.toBeNull(), { timeout: 10000 });
    const input = q<HTMLInputElement>(root, "#spass-password");
    expect(input.getAttribute("aria-describedby")).toBe("password-error");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("avatars never split an emoji", async () => {
    expect(initial("🔥 Fire")).toBe("🔥");
    expect(initial("👩‍💻 Dev")).toBe("👩‍💻");
    expect(initial("")).toBe("?");
    const root = setup();
    await unlock(root, await exportWith([["🔥 Fire Bank", "https://bank.example", "ada", "p", "", ""]]));
    click(root, "[data-testid=browse-logins]");
    expect(q(document.body, "[data-testid=login] .av").textContent).toBe("🔥");
  });
});

describe("360px layout guards (CSS)", () => {
  const css = readFileSync("web/src/ui/styles.css", "utf8");
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*()]/g, "\\$&")} \\{([^}]*)\\}`))?.[2] ?? "";
  it("tiles cannot grow past the screen", () => {
    expect(rule(".tiles")).toMatch(/repeat\(2, minmax\(0, 1fr\)\)/);
    expect(rule(".tile")).toMatch(/min-width: 0/);
  });
  it("long unbroken text wraps inside sheets and the vault; close button stays on screen", () => {
    expect(rule(".sheet")).toMatch(/overflow-wrap: anywhere/);
    expect(rule(".vault-main")).toMatch(/overflow-wrap: anywhere/);
    expect(rule(".sheet-head h2")).toMatch(/min-width: 0/);
    expect(rule(".x")).toMatch(/flex: none/);
  });
});

describe("favicon", () => {
  it("is the Ember brass mark, not the old green one", () => {
    const tpl = readFileSync("web/index.template.html", "utf8");
    const data = tpl.match(/rel="icon"[^>]*href="data:image\/png;base64,([^"]+)"/)![1];
    const bytes = Buffer.from(data, "base64");
    expect(bytes.readUInt32BE(16)).toBe(32);
    // Old icon embedded the Grove green palette (#5a6b41 …) in its PLTE chunk.
    expect(bytes.includes(Buffer.from([0x5a, 0x6b, 0x41]))).toBe(false);
  });
});
