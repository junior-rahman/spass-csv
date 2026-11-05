import { SpassError, decryptSpass, encryptSpass, samplePlaintext } from "../src/lib";
import { TEST_PASSWORD, sampleSpass } from "./helpers";

describe("decryptSpass", () => {
  it("round-trips encryptSpass output", async () => {
    const file = await sampleSpass();
    expect(await decryptSpass(file, TEST_PASSWORD)).toBe(samplePlaintext());
  });

  it("throws a password error for a wrong password", async () => {
    const file = await sampleSpass();
    await expect(decryptSpass(file, "wrong")).rejects.toMatchObject({ code: "password" });
  });

  it("never yields plaintext for 40 random wrong passwords", async () => {
    const file = await sampleSpass();
    for (let i = 0; i < 40; i++) {
      await expect(decryptSpass(file, `wrong-${i}-${Math.random()}`)).rejects.toBeInstanceOf(SpassError);
    }
  });

  it("rejects a correctly decrypted body that lacks a Samsung header", async () => {
    const file = await encryptSpass("junk;with;semicolons\nmore", TEST_PASSWORD);
    await expect(decryptSpass(file, TEST_PASSWORD)).rejects.toMatchObject({ code: "password" });
  });

  it("rejects an empty file and non-base64 input as format errors", async () => {
    await expect(decryptSpass("   ", "x")).rejects.toMatchObject({ code: "format" });
    await expect(decryptSpass("not base64 !!!", "x")).rejects.toMatchObject({ code: "format" });
  });
});
