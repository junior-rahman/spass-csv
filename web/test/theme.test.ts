import { readFileSync } from "node:fs";

const css = readFileSync("web/src/ui/styles.css", "utf8");
const template = readFileSync("web/index.template.html", "utf8");

describe("dual theme tokens", () => {
  it("light primary is Grove #3F4F3A", () => {
    expect(css).toMatch(/--primary:\s*#3F4F3A/);
  });

  it("dark theme follows the system with glass, glow and gradient CTA", () => {
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(dark).toMatch(/#1C1917|#0F1410/);
    expect(dark).toMatch(/--card-blur:\s*blur\(/);
    expect(dark).toMatch(/--mark-glow:\s*0 0/);
    expect(dark).toMatch(/--cta:\s*linear-gradient\(135deg, #6B8F71 0%, #3F4F3A 100%\)/);
  });

  it("has no in-app theme toggle", () => {
    expect(css).not.toMatch(/\[data-theme/);
    expect(readFileSync("web/src/ui/app.ts", "utf8")).not.toMatch(/data-theme|toggleTheme/);
  });

  it("template declares color-scheme and a CSP placeholder", () => {
    expect(template).toMatch(/name="color-scheme" content="light dark"/);
    expect(template).toMatch(/Content-Security-Policy" content="%CSP%"/);
  });
});
