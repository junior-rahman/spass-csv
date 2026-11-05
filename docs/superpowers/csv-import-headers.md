# CSV import headers (permanent contract)

Goal: every Spcc login CSV imports into its target manager with **zero manual column mapping**.
Locked by `web/test/csv.test.ts` (exact header strings + no-BOM test).

| Format | Exact header row | Source |
|---|---|---|
| 1Password | `Title,Website,Username,Password,Notes,OTPAuth` | 1Password CSV import (labels case-insensitive; Website/Username/Password are the required labels) |
| Google / Chrome | `name,url,username,password,note` | Google Password Manager CSV import |
| Apple Passwords | `Title,URL,Username,Password,Notes,OTPAuth` | Apple Passwords / Safari CSV export layout |
| Bitwarden | `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp` | Bitwarden "Bitwarden (csv)" import |

## Rules
- Login CSVs are written **without a UTF-8 BOM**. A BOM glues `\uFEFF` onto the first label and can make importers
  (1Password's "You missed required labels… Username, Password, Website") fail to auto-detect the header row.
  Cards/addresses/notes spreadsheets keep the BOM for Excel.
- No spaces after commas in headers; CRLF line endings; RFC 4180 quoting.
- Non-empty: Title never empty (`displayTitle` → site/username/`no title`); Username never empty (`no username`);
  Google URL never empty (`no url`); others leave blank URL. Password never invented. Pre-save warning stays.
- TOTP: full `otpauth://` URI goes in OTPAuth (1Password, Apple) / login_totp (Bitwarden); otherwise appended to notes.
- Any header change must update the golden tests in the same commit.

## .spass picker
- Web: `<input accept=".spass">` + filename hard-reject.
- Android: `ACTION_OPEN_DOCUMENT` filtered to `application/octet-stream` (+ x-spass) via EXTRA_MIME_TYPES, then
  `isSpassUri` hard-rejects anything not named `*.spass`. (Android has no registered .spass MIME, so some
  non-.spass binaries may still appear; they are rejected on pick.)
