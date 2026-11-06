import { existsSync, readFileSync } from "node:fs";

const css = readFileSync("web/src/ui/styles.css", "utf8");
const template = readFileSync("web/index.template.html", "utf8");
const build = readFileSync("scripts/build.mjs", "utf8");

describe("Night Grove tokens", () => {
  it("locks the palette", () => {
    for (const t of ["--soil: #1C1917", "--olive: #6B8F71", "--grove: #3F4F3A", "--fern: #A3C9A8", "--cream: #F7F4EF", "--mist: #E8EDE6", "--caution: #B54708", "--danger: #FFB4A8"]) expect(css).toContain(t);
  });

  it("primary CTA is Olive, 58px tall, radius 18px, Soil text", () => {
    const cta = css.match(/\.cta \{[^}]*\}/)![0];
    expect(cta).toContain("height: 58px");
    expect(cta).toContain("border-radius: 18px");
    expect(cta).toContain("background: var(--olive)");
    expect(cta).toContain("color: var(--soil)");
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
    expect(template).toMatch(/name="theme-color" content="#1C1917"/);
    expect(template).toMatch(/Content-Security-Policy" content="%CSP%"/);
  });
});
