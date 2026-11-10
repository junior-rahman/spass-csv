import { existsSync, readFileSync } from "node:fs";

const css = readFileSync("web/src/ui/styles.css", "utf8");
const template = readFileSync("web/index.template.html", "utf8");
const build = readFileSync("scripts/build.mjs", "utf8");

describe("Ember Charcoal tokens", () => {
  it("locks the palette", () => {
    for (const t of ["--soil: #181716", "--sheet: #211F1D", "--olive: #D9A55B", "--grove: #4A3A22", "--fern: #EBC58C", "--cream: #F5F0E8", "--mist: #EDE6DA", "--caution: #B3402F", "--caution-text: #F4A89B", "--danger: #FFB1C1"]) expect(css).toContain(t);
  });

  it("primary CTA is brass (--olive), 58px tall, radius 18px, Soil text", () => {
    const cta = css.match(/\.cta \{[^}]*\}/)![0];
    expect(cta).toContain("height: 58px");
    expect(cta).toContain("border-radius: 18px");
    expect(cta).toContain("background: var(--olive)");
    expect(cta).toContain("color: var(--soil)");
  });

  it("no Night Grove olive/fern left in the stylesheet", () => {
    expect(css).not.toMatch(/6B8F71|A3C9A8|3F4F3A|1C1917|107,\s*143,\s*113|163,\s*201,\s*168/i);
  });

  it("overview hero glow fades inside the ring instead of a clipped box-shadow", () => {
    const rules = css.match(/\.ov-hero \.ring-field \{[^}]*\}/g)!.join(" ");
    expect(rules).toContain("box-shadow: none");
    expect(rules).toMatch(/radial-gradient\(circle 46px at center,[^;]*transparent 100%\)/);
  });

  it("stacked sheet actions keep the full-height CTA (Add / Review / Done)", () => {
    expect(css).toMatch(/\.acts\.stack \.cta \{ flex: none; \}/);
  });

  it("bundles Outfit locally and allows only data: fonts", () => {
    for (const w of ["400", "500", "600"]) expect(existsSync(`web/src/ui/assets/outfit-${w}.ttf`)).toBe(true);
    expect(css).toMatch(/font-family: Outfit/);
    expect(css).not.toMatch(/Inter|Roboto/);
    expect(build).toContain("font-src data:");
  });

  it("no in-app theme toggle and no cream Soft Grove light theme", () => {
    expect(css).not.toMatch(/\[data-theme/);
    expect(css).not.toMatch(/prefers-color-scheme: light/);
    expect(readFileSync("web/src/ui/app.ts", "utf8")).not.toMatch(/data-theme|toggleTheme/);
  });

  it("template declares dark color-scheme and a CSP placeholder", () => {
    expect(template).toMatch(/name="color-scheme" content="dark"/);
    expect(template).toMatch(/name="theme-color" content="#181716"/);
    expect(template).toMatch(/Content-Security-Policy" content="%CSP%"/);
  });
});
