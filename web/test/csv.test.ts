import type { Login, Note } from "../src/lib/types";
import {
  PLACEHOLDER_TITLE,
  PLACEHOLDER_URL,
  PLACEHOLDER_USERNAME,
  applyPlaceholders,
  displayTitle,
  formatRequiresUrl,
  incompleteLogins,
  loginGaps
} from "../src/lib/model";
import { DEFAULT_FORMAT, FORMATS, cardsToCsv, cell, fileNameFor, loginsToCsv, parseSpassText, samplePlaintext, toVault } from "../src/lib";

const vault = () => toVault(parseSpassText(samplePlaintext()));
const BOM = "\uFEFF";
const MAIL_OTP = "otpauth://totp/Sample:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Sample";
const EVIL = "\"'=HYPERLINK(\"\"http://evil.test\"\")\"";

describe("cell", () => {
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"])("neutralizes formula lead %j", (value) => {
    expect(cell(value).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("does not touch raw cells", () => {
    expect(cell("=x-pass", false)).toBe("=x-pass");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(cell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});

describe("golden login CSVs", () => {
  it("1password: Notes has no OTP line", () => {
    const out = loginsToCsv(vault().logins, vault().notes, "1password");
    expect(out).not.toMatch(/OTP:/);
    expect(out).not.toMatch(/otpauth:/i);
    const mail = out.trim().split("\r\n")[0];
    expect(mail).toContain("Fake entry for the preview");
    expect(mail).not.toContain("OTP:");
  });

  it("1Password", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "1password")).toBe(
      `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,Fake entry for the preview\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL}\r\n`
    );
  });

  it("Google", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "google")).toBe(
      `name,url,username,password,note\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,"Fake entry for the preview\nOTP: ${MAIL_OTP}"\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `Chase Bank Card,${PLACEHOLDER_URL},lee,=x-pass,${EVIL}\r\n`
    );
  });

  it("Apple", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "apple")).toBe(
      `Title,URL,Username,Password,Notes,OTPAuth\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,Fake entry for the preview,${MAIL_OTP}\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL},\r\n`
    );
  });

  it("Bitwarden", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "bitwarden")).toBe(
      `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\r\n` +
        `,0,login,Sample Mail,Fake entry for the preview,,0,https://mail.example.test,ada@example.test,sample-mailbox-pass,${MAIL_OTP}\r\n` +
        `,0,login,Sample Bank,,,0,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `,0,login,Chase Bank Card,${EVIL},,0,,lee,=x-pass,\r\n` +
        `,0,note,Router note,"This is sample text, not a real secret.",,0,,,,\r\n`
    );
  });

  it("cards", () => {
    expect(cardsToCsv(vault().cards)).toBe(
      `${BOM}nickname,name_on_card,number,exp_month,exp_year,security_code,note\r\nSample Visa,Ada Example,4242424242424242,09,2030,123,\r\n`
    );
  });
});

describe("formats", () => {
  it("has four equal formats in fixed order, 1Password default", () => {
    expect(FORMATS.map((f) => f.id)).toEqual(["1password", "google", "apple", "bitwarden"]);
    expect(DEFAULT_FORMAT).toBe("1password");
    expect(fileNameFor("apple")).toBe("samsung-pass-apple.csv");
  });

  it("only google needs a url placeholder", () => {
    expect(formatRequiresUrl("google")).toBe(true);
    for (const f of ["1password", "apple", "bitwarden"] as const) expect(formatRequiresUrl(f)).toBe(false);
  });
});

describe("password-manager CSVs start with the header (no BOM)", () => {
  it.each(["1password", "google", "apple", "bitwarden"])("%s", (fmt) => {
    const out = loginsToCsv(vault().logins, vault().notes, fmt as never);
    expect(out.charCodeAt(0)).not.toBe(0xfeff);
  });
});

describe("import-safe labels", () => {
  const blank = (over: Partial<Login> = {}): Login =>
    ({ ...vault().logins[0], name: "", url: "", username: "", password: "", note: "", otp: "", otpUri: "", appLabel: "", needsSite: false, ...over });
  const HEADERS: Record<string, string> = {
    google: "name,url,username,password,note",
    apple: "Title,URL,Username,Password,Notes,OTPAuth",
    bitwarden: "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp"
  };
  const titleCol: Record<string, number> = { "1password": 0, google: 0, apple: 0, bitwarden: 3 };
  const userCol: Record<string, number> = { "1password": 2, google: 2, apple: 2, bitwarden: 8 };
  const urlCol: Record<string, number> = { "1password": 1, google: 1, apple: 1, bitwarden: 7 };
  const rows = (fmt: string, logins: Login[], notes: Note[] = []) =>
    loginsToCsv(logins, notes, fmt as never).replace(BOM, "").trim().split("\r\n");

  it.each(Object.keys(HEADERS))("%s: exact header and never empty title/username", (fmt) => {
    const out = rows(fmt, [blank({ url: "https://www.github.com/login" }), blank({ username: "bob" }), blank({ password: "p" })]);
    expect(out[0]).toBe(HEADERS[fmt]);
    const titles = out.slice(1).map((r) => r.split(",")[titleCol[fmt]]);
    expect(titles).toEqual(["github.com", "bob", PLACEHOLDER_TITLE]);
    const users = out.slice(1).map((r) => r.split(",")[userCol[fmt]]);
    expect(users).toEqual([PLACEHOLDER_USERNAME, "bob", PLACEHOLDER_USERNAME]);
  });

  it("1password: headerless, 5 columns, never empty title/username", () => {
    const out = rows("1password", [blank({ url: "https://www.github.com/login" }), blank({ username: "bob" }), blank({ password: "p" })]);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.split(",").length)).toEqual([5, 5, 5]);
    expect(out.map((r) => r.split(",")[0])).toEqual(["github.com", "bob", PLACEHOLDER_TITLE]);
    expect(out.map((r) => r.split(",")[2])).toEqual([PLACEHOLDER_USERNAME, "bob", PLACEHOLDER_USERNAME]);
  });

  it("only google fills no url; others export a blank website", () => {
    const login = blank({ username: "bob" });
    expect(rows("google", [login])[1].split(",")[urlCol.google]).toBe(PLACEHOLDER_URL);
    expect(rows("1password", [login])[0].split(",")[urlCol["1password"]]).toBe("");
    expect(rows("1password", [login])[0]).toBe("bob,,bob,,");
    expect(rows("apple", [login])[1].split(",")[urlCol.apple]).toBe("");
    expect(rows("bitwarden", [login])[1].split(",")[urlCol.bitwarden]).toBe("");
  });

  it.each(["1password", "apple", "bitwarden"])("%s: keep leaves website blank, never no url", (fmt) => {
    const login = blank({ name: "Mission Lane", username: "u", needsSite: true });
    applyPlaceholders(login, fmt as never);
    expect(login.url).toBe("");
    expect(incompleteLogins([login], fmt as never)).toHaveLength(0);
    expect(loginsToCsv([login], [], fmt as never)).not.toContain(PLACEHOLDER_URL);
    expect(loginGaps(login, "google")).toEqual(["url"]);
  });

  it.each(["1password", "bitwarden", "apple", "google"])("%s: incompleteLogins returns every needsSite login", (fmt) => {
    const logins = [
      blank({ id: "a", name: "A", username: "u", needsSite: true }),
      blank({ id: "b", name: "B", username: "u", needsSite: true, appLabel: "com.x" }),
      blank({ id: "c", name: "C", username: "u", url: "https://c.test" }),
      blank({ id: "d", username: "u", url: "" , needsSite: true })
    ];
    const inc = incompleteLogins(logins, fmt as never);
    expect(inc.map((l) => l.id)).toEqual(["a", "b", "d"]);
    expect(loginGaps(logins[0], fmt as never)).toEqual(["url"]);
    for (const l of logins.filter((x) => x.needsSite)) expect(inc).toContain(l);
    for (const l of inc) applyPlaceholders(l, fmt as never);
    expect(incompleteLogins(logins, fmt as never)).toHaveLength(0);
  });

  it("never invents a password placeholder", () => {
    const out = rows("google", [blank({ username: "bob" })]);
    expect(out[1].split(",")[3]).toBe("");
  });

  it("bitwarden blank note gets a name", () => {
    const out = rows("bitwarden", [], [{ ...vault().notes[0], title: "", body: "x" }]);
    expect(out[1].split(",")[3]).toBe("Note");
  });

  it("displayTitle keeps a real name", () => {
    expect(displayTitle(blank({ name: " Mail ", url: "https://x.test" }))).toBe("Mail");
  });

  it("loginGaps and applyPlaceholders follow the locked strings", () => {
    const login = blank({ password: "x" });
    expect(loginGaps(login, "google")).toEqual(["title", "username", "url"]);
    expect(incompleteLogins([login], "1password")).toHaveLength(1);
    applyPlaceholders(login, "google");
    expect(login.name).toBe(PLACEHOLDER_TITLE);
    expect(login.username).toBe(PLACEHOLDER_USERNAME);
    expect(login.url).toBe(PLACEHOLDER_URL);
    expect(login.password).toBe("x");
    expect(loginGaps(login, "google")).toEqual([]);
  });
});
