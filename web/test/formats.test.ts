import { describe, expect, it } from "vitest";
import { FORMATS } from "../src/lib/formats";

describe("importSteps", () => {
  it.each(FORMATS.map((f) => [f.id, f]))("%s has >= 3 steps", (_id, f) => {
    expect(f.importSteps.length).toBeGreaterThanOrEqual(3);
  });
  it("1Password steps include exact Label order", () => {
    const op = FORMATS.find((f) => f.id === "1password")!;
    expect(op.importSteps.join("\n")).toContain("Title, Website, Username, Password, Notes");
  });
  it("full destination names", () => {
    expect(FORMATS.map((f) => f.label)).toEqual(["1Password", "Google Password Manager", "Apple Passwords", "Bitwarden"]);
  });
});
