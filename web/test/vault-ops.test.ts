import { describe, expect, it } from "vitest";
import { applyLoginEdit, defaultMergeChoice, duplicateGroups, groupName, mergeLogins, needsLook, siteKey } from "../src/lib/vault-ops";
import { loginsToCsv } from "../src/lib/csv";
import type { Login } from "../src/lib/types";

const L = (over: Partial<Login>): Login => ({
  id: over.id ?? "x", name: "", url: "", username: "", password: "", note: "", otp: "", otpUri: "", needsSite: false, appLabel: "", ...over
});

describe("siteKey / duplicateGroups", () => {
  it("uses the full hostname and strips www, not a brand stem or title", () => {
    expect(siteKey(L({ url: "https://www.amazon.com/login" }))).toBe("amazon.com");
    expect(siteKey(L({ url: "https://amazon.com" }))).toBe("amazon.com");
    expect(siteKey(L({ url: "https://mail.google.com" }))).toBe("mail.google.com");
    expect(siteKey(L({ url: "https://photos.google.com" }))).toBe("photos.google.com");
    expect(siteKey(L({ url: "https://amazon.co.uk" }))).toBe("amazon.co.uk");
    expect(siteKey(L({ name: "Amazon" }))).toBe("");
    expect(siteKey(L({ name: "amazon.com" }))).toBe("");
    expect(siteKey(L({}))).toBe("");
  });
  it("uses a mapped app package as the website, or the package itself when unmapped", () => {
    expect(siteKey(L({ appLabel: "com.amazon.mShop.android.shopping" }))).toBe("amazon.com");
    expect(siteKey(L({ appLabel: "com.unknown.bankapp" }))).toBe("com.unknown.bankapp");
  });
  it("groups only the same website or app plus the same username", () => {
    const amazonA = L({ id: "a", name: "Amazon", url: "https://amazon.com", username: "shop@example.com" });
    const amazonWww = L({ id: "w", name: "Amazon shopping", url: "https://www.amazon.com", username: "SHOP@example.com" });
    const amazonApp = L({ id: "p", name: "Amazon", appLabel: "com.amazon.mShop.android.shopping", username: "shop@example.com" });
    const otherUser = L({ id: "o", url: "https://amazon.com", username: "orders@example.com" });
    const noUser = L({ id: "e", url: "https://amazon.com", username: "" });
    const gmail = L({ id: "g", name: "Gmail", url: "https://mail.google.com", username: "shop@example.com" });
    const photos = L({ id: "ph", name: "Photos", url: "https://photos.google.com", username: "shop@example.com" });
    const kindle = L({ id: "k", name: "Kindle", url: "https://amazon.com", username: "kindle@example.com" });
    const netflix = L({ id: "n", name: "Netflix", url: "https://netflix.com", username: "n@x.com", password: "reused" });
    const other = L({ id: "x", name: "Other", url: "https://other.test", username: "o@x.com", password: "reused" });
    const groups = duplicateGroups([amazonA, amazonWww, amazonApp, otherUser, noUser, gmail, photos, kindle, netflix, other]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((l) => l.id).sort()).toEqual(["a", "p", "w"]);
    expect(groupName(groups[0])).toBe("amazon.com");
  });
});

describe("mergeLogins", () => {
  const a = L({ id: "a", name: "Amazon", url: "https://amazon.com", username: "shop@example.com", password: "pa" });
  const b = L({ id: "b", name: "amazon.com", url: "https://amazon.com", username: "orders@example.com", password: "pb", note: "old", otp: "123" });
  it("defaults to A, but B when A is empty", () => {
    expect(defaultMergeChoice(a, b)).toEqual({ name: "a", url: "a", username: "a", password: "a", note: "b" });
  });
  it("keeps chosen fields under A's id without mutating inputs", () => {
    const m = mergeLogins(a, b, { name: "a", url: "a", username: "b", password: "b", note: "b" });
    expect(m).toMatchObject({ id: "a", name: "Amazon", username: "orders@example.com", password: "pb", note: "old", otp: "123" });
    expect(a.username).toBe("shop@example.com");
  });
});

describe("needsLook / applyLoginEdit", () => {
  it("counts website-missing as needing a look for every format, even after legacy keep", () => {
    const bank = L({ name: "Bank login", username: "jsmith", siteKeptBlank: true });
    for (const f of ["1password", "google", "apple", "bitwarden", "other"] as const) expect(needsLook([bank], f)).toHaveLength(1);
  });
  it("edit normalises website and clears the gap", () => {
    const bank = L({ name: "Bank login", username: "jsmith", needsSite: true });
    applyLoginEdit(bank, { name: "Bank login", url: "bank.example.com", username: "jsmith", password: "p", note: "" });
    expect(bank.url).toBe("https://bank.example.com");
    expect(needsLook([bank], "1password")).toHaveLength(0);
    applyLoginEdit(bank, { name: "Bank login", url: "not a site", username: "jsmith", password: "p", note: "" });
    expect(bank.url).toBe("");
    expect(bank.needsSite).toBe(true);
  });
});

describe("Other format", () => {
  it("writes headered Title,Website,Username,Password,Notes with blank website and no OTP", () => {
    const csv = loginsToCsv([L({ name: "Bank", username: "j", password: "p", note: "memo", otp: "JBSWY3DPEHPK3PXP" })], [], "other");
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Title,Website,Username,Password,Notes");
    expect(lines[1]).toBe("Bank,,j,p,memo");
    expect(csv).not.toContain("no url");
    expect(csv).not.toContain("JBSWY3DPEHPK3PXP");
  });
});
