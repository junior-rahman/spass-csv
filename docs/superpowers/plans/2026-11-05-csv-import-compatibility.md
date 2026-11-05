# CSV Import Compatibility Implementation Plan

**Goal:** Every provider CSV imports cleanly — exact official headers, never an empty Title/name ("Missing label"), no invented URLs.
**Architecture:** Add `displayTitle(login)` in `web/src/lib/model.ts`; all four writers in `web/src/lib/csv.ts` use it. Bitwarden note rows fall back to "Note".
**Tech:** TypeScript, vitest.

## Task 1: Failing tests (`web/test/csv.test.ts`)
- For each format, input login with `name: ""` → assert exact header row and non-empty title cell.
- Fallback order: name → URL hostname → username → "Untitled login". URL column stays blank when url is blank.
- Bitwarden note with empty title → name "Note".
- Run `npx vitest run test/csv.test.ts` → FAIL.

## Task 2: `displayTitle` helper (`web/src/lib/model.ts`)
- `name.trim()` || hostname(url) || username || "Untitled login".

## Task 3: Use helper in all writers (`web/src/lib/csv.ts`)
- Replace `l.name || "Login"` / `l.name`. Run tests → PASS.

## Task 4: Verify
- `npx vitest run`, `npx tsc --noEmit`, `npm run check`. Format hints unchanged (import paths unchanged).
