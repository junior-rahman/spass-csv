import type { FormatId } from "./types";

export interface FormatInfo {
  id: FormatId;
  label: string;
  fileName: string;
  hint: string;
}

/** Equal order and weight. Default when nothing stored: 1Password. */
export const FORMATS: readonly FormatInfo[] = [
  { id: "1password", label: "1Password", fileName: "samsung-pass-1password.csv", hint: "Import at my.1password.com → Import → CSV. On the Label step pick, left to right: Title, Website, Username, Password, Notes." },
  { id: "google", label: "Google", fileName: "samsung-pass-google.csv", hint: "Chrome → Password Manager → Settings → Import. One-time codes go in the note." },
  { id: "apple", label: "Apple", fileName: "samsung-pass-apple.csv", hint: "Settings → Apps → Passwords → Import passwords. One-time codes go in OTPAuth." },
  { id: "bitwarden", label: "Bitwarden", fileName: "samsung-pass-bitwarden.csv", hint: "Import as Bitwarden (csv). Logins and notes are in this file. Cards are separate." }
];

export const DEFAULT_FORMAT: FormatId = "1password";

export function isFormatId(value: unknown): value is FormatId {
  return FORMATS.some((format) => format.id === value);
}

export function fileNameFor(format: FormatId): string {
  return FORMATS.find((item) => item.id === format)!.fileName;
}
