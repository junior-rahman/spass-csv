import { encryptSpass, samplePlaintext } from "../src/lib";

export const TEST_PASSWORD = "correct horse battery";

/** Encrypted synthetic export. Never commit a real .spass. */
export async function sampleSpass(): Promise<string> {
  return encryptSpass(samplePlaintext(), TEST_PASSWORD);
}
