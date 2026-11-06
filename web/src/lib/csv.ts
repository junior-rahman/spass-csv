import { csvUrl, csvUsername, displayTitle, resolvedTitle } from "./model";
import type { Address, Card, FormatId, Login, Note, SpassTable } from "./types";

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Quotes a CSV cell. When formulaSafe, a leading = + - @ TAB CR is prefixed with ' so spreadsheets do not execute it. */
export function cell(value: string, formulaSafe = true): string {
  let v = value;
  if (formulaSafe && FORMULA_LEAD.test(v)) v = `'${v}`;
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** rawColumns: header names written verbatim (passwords, TOTP secrets, card numbers/codes). */
export function toCsv(headers: string[], rows: string[][], rawColumns: string[] = [], bom = true, omitHeader = false): string {
  const raw = headers.map((header) => rawColumns.includes(header));
  const head = headers.map((header) => cell(header, false)).join(",");
  const body = rows.map((row) => headers.map((_, i) => cell(row[i] ?? "", !raw[i])).join(","));
  const lines = omitHeader ? body : [head, ...body];
  return lines.length ? `${bom ? "\uFEFF" : ""}${lines.join("\r\n")}\r\n` : "";
}

export function noteWithOtp(note: string, otp: string): string {
  if (!otp) return note;
  if (note.includes(otp)) return note;
  const line = `OTP: ${otp}`;
  return note ? `${note}\n${line}` : line;
}

export function loginsToCsv(logins: Login[], notes: Note[], format: FormatId): string {
  if (format === "1password") {
    return toCsv(
      // 1Password's official layout: headerless Title,Website,Username,Password,Notes (labelled once in their UI).
      ["Title", "Website", "Username", "Password", "Notes"],
      logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, l.note]),
      ["Password"],
      false,
      true
    );
  }
  if (format === "other") {
    // Keep blank Title / Website / Username as empty cells — no placeholders.
    return toCsv(
      ["Title", "Website", "Username", "Password", "Notes"],
      logins.map((l) => [resolvedTitle(l), csvUrl(l, format), l.username.trim(), l.password, l.note]),
      ["Password"],
      false
    );
  }
  if (format === "apple") {
    return toCsv(
      ["Title", "URL", "Username", "Password", "Notes", "OTPAuth"],
      logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, l.otpUri ? l.note : noteWithOtp(l.note, l.otp), l.otpUri]),
      ["Password", "OTPAuth"],
      false
    );
  }
  if (format === "bitwarden") {
    const headers = [
      "folder", "favorite", "type", "name", "notes", "fields", "reprompt",
      "login_uri", "login_username", "login_password", "login_totp"
    ];
    const loginRows = logins.map((l) => [
      "", "0", "login", displayTitle(l), l.note, "", "0", csvUrl(l, format), csvUsername(l), l.password, l.otpUri || l.otp
    ]);
    const noteRows = notes.map((n) => ["", "0", "note", n.title.trim() || "Note", n.body, "", "0", "", "", "", ""]);
    return toCsv(headers, [...loginRows, ...noteRows], ["login_password", "login_totp"], false);
  }
  return toCsv(
    ["name", "url", "username", "password", "note"],
    logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, noteWithOtp(l.note, l.otp)]),
    ["password"],
    false
  );
}

export function cardsToCsv(cards: Card[]): string {
  return toCsv(
    ["nickname", "name_on_card", "number", "exp_month", "exp_year", "security_code", "note"],
    cards.map((c) => [c.nickname, c.holder, c.number, c.expMonth, c.expYear, c.code, c.note]),
    ["number", "exp_month", "exp_year", "security_code"]
  );
}

export function addressesToCsv(addresses: Address[]): string {
  return toCsv(
    ["name", "company", "street", "city", "state", "postal_code", "country", "phone", "email"],
    addresses.map((a) => [a.name, a.company, a.street, a.city, a.state, a.postal, a.country, a.phone, a.email]),
    ["phone"]
  );
}

export function notesToCsv(notes: Note[]): string {
  return toCsv(["title", "details"], notes.map((n) => [n.title, n.body]));
}

export function tableToCsv(table: SpassTable): string {
  return toCsv(table.headers, table.rows.map((row) => table.headers.map((header) => row[header] ?? "")));
}
