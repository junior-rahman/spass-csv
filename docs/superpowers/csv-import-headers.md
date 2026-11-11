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
- Title source: Samsung Pass `title`; for app logins, else `app_name` (2.0.23), else the package / raw link / username. Website logins (http(s) URL or bare domain) without a title use the host: their `app_name` / package is the browser that saved them (2.0.25).
- Non-empty: Title never empty (`displayTitle` → site/username/`no title`); Username never empty (`no username`);
  Google URL never empty (`no url`); others leave blank URL. Password never invented. Pre-save warning stays.
- Google Password Manager (Chromium `password_importer.cc`) rejects a row with a missing or non-http(s)/android:// URL
  (so `no url` rows are listed as not imported, never imported), an empty password, or a note / username / password over
  1,000 bytes (URL 2,048). Spcc flags missing websites and notes over 1,000 UTF-8 bytes (OTP line included) as
  "Needs a look" for Google, with Save anyway (2.0.25).
- TOTP: full `otpauth://` URI goes in OTPAuth (Apple) / login_totp (Bitwarden); Google gets `OTP: …` appended to the note. 1Password and Other carry no OTP (stripped in f7070fe for a clean Label step; an OTP warning is a deferred proposal).
- Any header change must update the golden tests in the same commit.

## .spass picker
- Web: `<input accept=".spass">`; the page checks name, size (64 MB) and shape on pick and explains rejections (2.0.20).
- Android: `ACTION_OPEN_DOCUMENT` filtered to `application/octet-stream` (+ x-spass) via EXTRA_MIME_TYPES. Every pick reaches the
  page (no Kotlin name filter since 2.0.20); content decides, so a real export whose provider mangles the name still opens.

## Android file picker

Android's Storage Access Framework filters only by MIME type, never by file name/extension. `.spass` has no registered MIME (providers report `application/octet-stream`), so the picker requests octet-stream only (hides images, PDFs, docs, media, text) and opens in Downloads. Other unknown-binary files (.zip, .apk, .bin, etc.) can still appear on stock Android/Samsung; the page rejects them with a clear message. Truly hiding them would need broad `MANAGE_EXTERNAL_STORAGE` + a custom file browser, which we deliberately avoid.

## Save names (Android)
`MainActivity.SAFE_NAME` accepts `samsung-pass-*.csv` and `passwords.csv` (Other). `scripts/check-android.mjs` fails if any file name the page offers would be rejected (2.0.21: Other was being saved as `samsung-pass.csv`).
