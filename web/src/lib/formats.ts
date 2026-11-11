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
  { id: "1password", label: "1Password", fileName: "samsung-pass-1password.csv", hint: "At my.1password.com: your name → Import data → CSV File. On the Label step pick, left to right: Title, Website, Username, Password, Notes.", importSteps: ["Open my.1password.com in a browser and sign in.", "Select your name (top right) → Import data → CSV File, and upload the saved CSV.", "On the Label step, set columns left to right: Title, Website, Username, Password, Notes.", "Blank Website cells are OK — add real URLs later so autofill works.", "Select Continue, then delete the CSV (it is plain text)."] },
  { id: "google", label: "Google Password Manager", fileName: "samsung-pass-google.csv", hint: "Chrome → Settings → Google Password Manager → Settings → Import passwords. One-time codes go in the note.", importSteps: ["Open Chrome → Settings → Google Password Manager → Settings.", "Tap Import passwords and choose the saved CSV.", "Google can’t import a login without a website (or with a note over 1,000 characters). It lists those as not imported — add them by hand. App logins whose export carries an Android app link import as app logins.", "Delete the CSV when the import finishes (it is plain text)."] },
  { id: "apple", label: "Apple Passwords", fileName: "samsung-pass-apple.csv", hint: "iPhone: Settings → Apps → Safari → Import. Mac: Passwords → File → Import Passwords. One-time codes go in OTPAuth.", importSteps: ["iPhone or iPad: open Settings → Apps → Safari and tap Import (below History and Website Data).", "Tap Choose File, pick the saved CSV, then Import to Safari — it lands in the Passwords app. On a Mac: Passwords → File → Import Passwords.", "One-time codes import through the OTPAuth column.", "Apple Passwords may skip logins without a website and lists what it couldn’t import — add those by hand.", "Delete the CSV when the import finishes (it is plain text)."] },
  { id: "bitwarden", label: "Bitwarden", fileName: "samsung-pass-bitwarden.csv", hint: "Import as Bitwarden (csv). Logins and notes are in this file. Cards are separate.", importSteps: ["Open the Bitwarden web vault → Tools → Import data.", "Choose file format “Bitwarden (csv)” and upload the saved CSV.", "Logins and secure notes come in together; cards are separate.", "Delete the CSV when the import finishes (it is plain text)."] },
  { id: "other", label: "Other", fileName: "passwords.csv", hint: "Any other app or spreadsheet. Columns: Title, Website, Username, Password, Notes.", importSteps: ["Open your password manager’s import screen (often under Settings or Tools → Import).", "Choose a generic CSV import and pick the saved passwords.csv.", "Match the columns: Title, Website, Username, Password, Notes.", "Delete the CSV when the import finishes (it is plain text)."] }
];

/** The four named destinations shown as 2×2 tiles; "other" is the row below them. */
export const NAMED_FORMATS = FORMATS.filter((f) => f.id !== "other");

export const DEFAULT_FORMAT: FormatId = "1password";

export function isFormatId(value: unknown): value is FormatId {
  return FORMATS.some((format) => format.id === value);
}

export function fileNameFor(format: FormatId): string {
  return FORMATS.find((item) => item.id === format)!.fileName;
}
