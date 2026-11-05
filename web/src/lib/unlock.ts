import { decryptSpass } from "./crypto";
import { SpassError } from "./errors";
import { looksLikeSpassPlaintext } from "./header";
import { toVault, vaultCount } from "./model";
import { parseSpassText } from "./parse";
import type { Vault } from "./types";

export function isPlaintextExport(text: string): boolean {
  return looksLikeSpassPlaintext(text);
}

export async function unlockText(fileText: string, password: string): Promise<Vault> {
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
