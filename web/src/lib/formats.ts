import type { FormatId } from "./types";

export interface FormatInfo {
  id: FormatId;
  label: string;
  fileName: string;
  hint: string;
  /** Post-Save checklist (ordered). */
  importSteps: readonly string[];
}

/** Equal order and weight. Default when nothing stored: 1Password. */
export const FORMATS: readonly FormatInfo[] = [
  { id: "1password", label: "1Password", fileName: "samsung-pass-1password.csv", hint: "Import at my.1password.com → Import → CSV. On the Label step pick, left to right: Title, Website, Username, Password, Notes.", importSteps: ["Open my.1password.com in a browser and sign in.", "Go to Import → CSV File and upload the saved CSV.", "On the Label step, set columns left to right: Title, Website, Username, Password, Notes.", "Blank Website cells are OK — add real URLs later so autofill works.", "Tap Continue, then delete the CSV (it is plaintext)."] },
  { id: "google", label: "Google Password Manager", fileName: "samsung-pass-google.csv", hint: "Chrome → Password Manager → Settings → Import. One-time codes go in the note.", importSteps: ["Open Chrome → Google Password Manager → Settings.", "Tap Import passwords and choose the saved CSV.", "Logins without a website show as “no url” — edit them later.", "Delete the CSV when the import finishes (it is plaintext)."] },
  { id: "apple", label: "Apple Passwords", fileName: "samsung-pass-apple.csv", hint: "Settings → Apps → Passwords → Import passwords. One-time codes go in OTPAuth.", importSteps: ["On your iPhone or Mac open Settings → Apps → Passwords.", "Choose Import passwords and pick the saved CSV.", "One-time codes import through the OTPAuth column.", "Delete the CSV when the import finishes (it is plaintext)."] },
  { id: "bitwarden", label: "Bitwarden", fileName: "samsung-pass-bitwarden.csv", hint: "Import as Bitwarden (csv). Logins and notes are in this file. Cards are separate.", importSteps: ["Open the Bitwarden web vault → Tools → Import data.", "Choose file format “Bitwarden (csv)” and upload the saved CSV.", "Logins and secure notes come in together; cards are separate.", "Delete the CSV when the import finishes (it is plaintext)."] }
];

export const DEFAULT_FORMAT: FormatId = "1password";

export function isFormatId(value: unknown): value is FormatId {
  return FORMATS.some((format) => format.id === value);
}

export function fileNameFor(format: FormatId): string {
  return FORMATS.find((item) => item.id === format)!.fileName;
}
