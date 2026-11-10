# Spcc import UX polish — design

**Date:** 2026-11-05  
**Product:** Spcc (Spass to CSV Converter)  
**Status:** Approved for planning  
**Scope:** Import destination picking, post-Save guidance, 1Password CSV clarity  

## Problem

People export for the wrong password manager, then hit 1Password’s Label step without a clear column map. Format chips are easy to mis-tap. Putting `OTP: otpauth://…` in Notes makes column 5 look like an OTP field and confuses labeling. Literal `no url` was already fixed in 2.0.6 for non-Google formats (blank website cells).

## Goals

1. Make destination choice explicit: “Where are you importing?”
2. After every successful Save, walk through that manager’s import steps.
3. Keep 1Password CSV Label-friendly: clean Notes (no OTP lines); blank websites allowed.
4. Do not invent websites or passwords.

## Non-goals

- Full visual rebrand or Warm Grove/P2 changes
- Onboarding / first-run rewrite
- Cards / addresses / notes export UX
- Play Console listing or release process
- Putting OTP into a separate 1Password CSV column (official layout has no OTP column)

## Approach

**A — Destination sheet** (chosen): replace chips with one destination control; full post-Save step-by-step; strip OTP from 1Password Notes.

## Destination picker

- Replace the four format chips with one control labeled **Where are you importing?**
- Options (same `FormatId`s): 1Password, Google Password Manager, Apple Passwords, Bitwarden.
- Persist last choice (existing store); default remains 1Password.
- Changing destination updates Save filename, incomplete-sheet wording, and post-Save guide content only. Never auto-saves.
- Visual: Warm Grove list/sheet or segmented control consistent with existing sheets (Fern focus rings, Olive selected state). Touch targets ≥ 48dp.

## After Save guide

- On successful Save (file written), show a sheet (not only a snackbar) with a numbered checklist for the **current** destination.
- **1Password:** Open [my.1password.com](https://my.1password.com) → your name → Import data → CSV File → Label left→right **Title, Website, Username, Password, Notes** → Continue → delete the CSV. Note: blank Website cells are valid; autofill needs a real URL later in 1Password.
- **Google / Apple / Bitwarden:** Short official-path steps + their column/header expectations (existing format hints, expanded to checklist).
- Primary action: **Done** (dismiss). Incomplete-login warn still runs **before** Save as today.
- Guide appears every successful Save (no “don’t show again” in this pass).

## CSV clarity

| Format | Headers | Missing website | OTP |
|--------|---------|-----------------|-----|
| 1Password | Headerless Title,Website,Username,Password,Notes | Blank cell | **Not** written into Notes |
| Google | name,url,username,password,note | `no url` | Keep current note/OTP behavior |
| Apple | Title,URL,Username,Password,Notes,OTPAuth | Blank | OTPAuth column (unchanged) |
| Bitwarden | Existing headers | Blank | login_totp (unchanged) |

Incomplete Save warn still lists every login missing title/username/website for all formats. Users edit missing fields in place and Save, or Delete (immediate + Undo). **Keep with placeholders is removed** — do not write `no title` / `no username`. Website on Save: `no url` only for Google; blank for 1Password/Apple/Bitwarden. Passwords stay empty when missing.

## Data flow

1. User picks destination → `state.format` + persist.  
2. Unlock / edit / incomplete warn (unchanged).  
3. Confirm Save → write CSV for that format.  
4. On success → show destination-specific import guide sheet.  

## Error handling

- Save failure: existing error path; no guide.  
- User cancels Save confirm / incomplete sheet: no guide.  
- Guide dismiss does not clear vault.

## Testing

- Unit: 1Password golden CSV has no `OTP:` / otpauth in Notes; blank website cells.  
- Unit: destination persistence / default.  
- UI: picker replaces chips; guide sheet content per format after mocked successful Save.  
- Regression: Google still emits `no url`; Apple OTPAuth; Bitwarden totp.

## Version

Ship as **2.0.7** (versionCode +1) with debug APK + release AAB when implementation lands.

## Open decisions (none)

All product choices locked in brainstorming with Juel on 2026-11-05.
