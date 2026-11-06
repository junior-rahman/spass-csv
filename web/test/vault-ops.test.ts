import { describe, expect, it } from "vitest";
import { applyLoginEdit, needsLook } from "../src/lib/vault-ops";
import { loginsToCsv } from "../src/lib/csv";
import type { Login } from "../src/lib/types";

const L = (over: Partial<Login>): Login => ({
  id: over.id ?? "x", name: "", url: "", username: "", password: "", note: "", otp: "", otpUri: "", needsSite: false, appLabel: "", ...over
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
