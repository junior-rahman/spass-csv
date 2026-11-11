// @vitest-environment jsdom
// 2.0.25 audit regressions (fifth pass on 2.0.24). Fake data only.
import { webcrypto } from "node:crypto";
import {
  FORMATS, SpassError, addressesToCsv, cardsToCsv, encryptSpass, googleNoteTooLong, loginGaps, loginsToCsv, notesToCsv,
  parseSpassText, toVault, unlockText, type Login
} from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import { mount } from "../src/ui/app";
import { FORMAT_KEY } from "../src/ui/prefs";
import { TEST_PASSWORD } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const HEAD = "title;host_url;username_value;password_value;credential_memo;otp;app_name;package_name";
const row = (...cells: string[]) => cells.map((c) => (c ? b64(c) : "")).join(";");
const plain = (rows: string[]) => ["25", "true;true;true;true", "false", "next_table", HEAD, ...rows, ""].join("\n");
const L = (over: Partial<Login>): Login => ({ id: "x", name: "T", url: "https://a.com", username: "u", password: "p", note: "", otp: "", otpUri: "", needsSite: false, appLabel: "", ...over });

async function boot(rows: string[], format = "1password") {
  localStorage.setItem(FORMAT_KEY, format);
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById("app")!;
  const saves: { fileName: string; csv: string }[] = [];
  mount(root, { platform: { save: async (fileName, csv) => { saves.push({ fileName, csv }); return true; } } });
  const input = root.querySelector<HTMLInputElement>("#spass-file")!;
  Object.defineProperty(input, "files", { value: [new File([await encryptSpass(plain(rows), TEST_PASSWORD)], "a.spass")], configurable: true });
  input.dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
  const pw = root.querySelector<HTMLInputElement>("#spass-password")!;
  pw.value = TEST_PASSWORD;
  pw.dispatchEvent(new Event("input"));
  root.querySelector<HTMLButtonElement>("[data-testid=convert]")!.click();
  await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
  return { root, saves };
}
const click = (root: Element, sel: string) => root.querySelector<HTMLElement>(sel)!.click();
async function saveNow(root: HTMLElement, saves: unknown[]) {
  await vi.waitFor(() => expect(root.querySelector("[data-testid=confirm-save]")).not.toBeNull());
  click(root, "[data-testid=confirm-save]");
  await vi.waitFor(() => expect(saves.length).toBe(1));
}

describe("Google Password Manager import limits (Chromium password_importer)", () => {
  it("a note over 1,000 UTF-8 bytes (OTP line included) is a Google-only gap", () => {
    expect(googleNoteTooLong(L({ note: "a".repeat(1000) }))).toBe(false);
    expect(googleNoteTooLong(L({ note: "a".repeat(1001) }))).toBe(true);
    expect(googleNoteTooLong(L({ note: "가".repeat(334) }))).toBe(true); // 1,002 bytes, 334 characters
    expect(googleNoteTooLong(L({ note: "a".repeat(990), otp: "JBSWY3DPEHPK3PXP" }))).toBe(true);
    expect(loginGaps(L({ note: "a".repeat(1001) }), "google")).toEqual(["note"]);
    for (const f of ["1password", "apple", "bitwarden", "other"] as const) expect(loginGaps(L({ note: "a".repeat(5000) }), f)).toEqual([]);
  });
  it("the needs-a-look sheet says Google skips logins without a website instead of promising “no url”", async () => {
    const { root } = await boot([row("Bank", "", "jsmith", "pw", "", "", "", ""), row("Mail", "https://mail.example", "a", "b", "", "", "", "")], "google");
    click(root, "[data-testid=save]");
    const sheet = root.querySelector("[data-testid=sheet-needs-look]")!;
    expect(sheet.textContent).toContain("can't import a login without a website");
    expect(sheet.textContent).not.toContain("lists them as");
    expect(sheet.querySelector("[data-testid=save-anyway]")).not.toBeNull();
    const steps = FORMATS.find((f) => f.id === "google")!.importSteps.join(" ");
    expect(steps).not.toMatch(/show as .no url/);
    expect(steps).toContain("can’t import a login without a website");
  });
  it("a long note is flagged, Review focuses Notes with a hint, and Save anyway is still offered", async () => {
    const { root, saves } = await boot([row("Codes", "https://codes.example", "me", "pw", "x".repeat(1200), "", "", "")], "google");
    expect(root.querySelector("[data-testid=needs-look-count]")!.textContent).toBe("Needs a look · 1");
    click(root, "[data-testid=save]");
    const sheet = root.querySelector("[data-testid=sheet-needs-look]")!;
    expect(sheet.textContent).toContain("note too long for Google");
    expect(sheet.textContent).toContain("over 1,000 characters");
    click(root, "[data-testid=review]");
    expect(document.activeElement?.id).toBe("edit-notes");
    expect(root.querySelector("[data-testid=sheet-edit]")!.textContent).toContain("Google skips a login whose note is over 1,000 characters");
    const notes = root.querySelector<HTMLTextAreaElement>("#edit-notes")!;
    notes.value = "short";
    notes.dispatchEvent(new Event("input"));
    click(root, "[data-testid=edit-save]");
    expect(root.querySelector("[data-testid=needs-look]")).toBeNull();
    click(root, "[data-testid=save]");
    await saveNow(root, saves);
    expect(saves[0].csv).toContain("Codes,https://codes.example,me,pw,short");
  });
});

describe("undo never lets a stale sheet overwrite restored logins", () => {
  it("undoing a merge while Edit is open on the merged login closes Edit; both original passwords survive", async () => {
    const { root, saves } = await boot([row("A", "https://a.com", "u", "pa", "", "", "", ""), row("B", "https://a.com", "u", "pb", "", "", "", "")]);
    click(root, "[data-testid=merge-suggestions]");
    click(root, "[data-testid=merge-opt][data-field=password][data-side=b]");
    click(root, "[data-testid=merge-confirm]");
    click(root, "[data-testid=browse-logins]");
    click(root, "[data-testid=login]");
    expect(root.querySelector("[data-testid=sheet-edit]")).not.toBeNull();
    click(root, "[data-testid=undo]");
    expect(root.querySelector("[data-testid=sheet-edit]")).toBeNull();
    expect(root.querySelector("[data-testid=sheet-browse]")).not.toBeNull();
    click(root, ".sheet .x");
    click(root, "[data-testid=save]");
    await saveNow(root, saves);
    expect(saves[0].csv).toBe("A,https://a.com,u,pa,\r\nB,https://a.com,u,pb,\r\n");
  });
  it("undoing an unrelated delete keeps an open Edit and its typing", async () => {
    const { root } = await boot([row("A", "https://a.com", "u1", "pa", "", "", "", ""), row("B", "https://b.com", "u2", "pb", "", "", "", "")]);
    click(root, "[data-testid=browse-logins]");
    click(root, "[data-testid=login][data-id=login-0]");
    click(root, "[data-testid=edit-delete]");
    click(root, "[data-testid=browse-logins]");
    click(root, "[data-testid=login][data-id=login-1]");
    const title = root.querySelector<HTMLInputElement>("#edit-title")!;
    title.value = "B typed";
    title.dispatchEvent(new Event("input"));
    click(root, "[data-testid=undo]");
    expect(root.querySelector<HTMLInputElement>("#edit-title")!.value).toBe("B typed");
  });
});

describe("merge compares passwords verbatim", () => {
  it("passwords that differ only by edge spaces are offered as a choice, not “Same in both”", async () => {
    const { root, saves } = await boot([row("A", "https://a.com", "u", "pw", "", "", "", ""), row("A", "https://a.com", "u", " pw ", "", "", "", "")]);
    click(root, "[data-testid=merge-suggestions]");
    const opts = root.querySelectorAll("[data-testid=merge-opt][data-field=password]");
    expect(opts).toHaveLength(2);
    expect(opts[0].textContent).toContain("spaces differ");
    click(root, "[data-testid=merge-opt][data-field=password][data-side=b]");
    click(root, "[data-testid=merge-confirm]");
    click(root, "[data-testid=save]");
    await saveNow(root, saves);
    expect(saves[0].csv).toBe('A,https://a.com,u," pw ",\r\n');
  });
});

describe("website logins are titled by their site, not the browser that saved them", () => {
  it("no title → host; app_name / package of the browser and the full URL are never the title", () => {
    const v = toVault(parseSpassText(plain([
      row("", "https://mail.example.com/login?x=1", "u", "p", "", "", "Samsung Internet", "com.sec.android.app.sbrowser"),
      row("", "https://x.example.org/", "u2", "p", "", "", "", "com.sec.android.app.sbrowser"),
      row("", "shop.example.net", "u3", "p", "", "", "Chrome", "com.android.chrome"),
      row("", "android://hash@com.netflix.mediaclient/", "n", "p", "", "", "Netflix", "com.netflix.mediaclient"),
      row("Kept", "https://k.example", "k", "p", "", "", "Samsung Internet", "com.sec.android.app.sbrowser")
    ])));
    expect(loginsToCsv(v.logins, [], "google").split("\r\n").slice(1, 6).map((l) => l.split(",")[0]))
      .toEqual(["mail.example.com", "x.example.org", "shop.example.net", "Netflix", "Kept"]);
    expect(v.logins[0].appLabel).toBe("");
    expect(v.logins[3].appLabel).toBe("com.netflix.mediaclient");
  });
  it("a title-less website login's OTP label uses the host", () => {
    const v = toVault(parseSpassText(plain([row("", "https://mail.example.com/", "ada", "p", "", "JBSWY3DPEHPK3PXPJBSWY3DP", "Samsung Internet", "com.sec.android.app.sbrowser")])));
    expect(v.logins[0].otpUri).toContain("issuer=mail.example.com");
  });
});

describe("controls", () => {
  it("the Edit show/hide password icon matches the export password field (eye-off while hidden)", async () => {
    const { root } = await boot([row("A", "https://a.com", "u", "pw", "", "", "", "")]);
    click(root, "[data-testid=browse-logins]");
    click(root, "[data-testid=login]");
    const btn = () => root.querySelector("#edit-password")!.parentElement!.querySelector("button")!;
    expect([btn().getAttribute("aria-label"), btn().querySelector(".icon")!.getAttribute("data-icon")]).toEqual(["Show password", "visibility_off"]);
    btn().click();
    expect([btn().getAttribute("aria-label"), btn().querySelector(".icon")!.getAttribute("data-icon")]).toEqual(["Hide password", "visibility"]);
  });
  it("the Browse search box has an accessible name", async () => {
    const { root } = await boot([row("A", "https://a.com", "u", "pw", "", "", "", "")]);
    click(root, "[data-testid=browse-logins]");
    expect(root.querySelector("#browse-query")!.getAttribute("aria-label")).toBe("Find a login");
  });
});

describe("parser fuzz (mutation)", () => {
  it("6,000 mutated exports only ever raise SpassError, and every exporter accepts what parses", async () => {
    let seed = 20251110;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const atoms = ['"', ";", "\n", "\r\n", "\r", "next_table", "&&&NULL&&&", b64("&&&NULL&&&"), "=", " ", "\u0000", "\uFEFF", "true", "false", "password_value", b64("pw"), "card_number", "note_title", '""', "\t", "é", "😀", "version:"];
    const base = ["30", "true;true;true;true", "false", "next_table", HEAD, row("T", "https://a.com", "u", "p", "n", "JBSWY3DPEHPK3PXPJBSWY3DP", "", ""),
      "next_table", "name_on_card;card_number", row("A", "4111"), "next_table", "street_address;city", "next_table", "note_title;note_detail", row("t", "d"), ""].join("\r\n");
    const bad: string[] = [];
    for (let n = 0; n < 6000; n++) {
      let s = base;
      for (let j = 0, k = 1 + Math.floor(rnd() * 8); j < k; j++) {
        const pos = Math.floor(rnd() * (s.length + 1));
        const op = rnd();
        s = op < 0.5 ? s.slice(0, pos) + atoms[Math.floor(rnd() * atoms.length)] + s.slice(pos) : op < 0.8 ? s.slice(0, pos) + s.slice(pos + 1 + Math.floor(rnd() * 20)) : s.slice(0, pos);
      }
      try {
        const v = toVault(parseSpassText(s));
        for (const f of ["1password", "google", "apple", "bitwarden", "other"] as const) loginsToCsv(v.logins, v.notes, f);
        cardsToCsv(v.cards); notesToCsv(v.notes); addressesToCsv(v.addresses);
      } catch (e) { if (!(e instanceof SpassError)) bad.push(`${e} :: ${JSON.stringify(s).slice(0, 200)}`); }
      try { await unlockText(s, "x"); } catch (e) { if (!(e instanceof SpassError)) bad.push(`unlock ${e}`); }
    }
    expect(bad).toEqual([]);
  });
});
