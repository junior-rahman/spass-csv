import { looksLikeSpassPlaintext, samplePlaintext } from "../src/lib";

describe("looksLikeSpassPlaintext", () => {
  it("accepts the numeric-version header with next_table", () => {
    expect(looksLikeSpassPlaintext(samplePlaintext())).toBe(true);
  });

  it("accepts the samsung_pass_export header", () => {
    expect(looksLikeSpassPlaintext("samsung_pass_export\nversion:3\nnext_table\ntitle;password_value\n")).toBe(true);
  });

  it("rejects text that only contains a semicolon", () => {
    expect(looksLikeSpassPlaintext("garbage;more\nstuff\nhere")).toBe(false);
  });

  it("rejects a valid header without next_table", () => {
    expect(looksLikeSpassPlaintext("25\ntrue;true;true;true\nfalse\ntitle;password_value\n")).toBe(false);
  });

  it("rejects next_table without a real header", () => {
    expect(looksLikeSpassPlaintext("hello\nworld;x\nnext_table\na;b\n")).toBe(false);
  });

  it("never accepts 10k random strings", () => {
    const alphabet = "abc;,\n0123456789next_table";
    let accepted = 0;
    for (let i = 0; i < 10000; i++) {
      let s = "";
      const len = 8 + Math.floor(Math.random() * 120);
      for (let j = 0; j < len; j++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (looksLikeSpassPlaintext(s)) accepted++;
    }
    expect(accepted).toBe(0);
  });
});
