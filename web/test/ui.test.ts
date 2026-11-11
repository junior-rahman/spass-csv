// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { encryptSpass } from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
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
const all = (root: Element, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const click = (root: Element, sel: string) => q<HTMLButtonElement>(root, sel).click();
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));

/** Synthetic export matching the Night Grove mock: duplicates and gaps. Fake data only. */
function groveExport(): Promise<string> {
  const row = (...cells: string[]) => cells.map((c) => (c ? b64(c) : "")).join(";");
  const plain = [
    "25", "true;true;true;true", "false", "next_table",
    "title;host_url;username_value;password_value;credential_memo;otp",
    row("Bank login", "com.unknown.bankapp", "jsmith", "bank-pass", "", ""),
    row("amazon.com", "https://www.amazon.com", "", "old-pass", "old note", ""),
    row("", "", "", "lost-pass", "", ""),
    row("Netflix", "https://netflix.com", "n@example.com", "nf", "", ""),
    row("GitHub", "https://github.com", "junior", "gh", "", ""),
    row("Amazon", "https://amazon.com", "shop@example.com", "new-pass", "", ""),
    row("Amazon shopping", "https://www.amazon.com", "shop@example.com", "older-pass", "", ""),
    ""
  ].join("\n");
  return encryptSpass(plain, TEST_PASSWORD);
}

async function choose(root: HTMLElement, password: string, fileName = "export.spass", content?: string) {
  const file = new File([content ?? await sampleSpass()], fileName, { type: "application/octet-stream" });
  const input = q<HTMLInputElement>(root, "#spass-file");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  const pw = q<HTMLInputElement>(root, "#spass-password");
  pw.value = password;
  pw.dispatchEvent(new Event("input"));
}

async function unlock(root: HTMLElement, content?: string) {
  await choose(root, TEST_PASSWORD, "Pass_20261105.spass", content);
  click(root, "[data-testid=convert]");
  await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
}

function expectNoBannedChrome(root: HTMLElement) {
  for (const sel of ["[data-testid=trust]", "[data-testid=rail]", ".rail", "[data-testid=clear]", "input[type=search]", "[data-testid=incomplete-keep]", ".appbar"]) {
    expect(root.querySelector(sel)).toBeNull();
  }
  expect(document.body.textContent).not.toMatch(/Keep with placeholders|nothing uploaded|Stays on this phone/);
}

beforeEach(() => localStorage.clear());

describe("staged flow", () => {
  it("home shows only the jewel, lockup and Choose .spass file", () => {
    const { root } = setup();
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
    expect(q(root, "[data-testid=choose-file]").textContent).toContain("Choose .spass file");
    expect(q(root, ".lockup-title").textContent).toBe("Spcc");
    expect(q(root, ".lockup-sub").textContent).toBe("Spass to CSV Converter");
    expect(q(root, "[data-testid=rings] [data-mark=p-ring] img").getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(root.textContent).toContain("Samsung Pass export");
    expect(root.querySelector("#spass-password")).toBeNull();
    expect(root.querySelector("[data-format]")).toBeNull();
    expect(root.querySelector("[data-testid=save]")).toBeNull();
    expect(root.querySelector("[data-testid=convert]")).toBeNull();
    expectNoBannedChrome(root);
  });

  it("file input accepts only .spass and rejects other extensions", async () => {
    const { root } = setup();
    const input = q<HTMLInputElement>(root, "#spass-file");
    expect(input.getAttribute("accept")).toBe(".spass");
    Object.defineProperty(input, "files", { value: [new File(["nope"], "notes.txt")], configurable: true });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(root.querySelector("[data-testid=file-error]")).not.toBeNull());
    expect(root.querySelector("#spass-password")).toBeNull();
    expect(q(root, ".error").textContent).toMatch(/\.spass/);
    expect(isSpassFileName("export.spass")).toBe(true);
    expect(isSpassFileName("export.csv")).toBe(false);
  });

  it("password stage: file well, export-password helper, Unlock disabled until typed, no destination yet", async () => {
    const { root } = setup();
    await choose(root, "");
    expect(root.querySelector("[data-testid=stage-password]")).not.toBeNull();
    expect(q(root, "[data-testid=filename]").textContent).toBe("export.spass");
    expect(root.textContent).toContain("Enter password");
    expect(root.textContent).toContain("not your Samsung account password");
    expect(q(root, "[data-testid=convert]").textContent).toBe("Unlock");
    expect(q<HTMLButtonElement>(root, "[data-testid=convert]").disabled).toBe(true);
    expect(root.querySelector("[data-format]")).toBeNull();
    expect(root.querySelector("[data-testid=save]")).toBeNull();
    const pw = q<HTMLInputElement>(root, "#spass-password");
    expect(pw.type).toBe("password");
    pw.value = "x";
    pw.dispatchEvent(new Event("input"));
    expect(q<HTMLButtonElement>(root, "[data-testid=convert]").disabled).toBe(false);
    expectNoBannedChrome(root);
  });

  it("password stage Change file goes back to home", async () => {
    const { root } = setup();
    await choose(root, "abc");
    click(root, "[data-testid=change-file]");
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
  });

  it("shows a password error for a wrong password", async () => {
    const { root } = setup();
    await choose(root, "nope");
    click(root, "[data-testid=convert]");
    await vi.waitFor(() => expect(q(root, ".error").textContent).toMatch(/not your Samsung account password/));
    expect(root.querySelector("[data-testid=stage-password]")).not.toBeNull();
  });

  it("shows the ring unlocking stage then lands on the vault (not a destination page)", async () => {
    const { root } = setup();
    await choose(root, TEST_PASSWORD);
    click(root, "[data-testid=convert]");
    expect(root.querySelector("[data-testid=unlocking]")).not.toBeNull();
    expect(root.querySelector("[data-testid=unlocking] .arc")).not.toBeNull();
    expect(root.textContent).toContain("Unlocking…");
    await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
    expect(root.querySelector("#spass-password")).toBeNull();
    expect(root.querySelector("#spass-file")).toBeNull();
    expect(root.querySelector("[data-format]")).toBeNull();
    expect(q(root, "[data-testid=destination-chip]").textContent).toContain("Save for 1Password");
    expect(all(root, "[data-testid=save]")).toHaveLength(1);
    expect(q(root, "[data-testid=save]").textContent).toBe("Save CSV");
    expectNoBannedChrome(root);
  });

  it("vault Change file wipes back to choose file", async () => {
    const { root } = setup();
    await unlock(root);
    click(root, "[data-testid=change-file]");
    click(document.body, "[data-testid=leave]");
    expect(root.querySelector("[data-testid=stage-home]")).not.toBeNull();
    expect(root.querySelector("[data-testid=vault]")).toBeNull();
  });

  it("wipes the vault when the page is hidden", async () => {
    const { root } = setup();
    await unlock(root);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(root.querySelector("[data-testid=vault]")).toBeNull();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("About keeps privacy facts in a sheet", () => {
    const { root } = setup();
    click(root, "[data-testid=about]");
    expect(document.querySelector("[data-testid=sheet-about]")!.textContent).toMatch(/Nothing is uploaded.*Play In-App Updates/s);
  });
});

describe("destination chip + sheet", () => {
  it("opens 2×2 named tiles plus Other, selected tile jeweled; picking updates chip and storage", async () => {
    const { root } = setup();
    await unlock(root);
    click(root, "[data-testid=destination-chip]");
    const sheet = q(document.body, "[data-testid=sheet-destination]");
    expect(all(sheet, ".ng-tile").map((t) => t.dataset.format)).toEqual(["1password", "google", "apple", "bitwarden"]);
    expect(sheet.querySelector(".ng-other[data-format=other]")!.textContent).toContain("passwords.csv");
    expect(q(sheet, ".ng-tile.sel").dataset.format).toBe("1password");
    expect(q(sheet, ".ng-tile.sel .ring-field")).not.toBeNull();
    expect(q(sheet, "[data-testid=counts]").textContent).toMatch(/3Logins.*1Card.*1Address.*1Note.*1Incomplete/);
    expect(sheet.querySelector("input")).toBeNull();
    click(sheet, "[data-format=google]");
    expect(document.querySelector("[data-testid=sheet-destination]")).toBeNull();
    expect(q(root, "[data-testid=destination-chip]").textContent).toContain("Google Password Manager");
    expect(localStorage.getItem(FORMAT_KEY)).toBe("google");
  });

  it("restores the last-used format", async () => {
    localStorage.setItem(FORMAT_KEY, "apple");
    const { root } = setup();
    await unlock(root);
    expect(q(root, "[data-testid=destination-chip]").textContent).toContain("Apple Passwords");
  });
});

describe("organize vault", () => {
  it("shows an overview, Needs a look as one tap, one merge line, and no login dump", async () => {
    const { root } = setup();
    await unlock(root, await groveExport());
    expect(q(root, "[data-testid=needs-look-count]").textContent).toBe("Needs a look · 3");
    expect(root.querySelector("[data-testid=needs-look-item]")).toBeNull();
    expect(all(root, "[data-testid=merge-suggestions]")).toHaveLength(1);
    expect(q(root, "[data-testid=merge-suggestions]").textContent).toMatch(/^Possible merge\s*amazon\.com$/);
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("4");
    expect(q(root, "[data-testid=places-count]").textContent).toBe("across 3 places");
    expect(root.querySelector("[data-testid=login]")).toBeNull();
    click(root, "[data-testid=needs-look]");
    const items = all(document.body, "[data-testid=needs-look-item]").map((r) => r.textContent);
    expect(items[0]).toMatch(/Bank login.*jsmith.*No website/);
    expect(items[1]).toMatch(/amazon\.com.*No username/);
    expect(items[2]).toMatch(/Untitled login.*No title/);
  });

  it("browse lists ready logins grouped by place and search filters them", async () => {
    const { root } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=browse-logins]");
    const sheet = q(document.body, "[data-testid=sheet-browse]");
    expect(all(sheet, "[data-testid=login]").map((r) => r.querySelector("b")!.textContent)).toEqual(["Amazon", "Amazon shopping", "GitHub", "Netflix"]);
    const find = q<HTMLInputElement>(sheet, "[data-testid=browse-query]");
    find.value = "git";
    find.dispatchEvent(new Event("input"));
    expect(all(document.body, "[data-testid=sheet-browse] [data-testid=login]").map((r) => r.querySelector("b")!.textContent)).toEqual(["GitHub"]);
    click(document.body, "[data-testid=login]");
    expect(q(document.body, "[data-testid=sheet-edit]").querySelector("h2")!.textContent).toBe("GitHub");
  });

  it("sample export folds cards, notes and addresses into tiles that save their CSVs", async () => {
    const { root, saves } = setup();
    await unlock(root);
    expect(q(root, "[data-testid=tile-cards]").textContent).toMatch(/1 Card.*Sample Visa ••4242/);
    expect(q(root, "[data-testid=tile-notes]").textContent).toContain("1 Note");
    expect(q(root, "[data-testid=tile-addresses]").textContent).toContain("1 Address");
    click(root, "[data-testid=tile-addresses]");
    const extras = q(document.body, "[data-testid=sheet-extras]");
    expect(extras.textContent).toContain("Ada Example");
    expect(extras.textContent).toContain("1 Sample Street");
    expect(extras.textContent).toContain("Sample City, NY 10001");
    expect(extras.textContent).not.toMatch(/passwords in plain text/i);
    click(extras, "[data-testid=confirm-save]");
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("samsung-pass-addresses.csv");
  });

  it("Bitwarden keeps notes in the main file (no separate notes CSV), but you can still open and delete them", async () => {
    localStorage.setItem(FORMAT_KEY, "bitwarden");
    const { root } = setup();
    await unlock(root);
    expect(q(root, "[data-testid=tile-notes]").textContent).toContain("In Bitwarden file");
    click(root, "[data-testid=tile-notes]");
    const extras = q(document.body, "[data-testid=sheet-extras]");
    expect(extras.textContent).toContain("Router note");
    expect(extras.querySelector("[data-testid=confirm-save]")).toBeNull();
  });

  it("lets you delete an address, card, or note with undo", async () => {
    const { root } = setup();
    await unlock(root);
    click(root, "[data-testid=tile-addresses]");
    click(document.body, "[data-testid=extra-delete]");
    expect(q(document.body, "[data-testid=snackbar]").textContent).toContain("Deleted Ada Example");
    expect(root.querySelector("[data-testid=tile-addresses]")).toBeNull();
    expect(document.querySelector("[data-testid=sheet-extras]")).toBeNull();
    click(document.body, "[data-testid=undo]");
    expect(q(root, "[data-testid=tile-addresses]").textContent).toContain("1 Address");

    click(root, "[data-testid=tile-cards]");
    click(document.body, "[data-testid=extra-delete]");
    expect(q(document.body, "[data-testid=snackbar]").textContent).toContain("Deleted Sample Visa");
    expect(root.querySelector("[data-testid=tile-cards]")).toBeNull();
    click(document.body, "[data-testid=undo]");
    expect(q(root, "[data-testid=tile-cards]")).not.toBeNull();

    click(root, "[data-testid=tile-notes]");
    click(document.body, "[data-testid=extra-delete]");
    expect(q(document.body, "[data-testid=snackbar]").textContent).toContain("Deleted Router note");
    expect(root.querySelector("[data-testid=tile-notes]")).toBeNull();
  });

  it("edit sheet: website focused for the gap, Save changes fixes it and the count drops", async () => {
    const { root } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=needs-look]");
    click(document.body, "[data-testid=needs-look-item]");
    const sheet = q(document.body, "[data-testid=sheet-edit]");
    expect(sheet.querySelector("h2")!.textContent).toBe("Bank login");
    expect(document.activeElement?.id).toBe("edit-url");
    expect(sheet.textContent).toContain("Add a website so 1Password can match this login.");
    expect(q<HTMLInputElement>(sheet, "#edit-username").value).toBe("jsmith");
    expect(q<HTMLInputElement>(sheet, "#edit-password").type).toBe("password");
    expect(sheet.textContent).not.toMatch(/placeholder/i);
    const url = q<HTMLInputElement>(sheet, "#edit-url");
    url.value = "bank.example.com";
    url.dispatchEvent(new Event("input"));
    click(sheet, "[data-testid=edit-save]");
    expect(document.querySelector("[data-testid=sheet-edit]")).toBeNull();
    expect(q(root, "[data-testid=needs-look-count]").textContent).toBe("Needs a look · 2");
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("5");
  });

  it("delete is immediate with an Undo snackbar", async () => {
    const { root } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=needs-look]");
    click(document.body, "[data-testid=needs-look-item]");
    click(document.body, "[data-testid=edit-delete]");
    expect(q(document.body, "[data-testid=snackbar]").textContent).toContain("Deleted Bank login");
    expect(q(root, "[data-testid=needs-look-count]").textContent).toBe("Needs a look · 2");
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("4");
    click(document.body, "[data-testid=undo]");
    expect(q(root, "[data-testid=needs-look-count]").textContent).toBe("Needs a look · 3");
    click(root, "[data-testid=needs-look]");
    expect(all(document.body, "[data-testid=needs-look-item]")[0].textContent).toContain("Bank login");
  });

  it("merge sheet uses real values, lets you pick per field, and leaves one login", async () => {
    const { root } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=merge-suggestions]");
    expect(document.querySelector("[data-testid=sheet-merges]")).toBeNull();
    const sheet = q(document.body, "[data-testid=sheet-merge]");
    expect(sheet.querySelector("h2")!.textContent).toBe("Merge amazon.com");
    expect(sheet.textContent).toContain("One login will be saved. The other will be removed.");
    expect(sheet.textContent).toContain("Same in both");
    expect(q(sheet, ".mg-ring.a").textContent).toContain("Amazon");
    expect(q(sheet, ".mg-ring.b").textContent).toContain("Amazon shopping");
    expect(all(sheet, "[data-testid=merge-opt][data-field=username]")).toHaveLength(0);
    expect(sheet.textContent).not.toContain("No username");
    click(sheet, "[data-field=password][data-side=b]");
    click(sheet, "[data-field=name][data-side=b]");
    click(document.body, "[data-testid=merge-confirm]");
    expect(document.querySelector("[data-testid=sheet-merge]")).toBeNull();
    expect(root.querySelector("[data-testid=merge-suggestions]")).toBeNull();
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("3");
    expect(q(document.body, "[data-testid=snackbar]").textContent).toContain("Merged");
    expect(q(root, "[data-testid=needs-look-count]").textContent).toBe("Needs a look · 3");
    click(root, "[data-testid=browse-logins]");
    expect(all(document.body, "[data-testid=sheet-browse] [data-testid=login]").filter((r) => /amazon/i.test(r.textContent!))).toHaveLength(1);
  });

  it("does not suggest merging different websites that share a username", async () => {
    const row = (...cells: string[]) => cells.map((c) => (c ? b64(c) : "")).join(";");
    const plain = [
      "25", "true;true;true;true", "false", "next_table",
      "title;host_url;username_value;password_value;credential_memo;otp",
      row("Gmail", "https://mail.google.com", "me@gmail.com", "p1", "", ""),
      row("Photos", "https://photos.google.com", "me@gmail.com", "p2", "", ""),
      ""
    ].join("\n");
    const { root } = setup();
    await unlock(root, await encryptSpass(plain, TEST_PASSWORD));
    expect(root.querySelector("[data-testid=merge-suggestions]")).toBeNull();
  });

  it("collapses several merge suggestions into one line that opens a list, with undo", async () => {
    const row = (...cells: string[]) => cells.map((c) => (c ? b64(c) : "")).join(";");
    const plain = [
      "25", "true;true;true;true", "false", "next_table",
      "title;host_url;username_value;password_value;credential_memo;otp",
      row("Amazon", "https://amazon.com", "shop@example.com", "a1", "", ""),
      row("Amazon shopping", "https://www.amazon.com", "shop@example.com", "a2", "", ""),
      row("Netflix", "https://netflix.com", "n@example.com", "n1", "", ""),
      row("Netflix app", "com.netflix.mediaclient", "n@example.com", "n2", "", ""),
      row("GitHub", "https://github.com", "ada", "g1", "", ""),
      ""
    ].join("\n");
    const { root } = setup();
    await unlock(root, await encryptSpass(plain, TEST_PASSWORD));
    const line = all(root, "[data-testid=merge-suggestions]");
    expect(line).toHaveLength(1);
    expect(q(line[0], "[data-testid=merge-count]").textContent).toBe("2 possible merges");
    expect(line[0].textContent).toContain("amazon.com, netflix.com");
    expect(line[0].getAttribute("aria-label")).toBe("2 possible merges");
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("5");

    click(root, "[data-testid=merge-suggestions]");
    const list = q(document.body, "[data-testid=sheet-merges]");
    expect(list.querySelector("h2")!.textContent).toBe("Possible merges · 2");
    const items = all(list, "[data-testid=merge-item]");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringMatching(/amazon\.com.*2 logins · Amazon · Amazon shopping.*Merge/),
      expect.stringMatching(/netflix\.com.*2 logins.*Merge/)
    ]);

    items[0].click();
    expect(q(document.body, "[data-testid=sheet-merge] h2").textContent).toBe("Merge amazon.com");
    expect(q(document.body, "[data-testid=merge-cancel]").textContent).toBe("Back");
    click(document.body, "[data-testid=merge-cancel]");
    expect(all(document.body, "[data-testid=sheet-merges] [data-testid=merge-item]")).toHaveLength(2);

    all(document.body, "[data-testid=merge-item]")[0].click();
    click(document.body, "[data-testid=merge-confirm]");
    // Back on the list with one left; the overview line says so.
    expect(all(document.body, "[data-testid=sheet-merges] [data-testid=merge-item]")).toHaveLength(1);
    expect(q(root, "[data-testid=merge-count]").textContent).toBe("Possible merge");
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("4");

    click(document.body, "[data-testid=merge-item]");
    click(document.body, "[data-testid=merge-confirm]");
    expect(document.querySelector("[data-testid=sheet-merges]")).toBeNull();
    expect(document.querySelector("[data-testid=sheet-merge]")).toBeNull();
    expect(root.querySelector("[data-testid=merge-suggestions]")).toBeNull();
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("3");

    click(document.body, "[data-testid=undo]");
    expect(q(root, "[data-testid=merge-count]").textContent).toBe("Possible merge");
    expect(q(root, "[data-testid=logins-count]").textContent).toBe("4");
  });

  it("keeps the merge line to one compact, ellipsized row", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("web/src/ui/styles.css", "utf8");
    const rule = (sel: string) => css.match(new RegExp(`${sel.replace(/[.*]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
    expect(rule(".merge-row")).toMatch(/height: 52px/);
    expect(rule(".merge-row .t")).toMatch(/white-space: nowrap/);
    expect(rule(".merge-row .t")).toMatch(/min-width: 0/);
    expect(rule(".merge-row .t span")).toMatch(/text-overflow: ellipsis/);
    expect(css).not.toContain("merge-banner");
  });

});

describe("Save CSV", () => {
  it("website-only gaps warn, offer Save anyway, and confirm before writing (1Password blank website)", async () => {
    const { root, saves } = setup();
    await unlock(root);
    click(root, "[data-testid=save]");
    expect(q(document.body, "[data-testid=sheet-needs-look]").textContent).toContain("no website");
    expect(saves).toHaveLength(0);
    click(document.body, "[data-testid=save-anyway]");
    expect(saves).toHaveLength(0);
    click(document.body, "[data-testid=confirm-save]");
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("samsung-pass-1password.csv");
    expect(saves[0].csv.startsWith("Title,")).toBe(false);
    expect(saves[0].csv).not.toMatch(/no url|no title|no username/);
    await vi.waitFor(() => expect(document.querySelector("[data-testid=sheet-import-guide]")).not.toBeNull());
    const guide = q(document.body, "[data-testid=sheet-import-guide]");
    expect(guide.textContent).toContain("Import into 1Password");
    expect(guide.textContent).toContain("Title, Website, Username, Password, Notes");
    click(document.body, "[data-testid=guide-done]");
    expect(root.querySelector(".reminder")).not.toBeNull();
  });

  it("Google keeps its no url for missing websites", async () => {
    localStorage.setItem(FORMAT_KEY, "google");
    const { root, saves } = setup();
    await unlock(root);
    click(root, "[data-testid=save]");
    click(document.body, "[data-testid=save-anyway]");
    click(document.body, "[data-testid=confirm-save]");
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("samsung-pass-google.csv");
    expect(saves[0].csv).toContain("no url");
  });

  it("title/username gaps block Save (no Save anyway, no placeholders); Review opens edit", async () => {
    const { root, saves } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=save]");
    const sheet = q(document.body, "[data-testid=sheet-needs-look]");
    expect(sheet.textContent).toContain("3 logins need a look");
    expect(sheet.querySelector("[data-testid=save-anyway]")).toBeNull();
    click(sheet, "[data-testid=review]");
    expect(document.querySelector("[data-testid=sheet-edit]")).not.toBeNull();
    expect(saves).toHaveLength(0);
  });

  it("Other writes a headered generic passwords.csv with generic import steps", async () => {
    localStorage.setItem(FORMAT_KEY, "other");
    const { root, saves } = setup();
    await unlock(root);
    click(root, "[data-testid=needs-look]");
    click(document.body, "[data-testid=needs-look-item]");
    click(document.body, "[data-testid=edit-delete]");
    click(root, "[data-testid=save]");
    click(document.body, "[data-testid=confirm-save]");
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("passwords.csv");
    expect(saves[0].csv.replace(/^\uFEFF/, "").split("\r\n")[0]).toBe("Title,Website,Username,Password,Notes");
    expect(saves[0].csv).not.toContain("JBSWY3DPEHPK3PXP");
    await vi.waitFor(() => expect(document.querySelector("[data-testid=sheet-import-guide]")).not.toBeNull());
    expect(q(document.body, "[data-testid=sheet-import-guide]").textContent).toContain("Import into your password manager");
  });

  it("Other save warning offers Add, Delete all, Keep them blank (no forced fill)", async () => {
    localStorage.setItem(FORMAT_KEY, "other");
    const { root, saves } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=save]");
    const sheet = q(document.body, "[data-testid=sheet-needs-look]");
    expect(sheet.textContent).toMatch(/missing a title, username, or website/i);
    expect(sheet.querySelector("[data-testid=add]")).not.toBeNull();
    expect(sheet.querySelector("[data-testid=delete-all]")).not.toBeNull();
    expect(sheet.querySelector("[data-testid=keep-blank]")).not.toBeNull();
    expect(sheet.querySelector("[data-testid=save-anyway]")).toBeNull();
    expect(sheet.querySelector("[data-testid=incomplete-keep]")).toBeNull();
    expect(saves).toHaveLength(0);
  });

  it("Other Keep them blank writes passwords.csv with empty Title/Website/Username cells", async () => {
    localStorage.setItem(FORMAT_KEY, "other");
    const { root, saves } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=save]");
    click(document.body, "[data-testid=keep-blank]");
    expect(saves).toHaveLength(0);
    click(document.body, "[data-testid=confirm-save]");
    await vi.waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].fileName).toBe("passwords.csv");
    const lines = saves[0].csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Title,Website,Username,Password,Notes");
    expect(saves[0].csv).not.toMatch(/no url|no title|no username/);
    // Fully blank grove row: empty title, website, username — password only.
    expect(lines.some((line) => line.startsWith(",,,lost-pass,"))).toBe(true);
    expect(saves[0].csv).not.toContain("JBSWY3DPEHPK3PXP");
  });

  it("Other Delete all removes incomplete logins then opens save; Undo restores them", async () => {
    localStorage.setItem(FORMAT_KEY, "other");
    const { root, saves } = setup();
    await unlock(root, await groveExport());
    const beforeIncomplete = q(root, "[data-testid=needs-look-count]").textContent!;
    expect(beforeIncomplete).toMatch(/Needs a look · \d+/);
    click(root, "[data-testid=save]");
    click(document.body, "[data-testid=delete-all]");
    expect(document.querySelector("[data-testid=sheet-save]")).not.toBeNull();
    expect(root.querySelector("[data-testid=needs-look-count]")).toBeNull();
    expect(saves).toHaveLength(0);
    click(document.body, "[data-testid=undo]");
    expect(document.querySelector("[data-testid=snackbar]")).toBeNull();
    expect(q(root, "[data-testid=needs-look-count]").textContent).toBe(beforeIncomplete);
    expect(saves).toHaveLength(0);
  });

  it("Other Add opens the look list when several logins need a look", async () => {
    localStorage.setItem(FORMAT_KEY, "other");
    const { root, saves } = setup();
    await unlock(root, await groveExport());
    click(root, "[data-testid=save]");
    click(document.body, "[data-testid=add]");
    expect(document.querySelector("[data-testid=sheet-look]")).not.toBeNull();
    expect(document.querySelector("[data-testid=look-list]")).not.toBeNull();
    expect(saves).toHaveLength(0);
  });
});
