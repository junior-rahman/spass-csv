# Spcc Soft Grove design-critic pass — design

**Date:** 2026-11-05
**Status:** Approved for implementation planning
**Baseline:** 2.0.7
**Target release:** 2.0.8 after implementation (increment versionCode)
**Approach:** C — full Soft Grove pass, including Play listing art

## Intent and decision authority

Audit and refine the whole app UI against Warm Grove / P2 Soft: fix usability, accessibility, and flow honesty before visual polish. Preserve the trusted local conversion experience rather than adding screens or changing CSV semantics. This document captures the approved brainstorm and is self-contained input for writing-plans; it is not an implementation plan. Where earlier audit suggestions conflict, the explicit decisions here win: Delete incomplete applies immediately with Undo; incomplete rows are fixed by editing fields in place and Saving (no Keep-with-placeholders); Convert stays in the scroll pane; destination cards receive a full redesign; the feature graphic includes a phone mock.

## Scope and preserved contracts

Cover setup/file selection, destination selection, unlocking/progress, unlocked preview and search, auxiliary exports, incomplete and plaintext warnings, Save outcomes, import guidance, Clear, About, empty states, and light/dark presentation. Include the app icon and Play feature graphic.

Keep:

- Warm Grove palette: Grove `#3F4F3A`, Olive `#6B8F71`, Fern `#A3C9A8`, Cream `#F7F4EF`, Soil `#1C1917`.
- P2 Soft overlap lockup and locked P-ring mark. Display name Spcc; subtitle Spass to CSV Converter.
- Device-controlled theme only; no theme toggle.
- Current import flow: destination picker before export and post-Save guidance. Destinations remain 1Password, Google Password Manager, Apple Passwords, and Bitwarden. Preserve default 1Password and last-choice persistence; changing destination never auto-saves.
- Existing conversion, editing, privacy, and CSV rules. Never invent websites or passwords. Preserve export-password versus Samsung-account clarity and the plaintext warning before Save.
- 1Password headerless Title,Website,Username,Password,Notes with blank missing websites and no OTP in Notes. Google retains its current headers, `no url` fallback and note/OTP behavior; Apple retains OTPAuth; Bitwarden retains its headers and login_totp. On Save, CSV still uses format-specific missing-website rules (`no url` only for Google; blank otherwise). Do **not** invent passwords. Incomplete UI no longer offers Keep-with-placeholders (`no title` / `no username`); users edit missing fields or Delete.
- Existing post-unlock Clear/Save affordances. No new cards/addresses onboarding screens.

## Sheets and accessibility

Apply one consistent sheet contract to destination, incomplete, plaintext, guide, clear, and About:

- Expose a modal dialog with an accessible name linked to its visible heading (or an equivalent aria label).
- Move focus into the opened sheet, trap Tab/Shift+Tab within it, close on Escape through the normal cancel/dismiss path, and restore focus to the invoking control on close.
- Limit the sheet to approximately 85vh; give its body a scroll region and keep action buttons sticky and reachable. Long content, short phones, and an on-screen keyboard must not clip actions or headings.
- Preserve visible focus treatment and at least 48dp touch targets. Destination selection must have accessible checked state and standard radio-group keyboard arrow navigation. The file-picker trigger must be keyboard-focusable.

**Incomplete logins:** The incomplete sheet lists every login missing title, username, or website. Tap a row to edit those fields in place; Save changes commits edits and drops the login from Incomplete when title, username, and website are all filled. Passwords stay empty when missing — never invent one. Host/username is used as a real title only when Samsung already supplied one.

**Delete incomplete:** There is no Keep-with-placeholders action. Delete applies immediately to the unlocked vault and preview, then shows an undo toast with a clearly labeled Undo action. Undo restores the removed rows and the corresponding preview/count state for that deletion. Cancelling a later plaintext/save dialog must not silently reverse or hide this immediate action. Do not defer deletion until Save. Undo data is sensitive vault data: Clear, a new file, and background clearing must invalidate it; Undo must never resurrect a cleared vault. The toast must be perceivable and operable by keyboard and assistive technology.

**Empty states:** Wire/use `.empty-search` for a short, calm Grove no-results message. Distinguish no matching search results from an empty vault; neither may render as an unexplained blank list. Do not imply a conversion error when there are simply no records.

## Voice and flow honesty

- Rename summary actions exactly **Change file** and **Change destination**.
- Reflect actual work in the phase rail: **File → Unlocking… → Save**. Unlocking is an active work state, not an unchanged File state; do not imply Save readiness before unlock completes.
- Native user cancellation says **Save cancelled — nothing written**. Treat it as cancellation, not failure; real write failures retain an error path and do not show a success guide.
- Primary login Save shows the current destination's guide and actual saved filename. Cards, notes, and addresses Save each get their own short guide for that export and its actual filename, not login-import steps or the primary filename. Do not promise unsupported destination import capabilities.
- On web, use **Download started** when initiating a download; do not claim the file was written without confirmation. Guidance may follow initiation but must describe that status honestly.
- **Convert remains in the scroll pane, not sticky.** Do not apply the earlier audit's sticky-Convert suggestion.
- Make guide URLs real tappable, keyboard-accessible links with meaningful labels.
- When backgrounding clears the unlocked vault, show a one-line explanation on return; retain the security clearing behavior and do not expose vault contents in the notice.

## Soft Grove visual language

- Replace stock Material folder, lock, eye, download, delete, and overflow icons with a coherent set of simple Grove-line icons. Preserve recognizable meaning and accessible names for icon-only controls.
- Quiet the phase rail into soft text steps rather than heavy pills; active/progress meaning must not rely on color alone.
- Remove dead `.chips` CSS; chips are not the destination-selection model.
- Soften the sheet handle without weakening dialog affordances.
- Keep the privacy strip's lock metaphor, drawn in Grove line weight rather than a stock filled lock. The privacy lock is not a replacement for the P-ring brand mark.
- Retain dark glass/glow as an approved brand extension, documented in `docs/brand/pass-to-csv-brand.md`; it must not introduce a separate theme or compromise contrast.
- Rewrite About into short sections: **What Spcc does · Privacy · Updates · License**. Keep factual existing privacy/update/license information, remove wall-of-text presentation, and do not invent legal or publishing claims.

### Destination cards

Redesign layout and visual weight, not merely the selected color. Use a calm, legible Soft Grove card/list hierarchy with the full destination name and a clear selection affordance. Keep choices scannable and large enough to tap without truncation or compressed labels. Selected state uses **Olive**, not Fern; retain Fern for focus treatment where appropriate. Pair selection color with an explicit checked indicator and accessible state. Reduce heavy Material surfaces/borders and keep restrained spacing and Grove-line treatment consistent with other controls. Preserve all four choices and their behavior.

## Play listing visuals

Deliver artwork as part of implementation, not publication:

- **App icon:** locked P-ring on a Warm Grove squircle. Preserve mark geometry and prepare a clean, legible icon at small sizes.
- **Feature graphic:** exactly **1024 × 500 px**, Cream field, P2 Soft lockup, and the tagline **Samsung Pass → CSV for 1Password, Google, Apple, Bitwarden**.
- Include a phone mock of the redesigned app UI. Use fabricated, non-sensitive demo content only; no screenshots of real passwords, OTPs, personal records, or decrypted vault data.
- Balance phone mock and left-side lockup/copy for readable hierarchy; do not let the mock hide the mark or tagline.
- Mention destination/product names as text only. Do not use competitor logos or imply endorsement/affiliation.
- These are icon/feature-graphic assets, not authorization to upload, publish, or change Play Console settings.

## Out of scope / carried items

- Parser quote hardening, the www package, and phone formula-safe work remain carried items, not part of this pass.
- Play Console identity and publishing process belong to the Play Console teammate.
- No package-name or pricing changes.
- No theme toggle, new onboarding screens for cards/addresses, or CSV-format redesign.

## Acceptance and verification for the implementation plan

1. Walk every surface listed in Scope in device light and dark themes. Warm Grove tokens, P2 Soft, and P-ring remain intact; Grove-line icons, quieter rail, softer handle, redesigned destination cards, and sectional About replace the identified Material residue.
2. For every sheet, verify announced dialog name, initial focus, forward/reverse focus containment, Escape cancellation/dismissal, and focus restoration. Test long content on a short viewport and with a keyboard visible: body scrolls and actions remain reachable.
3. Delete incomplete updates preview/counts immediately; Undo restores rows. Test subsequent Save cancellation, repeated deletion, and Clear/background/new-file invalidation so stale Undo cannot recover cleared data.
4. Search with no matches and an empty unlocked vault each show the appropriate short empty state. Destination radio keyboard navigation and file-picker keyboard activation work; selected Olive is distinct from Fern focus and has a non-color indicator.
5. Verify both renamed Change actions, real Unlocking progress, exact native-cancel copy, genuine error handling, web Download started status, and the background-clear explanation. Convert remains in the scroll pane.
6. Exercise login Save for all four destinations and each auxiliary export. Guides match export type, destination where relevant, and actual filename; links are tappable. No login instructions leak into auxiliary guides, and no unconfirmed web write is called saved.
7. Run CSV regression coverage: 1Password Notes remains OTP-free; Google fallback/note behavior, Apple OTPAuth, Bitwarden totp, and existing placeholder rules remain unchanged.
8. Inspect icon at small size and feature graphic at 1024×500. Require Cream field, P2 Soft lockup, exact tagline, phone mock, text-only competitor names, and non-sensitive demo UI.
9. Document approved dark glass/glow and Olive selection in the brand guide. Remove dead `.chips` styling without removing live empty-state styling.
10. Implementation ships as **2.0.8**, with versionCode advanced from 2.0.7. This documentation commit does not bump versions or implement UI/artwork. Publishing remains separate.

All product decisions above are approved; no unresolved product placeholders remain. The next step is writing-plans, then implementation and verification against this contract.
