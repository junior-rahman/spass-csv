// @vitest-environment jsdom
// 2.0.22 audit regressions. Fake data only.
import { webcrypto } from "node:crypto";
import { FORMATS, WRONG_PASSWORD, encryptSpass, loginsToCsv } from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import { mount } from "../src/ui/app";
import { TEST_PASSWORD } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector<T>(sel)!;
const NOTE = 'Recovery codes:\n1111-2222\n\n  3333-4444 "x", y';

async function unlockedWithNote() {
  const saved: string[] = [];
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById("app")!;
  mount(root, { platform: { save: async (_n, csv) => { saved.push(csv); return true; } } });
  const plain = ["25", "true;true;true;true", "false", "next_table", "title;host_url;username_value;password_value;credential_memo;otp",
    [b64("Mail"), b64("https://mail.example"), b64("ada@example.test"), b64("pw"), b64(NOTE), ""].join(";"), ""].join("\n");
  const input = q<HTMLInputElement>(root, "#spass-file");
  Object.defineProperty(input, "files", { value: [new File([await encryptSpass(plain, TEST_PASSWORD)], "Pass.spass")], configurable: true });
  input.dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  const pw = q<HTMLInputElement>(root, "#spass-password");
  pw.value = TEST_PASSWORD;
  pw.dispatchEvent(new Event("input"));
  q<HTMLButtonElement>(root, "[data-testid=convert]").click();
  await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
  return { root, saved };
}

describe("Edit keeps multi-line notes", () => {
  it("Notes is a multi-line field and Save changes keeps every line break", async () => {
    const { root, saved } = await unlockedWithNote();
    q<HTMLButtonElement>(root, "[data-testid=browse-logins]").click();
    q<HTMLButtonElement>(root, "[data-testid=login]").click();
    const notes = q<HTMLTextAreaElement>(root, "#edit-notes");
    expect(notes.tagName).toBe("TEXTAREA");
    expect(notes.value).toBe(NOTE);
    const user = q<HTMLInputElement>(root, "#edit-username");
    user.value = "ada2@example.test";
    user.dispatchEvent(new Event("input"));
    q<HTMLButtonElement>(root, "[data-testid=edit-save]").click();
    q<HTMLButtonElement>(root, ".sheet [aria-label=Close]").click();
    q<HTMLButtonElement>(root, "[data-testid=save]").click();
    q<HTMLButtonElement>(root, "[data-testid=confirm-save]").click();
    await vi.waitFor(() => expect(saved.length).toBe(1));
    expect(saved[0]).toContain(`"${NOTE.replace(/"/g, '""')}"`);
  });
});

describe("import steps match the importers (Nov 2026)", () => {
  const steps = (id: string) => FORMATS.find((f) => f.id === id)!.importSteps.join(" ");
  it("Apple: iPhone imports from Settings → Apps → Safari → Import; Mac from Passwords → File", () => {
    expect(steps("apple")).toMatch(/Settings → Apps → Safari/);
    expect(steps("apple")).toMatch(/Passwords → File → Import Passwords/);
    expect(steps("apple")).not.toMatch(/Apps → Passwords/);
  });
  it("1Password: name menu → Import data → CSV File", () => {
    expect(steps("1password")).toMatch(/Import data → CSV File/);
  });
  it("one spelling of plain text in user copy", () => {
    const copy = FORMATS.map((f) => [f.hint, ...f.importSteps].join(" ")).join(" ") + WRONG_PASSWORD;
    expect(copy).not.toMatch(/plaintext/);
    expect(WRONG_PASSWORD).toMatch(/when exporting/);
  });
  it("exporters unaffected by copy changes", () => {
    expect(loginsToCsv([], [], "google")).toBe("name,url,username,password,note\r\n");
  });
});
