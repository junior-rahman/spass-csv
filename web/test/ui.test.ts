// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { isSpassFileName, mount } from "../src/ui/app";
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

async function choose(root: HTMLElement, password: string, fileName = "export.spass") {
  const file = new File([await sampleSpass()], fileName, { type: "application/octet-stream" });
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

  it("file input accepts only .spass and rejects other extensions", async () => {
    const { root } = setup();
    const input = q<HTMLInputElement>(root, "#spass-file");
    expect(input.getAttribute("accept")).toBe(".spass");
    const bad = new File(["nope"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [bad], configurable: true });
    input.dispatchEvent(new Event("change"));
    expect(root.querySelector("[data-testid=filename]")).toBeNull();
    expect(q(root, ".error").textContent).toMatch(/\.spass/);
    expect(isSpassFileName("export.spass")).toBe(true);
    expect(isSpassFileName("export.csv")).toBe(false);
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

  it("after unlock collapses setup into a summary and results pane", async () => {
    const { root } = setup();
    await unlock(root);
    expect(root.querySelector("[data-testid=unlocked-summary]")).not.toBeNull();
    expect(root.querySelector("[data-testid=results]")).not.toBeNull();
    expect(root.querySelector("[data-testid=pane]")).not.toBeNull();
    expect(root.querySelector("#spass-password")).toBeNull();
    expect(root.querySelector("#spass-file")).toBeNull();
    expect(root.querySelector("[data-testid=convert]")).toBeNull();
    expect(root.querySelector(".app")).not.toBeNull();
    expect(root.querySelectorAll(".card.results").length).toBe(1);
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
    expect(saves[0].csv.startsWith("Title,")).toBe(false);
    expect(root.querySelector(".reminder")).not.toBeNull();
  });

  it("Google save warns about incomplete rows before placeholders", async () => {
    const { root, saves } = setup();
    await unlock(root);
    q<HTMLButtonElement>(root, "[data-format=google]").click();
    q<HTMLButtonElement>(root, "[data-testid=save]").click();
    expect(root.querySelector("[data-testid=sheet-incomplete]")).not.toBeNull();
    expect(saves).toHaveLength(0);
    q<HTMLButtonElement>(root, "[data-testid=incomplete-keep]").click();
    expect(root.querySelector("[data-testid=sheet-save]")).not.toBeNull();
    q<HTMLButtonElement>(root, "[data-testid=confirm-save]").click();
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("samsung-pass-google.csv");
    expect(saves[0].csv).toContain("no url");
  });

  it("incomplete delete drops those rows then saves", async () => {
    const { root, saves } = setup();
    await unlock(root);
    const before = root.querySelectorAll("[data-testid=login]").length;
    q<HTMLButtonElement>(root, "[data-format=google]").click();
    q<HTMLButtonElement>(root, "[data-testid=save]").click();
    q<HTMLButtonElement>(root, "[data-testid=incomplete-delete]").click();
    expect(root.querySelectorAll("[data-testid=login]").length).toBeLessThan(before);
    q<HTMLButtonElement>(root, "[data-testid=confirm-save]").click();
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].csv).not.toContain("no url");
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

describe("brand lockup", () => {
  it("renders the P2 Soft overlap lockup with the P-ring mark", () => {
    const { root } = setup();
    const lockup = q(root, ".appbar [data-testid=lockup]");
    const mark = q(lockup, "[data-mark=p-ring]");
    expect(mark.getAttribute("aria-label")).toBe("Spcc logo");
    const img = mark.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(mark.querySelector("svg")).toBeNull();
    expect(q(lockup, ".lockup-title").textContent).toBe("Spcc");
    expect(q(lockup, ".lockup-sub").textContent).toBe("Spass to CSV Converter");
    expect(root.querySelector('.appbar [data-icon="lock"]')).toBeNull();
  });
  it("renders the trust banner", () => {
    const { root } = setup();
    expect(q(root, "[data-testid=trust]").textContent).toContain("nothing uploaded");
  });
});
