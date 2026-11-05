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
