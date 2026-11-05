import type { Login, Note } from "../src/lib/types";
import { displayTitle } from "../src/lib/model";
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
  it("1Password", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "1password")).toBe(
      `${BOM}Title,Website,Username,Password,Notes\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,"Fake entry for the preview\nOTP: ${MAIL_OTP}"\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL}\r\n`
    );
  });

  it("Google", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "google")).toBe(
      `${BOM}name,url,username,password,note\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,"Fake entry for the preview\nOTP: ${MAIL_OTP}"\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL}\r\n`
    );
  });

  it("Apple", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "apple")).toBe(
      `${BOM}Title,URL,Username,Password,Notes,OTPAuth\r\n` +
        `Sample Mail,https://mail.example.test,ada@example.test,sample-mailbox-pass,Fake entry for the preview,${MAIL_OTP}\r\n` +
        `Sample Bank,https://chase.com,j.lee,not-a-real-password,,\r\n` +
        `Chase Bank Card,,lee,=x-pass,${EVIL},\r\n`
    );
  });

  it("Bitwarden", () => {
    expect(loginsToCsv(vault().logins, vault().notes, "bitwarden")).toBe(
      `${BOM}folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\r\n` +
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
});

describe("import-safe labels", () => {
  const blank = (over: Partial<Login> = {}): Login =>
    ({ ...vault().logins[0], name: "", url: "", username: "", password: "", note: "", otp: "", otpUri: "", ...over });
  const HEADERS: Record<string, string> = {
    "1password": "Title,Website,Username,Password,Notes",
    google: "name,url,username,password,note",
    apple: "Title,URL,Username,Password,Notes,OTPAuth",
    bitwarden: "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp"
  };
  const titleCol: Record<string, number> = { "1password": 0, google: 0, apple: 0, bitwarden: 3 };
  const rows = (fmt: string, logins: Login[], notes: Note[] = []) =>
    loginsToCsv(logins, notes, fmt as never).replace(BOM, "").trim().split("\r\n");

  it.each(Object.keys(HEADERS))("%s: exact header and never empty title", (fmt) => {
    const out = rows(fmt, [blank({ url: "https://www.github.com/login" }), blank({ username: "bob" }), blank({ password: "p" })]);
    expect(out[0]).toBe(HEADERS[fmt]);
    const titles = out.slice(1).map((r) => r.split(",")[titleCol[fmt]]);
    expect(titles).toEqual(["github.com", "bob", "Untitled login"]);
  });

  it("does not invent a URL", () => {
    expect(rows("google", [blank({ username: "bob" })])[1]).toBe("bob,,bob,,");
  });

  it("bitwarden blank note gets a name", () => {
    const out = rows("bitwarden", [], [{ ...vault().notes[0], title: "", body: "x" }]);
    expect(out[1].split(",")[3]).toBe("Note");
  });

  it("displayTitle keeps a real name", () => {
    expect(displayTitle(blank({ name: " Mail ", url: "https://x.test" }))).toBe("Mail");
  });
});
