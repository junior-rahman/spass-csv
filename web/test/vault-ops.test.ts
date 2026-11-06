import { describe, expect, it } from "vitest";
import { applyLoginEdit, defaultMergeChoice, duplicateGroups, groupName, mergeLogins, needsLook, siteKey } from "../src/lib/vault-ops";
import { loginsToCsv } from "../src/lib/csv";
import type { Login } from "../src/lib/types";

const L = (over: Partial<Login>): Login => ({
  id: over.id ?? "x", name: "", url: "", username: "", password: "", note: "", otp: "", otpUri: "", needsSite: false, appLabel: "", ...over
});

describe("siteKey / duplicateGroups", () => {
  it("normalises amazon.com, www, Amazon and co.uk to one key", () => {
    expect(siteKey(L({ url: "https://www.amazon.com/login" }))).toBe("amazon");
    expect(siteKey(L({ name: "Amazon" }))).toBe("amazon");
    expect(siteKey(L({ name: "amazon.com" }))).toBe("amazon");
    expect(siteKey(L({ url: "https://www.amazon.co.uk" }))).toBe("amazon");
    expect(siteKey(L({}))).toBe("");
  });
  it("groups same-site logins only", () => {
    const a = L({ id: "a", name: "Amazon", url: "https://amazon.com", username: "shop@example.com" });
    const b = L({ id: "b", name: "amazon.com", url: "https://www.amazon.com" });
    const n = L({ id: "n", name: "Netflix", url: "https://netflix.com" });
    const groups = duplicateGroups([a, n, b]);
    expect(groups.map((g) => g.map((l) => l.id))).toEqual([["a", "b"]]);
    expect(groupName(groups[0])).toBe("Amazon");
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
