// @vitest-environment jsdom
// 2.0.21 audit regressions. Fake data only.
import { webcrypto } from "node:crypto";
import { afterEach } from "vitest";
import { cell, encryptSpass, loginsToCsv, normalizeUserUrl, parseSpassText, toVault, type FormatId } from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import { mount } from "../src/ui/app";
import { detectPlatform, SAVE_RETURN_TIMEOUT_MS, SAVE_TIMEOUT_MS, type Platform } from "../src/ui/platform";
import { TEST_PASSWORD } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector<T>(sel)!;
const all = (root: Element, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const click = (root: Element, sel: string) => q<HTMLButtonElement>(root, sel).click();
const back = () => (globalThis as unknown as { spccBack: () => boolean }).spccBack();
const HEADER = "title;host_url;username_value;password_value;credential_memo;otp";
const plain = (rows: string[][]) => ["25", "true;true;true;true", "false", "next_table", HEADER, ...rows.map((r) => r.map((c) => (c ? b64(c) : "")).join(";")), ""].join("\n");
let visibility: DocumentVisibilityState = "visible";
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
const setVisibility = (v: DocumentVisibilityState) => { visibility = v; document.dispatchEvent(new Event("visibilitychange")); };

function setup(platform: Platform = { save: async () => true }) {
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById("app")!;
  mount(root, { platform });
  return root;
}
async function unlock(root: HTMLElement, rows: string[][]) {
  const input = q<HTMLInputElement>(root, "#spass-file");
  Object.defineProperty(input, "files", { value: [new File([await encryptSpass(plain(rows), TEST_PASSWORD)], "Pass_20261110.spass")], configurable: true });
  input.dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  const pw = q<HTMLInputElement>(root, "#spass-password");
  pw.value = TEST_PASSWORD;
  pw.dispatchEvent(new Event("input"));
  click(root, "[data-testid=convert]");
  await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
}
afterEach(() => { localStorage.clear(); visibility = "visible"; vi.useRealTimers(); delete (globalThis as { passBridge?: unknown }).passBridge; });

describe("passwords are exported exactly", () => {
  it("keeps leading/trailing spaces in passwords and quotes them in every format", () => {
    const vault = toVault(parseSpassText(plain([["Bank", "https://bank.example", "u", "  pass word ", "", ""]])));
    expect(vault.logins[0].password).toBe("  pass word ");
    for (const f of ["1password", "google", "apple", "bitwarden", "other"] as FormatId[]) {
      expect(loginsToCsv(vault.logins, vault.notes, f)).toContain(`"  pass word "`);
    }
  });
  it("still drops NUL sentinels and whitespace-only passwords as empty", () => {
    const vault = toVault(parseSpassText(plain([["A", "https://a.example", "u", "&&&NULL&&&", "", ""], ["B", "https://b.example", "u", "   ", "", ""]])));
    expect(vault.logins.map((l) => l.password)).toEqual(["", ""]);
  });
  it("quotes cells with edge whitespace; leaves plain cells alone", () => {
    expect(cell(" a", false)).toBe('" a"');
    expect(cell("a\t", false)).toBe('"a\t"');
    expect(cell("a b", false)).toBe("a b");
  });
});

describe("websites", () => {
  it("accepts internationalised, punycode and localhost hosts; rejects plain words", () => {
    expect(normalizeUserUrl("münchen.de")).toBe("https://münchen.de");
    expect(normalizeUserUrl("пример.рф/login")).toBe("https://пример.рф/login");
    expect(normalizeUserUrl("xn--e1afmkfd.xn--p1ai")).toBe("https://xn--e1afmkfd.xn--p1ai");
    expect(normalizeUserUrl("localhost:8080")).toBe("https://localhost:8080");
    expect(normalizeUserUrl("my bank")).toBe("");
    expect(normalizeUserUrl("bank")).toBe("");
  });
  it("edit sheet never silently erases a typed website it can't read", async () => {
    const root = setup();
    await unlock(root, [["Shop", "https://shop.example", "u@example.test", "p", "", ""], ["Mail", "https://mail.example", "m@example.test", "p", "", ""]]);
    click(root, "[data-testid=browse-logins]");
    all(root, "[data-testid=login]")[0].click();
    const url = q<HTMLInputElement>(root, "#edit-url");
    url.value = "not a website";
    url.dispatchEvent(new Event("input"));
    click(root, "[data-testid=edit-save]");
    expect(root.querySelector("[data-testid=sheet-edit]")).not.toBeNull();
    expect(q(root, "[data-testid=edit-url-error]").getAttribute("role")).toBe("alert");
    expect(q(root, "#edit-url").getAttribute("aria-invalid")).toBe("true");
    expect(q<HTMLInputElement>(root, "#edit-url").value).toBe("not a website");
    const fixed = q<HTMLInputElement>(root, "#edit-url");
    fixed.value = "münchen.de";
    fixed.dispatchEvent(new Event("input"));
    click(root, "[data-testid=edit-save]");
    expect(root.querySelector("[data-testid=sheet-edit]")).toBeNull();
    expect(root.querySelector("[data-testid=needs-look]")).toBeNull();
  });
});

describe("undo never leaves a stale Save confirm", () => {
  it("Other → Delete all → Undo closes the Save sheet; saving again includes the restored logins", async () => {
    localStorage.setItem("passtocsv.format", "other");
    const saved: string[] = [];
    const root = setup({ save: async (_n, csv) => { saved.push(csv); return true; } });
    await unlock(root, [["Shop", "https://shop.example", "u@example.test", "p1", "", ""], ["", "", "", "orphan", "", ""]]);
    click(root, "[data-testid=save]");
    click(root, "[data-testid=delete-all]");
    expect(root.querySelector("[data-testid=sheet-save]")).not.toBeNull();
    click(root, "[data-testid=undo]");
    expect(root.querySelector("[data-testid=sheet-save]")).toBeNull();
    click(root, "[data-testid=save]");
    click(root, "[data-testid=keep-blank]");
    click(root, "[data-testid=confirm-save]");
    await vi.waitFor(() => expect(saved.length).toBe(1));
    expect(saved[0]).toContain("orphan");
  });
});

describe("empty save", () => {
  it("Save CSV with no logins left shows a message and writes nothing", async () => {
    const save = vi.fn(async () => true);
    const root = setup({ save });
    await unlock(root, [["Shop", "https://shop.example", "u@example.test", "p1", "", ""]]);
    click(root, "[data-testid=browse-logins]");
    all(root, "[data-testid=login]")[0].click();
    click(root, "[data-testid=edit-delete]");
    click(document.body, "[data-testid=sheet-browse] .x");
    click(root, "[data-testid=save]");
    expect(root.querySelector(".sheet")).toBeNull();
    expect(q(root, "[data-testid=snackbar]").textContent).toBe("No logins to save.");
    expect(save).not.toHaveBeenCalled();
  });
});

describe("a11y: sheets are modal", () => {
  it("the page behind an open sheet is inert; closing restores it", async () => {
    const root = setup();
    await unlock(root, [["Shop", "https://shop.example", "u@example.test", "p1", "", ""]]);
    expect(q(root, ".app").hasAttribute("inert")).toBe(false);
    click(root, "[data-testid=destination-chip]");
    expect(q(root, ".app").hasAttribute("inert")).toBe(true);
    expect(q(root, ".sheet").closest("[inert]")).toBeNull();
    back();
    expect(q(root, ".app").hasAttribute("inert")).toBe(false);
  });
});

describe("file picker pending state", () => {
  it("a cancelled pick with no cancel/focus event doesn't swallow Back on the home screen forever", async () => {
    vi.useFakeTimers();
    const root = setup();
    q<HTMLInputElement>(root, "#spass-file").dispatchEvent(new Event("click"));
    expect(back()).toBe(true); // picker open: Back belongs to the picker
    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(2000);
    expect(back()).toBe(false);
  });
});

describe("android save bridge timing", () => {
  const bridge = () => {
    const b = { postMessage: vi.fn(), onmessage: null as ((e: { data: string }) => void) | null };
    (globalThis as { passBridge?: unknown }).passBridge = b;
    return b;
  };
  it("does not give up while the system Save picker hides the page", async () => {
    vi.useFakeTimers();
    const b = bridge();
    const p = detectPlatform().save("passwords.csv", "a");
    setVisibility("hidden");
    vi.advanceTimersByTime(SAVE_TIMEOUT_MS * 10);
    setVisibility("visible");
    b.onmessage?.({ data: JSON.stringify({ type: "saved", ok: true }) });
    await expect(p).resolves.toBe(true);
  });
  it("still settles false when no reply comes after the page is back", async () => {
    vi.useFakeTimers();
    bridge();
    const p = detectPlatform().save("passwords.csv", "a");
    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(SAVE_RETURN_TIMEOUT_MS);
    await expect(p).resolves.toBe(false);
  });
  it("an Android WebView without the bridge reports failure instead of a fake success", async () => {
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    await expect(detectPlatform().save("passwords.csv", "a")).resolves.toBe(true); // plain browser: download works
    const ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 Chrome/80.0 Mobile Safari/537.36");
    await expect(detectPlatform().save("passwords.csv", "a")).resolves.toBe(false);
    ua.mockRestore();
  });
});
