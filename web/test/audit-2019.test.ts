// Regression tests for the 2.0.19 audit. Fake data only.
import { webcrypto } from "node:crypto";
import {
  addressesToCsv, cardsToCsv, decryptSpass, encryptSpass, extractPackage, loginsToCsv, parseSpassText, resolveUrl,
  normalizeUserUrl, toVault, unlockText, MAX_SPASS_BYTES
} from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import type { Login } from "../src/lib";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const L = (over: Partial<Login>): Login => ({ id: "x", name: "", url: "", username: "", password: "", note: "", otp: "", otpUri: "", needsSite: false, appLabel: "", ...over });

describe("websites in the export are kept (www / subdomains / IPs / android URIs)", () => {
  it.each(["www.amazon.com", "mail.google.com", "accounts.google.co.uk", "my.bank.example.com"])("%s is a website, not a package", (host) => {
    expect(extractPackage(host)).toBe("");
    expect(resolveUrl(host, "")).toEqual({ url: `https://${host}`, needsSite: false, appLabel: "" });
  });
  it.each(["com.chase.sig.android", "org.telegram.messenger", "proton.android.pass", "de.dkb.portalapp", "com.amazon.mShop.android.shopping"])("%s stays a package", (pkg) => {
    expect(extractPackage(pkg)).toBe(pkg);
  });
  it("reads the package from android://<hash>@<package>/", () => {
    expect(extractPackage("android://AbCdEf123==@com.netflix.mediaclient/")).toBe("com.netflix.mediaclient");
    expect(resolveUrl("android://AbCdEf123==@com.netflix.mediaclient/", "").url).toBe("https://netflix.com");
  });
  it("keeps an IPv4 address (router logins)", () => {
    expect(resolveUrl("192.168.1.1", "").url).toBe("https://192.168.1.1");
    expect(normalizeUserUrl("10.0.0.138:8080/admin")).toBe("https://10.0.0.138:8080/admin");
    expect(normalizeUserUrl("999.1.1.1")).toBe("");
  });
});

describe("parser: quoted multi-line fields and uneven rows", () => {
  const head = ["25", "true;true;true;true", "false", "next_table", "title;host_url;username_value;password_value;credential_memo;otp"];
  it("keeps newlines, blank lines, indentation and a literal next_table inside a quoted field", () => {
    const text = [...head, `${b64("Bank")};${b64("https://bank.example")};"  ada  ";${b64("pw")};"line 1\n\n  indented\nnext_table\nend";`, [b64("Two"), b64("https://two.example"), b64("bo"), b64("pw2"), "", ""].join(";"), ""].join("\n");
    const vault = toVault(parseSpassText(text));
    expect(vault.logins).toHaveLength(2);
    expect(vault.logins[0].note).toBe("line 1\n\n  indented\nnext_table\nend");
    expect(vault.logins[1].name).toBe("Two");
  });
  it("short and long rows neither shift columns nor drop data", () => {
    const text = [...head, [b64("Short"), b64("https://s.example")].join(";"), [b64("Long"), b64("https://l.example"), b64("u"), b64("p"), "", "", b64("extra")].join(";"), ""].join("\n");
    const parsed = parseSpassText(text);
    const vault = toVault(parsed);
    expect(vault.logins.map((l) => [l.name, l.url, l.username])).toEqual([["Short", "https://s.example", ""], ["Long", "https://l.example", "u"]]);
    expect(parsed.tables[0].rows[1].extra_7).toBe("extra");
  });
  it("unicode and emoji round-trip through decrypt, parse and CSV", async () => {
    const text = [...head, [b64("🔥 Fire Bank"), b64("https://bank.example"), b64("ユーザー"), b64("pä$$🔑"), b64("مرحبا\nnote"), ""].join(";"), ""].join("\n");
    const vault = await unlockText(await encryptSpass(text, "pw"), "pw");
    expect(vault.logins[0]).toMatchObject({ name: "🔥 Fire Bank", username: "ユーザー", password: "pä$$🔑", note: "مرحبا\nnote" });
    expect(loginsToCsv(vault.logins, [], "bitwarden")).toContain('"مرحبا\nnote"');
  });
});

describe("decrypt edge cases", () => {
  it("rejects a wrong password, truncation and garbage with clear errors", async () => {
    const good = await encryptSpass("25\ntrue;true;true;true\nnext_table\ntitle;password_value\nx;y\n", "right");
    await expect(decryptSpass(good, "wrong")).rejects.toMatchObject({ code: "password" });
    await expect(decryptSpass(good.slice(0, good.length - 7), "right")).rejects.toMatchObject({ code: "format" });
    await expect(decryptSpass("not base64 at all!!", "right")).rejects.toMatchObject({ code: "format" });
    await expect(decryptSpass("", "right")).rejects.toMatchObject({ code: "format" });
  });
  it("refuses absurdly large files before decrypting", async () => {
    await expect(unlockText("A".repeat(MAX_SPASS_BYTES + 4), "pw")).rejects.toMatchObject({ code: "format", message: expect.stringMatching(/too large/i) });
  });
});

describe("CSV: credentials stay exact, spreadsheets stay safe", () => {
  it("a phone-number username is written verbatim in every login format", () => {
    for (const f of ["1password", "google", "apple", "bitwarden", "other"] as const) {
      const csv = loginsToCsv([L({ name: "WhatsApp", url: "https://web.whatsapp.com", username: "+447700900123", password: "p" })], [], f);
      expect(csv).toContain(",+447700900123,");
      expect(csv).not.toContain("'+447700900123");
    }
  });
  it("still neutralises formula titles and notes in login CSVs", () => {
    const csv = loginsToCsv([L({ name: "=HYPERLINK(1)", url: "https://x.example", username: "u", password: "p", note: "@SUM(1)" })], [], "other");
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("'@SUM(1)");
  });
  it("address phone and card fields cannot inject formulas", () => {
    const a = addressesToCsv([{ id: "a", name: "Ada", company: "", street: "1 St", city: "", state: "", postal: "", country: "", phone: "=HYPERLINK(\"http://evil.test\")", email: "" }]);
    expect(a).toContain(`"'=HYPERLINK(""http://evil.test"")"`);
    const plainPhone = addressesToCsv([{ id: "a", name: "Ada", company: "", street: "1 St", city: "", state: "", postal: "", country: "", phone: "+1 555 0100", email: "" }]);
    expect(plainPhone).toContain(",'+1 555 0100,");
    const c = cardsToCsv([{ id: "c", nickname: "V", holder: "A", number: "=1+1", expMonth: "09", expYear: "2030", code: "-1", note: "" }]);
    expect(c).toContain(",'=1+1,09,2030,'-1,");
  });
});

describe("host vs package edge cases", () => {
  it.each([["de.wikipedia.org", ""], ["com.example.app", "com.example.app"], ["me.lyft.android", "me.lyft.android"], ["jp.naver.line.android", "jp.naver.line.android"], ["uk.co.bbc.mobile", "uk.co.bbc.mobile"]])("%s → %j", (v, pkg) => {
    expect(extractPackage(v)).toBe(pkg);
  });
});

describe("2.0.19 audit: single-file build integrity", () => {
  it("inlined script is byte-identical to app.js and matches its CSP hash", async () => {
    const { readFileSync } = await import("node:fs");
    const { createHash } = await import("node:crypto");
    const html = readFileSync("samsung-pass-to-csv.html", "utf8");
    const js = readFileSync("app.js", "utf8");
    const m = html.match(/<script>([\s\S]*)<\/script>/);
    expect(m?.[1]).toBe(js);
    const hash = createHash("sha256").update(js).digest("base64");
    expect(html).toContain(`script-src 'sha256-${hash}'`);
  });
});
