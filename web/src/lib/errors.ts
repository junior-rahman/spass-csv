export type SpassErrorCode = "password" | "format" | "empty";

export class SpassError extends Error {
  readonly code: SpassErrorCode;
  constructor(code: SpassErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "SpassError";
  }
}

export const WRONG_PASSWORD =
  "Couldn't unlock this file. Use the password you set while exporting, not your Samsung account password.";
