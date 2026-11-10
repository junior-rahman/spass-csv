// 2.0.22: property / fuzz tests — parser + every exporter round-trip through a strict RFC 4180 parser; garbage and truncated inputs only raise SpassError. Seeded, deterministic.
import { bytesToBase64 } from "../src/lib/bytes";
import { SpassError, encryptSpass, unlockText, spassShapeError, parseSpassText, toVault, loginsToCsv, cardsToCsv, addressesToCsv, notesToCsv, type FormatId } from "../src/lib";
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const ATOMS = ["a", "Z", "0", " ", ",", ";", '"', "'", "\n", "\r\n", "\t", "=", "+", "-", "@", "é", "ß", "م", "😀", "👨‍👩‍👧", "\u202e", "\u00a0", "next_table", "&&&NULL&&&", "https://", ".com", "\\", "/", "?", "#"];
const str = (max = 12) => Array.from({ length: Math.floor(rnd() * max) }, () => pick(ATOMS)).join("");
const b64 = (v: string) => bytesToBase64(new TextEncoder().encode(v));
function parseCsvStrict(s: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ""; let q = false; let quoted = false;
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else { q = false; if (i + 1 < s.length && !",\r".includes(s[i + 1])) throw new Error(`junk after quote at ${i}`); } } else f += c; continue; }
    if (c === '"') { if (f !== "" || quoted) throw new Error(`stray quote at ${i}`); q = true; quoted = true; continue; }
    if (c === ",") { row.push(f); f = ""; quoted = false; continue; }
    if (c === "\r") { if (s[i + 1] !== "\n") throw new Error(`bare CR at ${i}`); i++; row.push(f); rows.push(row); row = []; f = ""; quoted = false; continue; }
    if (c === "\n") throw new Error(`bare LF outside quotes at ${i}`);
    f += c; }
  if (q) throw new Error("unterminated quote");
  if (f !== "" || row.length) throw new Error("missing final CRLF");
  return rows;
}
const COLS: Record<FormatId, { pw: number; user: number; header: boolean; n: number }> = {
  "1password": { pw: 3, user: 2, header: false, n: 5 }, other: { pw: 3, user: 2, header: true, n: 5 }, google: { pw: 3, user: 2, header: true, n: 5 },
  apple: { pw: 3, user: 2, header: true, n: 6 }, bitwarden: { pw: 9, user: 8, header: true, n: 11 }
};
describe("fuzz", () => {
  it("parser + exporters round-trip random logins", () => {
    for (let iter = 0; iter < 400; iter++) {
      const rows = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => [str(), pick(["", "https://x.example/" + str(4), "x.example", "com.foo.app", str(6)]), str(), str(), str(20), ""]);
      const text = ["25", "true;true;true;true", "false", "next_table", "title;host_url;username_value;password_value;credential_memo;otp",
        ...rows.map((r) => r.map((c) => (c ? b64(c) : "")).join(";")), "next_table", "note_title;note_detail", [b64(str()), b64(str(20))].join(";"), ""].join("\n");
      const v = toVault(parseSpassText(text));
      const expectedRows = rows.filter((r) => { const t = (x: string) => x.replace(/\u0000/g, "").trim(); const n = (x: string) => t(x) === "&&&NULL&&&" ? "" : t(x); return n(r[0]) || n(r[1]) || n(r[2]) || n(r[3]).length || n(r[4]); });
      expect(v.logins.length, JSON.stringify(rows)).toBe(expectedRows.length);
      v.logins.forEach((l, i) => {
        const raw = expectedRows[i][3];
        const exp = raw.trim() === "&&&NULL&&&" || !raw.trim() ? "" : raw;
        expect(l.password, JSON.stringify(raw)).toBe(exp);
      });
      for (const f of Object.keys(COLS) as FormatId[]) {
        const csv = loginsToCsv(v.logins, v.notes, f);
        let parsed: string[][];
        try { parsed = parseCsvStrict(csv); } catch (e) { throw new Error(`${f}: ${(e as Error).message}\n${JSON.stringify(csv)}`); }
        const body = COLS[f].header ? parsed.slice(1) : parsed;
        const logins = f === "bitwarden" ? body.filter((r) => r[2] === "login") : body;
        expect(logins.length, f).toBe(v.logins.length);
        logins.forEach((r, i) => {
          expect(r.length, f).toBe(COLS[f].n);
          expect(r[COLS[f].pw], f).toBe(v.logins[i].password);
          const u = v.logins[i].username.trim();
          expect(r[COLS[f].user], f).toBe(u || (f === "other" ? "" : "no username"));
          const note = v.logins[i].note; const safe = /^[=+\-@\t\r]/.test(note) ? `'${note}` : note;
          if (f === "1password" || f === "other") expect(r[4], f + " note").toBe(safe);
          if (f === "bitwarden") expect(r[4], f + " note").toBe(safe);
          const url = v.logins[i].url; const surl = /^[=+\-@\t\r]/.test(url) ? `'${url}` : url;
          if (f !== "google") expect(r[f === "bitwarden" ? 7 : 1], f + " url").toBe(surl);
        });
      }
      for (const csv of [cardsToCsv(v.cards), addressesToCsv(v.addresses), notesToCsv(v.notes)]) if (csv) parseCsvStrict(csv.replace(/^\uFEFF/, ""));
    }
  });
  it("garbage / truncated inputs only ever raise SpassError", async () => {
    const good = await encryptSpass("25\ntrue;true;true;true\nfalse\nnext_table\ntitle;password_value\n" + b64("t") + ";" + b64("p") + "\n", "pw");
    const inputs: string[] = [];
    for (let i = 0; i < 150; i++) {
      const k = i % 6;
      if (k === 0) inputs.push(good.slice(0, Math.floor(rnd() * good.length)));
      else if (k === 1) inputs.push(str(60));
      else if (k === 2) inputs.push(good.split("").map((c) => (rnd() < 0.02 ? pick(["A", "=", "!", " "]) : c)).join(""));
      else if (k === 3) inputs.push(b64(String.fromCharCode(...Array.from({ length: 52 + 16 * Math.floor(rnd() * 5) }, () => Math.floor(rnd() * 256)))));
      else if (k === 4) inputs.push("25\ntrue;true\nfalse\nnext_table\n" + str(40) + "\nnext_table\n" + str(40));
      else inputs.push("samsung_pass_export\nversion: 1\nnext_table\n" + Array.from({ length: 5 }, () => str(10)).join("\n"));
    }
    let ok = 0;
    for (const t of inputs) {
      spassShapeError(t, "x.spass"); spassShapeError(t, "x.bin");
      for (const pw of ["pw", "wrong"]) {
        try { await unlockText(t, pw); ok++; } catch (e) { if (!(e instanceof SpassError)) throw new Error(`non-SpassError ${(e as Error)?.constructor?.name}: ${(e as Error).message} for ${JSON.stringify(t.slice(0, 120))}`); }
      }
    }
  });
});
