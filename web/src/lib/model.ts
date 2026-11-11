import { extractPackage, siteForPackage } from "./sites";
import type { Address, Card, FormatId, Login, Note, ParsedSpass, SpassTable, Vault } from "./types";

function clean(value: string | undefined): string {
  const v = (value ?? "").replace(/\u0000/g, "").trim();
  return v === "&&&NULL&&&" ? "" : v;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }
  return "";
}

/** Like pick, but never trims: a password's leading/trailing spaces are part of the secret. */
function pickExact(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = (row[key] ?? "").replace(/\u0000/g, "");
    if (value.trim() === "&&&NULL&&&") continue;
    if (value.trim()) return value;
  }
  return "";
}

/** Bare host: ASCII or internationalised labels (münchen.de, xn--…), letter TLD or punycode TLD (xn--p1ai). */
const BARE_DOMAIN = /^[\p{L}\p{N}.-]+\.(\p{L}{2,}|xn--[a-z0-9-]+)\.?([/:?#].*)?$/iu;
/** localhost with an optional port or path (local dev servers, router UIs). */
const BARE_LOCALHOST = /^localhost(:\d{1,5})?([/?#].*)?$/i;
const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
/** Bare IPv4 host (router / NAS logins), optional port or path. */
const BARE_IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}([/:?#].*)?$`);

/** Normalizes a URL the user typed, or a bare domain from the export. Returns "" when it is not a site. */
export function normalizeUserUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (BARE_DOMAIN.test(value) || BARE_IPV4.test(value) || BARE_LOCALHOST.test(value)) return `https://${value}`;
  return "";
}

export interface ResolvedUrl {
  url: string;
  needsSite: boolean;
  appLabel: string;
}

/** URL comes from the export first, then the curated package map. A real website is never overwritten. */
export function resolveUrl(raw: string, packageName: string): ResolvedUrl {
  const rawPkg = extractPackage(raw);
  const pkg = packageName || rawPkg;
  if (/^https?:\/\//i.test(raw)) return { url: raw, needsSite: false, appLabel: packageName || "" };
  // Bare domains (netflix.com) win over a package field such as Samsung Internet.
  if (!rawPkg) {
    const normalized = normalizeUserUrl(raw);
    if (normalized) return { url: normalized, needsSite: false, appLabel: packageName || "" };
  }
  const mapped = pkg ? siteForPackage(pkg) : "";
  if (mapped) return { url: mapped, needsSite: false, appLabel: pkg };
  if (pkg) return { url: "", needsSite: true, appLabel: pkg };
  return { url: "", needsSite: true, appLabel: "" };
}

export function otpFields(otp: string, name: string, username: string): { otp: string; otpUri: string } {
  const value = otp.trim();
  if (!value) return { otp: "", otpUri: "" };
  if (value.toLowerCase().startsWith("otpauth://")) return { otp: value, otpUri: value };
  const secret = value.replace(/\s+/g, "");
  if (/^[A-Za-z2-7]+=*$/.test(secret) && secret.replace(/=/g, "").length >= 16) {
    const label = encodeURIComponent(username ? `${name}:${username}` : name || "Account");
    const issuer = encodeURIComponent(name || "Account");
    return { otp: value, otpUri: `otpauth://totp/${label}?secret=${secret.replace(/=/g, "").toUpperCase()}&issuer=${issuer}` };
  }
  return { otp: value, otpUri: "" };
}

function table(parsed: ParsedSpass, type: string): SpassTable | null {
  return parsed.tables.find((item) => item.type === type) ?? null;
}

export function toVault(parsed: ParsedSpass, alreadyPlain = false): Vault {
  const passwordTable = table(parsed, "passwords");
  const logins: Login[] = [];
  (passwordTable?.rows ?? []).forEach((row, index) => {
    const packageName = pick(row, ["package_name", "app_package", "package"]);
    const rawUrl = pick(row, ["host_url", "origin_url", "url", "action_url"]);
    const resolved = resolveUrl(rawUrl, packageName);
    const username = pick(row, ["username_value", "username", "email", "user_id"]);
    const password = pickExact(row, ["password_value", "password"]);
    const note = pick(row, ["credential_memo", "note", "notes", "memo"]);
    // A website login (raw http(s) URL or bare domain) is saved by a browser: its app_name / package is the browser
    // ("Samsung Internet", com.sec.android.app.sbrowser), never the site. Leave the name empty so the title is the host.
    const webLogin = /^https?:\/\//i.test(rawUrl) || (!extractPackage(rawUrl) && normalizeUserUrl(rawUrl) !== "");
    const appLabel = webLogin ? "" : resolved.appLabel;
    const name = pick(row, ["title", "name", "display_name"]) || (webLogin ? "" : pick(row, ["app_name"]) || appLabel || rawUrl) || (resolved.url ? "" : username);
    const otp = otpFields(pick(row, ["otp", "totp", "otp_secret", "one_time_password"]), resolvedTitle({ name, url: resolved.url, username, appLabel }), username);
    if (!username && !password && !resolved.url && !note && !otp.otp && !name) return;
    logins.push({
      id: `login-${index}`,
      name,
      url: resolved.url,
      username,
      password,
      note,
      otp: otp.otp,
      otpUri: otp.otpUri,
      needsSite: resolved.needsSite,
      appLabel
    });
  });
  const cards: Card[] = (table(parsed, "cards")?.rows ?? [])
    .map((row, index) => ({
      id: `card-${index}`,
      nickname: pick(row, ["reserved_5", "card_name", "nickname", "name"]) || "Card",
      holder: pick(row, ["name_on_card", "cardholder_name", "holder"]),
      number: pick(row, ["card_number", "number"]),
      expMonth: pick(row, ["expiration_month", "exp_month"]),
      expYear: pick(row, ["expiration_year", "exp_year"]),
      code: pick(row, ["security_code", "cvv", "cvc"]),
      note: pick(row, ["card_memo", "memo", "note", "notes"])
    }))
    .filter((card) => card.holder || card.number || card.nickname !== "Card");
  const addresses: Address[] = (table(parsed, "addresses")?.rows ?? [])
    .map((row, index) => ({
      id: `address-${index}`,
      name: pick(row, ["name", "full_name", "first_name"]),
      company: pick(row, ["company", "company_name"]),
      street: pick(row, ["street_address", "address1", "address", "street"]),
      city: pick(row, ["city"]),
      state: pick(row, ["state", "region", "province"]),
      postal: pick(row, ["postal_code", "zip", "zipcode"]),
      country: pick(row, ["country_code", "country"]),
      phone: pick(row, ["phone", "phone_number", "tel"]),
      email: pick(row, ["email"])
    }))
    .filter((item) => item.name || item.street || item.city);
  const notes: Note[] = (table(parsed, "notes")?.rows ?? [])
    .map((row, index) => ({
      id: `note-${index}`,
      title: pick(row, ["note_title", "title", "name"]) || "Note",
      body: pick(row, ["note_detail", "note", "notes", "detail", "content"])
    }))
    .filter((item) => item.title !== "Note" || item.body);
  const known = new Set(["passwords", "cards", "addresses", "notes"]);
  const otherTables = parsed.tables.filter((item) => !known.has(item.type) && item.rows.length > 0);
  return { version: parsed.version, logins, cards, addresses, notes, passwordTable, otherTables, alreadyPlain };
}

/** Applies a website the user typed for one login. Invalid input leaves the URL blank. */
export function setManualSite(login: Login, input: string): void {
  login.url = normalizeUserUrl(input);
  login.needsSite = login.url === "";
  login.siteKeptBlank = false;
}

export function vaultCount(vault: Vault): number {
  return vault.logins.length + vault.cards.length + vault.addresses.length + vault.notes.length;
}

export const PLACEHOLDER_TITLE = "no title";
export const PLACEHOLDER_USERNAME = "no username";
export const PLACEHOLDER_URL = "no url";

/** Every format flags a blank website as a gap (warned on Save). */
export function formatFlagsMissingUrl(_format: FormatId): boolean {
  return true;
}

/**
 * Only Google gets the "no url" placeholder. Google Password Manager does not import a login without an http(s) or
 * android:// URL at all (Chromium password_importer: MISSING_URL / INVALID_URL); the placeholder makes those rows easy
 * to recognise in Google's "not imported" list. 1Password / Apple / Bitwarden accept an empty website cell.
 */
export function formatRequiresUrl(format: FormatId): boolean {
  return format === "google";
}

/** Name → app label → URL host → username. Empty string when none of those exist. Never invents a URL. */
export function resolvedTitle(login: Pick<Login, "name" | "url" | "username"> & { appLabel?: string }): string {
  const name = login.name.trim() || (login.appLabel ?? "").trim();
  if (name) return name;
  try {
    const host = new URL(login.url).hostname.replace(/^www\./, "");
    if (host) return host;
  } catch { /* no usable URL */ }
  return login.username.trim();
}

/** Import-safe label: resolvedTitle → "no title". Never empty; never invents a URL. */
export function displayTitle(login: Pick<Login, "name" | "url" | "username"> & { appLabel?: string }): string {
  return resolvedTitle(login) || PLACEHOLDER_TITLE;
}

export type LoginGap = "title" | "username" | "url" | "note";

/** Appends a one-time-code secret to the note (formats without an OTP column). */
export function noteWithOtp(note: string, otp: string): string {
  if (!otp) return note;
  if (note.includes(otp)) return note;
  const line = `OTP: ${otp}`;
  return note ? `${note}\n${line}` : line;
}

/**
 * Google Password Manager rejects a CSV row whose note is longer than 1,000 bytes (UTF-8), so the whole login is
 * skipped (Chromium kMaxPasswordNoteLength, checked on std::string length). The note written includes the OTP line.
 */
export const GOOGLE_NOTE_MAX_BYTES = 1000;
export function googleNoteTooLong(login: Pick<Login, "note" | "otp">): boolean {
  return new TextEncoder().encode(noteWithOtp(login.note, login.otp)).length > GOOGLE_NOTE_MAX_BYTES;
}

/** Required CSV fields that are still empty (or, for Google, a note it would reject). Password is never listed. */
export function loginGaps(login: Login, format: FormatId): LoginGap[] {
  const gaps: LoginGap[] = [];
  if (!resolvedTitle(login)) gaps.push("title");
  if (!login.username.trim()) gaps.push("username");
  if (formatFlagsMissingUrl(format) && !login.url.trim() && !(login.siteKeptBlank && !formatRequiresUrl(format))) gaps.push("url");
  if (format === "google" && googleNoteTooLong(login)) gaps.push("note");
  return gaps;
}

/** Short phrase per gap for lists ("Bank — no website, note too long"). */
export const GAP_LABEL: Record<LoginGap, string> = { title: "no title", username: "no username", url: "no website", note: "note too long for Google" };
/** Gaps Google can still take as a file: it lists those rows as not imported instead of the whole import failing. */
export const SKIPPABLE_GAPS: readonly LoginGap[] = ["url", "note"];

export function incompleteLogins(logins: Login[], format: FormatId): Login[] {
  return logins.filter((login) => loginGaps(login, format).length > 0);
}

/** Fills empty required fields with locked placeholders. Never invents a password. */
export function applyPlaceholders(login: Login, format: FormatId): void {
  if (!resolvedTitle(login)) login.name = PLACEHOLDER_TITLE;
  if (!login.username.trim()) login.username = PLACEHOLDER_USERNAME;
  if (!login.url.trim()) {
    if (formatRequiresUrl(format)) login.url = PLACEHOLDER_URL;
    else login.siteKeptBlank = true;
    login.needsSite = false;
  }
}

export function csvUsername(login: Pick<Login, "username">): string {
  return login.username.trim() || PLACEHOLDER_USERNAME;
}

export function csvUrl(login: Pick<Login, "url">, format: FormatId): string {
  if (login.url.trim()) return login.url;
  return formatRequiresUrl(format) ? PLACEHOLDER_URL : "";
}
