import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public copy", () => {
  const readme = readFileSync("README.md", "utf8");
  it("README: Play $2.99, MIT source-only, CSV deletion", () => {
    expect(readme).toMatch(/\$2\.99 one-time/);
    expect(readme).toMatch(/MIT/);
    expect(readme).toMatch(/No prebuilt APK\/AAB/);
    expect(readme).not.toMatch(/GitHub Releases/);
    expect(readme).toMatch(/Delete the CSV/);
    expect(readme).not.toMatch(/version\.json|allow install/i);
  });
  it("Privacy and Play listing exist and claim on-device only", () => {
    for (const p of ["PRIVACY.md", "docs/play/listing.md"]) {
      expect(readFileSync(p, "utf8")).toMatch(/[Nn]othing is uploaded|nothing uploaded/);
    }
  });
  it("no committed APK or updater manifest", () => {
    expect(existsSync("Pass-to-CSV.apk")).toBe(false);
    expect(existsSync("version.json")).toBe(false);
  });
});
