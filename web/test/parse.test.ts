import { decodeField, parseSemicolonRecords, parseSpassText, samplePlaintext } from "../src/lib";

describe("parse", () => {
  it("maps tables by header hints", () => {
    const parsed = parseSpassText(samplePlaintext());
    expect(parsed.version).toBe("25");
    expect(parsed.tables.map((t) => t.type)).toEqual(["passwords", "cards", "addresses", "notes"]);
  });

  it("treats &&&NULL&&& as empty, raw or base64", () => {
    expect(decodeField("&&&NULL&&&")).toBe("");
    expect(decodeField(btoa("&&&NULL&&&"))).toBe("");
  });

  it("keeps non-base64 fields as-is", () => {
    expect(decodeField("hello world")).toBe("hello world");
  });

  it("splits quoted semicolons correctly", () => {
    expect(parseSemicolonRecords('a;"b;c";d')).toEqual([["a", "b;c", "d"]]);
  });

  it("throws a format error for an unfinished table header", () => {
    expect(() => parseSpassText("25\ntrue\nfalse\nnext_table\ntitle;;password_value\nx;y;z")).toThrow(/didn't finish/);
  });
});
