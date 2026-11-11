// @vitest-environment jsdom
// 2.0.26: approved proposals A–F from the 2.0.25 audit. Fake data only.
import { webcrypto } from "node:crypto";
import { FORMATS, chromeAndroidLink, encryptSpass, loginGaps, loginsToCsv, parseSpassText, toVault, type Login } from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import { mount } from "../src/ui/app";
import { FORMAT_KEY } from "../src/ui/prefs";
import { TEST_PASSWORD } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const HEAD = "title;host_url;username_value;password_value;credential_memo;otp;app_name;package_name";
const row = (...cells: string[]) => cells.map((c) => (c ? b64(c) : "")).join(";");
const plain = (rows: string[]) => ["25", "true;true;true;true", "false", "next_table", HEAD, ...rows, ""].join("\n");
const HASH = "dGVzdC1jZXJ0LWhhc2gtZm9yLWFwcA"; // base64url, unpadded
const L = (over: Partial<Login>): Login => ({ id: "x", name: "T", url: "", username: "u", password: "p", note: "", otp: "", otpUri: "", needsSite: true, appLabel: "", ...over });

async function boot(rows: string[], format = "1password", leave = vi.fn()) {
  localStorage.setItem(FORMAT_KEY, format);
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById("app")!;
  const saves: { fileName: string; csv: string }[] = [];
  mount(root, { platform: { save: async (fileName, csv) => { saves.push({ fileName, csv }); return true; }, leave } });
  const input = root.querySelector<HTMLInputElement>("#spass-file")!;
  Object.defineProperty(input, "files", { value: [new File([await encryptSpass(plain(rows), TEST_PASSWORD)], "a.spass")], configurable: true });
  input.dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  const pw = root.querySelector<HTMLInputElement>("#spass-password")!;
  pw.value = TEST_PASSWORD;
  pw.dispatchEvent(new Event("input"));
  root.querySelector<HTMLButtonElement>("[data-testid=convert]")!.click();
  await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
  return { root, saves, leave };
}
const click = (root: Element, sel: string) => root.querySelector<HTMLElement>(sel)!.click();
const type = (root: Element, sel: string, value: string) => { const i = root.querySelector<HTMLInputElement>(sel)!; i.value = value; i.dispatchEvent(new Event("input")); };

describe("A: Google gets the export's Android app link when Chrome accepts it", () => {
  it("mirrors Chromium's Android facet URI rules and never converts or invents a hash", () => {
    expect(chromeAndroidLink(`android://${HASH}@com.example.app/`)).toBe(`android://${HASH}@com.example.app/`);
    expect(chromeAndroidLink(`android://${HASH}==@com.example.app`)).toBe(`android://${HASH}==@com.example.app/`);
    expect(chromeAndroidLink("android://ab-_9Z==@com.Example_app.v2/")).toBe("android://ab-_9Z==@com.Example_app.v2/");
    for (const bad of [
      "android://com.example.app", // no hash
      "android://ab+/cd==@com.example.app/", // standard base64 (+ /) is not accepted and not converted
      "android://abc=d@com.example.app/", // padding in the middle
      "android://a===@com.example.app/", // too much padding
      `android://${HASH}@com.example.app/login`, `android://${HASH}@com.example.app:443/`, `android://${HASH}@com.example.app/?x`,
      `android://${HASH}@com.exa-mple.app/`, `android://user:pw@com.example.app/`, "https://example.com/", ""
    ]) expect(chromeAndroidLink(bad), bad).toBe("");
  });
  it("an unmapped app login with a valid link imports into Google as an app login; other formats are unchanged", () => {
    const v = toVault(parseSpassText(plain([
      row("Bank", `android://${HASH}@com.unknown.bankapp/`, "jsmith", "pw", "", "", "Bank", "com.unknown.bankapp"),
      row("Old", "android://com.old.app", "o", "pw", "", "", "Old", "com.old.app"),
      row("Site", "https://site.example", "s", "pw", "", "", "Samsung Internet", "com.sec.android.app.sbrowser")
    ])));
    expect(v.logins.map((l) => l.appLink)).toEqual([`android://${HASH}@com.unknown.bankapp/`, undefined, undefined]);
    expect(v.logins[0].url).toBe("");
    expect(loginGaps(v.logins[0], "google")).toEqual([]);
    expect(loginGaps(v.logins[1], "google")).toEqual(["url"]);
    expect(loginGaps(v.logins[0], "apple")).toEqual(["url"]);
    const google = loginsToCsv(v.logins, [], "google").split("\r\n");
    expect(google[1]).toBe(`Bank,android://${HASH}@com.unknown.bankapp/,jsmith,pw,`);
    expect(google[2]).toBe("Old,no url,o,pw,");
    for (const f of ["1password", "apple", "bitwarden", "other"] as const) expect(loginsToCsv(v.logins, [], f)).not.toContain("android://");
  });
  it("a website typed in Edit still wins over the app link", async () => {
    const { root, saves } = await boot([row("Bank", `android://${HASH}@com.unknown.bankapp/`, "jsmith", "pw", "", "", "Bank", "com.unknown.bankapp")], "google");
    expect(root.querySelector("[data-testid=needs-look]")).toBeNull();
    click(root, "[data-testid=browse-logins]");
    click(root, "[data-testid=login]");
    type(root, "#edit-url", "bank.example");
    click(root, "[data-testid=edit-save]");
    click(document.body, "[data-testid=sheet-browse] .x");
    click(root, "[data-testid=save]");
    click(document.body, "[data-testid=confirm-save]");
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].csv).toContain("Bank,https://bank.example,jsmith,pw,");
  });
});

describe("B: Apple may skip logins without a website", () => {
  it("warning and import guide say so", async () => {
    const { root } = await boot([row("Bank", "", "jsmith", "pw", "", "", "", "")], "apple");
    click(root, "[data-testid=save]");
    expect(document.querySelector("[data-testid=sheet-needs-look]")!.textContent).toContain("Apple Passwords may skip a login without one");
    expect(FORMATS.find((f) => f.id === "apple")!.importSteps.join(" ")).toContain("may skip logins without a website");
  });
});

describe("C: Merge can show the two passwords", () => {
  it("Show reveals both (edge spaces visible), Hide masks them again", async () => {
    const { root } = await boot([row("A", "https://a.com", "u", "alpha-1", "", "", "", ""), row("A", "https://a.com", "u", " beta ", "", "", "", "")]);
    click(root, "[data-testid=merge-suggestions]");
    const values = () => [...document.querySelectorAll("[data-testid=merge-opt][data-field=password] .v")].map((e) => e.textContent);
    expect(values()).toEqual(["••••••", "••••••"]);
    const reveal = () => document.querySelector<HTMLButtonElement>("[data-testid=merge-reveal]")!;
    expect([reveal().getAttribute("aria-label"), reveal().getAttribute("aria-pressed")]).toEqual(["Show passwords", "false"]);
    reveal().click();
    expect(values()).toEqual(["alpha-1", "“ beta ”"]);
    expect([reveal().getAttribute("aria-label"), reveal().getAttribute("aria-pressed")]).toEqual(["Hide passwords", "true"]);
    reveal().click();
    expect(values()).toEqual(["••••••", "••••••"]);
  });
  it("a reopened merge starts hidden; Same in both is revealed too", async () => {
    const { root } = await boot([row("A", "https://a.com", "u", "same", "", "", "", ""), row("B", "https://a.com", "u", "same", "", "", "", "")]);
    click(root, "[data-testid=merge-suggestions]");
    click(document.body, "[data-testid=merge-reveal]");
    expect(document.querySelector(".mg-same .pw-shown")!.textContent).toBe("same");
    click(document.body, "[data-testid=merge-cancel]");
    click(root, "[data-testid=merge-suggestions]");
    expect(document.querySelector(".mg-same .dots")!.textContent).toBe("••••••");
  });
});

describe("D: Change file in the vault confirms first", () => {
  it("asks Leave and clear?, notes an unsaved CSV, and Change file goes home without leaving the app", async () => {
    const { root, leave } = await boot([row("A", "https://a.com", "u", "p", "", "", "", "")]);
    click(root, "[data-testid=change-file]");
    const sheet = document.querySelector("[data-testid=sheet-leave]")!;
    expect(sheet.textContent).toContain("Leave and clear?");
    expect(sheet.textContent).toContain("You haven't saved a CSV yet.");
    click(document.body, "[data-testid=leave]");
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
    expect(leave).not.toHaveBeenCalled();
  });
});

describe("E: deleting from Edit returns to the list it came from", () => {
  it("Browse comes back with the search kept; Undo restores the login into it", async () => {
    const { root } = await boot([row("Alpha", "https://alpha.example", "a", "p", "", "", "", ""), row("Alpine", "https://alpine.example", "b", "p", "", "", "", ""), row("Zed", "https://zed.example", "z", "p", "", "", "", "")]);
    click(root, "[data-testid=browse-logins]");
    type(document.body, "#browse-query", "alp");
    expect(document.querySelectorAll("[data-testid=login]")).toHaveLength(2);
    click(document.body, "[data-testid=login]");
    click(document.body, "[data-testid=edit-delete]");
    expect(document.querySelector("[data-testid=sheet-browse]")).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>("#browse-query")!.value).toBe("alp");
    expect(document.querySelectorAll("[data-testid=login]")).toHaveLength(1);
    click(document.body, "[data-testid=undo]");
    expect(document.querySelectorAll("[data-testid=login]")).toHaveLength(2);
  });
  it("Needs a look comes back to its list", async () => {
    const { root } = await boot([row("A", "", "u", "p", "", "", "", ""), row("B", "", "v", "p", "", "", "", "")]);
    click(root, "[data-testid=needs-look]");
    click(document.body, "[data-testid=needs-look-item]");
    click(document.body, "[data-testid=edit-delete]");
    expect(document.querySelectorAll("[data-testid=needs-look-item]")).toHaveLength(1);
  });
});

describe("F: blank usernames where the importer accepts them", () => {
  it("Google and Bitwarden save a blank username without a warning; 1Password and Apple still ask", async () => {
    for (const f of ["google", "bitwarden"]) {
      const { root, saves } = await boot([row("Pin site", "https://pin.example", "", "1234", "", "", "", "")], f);
      expect(root.querySelector("[data-testid=needs-look]")).toBeNull();
      click(root, "[data-testid=save]");
      click(document.body, "[data-testid=confirm-save]");
      await vi.waitFor(() => expect(saves).toHaveLength(1));
      expect(saves[0].csv).not.toContain("no username");
    }
    expect(loginGaps(L({ username: "", url: "https://x.example", needsSite: false }), "1password")).toEqual(["username"]);
    expect(loginGaps(L({ username: "", url: "https://x.example", needsSite: false }), "apple")).toEqual(["username"]);
    expect(loginsToCsv([L({ username: "", url: "https://x.example" })], [], "apple")).toContain("no username");
  });
});
