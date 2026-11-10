import { SpassError } from "./errors";
import type { ParsedSpass, SpassTable } from "./types";

const DEFAULT_TYPES = ["passwords", "cards", "addresses", "notes"];
const TYPE_ALIASES: Record<string, string> = {
  password: "passwords",
  passwords: "passwords",
  credential: "passwords",
  credentials: "passwords",
  card: "cards",
  cards: "cards",
  address: "addresses",
  addresses: "addresses",
  identity: "addresses",
  identities: "addresses",
  note: "notes",
  notes: "notes",
  secure_note: "notes",
  secure_notes: "notes"
};
const HEADER_HINTS: Record<string, string[]> = {
  passwords: ["password_value", "username_value", "origin_url", "host_url"],
  cards: ["card_number", "name_on_card", "expiration_month", "security_code"],
  addresses: ["street_address", "postal_code", "country_code"],
  notes: ["note_title", "note_detail"]
};
export const NULL_SENTINEL = "&&&NULL&&&";

function splitLines(text: string): string[] {
  const parts = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

export function parseDataTypes(line: string): string[] {
  const tokens = line.split(/[;,]/).map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.every((token) => token === "true" || token === "false")) {
    const enabled: string[] = [];
    tokens.slice(0, DEFAULT_TYPES.length).forEach((token, index) => {
      if (token === "true") enabled.push(DEFAULT_TYPES[index]);
    });
    return enabled;
  }
  const parsed: string[] = [];
  for (const token of tokens) {
    const alias = TYPE_ALIASES[token];
    if (alias) parsed.push(alias);
  }
  return parsed;
}

function readHeader(lines: string[]): { version: string; dataTypes: string[]; rest: string[] } {
  const first = (lines[0] ?? "").trim();
  const second = (lines[1] ?? "").trim();
  if (first === "samsung_pass_export" && second.toLowerCase().startsWith("version:")) {
    return { version: second, dataTypes: [], rest: lines.slice(2) };
  }
  return { version: first, dataTypes: parseDataTypes(second), rest: lines.slice(2) };
}

/** Toggles quote state for each unescaped `"` ("" toggles twice, so parity is enough). */
function quoteOpenAfter(line: string, open: boolean): boolean {
  let state = open;
  for (const ch of line) if (ch === '"') state = !state;
  return state;
}

/** Splits on `next_table`, quote-aware: a quoted field may span lines (blank lines, indentation, even "next_table"). */
function splitTables(lines: string[]): string[][] {
  const tables: string[][] = [];
  let current: string[] = [];
  let open = false;
  for (const raw of lines) {
    if (open) {
      current[current.length - 1] += `\n${raw}`;
      open = quoteOpenAfter(raw, true);
      continue;
    }
    const line = raw.trim();
    if (!line) continue;
    if (line === "next_table") {
      if (current.length) tables.push(current);
      current = [];
      continue;
    }
    if (current.length === 0 && !line.includes(";")) continue;
    open = quoteOpenAfter(line, false);
    // Keep trailing spaces that belong to a quoted field continuing on the next line.
    current.push(open ? raw.trimStart() : line);
  }
  if (current.length) tables.push(current);
  return tables;
}

export function parseSemicolonRecords(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ";") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

function isPrintable(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13 || code === 32) continue;
    if (code < 32 || code === 127) return false;
  }
  return true;
}

export function decodeField(field: string): string {
  if (field === "" || field === NULL_SENTINEL) return "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(field)) return field;
  const body = field.replace(/=+$/, "");
  if (body.length % 4 === 1) return field;
  const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text && isPrintable(text)) return text === NULL_SENTINEL ? "" : text;
  } catch {
    // not base64 text; keep raw field
  }
  return field;
}

function inferType(headers: string[]): string | null {
  const set = new Set(headers);
  for (const [type, hints] of Object.entries(HEADER_HINTS)) {
    if (hints.some((hint) => set.has(hint))) return type;
  }
  return null;
}

function parseTable(type: string, lines: string[]): SpassTable {
  const records = parseSemicolonRecords(lines.join("\n"));
  if (records.length === 0) return { type, headers: [], rows: [] };
  const headers = records[0].map((header) => header.trim());
  if (headers.length === 0 || headers.some((header) => !header)) {
    throw new SpassError("format", "This export has a table Samsung Pass didn't finish writing.");
  }
  const rows: Record<string, string>[] = [];
  for (const fields of records.slice(1)) {
    const width = Math.max(headers.length, fields.length);
    while (headers.length < width) headers.push(`extra_${headers.length + 1}`);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = decodeField(fields[i] ?? "");
    rows.push(row);
  }
  return { type, headers, rows };
}

export function parseSpassText(decrypted: string): ParsedSpass {
  const lines = splitLines(decrypted);
  if (lines.length < 3) throw new SpassError("format", "This file does not look like a Samsung Pass export.");
  const { version, dataTypes, rest } = readHeader(lines);
  const chunks = splitTables(rest);
  if (chunks.length === 0) throw new SpassError("format", "The file unlocked, but it has no password tables.");
  const tables = chunks.map((chunk, index) => {
    const headers = parseSemicolonRecords(chunk[0])[0]?.map((header) => header.trim()) ?? [];
    const type = inferType(headers) ?? dataTypes[index] ?? `table_${index + 1}`;
    return parseTable(type, chunk);
  });
  return { version, tables };
}
