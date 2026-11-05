import { bytesToBase64 } from "./bytes";

function b64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

/** Synthetic Samsung Pass plaintext. Fake data only — safe for tests and the About preview. */
export function samplePlaintext(): string {
  const login = [
    "title;host_url;username_value;password_value;credential_memo;otp",
    [
      b64("Sample Mail"),
      b64("https://mail.example.test"),
      b64("ada@example.test"),
      b64("sample-mailbox-pass"),
      b64("Fake entry for the preview"),
      b64("otpauth://totp/Sample:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Sample")
    ].join(";"),
    [b64("Sample Bank"), b64("com.chase.sig.android"), b64("j.lee"), b64("not-a-real-password"), "", ""].join(";"),
    [b64("Chase Bank Card"), b64("com.unknown.bankapp"), b64("lee"), b64("=x-pass"), b64("=HYPERLINK(\"http://evil.test\")"), ""].join(";")
  ];
  const card = [
    "name_on_card;card_number;expiration_month;expiration_year;security_code;reserved_5",
    [b64("Ada Example"), b64("4242424242424242"), b64("09"), b64("2030"), b64("123"), b64("Sample Visa")].join(";")
  ];
  const address = [
    "name;street_address;city;state;postal_code;country_code",
    [b64("Ada Example"), b64("1 Sample Street"), b64("Sample City"), b64("NY"), b64("10001"), b64("US")].join(";")
  ];
  const note = ["note_title;note_detail", [b64("Router note"), b64("This is sample text, not a real secret.")].join(";")];
  return ["25", "true;true;true;true", "false", "next_table", ...login, "next_table", ...card, "next_table", ...address, "next_table", ...note, ""].join("\n");
}
