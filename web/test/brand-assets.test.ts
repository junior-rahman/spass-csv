// Guards the Ember Charcoal launcher icon and Play listing art: no green, no stale raster icons.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const RES = "android/app/src/main/res";
const ART = "docs/play/art";
const OLD_GREENS = ["3F4F3A", "6B8F71", "A3C9A8", "5E7A5A", "2F3D2B"];

/** Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced) — enough for our own art. */
function decodePng(path: string): { w: number; h: number; ch: number; px: Uint8Array } {
  const buf = readFileSync(path);
  let off = 8, w = 0, h = 0, ch = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      expect(data[8]).toBe(8); expect(data[12]).toBe(0);
      ch = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      expect(ch).toBeGreaterThan(0);
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= ch && y ? px[(y - 1) * stride + x - ch] : 0;
      let p = src[x];
      if (f === 1) p += a; else if (f === 2) p += b; else if (f === 3) p += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = p & 255;
    }
  }
  return { w, h, ch, px };
}
function greenShare(path: string): number {
  const { w, h, ch, px } = decodePng(path);
  let green = 0;
  for (let i = 0; i < w * h; i++) { const r = px[i * ch], g = px[i * ch + 1], b = px[i * ch + 2]; if (g > r + 20 && g > b + 20) green++; }
  return green / (w * h);
}

describe("launcher icon (Ember Charcoal adaptive vector)", () => {
  it("is adaptive with background, foreground, and monochrome layers", () => {
    const xml = readFileSync(join(RES, "mipmap-anydpi-v26/ic_launcher.xml"), "utf8");
    for (const tag of ["<background", "<foreground", "<monochrome"]) expect(xml).toContain(tag);
    expect(readFileSync(join(RES, "values/ic_launcher_background.xml"), "utf8")).toMatch(/#181716/i);
    expect(readFileSync(join(RES, "drawable/ic_launcher_foreground.xml"), "utf8")).toMatch(/fillColor="#D9A55B"/i);
  });
  it("ships no stale raster launcher icons", () => {
    for (const dir of readdirSync(RES).filter((d) => d.startsWith("mipmap-") && d !== "mipmap-anydpi-v26")) {
      expect(readdirSync(join(RES, dir)).filter((f) => /^ic_launcher/.test(f))).toEqual([]);
    }
  });
  it("uses no old Grove greens in resources or listing copy", () => {
    const files = readdirSync(RES, { recursive: true }).map(String).filter((f) => f.endsWith(".xml")).map((f) => join(RES, f));
    files.push("docs/play/listing.md");
    for (const f of files) {
      const text = readFileSync(f, "utf8").toUpperCase();
      for (const hex of OLD_GREENS) expect(text, `${f} contains #${hex}`).not.toContain(hex);
    }
  });
});

describe("Play listing art and in-app mark", () => {
  const art = (name: string) => join(ART, name);
  it("has Play-spec sizes", () => {
    expect(decodePng(art("icon-512.png"))).toMatchObject({ w: 512, h: 512, ch: 4 });
    expect(decodePng(art("feature-graphic-1024x500.png"))).toMatchObject({ w: 1024, h: 500, ch: 3 });
    const shots = readdirSync(ART).filter((f) => f.startsWith("phone-"));
    expect(shots.length).toBeGreaterThanOrEqual(2);
    for (const s of shots) expect(decodePng(art(s))).toMatchObject({ w: 1080, h: 1920, ch: 3 });
  });
  it("hi-res icon is fully opaque", () => {
    const { px } = decodePng(art("icon-512.png"));
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) throw new Error("icon-512.png has transparency");
  });
  it("contains no green", () => {
    const files = readdirSync(ART).filter((f) => f.endsWith(".png")).map(art);
    files.push("web/src/ui/assets/spcc-mark.png");
    for (const f of files) {
      expect(existsSync(f)).toBe(true);
      expect(greenShare(f), f).toBeLessThan(0.001);
    }
  });
});
