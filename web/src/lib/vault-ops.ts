import { loginGaps, normalizeUserUrl, resolvedTitle, type LoginGap } from "./model";
import { siteForPackage } from "./sites";
import type { FormatId, Login } from "./types";

function hostOf(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(v) ? v : /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/.test(v) ? `https://${v}` : "";
  if (!withScheme) return "";
  try {
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Website or app identity: full hostname (www stripped), or a mapped/raw package. Never a title or brand stem. */
export function siteKey(login: Pick<Login, "url" | "appLabel">): string {
  const fromUrl = hostOf(login.url);
  if (fromUrl) return fromUrl;
  const pkg = login.appLabel.trim();
  if (!pkg) return "";
  const mapped = siteForPackage(pkg);
  return hostOf(mapped) || pkg.toLowerCase();
}

export function usernameKey(login: Pick<Login, "username">): string {
  return login.username.trim().toLowerCase();
}

/** Groups of ≥2 logins that share a website or app AND the same username. Password and title are ignored. */
export function duplicateGroups(logins: Login[]): Login[][] {
  const map = new Map<string, Login[]>();
  for (const login of logins) {
    const site = siteKey(login);
    const user = usernameKey(login);
    if (!site || !user) continue;
    const key = `${site}\n${user}`;
    map.set(key, [...(map.get(key) ?? []), login]);
  }
  return [...map.values()].filter((g) => g.length > 1);
}

/** Display name for a duplicate group: "amazon.com". */
export function groupName(group: Login[]): string {
  return siteKey(group[0]) || resolvedTitle(group[0]);
}

export const MERGE_FIELDS = ["name", "url", "username", "password", "note"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeSide = "a" | "b";
export type MergeChoice = Record<MergeField, MergeSide>;

/** A unless A is empty and B is not. */
export function defaultMergeChoice(a: Login, b: Login): MergeChoice {
  const pick = (f: MergeField): MergeSide => (!a[f].trim() && b[f].trim() ? "b" : "a");
  return { name: pick("name"), url: pick("url"), username: pick("username"), password: pick("password"), note: pick("note") };
}

/** Returns one login (A's id) with the chosen fields; never mutates the inputs. */
export function mergeLogins(a: Login, b: Login, choice: MergeChoice): Login {
  const src = (f: MergeField) => (choice[f] === "a" ? a : b);
  const pw = src("password");
  const other = pw === a ? b : a;
  const url = src("url").url;
  return {
    ...a,
    name: src("name").name,
    url,
    username: src("username").username,
    password: pw.password,
    note: src("note").note,
    otp: pw.otp || other.otp,
    otpUri: pw.otp ? pw.otpUri : other.otpUri,
    appLabel: a.appLabel || b.appLabel,
    needsSite: url.trim() === "",
    siteKeptBlank: false
  };
}

export interface LoginEdit {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
}

/** Applies Edit-sheet values. Website is normalised; invalid text leaves it blank. */
export function applyLoginEdit(login: Login, edit: LoginEdit): void {
  login.name = edit.name.trim();
  login.url = normalizeUserUrl(edit.url);
  login.needsSite = login.url === "";
  login.siteKeptBlank = false;
  login.username = edit.username.trim();
  login.password = edit.password;
  login.note = edit.note;
}

/** Logins with any missing title, username or website (website counts for every format). */
export function needsLook(logins: Login[], format: FormatId): Login[] {
  return logins.filter((l) => lookGaps(l, format).length > 0);
}

export function lookGaps(login: Login, format: FormatId): LoginGap[] {
  return loginGaps({ ...login, siteKeptBlank: false }, format);
}

export const GAP_TAG: Record<LoginGap, string> = { title: "No title", username: "No username", url: "No website" };
