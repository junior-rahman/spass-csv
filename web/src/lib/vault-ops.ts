import { loginGaps, normalizeUserUrl, type LoginGap } from "./model";
import type { FormatId, Login } from "./types";

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
