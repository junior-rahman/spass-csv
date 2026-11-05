/**
 * Strict Samsung Pass plaintext check. A decrypt with a wrong key that happens
 * to pass PKCS7 padding must never reach the parser.
 * Accepts either:
 *   line 1 "samsung_pass_export", line 2 "version:<n>"
 *   line 1 numeric version (e.g. "25"), line 2 data-type flags/names separated by ";" or ","
 * AND at least one line that is exactly "next_table".
 */
const TYPE_TOKEN = /^(true|false|passwords?|credentials?|cards?|address(es)?|identit(y|ies)|notes?|secure_notes?)$/i;

export function looksLikeSpassPlaintext(text: string): boolean {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
  if (lines.length < 3) return false;
  const [first, second] = lines;
  let headerOk = false;
  if (first === "samsung_pass_export" && /^version:\s*\S+$/i.test(second)) headerOk = true;
  if (/^\d{1,4}$/.test(first)) {
    const tokens = second.split(/[;,]/).map((token) => token.trim()).filter(Boolean);
    headerOk = tokens.length > 0 && tokens.every((token) => TYPE_TOKEN.test(token));
  }
  if (!headerOk) return false;
  return lines.slice(2).some((line) => line === "next_table");
}
