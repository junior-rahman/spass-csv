import { DEFAULT_FORMAT, isFormatId, type FormatId } from "../lib";

export const FORMAT_KEY = "passtocsv.format";

export function loadFormat(): FormatId {
  try {
    const stored = globalThis.localStorage?.getItem(FORMAT_KEY);
    return isFormatId(stored) ? stored : DEFAULT_FORMAT;
  } catch {
    return DEFAULT_FORMAT;
  }
}

export function storeFormat(format: FormatId): void {
  try {
    globalThis.localStorage?.setItem(FORMAT_KEY, format);
  } catch {
    // storage blocked; default applies next time
  }
}
