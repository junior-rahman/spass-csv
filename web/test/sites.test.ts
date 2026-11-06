import { APP_SITES, normalizeUserUrl, parseSpassText, resolveUrl, samplePlaintext, setManualSite, toVault } from "../src/lib";

describe("websites", () => {
  it("uses the curated map for known packages", () => {
    expect(resolveUrl("com.chase.sig.android", "")).toEqual({ url: "https://chase.com", needsSite: false, appLabel: "com.chase.sig.android" });
  });

  it("leaves unknown packages blank and flags them", () => {
    expect(resolveUrl("com.unknown.bankapp", "")).toEqual({ url: "", needsSite: true, appLabel: "com.unknown.bankapp" });
  });

  it("never turns a name into <name>.com", () => {
    const vault = toVault(parseSpassText(samplePlaintext()));
    const card = vault.logins.find((l) => l.name === "Chase Bank Card")!;
    expect(card.url).toBe("");
    expect(card.needsSite).toBe(true);
  });

  it("leaves non-URL text blank instead of copying it into the URL", () => {
    expect(resolveUrl("My Bank", "")).toEqual({ url: "", needsSite: true, appLabel: "" });
  });

  it("every URL in any CSV comes from the export or APP_SITES", () => {
    const vault = toVault(parseSpassText(samplePlaintext()));
    const allowed = new Set([...Object.values(APP_SITES), "https://mail.example.test", ""]);
    for (const login of vault.logins) expect(allowed.has(login.url)).toBe(true);
  });

  it("manual site accepts a domain and rejects free text", () => {
    const login = toVault(parseSpassText(samplePlaintext())).logins[2];
    setManualSite(login, "bank.example");
    expect(login.url).toBe("https://bank.example");
    expect(login.needsSite).toBe(false);
    setManualSite(login, "not a site");
    expect(login.url).toBe("");
    expect(login.needsSite).toBe(true);
    expect(normalizeUserUrl("http://x.test/a")).toBe("http://x.test/a");
  });

  it("does not map Samsung Internet to samsung.com", () => {
    expect(resolveUrl("com.sec.android.app.sbrowser", "")).toEqual({
      url: "",
      needsSite: true,
      appLabel: "com.sec.android.app.sbrowser"
    });
  });

  it("never lets a package mapping replace a website from the export", () => {
    expect(resolveUrl("https://netflix.com", "com.sec.android.app.sbrowser")).toEqual({
      url: "https://netflix.com",
      needsSite: false,
      appLabel: "com.sec.android.app.sbrowser"
    });
    expect(resolveUrl("netflix.com", "com.sec.android.app.sbrowser")).toEqual({
      url: "https://netflix.com",
      needsSite: false,
      appLabel: "com.sec.android.app.sbrowser"
    });
  });

  it("still maps Samsung Pay to samsung.com when that is the only site hint", () => {
    expect(resolveUrl("com.samsung.android.spay", "")).toEqual({
      url: "https://samsung.com",
      needsSite: false,
      appLabel: "com.samsung.android.spay"
    });
  });
});
