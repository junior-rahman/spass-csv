export interface SpassTable {
  type: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface ParsedSpass {
  version: string;
  tables: SpassTable[];
}

export interface Login {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
  otp: string;
  otpUri: string;
  needsSite: boolean;
  appLabel: string;
  /** User chose "Keep" for a login with no website; exported blank (or "no url" for Google). */
  siteKeptBlank?: boolean;
}

export interface Card {
  id: string;
  nickname: string;
  holder: string;
  number: string;
  expMonth: string;
  expYear: string;
  code: string;
  note: string;
}

export interface Address {
  id: string;
  name: string;
  company: string;
  street: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  phone: string;
  email: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
}

export interface Vault {
  version: string;
  logins: Login[];
  cards: Card[];
  addresses: Address[];
  notes: Note[];
  passwordTable: SpassTable | null;
  otherTables: SpassTable[];
  alreadyPlain: boolean;
}

export type FormatId = "1password" | "google" | "apple" | "bitwarden" | "other";
