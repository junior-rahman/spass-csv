// @vitest-environment jsdom
// 2.0.20: (D) clear non-.spass / damaged-export error, (E) Back asks before leaving, (F) Dismiss merge suggestions. Fake data only.
import { webcrypto } from "node:crypto";
import { EMPTY_FILE, NOT_SPASS_CONTENT, NOT_SPASS_NAME, encryptSpass, samplePlaintext, spassShapeError } from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import { mount } from "../src/ui/app";
import type { Platform } from "../src/ui/platform";
import { TEST_PASSWORD, sampleSpass } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector<T>(sel)!;
const all = (root: Element, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const click = (root: Element, sel: string) => q<HTMLButtonElement>(root, sel).click();
const back = () => (globalThis as unknown as { spccBack: () => boolean }).spccBack();

function setup(platform: Platform = { save: async () => true }) {
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById("app")!;
  mount(root, { platform });
  return root;
}
function pick(root: HTMLElement, content: string, name: string) {
  const input = q<HTMLInputElement>(root, "#spass-file");
  Object.defineProperty(input, "files", { value: [new File([content], name)], configurable: true });
  input.dispatchEvent(new Event("change"));
}
async function unlock(root: HTMLElement, content: string) {
  pick(root, content, "Pass_20261110.spass");
  await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  const pw = q<HTMLInputElement>(root, "#spass-password");
  pw.value = TEST_PASSWORD;
  pw.dispatchEvent(new Event("input"));
  click(root, "[data-testid=convert]");
  await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
}
function exportWith(rows: string[][]): Promise<string> {
  const row = (cells: string[]) => cells.map((c) => (c ? b64(c) : "")).join(";");
  return encryptSpass(["25", "true;true;true;true", "false", "next_table", "title;host_url;username_value;password_value;credential_memo;otp", ...rows.map(row), ""].join("\n"), TEST_PASSWORD);
}
const twoGroups = () => exportWith([
  ["Amazon", "https://amazon.com", "shop@example.com", "a1", "", ""], ["Amazon 2", "https://www.amazon.com", "shop@example.com", "a2", "", ""],
  ["Netflix", "https://netflix.com", "n@example.com", "n1", "", ""], ["Netflix 2", "https://www.netflix.com", "n@example.com", "n2", "", ""]
]);

describe("(D) shape check", () => {
  it("accepts encrypted and plaintext exports; rejects images, text, truncated and empty files", async () => {
    expect(spassShapeError(await sampleSpass(), "a.spass")).toBeNull();
    expect(spassShapeError(samplePlaintext(), "a.spass")).toBeNull();
    expect(spassShapeError("\u00ff\u00d8\u00ff\u00e0JFIF", "photo.jpg")).toBe(NOT_SPASS_NAME);
    expect(spassShapeError("hello world", "notes.txt")).toBe(NOT_SPASS_NAME);
    expect(spassShapeError("hello world", "Pass.spass")).toBe(NOT_SPASS_CONTENT);
    const enc = await sampleSpass();
    expect(spassShapeError(enc.slice(0, 40), "Pass.spass")).toBe(NOT_SPASS_CONTENT);
    expect(spassShapeError("   \n", "Pass.spass")).toBe(EMPTY_FILE);
  });
});

describe("(D) picked file errors", () => {
  it("a non-.spass pick shows an inline caution on the file stage, then a good pick clears it", async () => {
    const root = setup();
    pick(root, "\u00ff\u00d8\u00ff\u00e0JFIF", "IMG_2041.jpg");
    await vi.waitFor(() => expect(root.querySelector("[data-testid=file-error]")).not.toBeNull());
    const alert = q(root, "[data-testid=file-error]");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toBe(NOT_SPASS_NAME);
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
    expect(root.querySelector("#spass-password")).toBeNull();
    pick(root, await sampleSpass(), "Pass_20261110.spass");
    await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
    expect(root.querySelector("[data-testid=file-error]")).toBeNull();
  });

  it("a .spass that isn't a valid export is rejected before asking for a password", async () => {
    const root = setup();
    pick(root, "this is not an export", "Pass_20261110.spass");
    await vi.waitFor(() => expect(q(root, "[data-testid=file-error]").textContent).toBe(NOT_SPASS_CONTENT));
    expect(root.querySelector("#spass-password")).toBeNull();
  });

  it("a real export with a mangled name (Android providers) still opens", async () => {
    const root = setup();
    pick(root, await sampleSpass(), "document");
    await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  });
});

describe("(E) Back asks before leaving the vault", () => {
  it("shows Leave and clear? with Stay primary; Stay keeps the vault, Leave wipes and hands Back to Android", async () => {
    const left: number[] = [];
    const root = setup({ save: async () => true, leave: () => left.push(1) });
    await unlock(root, await twoGroups());
    expect(back()).toBe(true);
    const sheet = q(document.body, "[data-testid=sheet-leave]");
    expect(sheet.textContent).toContain("Leave and clear?");
    expect(q(sheet, "[data-testid=stay]").className).toContain("cta");
    expect(q(sheet, "[data-testid=leave]").className).toContain("ghost");
    click(sheet, "[data-testid=stay]");
    expect(document.querySelector(".sheet")).toBeNull();
    expect(root.querySelector("[data-testid=vault]")).not.toBeNull();
    expect(back()).toBe(true);
    expect(back()).toBe(true); // Back again = Stay
    expect(document.querySelector(".sheet")).toBeNull();
    expect(root.querySelector("[data-testid=vault]")).not.toBeNull();
    expect(left).toEqual([]);
    back();
    click(document.body, "[data-testid=leave]");
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
    expect(left).toEqual([1]);
  });

  it("Change file in the vault asks Leave and clear? first (2.0.26); Stay keeps the vault", async () => {
    const root = setup();
    await unlock(root, await twoGroups());
    click(root, "[data-testid=change-file]");
    expect(document.querySelector("[data-testid=sheet-leave] h2")!.textContent).toBe("Leave and clear?");
    click(document.body, "[data-testid=stay]");
    expect(root.querySelector("[data-testid=vault]")).not.toBeNull();
    click(root, "[data-testid=change-file]");
    expect(document.querySelector("[data-testid=sheet-leave] [data-testid=leave]")!.textContent).toBe("Change file");
    click(document.body, "[data-testid=leave]");
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
  });
});

describe("(F) Dismiss merge suggestions", () => {
  it("list Dismiss hides one suggestion with Undo; the one-line row updates and hides when none are left", async () => {
    const root = setup();
    await unlock(root, await twoGroups());
    expect(q(root, "[data-testid=merge-count]").textContent).toBe("2 possible merges");
    click(root, "[data-testid=merge-suggestions]");
    expect(all(document.body, "[data-testid=merge-item]")).toHaveLength(2);
    all(document.body, "[data-testid=merge-dismiss]")[0].click();
    expect(q(document.body, "[data-testid=snackbar]").textContent).toContain("Dismissed amazon.com");
    expect(all(document.body, "[data-testid=merge-item]")).toHaveLength(1);
    expect(q(root, "[data-testid=merge-count]").textContent).toBe("Possible merge");
    click(document.body, "[data-testid=undo]");
    expect(q(root, "[data-testid=merge-count]").textContent).toBe("2 possible merges");
    all(document.body, "[data-testid=merge-dismiss]")[0].click();
    all(document.body, "[data-testid=merge-dismiss]")[0].click();
    expect(document.querySelector(".sheet")).toBeNull();
    expect(root.querySelector("[data-testid=merge-suggestions]")).toBeNull();
    // Dismiss never deletes logins.
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("4");
  });

  it("merge preview Dismiss hides that suggestion; Undo brings it back; a new session forgets dismissals", async () => {
    const root = setup();
    await unlock(root, await exportWith([["Amazon", "https://amazon.com", "shop@example.com", "a1", "", ""], ["Amazon 2", "https://www.amazon.com", "shop@example.com", "a2", "", ""]]));
    click(root, "[data-testid=merge-suggestions]");
    expect(document.querySelector("[data-testid=sheet-merge]")).not.toBeNull();
    click(document.body, "[data-testid=sheet-merge] [data-testid=merge-dismiss]");
    expect(document.querySelector(".sheet")).toBeNull();
    expect(root.querySelector("[data-testid=merge-suggestions]")).toBeNull();
    click(document.body, "[data-testid=undo]");
    expect(root.querySelector("[data-testid=merge-suggestions]")).not.toBeNull();
    click(root, "[data-testid=merge-suggestions]");
    click(document.body, "[data-testid=sheet-merge] [data-testid=merge-dismiss]");
    click(root, "[data-testid=change-file]");
    click(document.body, "[data-testid=leave]");
    await unlock(root, await exportWith([["Amazon", "https://amazon.com", "shop@example.com", "a1", "", ""], ["Amazon 2", "https://www.amazon.com", "shop@example.com", "a2", "", ""]]));
    expect(root.querySelector("[data-testid=merge-suggestions]")).not.toBeNull();
  });
});
