// @vitest-environment jsdom
// 2.0.23 audit regressions: real Samsung Pass v25+/v30 layout (35-column password table, CRLF, base64 &&&NULL&&&),
// format variants, and verbatim edit fields. Fake data only.
import { webcrypto } from "node:crypto";
import { encryptSpass, spassShapeError, unlockText } from "../src/lib";
import { bytesToBase64 } from "../src/lib/bytes";
import { mount } from "../src/ui/app";
import { TEST_PASSWORD } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
const NULL = b64("&&&NULL&&&");
/** Column list of the Samsung Pass password table as documented by public reverse-engineering (35 fields). */
const HDR = "_id;origin_url;action_url;username_element;username_value;id_tz_enc;password_element;password_value;pw_tz_enc;host_url;ssl_valid;preferred;blacklisted_by_user;use_additional_auth;cm_api_support;created_time;modified_time;title;favicon;source_type;app_name;package_name;package_signature;reserved_1;reserved_2;reserved_3;reserved_4;reserved_5;reserved_6;reserved_7;reserved_8;credential_memo;otp;root_id;parent_id";
const row = (o: Record<string, string>) => HDR.split(";").map((h) => (h in o ? (o[h] === "" ? "" : b64(o[h])) : NULL)).join(";");
const appRow = row({ _id: "1", origin_url: "android://hash@com.netflix.mediaclient/", host_url: "android://hash@com.netflix.mediaclient/", username_element: "", password_element: "", username_value: "n@example.test", password_value: "p 1", title: "", favicon: "", app_name: "Netflix", package_name: "com.netflix.mediaclient", credential_memo: "", otp: "" });
const webRow = row({ _id: "2", origin_url: "https://mail.example/", host_url: "https://mail.example/", username_element: "", password_element: "", username_value: "ada@example.test", password_value: "pw😀𝄞", title: "Mail", favicon: "", app_name: "", package_name: "", credential_memo: "line1\r\nline2", otp: "" });
const pwOnly = (eol: string) => ["30", "true;false;false;false", "false", "next_table", HDR, appRow, webRow, ""].join(eol);
const unlock = async (plain: string, wrap = (s: string) => s) => unlockText(wrap(await encryptSpass(plain, TEST_PASSWORD)), TEST_PASSWORD);

describe("Samsung Pass v30 layout", () => {
  it("app logins without a title use app_name, not the package name", async () => {
    const v = await unlock(pwOnly("\r\n"));
    expect(v.logins.map((l) => [l.name, l.url, l.username, l.password])).toEqual([
      ["Netflix", "https://netflix.com", "n@example.test", "p 1"],
      ["Mail", "https://mail.example/", "ada@example.test", "pw😀𝄞"]
    ]);
    expect(v.logins[1].note).toBe("line1\r\nline2");
  });
  it.each([["LF", "\n"], ["CR", "\r"], ["CRLF", "\r\n"]])("%s line endings give the same vault", async (_n, eol) => {
    expect((await unlock(pwOnly(eol))).logins.map((l) => l.name)).toEqual(["Netflix", "Mail"]);
  });
  it("BOM / line-wrapped base64 / trailing newline around the file, and a BOM inside the plaintext", async () => {
    const wrapped = (s: string) => "\uFEFF" + s.replace(/(.{76})/g, "$1\r\n") + "\r\n";
    expect((await unlock(pwOnly("\r\n"), wrapped)).logins).toHaveLength(2);
    expect((await unlock("\uFEFF" + pwOnly("\r\n"))).logins).toHaveLength(2);
  });
  it("unpadded single-line base64 (as Samsung Pass writes it) passes the shape check", async () => {
    const text = (await encryptSpass(pwOnly("\r\n") + "xx", TEST_PASSWORD)).replace(/=+$/, "");
    expect(spassShapeError(text, "x.spass")).toBeNull();
    expect((await unlockText(text, TEST_PASSWORD)).logins).toHaveLength(2);
  });
  it("zero logins but cards; empty password table; older export without the third line; unknown extra table", async () => {
    const card = ["name_on_card;card_number;expiration_month;expiration_year;reserved_5", [b64("A"), b64("4111111111111111"), b64("01"), b64("2030"), NULL].join(";")];
    const cardsOnly = await unlock(["30", "false;true;false;false", "false", "next_table", ...card, ""].join("\r\n"));
    expect([cardsOnly.logins.length, cardsOnly.cards.map((c) => c.number)]).toEqual([0, ["4111111111111111"]]);
    const emptyPw = await unlock(["30", "true;true;false;false", "false", "next_table", HDR, "next_table", ...card, ""].join("\r\n"));
    expect([emptyPw.logins.length, emptyPw.cards.length]).toEqual([0, 1]);
    const old = await unlock(["1", "true;true;true;true", "next_table", HDR, appRow, "next_table", "next_table", "next_table", ""].join("\n"));
    expect(old.logins.map((l) => l.name)).toEqual(["Netflix"]);
    const extra = await unlock(["30", "true;false;false;false;true", "false", "next_table", HDR, appRow, "next_table", "foo_col;bar_col", [b64("x"), b64("y")].join(";"), ""].join("\r\n"));
    expect(extra.logins.map((l) => l.name)).toEqual(["Netflix"]);
  });
});

describe("edit fields are typed verbatim", () => {
  it("username, website, password and the export password turn off auto-capitalisation and autocorrect", async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const root = document.getElementById("app")!;
    mount(root, { platform: { save: async () => true } });
    const input = root.querySelector<HTMLInputElement>("#spass-file")!;
    Object.defineProperty(input, "files", { value: [new File([await encryptSpass(pwOnly("\r\n"), TEST_PASSWORD)], "Pass.spass")], configurable: true });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
    const pw = root.querySelector<HTMLInputElement>("#spass-password")!;
    expect([pw.getAttribute("autocapitalize"), pw.getAttribute("autocorrect")]).toEqual(["off", "off"]);
    pw.value = TEST_PASSWORD;
    pw.dispatchEvent(new Event("input"));
    root.querySelector<HTMLButtonElement>("[data-testid=convert]")!.click();
    await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
    root.querySelector<HTMLButtonElement>("[data-testid=browse-logins]")!.click();
    root.querySelector<HTMLButtonElement>("[data-testid=login]")!.click();
    for (const id of ["edit-username", "edit-url", "edit-password"]) {
      const el = root.querySelector(`#${id}`)!;
      expect([id, el.getAttribute("autocapitalize"), el.getAttribute("autocorrect")]).toEqual([id, "off", "off"]);
    }
    expect(root.querySelector("#edit-title")!.getAttribute("autocapitalize")).toBeNull();
  });
});
