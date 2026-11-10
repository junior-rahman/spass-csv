# Night Grove — design spec (2026-11-06)

Status: **Approved** by Juel ("Perfect lets implement this design", after the Night Grove mock photos).
Supersedes the visual layer of `2026-11-05-soft-grove-design-pass-design.md` and the incomplete-login
"Keep with placeholders" flow of `2026-11-05-import-ux-polish-design.md`. CSV formats, crypto, parser,
privacy posture and Android policy from those specs are unchanged unless stated here.

Visual source of truth: `dist/soft-grove-mockups/redesign-3/night-*.html` + `styles.css` and the approved PNGs.

## 0. Palette update — Ember Charcoal (2026-11-09, v2.0.16)

Status: **Approved** by Juel ("Go with Ember Charcoal", from the five-palette overview renders).
Ember Charcoal replaces the Night Grove colours only. Layout, Outfit type, P-ring jewel shape and
concentric rings, staged flow, overview vault, merge, Other save warning and extras are unchanged.
CSS token names below are kept for continuity; their values are:

| Token (CSS var) | Role | Ember Charcoal |
|---|---|---|
| `--soil` | Canvas, CTA label, theme-color, Android bars | `#181716` |
| `--sheet` | Bottom-sheet surface | `#211F1D` |
| `--olive` | Brass: CTA fill, selected tile/option, rings, glow | `#D9A55B` (charcoal label, 8.08:1) |
| `--fern` | Amber accent: focus ring, text buttons | `#EBC58C` |
| `--grove` | Deep bronze: snackbar Undo | `#4A3A22` |
| `--cream` | Text; snackbar surface | `#F5F0E8` (muted = 68%) |
| `--mist` | Reserved | `#EDE6DA` |
| `--caution` | Brick-red "Needs a look" (not orange, so it never blurs with brass) | `#B3402F` (text `#F4A89B`, line `#E58A7A`) |
| `--danger` | Delete outline on dark | `#FFB1C1` |

- The in-app P-ring jewel is recoloured to a brass field with a charcoal glyph (same geometry).
  The Android launcher icon (raster `mipmap-xxxhdpi/ic_launcher.webp`) is unchanged.
- Overview hero glow is a radial gradient that fades out inside the ring field, so it is never clipped
  into a visible box at the hero edge.

The Night Grove table in §1 is kept for history.

## 1. Visual system (Night Grove, superseded colours)

| Token | Hex | Use |
|---|---|---|
| Soil | `#1C1917` | Full-bleed canvas (always dark; no light theme) |
| Sheet | `#24201D` | Bottom-sheet surface |
| Olive | `#6B8F71` | Primary CTA fill (Soil text), selected tile/option, rings |
| Grove | `#3F4F3A` | Undo button in the cream snackbar |
| Fern | `#A3C9A8` | Focus ring, text buttons ("Change file", "Merge ›") only |
| Cream | `#F7F4EF` | Text; snackbar surface |
| Mist | `#E8EDE6` | Reserved |
| Caution | `#B54708` (+ `#F2B98A`/`#E8A06A` text tints) | "Needs a look" tray, incomplete count |
| Danger | `#FFB4A8` | Delete outline button on dark |

- Type: **Outfit** 400/500/600, bundled as local TTFs (inlined as `data:` URIs at build, CSP `font-src data:`). No Inter/Roboto.
- Primary CTA: 58px tall, radius 18px, Olive fill, Soil text, 17px/500.
- Mark: the existing circular P-ring PNG (`web/src/ui/assets/spcc-mark.png`) shown as a jewel inside faint concentric Olive rings. (Recoloured once to Ember Charcoal brass on 2026-11-09; geometry never redrawn.)
- Banned: Material File/Unlock/Save rail, P2 Soft header chip layout, cream Soft Grove surfaces, privacy/trust strip on home or setup, search bars, Clear button.
- `color-scheme: dark`; `theme-color` `#1C1917`. Android light + night themes both use Soil status/nav bars.

## 2. Staged flow (each stage shows only its own controls)

1. **Home / choose file** — jewel (116px) in three rings, "Spcc", "Spass to CSV Converter", Olive "Choose .spass file", helper "Samsung Pass export". No password, no destination.
2. **Password** — smaller jewel (76px) in rings, "Enter password", "Use the password you set when exporting", file well (`file name` + "Change file"), label "Export password", masked input with eye toggle, helper under the field: "Your export password — not your Samsung account password.", Olive "Unlock", footnote "From the .spass export". Wrong password → inline error under the field.
3. **Unlocking** — large rings, Olive progress arc rotating on the outer ring (no spinner icon), "Unlocking…", file name.
4. **Vault (organize)** — main screen after unlock (see §3). Footer: one full-width "Save CSV".

"Change file" (password stage and vault header) wipes the session (file, password, vault, drafts) and returns to Home. The chosen destination persists (localStorage) as before. Hiding the page still wipes an unlocked vault.

About & privacy stays in an About sheet (top-right ⋮ on home/password/vault), unchanged copy. Post-save plaintext guidance remains (save confirm sheet, import guide, reminder line).

## 3. Vault screen

Header: 40px jewel, "Unlocked" / file name, "Change file" (Fern text), ⋮ About.

Order:
1. **Destination chip** — "● Save for **{label}** ›" opens the destination sheet.
2. **Needs a look · N** tray (Caution tint, rings) — logins with any gap: title, username, or website (website-missing counts for every format). Row: avatar initial (`?` when untitled), title (italic "Untitled login" when none), subline (username · •••••••• or url), dashed tag for the first gap ("No title" / "No username" / "No website"). "Tap to fix" — tapping opens Edit. Hidden when N = 0.
3. **Merge suggestion** — when ≥2 logins share a site key: "{n} {Name} logins look like / the same site", "Merge ›". Site key: host from URL (strip scheme, `www.`, path, port) reduced to its second-level label (`amazon.com`, `www.amazon.co.uk` → `amazon`); without a URL, the title lowercased; a title that is a domain is treated as a host. Logins with no key never group.
4. **Logins · {complete} of {total}** tray — the complete logins; tap opens Edit.
5. **Tiles** (2-column grid): Cards ("{n} Cards", "Visa ••4242"-style last four of first card), Note(s) (first note title), Addresses (first address city). Tapping a tile opens the save-confirm sheet for that CSV. For Bitwarden, notes are in the main file: the Notes tile says "In Bitwarden file" and is not a separate save.
6. After a successful save: reminder "Delete the CSV after you import it. It holds your passwords in plain text."

## 4. Destination sheet

"Save CSV for" heading; 2×2 tiles: 1Password, Google Password Manager, Apple Passwords, Bitwarden (label + file name). Selected tile: Olive border/fill, check jewel, corner ring field. Below: dashed **Other** row ("Other · passwords.csv", "Any other app or spreadsheet"). Counts line: "{n} Logins  {n} Cards  {n} Notes  ● {n} Incomplete". Picking closes the sheet and stores the choice. No search.

## 5. Edit sheet

Title = login title, avatar, close ×. Fields: Title, Website, Username, Password (masked + eye), Notes ("Optional"). The first gap field is focused (website first when that is the gap) with hint "Add a website so {Destination} can match this login." Actions: **Delete** (Danger outline) + **Save changes** (Olive). Website input is normalised (`https://` added to a bare domain); invalid text leaves it blank (still needs a look). No "Keep with placeholders".

## 6. Delete with undo

Delete removes immediately, closes the sheet, shows cream snackbar "Deleted {title}" + Grove "Undo" (restores at the same index). Counts/trays update at once. Snackbar auto-hides after ~5 s.

## 7. Merge sheet

"Merge {Name}", A/B overlapping rings (A solid, B dashed) with an Olive "1" core, "One login will be saved. The other will be removed." Per field (Title, Website, Username, Password, Notes) — when values are equal show the single value + "Same in both"; when they differ show two options (A/B) defaulting to A, except an empty A side defaults to B. Values come from the real records (password shown as dots + A/B tag). Cancel / Merge. Merge keeps A's id/position with chosen fields (OTP: chosen password side's OTP, else the other), removes B, toast "Merged {title}".

## 8. Save CSV

- Save CSV with zero items needing a look → plaintext confirm sheet → platform save → import guide.
- With items needing a look → "{n} logins need a look" sheet listing them; **Review** opens Edit on the first. If every remaining gap is website-only, a secondary **Save anyway** is offered (blank website; Google writes "no url" per its format). Title/username gaps must be fixed or deleted — never exported as "no title"/"no username" placeholders from the UI.

## 9. Formats

Unchanged: 1Password headerless `Title,Website,Username,Password,Notes`, blank website, OTP not in notes; Google official columns, "no url" for missing website; Apple/Bitwarden blank website.
**New Other** (`id: "other"`, label "Other", file `passwords.csv`): headered `Title,Website,Username,Password,Notes`, blank website when missing, OTP stripped from Notes. Hint/steps generic ("Import this CSV into your password manager…"). Cards/addresses/notes CSVs remain available.

## 10. Test locks (web/test)

Staged file→password→unlock→vault; no trust strip / rail / Clear / search / Keep placeholders; destination chip + sheet with 4 tiles + Other; Other CSV; needs-a-look count; edit save; delete + undo; merge; Save CSV footer only after unlock; Outfit bundled; Night tokens.

## 11. Release

Android `versionName 2.0.8`, `versionCode 26`. No APK/AAB/keystore committed.
