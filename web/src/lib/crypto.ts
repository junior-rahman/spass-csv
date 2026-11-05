import { asBuffer, base64ToBytes, bytesToBase64 } from "./bytes";
import { SpassError, WRONG_PASSWORD } from "./errors";
import { looksLikeSpassPlaintext } from "./header";

export const SALT_BYTES = 20;
export const IV_BYTES = 16;
export const ITERATIONS = 70000;

const encoder = new TextEncoder();

async function deriveKey(password: string, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBuffer(salt), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-CBC", length: 256 },
    false,
    [usage]
  );
}

export async function decryptSpass(fileText: string, password: string): Promise<string> {
  const compact = fileText.replace(/^\uFEFF/, "").replace(/\s+/g, "");
  if (!compact) throw new SpassError("format", "That file is empty.");
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(compact);
  } catch {
    throw new SpassError(
      "format",
      "This is not a Samsung Pass .spass file. Export again from Samsung Pass, or pick the .spass file rather than a screenshot."
    );
  }
  if (raw.length < SALT_BYTES + IV_BYTES + 16) {
    throw new SpassError("format", "This file is too small to be a Samsung Pass export.");
  }
  if ((raw.length - SALT_BYTES - IV_BYTES) % 16 !== 0) {
    throw new SpassError("format", "This file is not a complete Samsung Pass export.");
  }
  const salt = raw.subarray(0, SALT_BYTES);
  const iv = raw.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = raw.subarray(SALT_BYTES + IV_BYTES);
  let plain: ArrayBuffer;
  try {
    const key = await deriveKey(password, salt, "decrypt");
    plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: asBuffer(iv) }, key, asBuffer(ciphertext));
  } catch {
    throw new SpassError("password", WRONG_PASSWORD);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(plain);
  } catch {
    throw new SpassError("password", WRONG_PASSWORD);
  }
  if (!looksLikeSpassPlaintext(text)) throw new SpassError("password", WRONG_PASSWORD);
  return text;
}

export async function encryptSpass(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, "encrypt");
  const cipher = await crypto.subtle.encrypt({ name: "AES-CBC", iv: asBuffer(iv) }, key, asBuffer(encoder.encode(plaintext)));
  const cipherBytes = new Uint8Array(cipher);
  const out = new Uint8Array(SALT_BYTES + IV_BYTES + cipherBytes.length);
  out.set(salt, 0);
  out.set(iv, SALT_BYTES);
  out.set(cipherBytes, SALT_BYTES + IV_BYTES);
  return bytesToBase64(out);
}
