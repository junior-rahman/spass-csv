# CSV import headers (permanent contract)

Goal: every Spcc login CSV imports into its target manager with **zero manual column mapping**.
Locked by `web/test/csv.test.ts` (exact header strings + no-BOM test).

| Format | Exact header row | Source |
|---|---|---|
| 1Password | *(headerless)* columns `Title,Website,Username,Password,Notes` | 1Password official CSV layout: no header row, no BOM. 1Password.com always shows a Label step — map left→right Title, Website, Username, Password, Notes once. |
| Google / Chrome | `name,url,username,password,note` | Google Password Manager CSV import |
| Apple Passwords | `Title,URL,Username,Password,Notes,OTPAuth` | Apple Passwords / Safari CSV export layout |
| Bitwarden | `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp` | Bitwarden "Bitwarden (csv)" import |

## Rules
- Login CSVs are written **without a UTF-8 BOM**. A BOM glues `\uFEFF` onto the first label and can make importers
  (1Password's "You missed required labels… Username, Password, Website") fail to auto-detect the header row.
  Cards/addresses/notes spreadsheets keep the BOM for Excel.
- No spaces after commas in headers; CRLF line endings; RFC 4180 quoting. Cells with leading/trailing whitespace are quoted (2.0.21) so a password like `" pw "` survives importers that trim unquoted cells; passwords are never trimmed on read either.
- Title source: Samsung Pass `title`, else `app_name` (app logins often have no title), else the package / URL / username (2.0.23).
- Non-empty: Title never empty (`displayTitle` → site/username/`no title`); Username never empty (`no username`);
  Google URL never empty (`no url`); others leave blank URL. Password never invented. Pre-save warning stays.
- TOTP: full `otpauth://` URI goes in OTPAuth (Apple) / Notes as `OTP: …` (1Password) / login_totp (Bitwarden); otherwise appended to notes.
- Any header change must update the golden tests in the same commit.

## .spass picker
- Web: `<input accept=".spass">`; the page checks name, size (64 MB) and shape on pick and explains rejections (2.0.20).
- Android: `ACTION_OPEN_DOCUMENT` filtered to `application/octet-stream` (+ x-spass) via EXTRA_MIME_TYPES. Every pick reaches the
  page (no Kotlin name filter since 2.0.20); content decides, so a real export whose provider mangles the name still opens.

## Android file picker

Android's Storage Access Framework filters only by MIME type, never by file name/extension. `.spass` has no registered MIME (providers report `application/octet-stream`), so the picker requests octet-stream only (hides images, PDFs, docs, media, text) and opens in Downloads. Other unknown-binary files (.zip, .apk, .bin, etc.) can still appear on stock Android/Samsung; the page rejects them with a clear message. Truly hiding them would need broad `MANAGE_EXTERNAL_STORAGE` + a custom file browser, which we deliberately avoid.

## Save names (Android)
`MainActivity.SAFE_NAME` accepts `samsung-pass-*.csv` and `passwords.csv` (Other). `scripts/check-android.mjs` fails if any file name the page offers would be rejected (2.0.21: Other was being saved as `samsung-pass.csv`).
