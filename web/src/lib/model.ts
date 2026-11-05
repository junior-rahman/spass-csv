import { extractPackage, siteForPackage } from "./sites";
import type { Address, Card, Login, Note, ParsedSpass, SpassTable, Vault } from "./types";

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

const BARE_DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i;

/** Normalizes a URL the user typed, or a bare domain from the export. Returns "" when it is not a site. */
export function normalizeUserUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (BARE_DOMAIN.test(value)) return `https://${value}`;
  return "";
}

export interface ResolvedUrl {
  url: string;
  needsSite: boolean;
  appLabel: string;
}

/** URL comes only from the export itself or the curated package map. Never guessed. */
export function resolveUrl(raw: string, packageName: string): ResolvedUrl {
  const pkg = packageName || extractPackage(raw);
  const mapped = pkg ? siteForPackage(pkg) : "";
  if (mapped) return { url: mapped, needsSite: false, appLabel: pkg };
  if (/^https?:\/\//i.test(raw)) return { url: raw, needsSite: false, appLabel: "" };
  if (pkg) return { url: "", needsSite: true, appLabel: pkg };
  const normalized = normalizeUserUrl(raw);
  if (normalized) return { url: normalized, needsSite: false, appLabel: "" };
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
    const password = pick(row, ["password_value", "password"]);
    const note = pick(row, ["credential_memo", "note", "notes", "memo"]);
    const name = pick(row, ["title", "name", "display_name"]) || resolved.appLabel || rawUrl || username || "Untitled login";
    const otp = otpFields(pick(row, ["otp", "totp", "otp_secret", "one_time_password"]), name, username);
    if (!username && !password && !resolved.url && !note && !otp.otp && name === "Untitled login") return;
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
      appLabel: resolved.appLabel
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
}

export function vaultCount(vault: Vault): number {
  return vault.logins.length + vault.cards.length + vault.addresses.length + vault.notes.length;
}
