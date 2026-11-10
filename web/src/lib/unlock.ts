import { base64ToBytes } from "./bytes";
import { IV_BYTES, SALT_BYTES, decryptSpass } from "./crypto";
import { SpassError } from "./errors";
import { looksLikeSpassPlaintext } from "./header";
import { toVault, vaultCount } from "./model";
import { parseSpassText } from "./parse";
import type { Vault } from "./types";

/** Real Samsung Pass exports are well under 10 MB; refuse anything absurd before reading/decrypting it. */
export const MAX_SPASS_BYTES = 64 * 1024 * 1024;
export const TOO_LARGE = "This file is too large to be a Samsung Pass export.";

export const NOT_SPASS_NAME = "That's not a .spass file. In Samsung Pass, use Export data, then choose the file that ends in .spass.";
export const NOT_SPASS_CONTENT = "This file isn't a valid Samsung Pass export. It may be damaged or incomplete. Export it again from Samsung Pass.";
export const EMPTY_FILE = "That file is empty. Export again from Samsung Pass.";

/**
 * Cheap shape check run as soon as a file is picked, before asking for a password.
 * A .spass is either a plaintext Samsung Pass export or base64(salt 20 | iv 16 | AES-CBC blocks).
 * Returns null when the file could be a Samsung Pass export, otherwise the message to show.
 */
export function spassShapeError(fileText: string, fileName = ""): string | null {
  if (fileText.length > MAX_SPASS_BYTES) return TOO_LARGE;
  const text = fileText.replace(/^\uFEFF/, "");
  if (isPlaintextExport(text)) return null;
  const named = /\.spass$/i.test(fileName.trim());
  const compact = text.replace(/\s+/g, "");
  if (!compact) return named ? EMPTY_FILE : NOT_SPASS_NAME;
  const bad = named ? NOT_SPASS_CONTENT : NOT_SPASS_NAME;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return bad;
  let length: number;
  try { length = base64ToBytes(compact).length; } catch { return bad; }
  if (length < SALT_BYTES + IV_BYTES + 16 || (length - SALT_BYTES - IV_BYTES) % 16 !== 0) return bad;
  return null;
}

export function isPlaintextExport(text: string): boolean {
  return looksLikeSpassPlaintext(text);
}

export async function unlockText(fileText: string, password: string): Promise<Vault> {
  if (fileText.length > MAX_SPASS_BYTES) throw new SpassError("format", TOO_LARGE);
  const text = fileText.replace(/^\uFEFF/, "");
  if (isPlaintextExport(text)) {
    const vault = toVault(parseSpassText(text), true);
    if (vaultCount(vault) === 0) throw new SpassError("format", "The file opened, but it has no logins, cards, addresses, or notes.");
    return vault;
  }
  if (!password) throw new SpassError("empty", "Enter the export password you set in Samsung Pass.");
  if (!globalThis.crypto?.subtle) throw new SpassError("format", "This browser can't unlock files. Open the page in Chrome.");
  const plain = await decryptSpass(text, password);
  const vault = toVault(parseSpassText(plain), false);
  if (vaultCount(vault) === 0) throw new SpassError("format", "The file unlocked, but it has no logins, cards, addresses, or notes.");
  return vault;
}
