import { decryptSpass } from "./crypto";
import { SpassError } from "./errors";
import { looksLikeSpassPlaintext } from "./header";
import { toVault, vaultCount } from "./model";
import { parseSpassText } from "./parse";
import type { Vault } from "./types";

/** Real Samsung Pass exports are well under 10 MB; refuse anything absurd before reading/decrypting it. */
export const MAX_SPASS_BYTES = 64 * 1024 * 1024;
export const TOO_LARGE = "This file is too large to be a Samsung Pass export.";

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
