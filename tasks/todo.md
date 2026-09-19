# Physical Inventory Upload — Preview & Validate comparison fixes

Date: 2026-09-19
File: `src/app/api/admin/physical-inventory-upload/route.ts` (server only; page untouched unless item 3 approved)

## Findings (verified)

- **BUG — ACTUAL COUNT of 0 silently skipped.** `route.ts:184-192` uses an `||` chain.
  Excel numeric `0` is falsy, falls through every alias to `undefined`, and line 203
  treats the row as empty → skipped. Item physically counted as zero is never compared
  or corrected. Proven with xlsx test (`0 → undefined → SKIPPED`, `7 → processed`).
- **Duplicate rows (same SKU + BRANCH) double-apply.** Both rows push to `updateItems`
  with `difference` vs the same original stock; apply runs `updateStock` twice.
  System 5, two rows saying 10 → ends at 15. Preview shows two `+5` lines, no warning.
- Latent (0 occurrences in prod DB today, 2099 variations checked): soft-deleted
  variations are not filtered; last-write-wins SKU map could shadow a live SKU.

Safety checks done before proposing:
- Export template prefills `ACTUAL COUNT: ''` (blank), not 0 → fix will NOT mass-zero
  untouched template rows.
- Actual 0 with system > 0 → `quantity = -current`, `allowNegative: true`. Same path
  already used today for any lower count. No new code path.
- Actual 0 with system 0 → "verified", no write.

## Plan (each item independent; approve any subset)

### 1. Fix zero-count skip (required)
Replace `||` chain for `actualCountRaw` with first-present lookup. Alias order preserved.

```ts
// Actual Count/Quantity variations
// NOTE: must not use `||` here — a numeric 0 count is a valid value, not "empty"
const COUNT_COLUMNS = [
  'ACTUAL COUNT', 'Actual Count', 'actual count', 'ACTUAL_COUNT', 'ActualCount',
  'ACTUAL', 'Actual', 'actual',
  'PHYSICAL COUNT', 'Physical Count', 'physical count',
  'COUNT', 'Count', 'count',
  'QTY', 'Qty', 'qty',
  'QUANTITY', 'Quantity', 'quantity',
  'PHYSICAL QTY', 'Physical Qty', 'physical qty',
  'STOCK', 'Stock', 'stock',
]
let actualCountRaw: unknown = undefined
for (const col of COUNT_COLUMNS) {
  const v = row[col]
  if (v !== undefined && v !== null && v !== '') {
    actualCountRaw = v
    break
  }
}
```
Lines 203-212 unchanged: `''`/null/undefined still skip; `parseFloat("0") = 0`, `0 < 0` false → valid.

Behavior change to communicate: after this fix, **0 = "counted zero, set stock to 0"**,
**blank = "not counted, skip"**. Anyone who typed 0 to mean "skip" must leave blank instead.

- [x] Apply change
- [x] Re-run xlsx test: `0 → processed`, `'' → skipped`, `7 → processed`, text `'0' → processed`
- [ ] Preview test file in browser (preview only, no apply): row with 0 appears as update with negative difference — needs deploy or local dev server; not done yet

### 2. Reject duplicate SKU+BRANCH rows (required)
In the STEP 4 loop, after `variation` resolved and before comparing, reject duplicates
the same way missing SKUs are rejected (whole upload, no changes):

```ts
const seenKeys = new Map<string, number>() // "locationId:variationId" -> first rowNumber
...
const dupKey = `${location.id}:${variation.id}`
const firstRow = seenKeys.get(dupKey)
if (firstRow !== undefined) {
  productErrors.push(`Row ${row.rowNumber}: duplicate of Row ${firstRow} (ITEM CODE "${row.itemCode}" at BRANCH "${row.branchName}")`)
  continue
}
seenKeys.set(dupKey, row.rowNumber)
```
Error surfaces through existing `productErrors` → 400 "Product validation failed" → page already renders it.

- [x] Apply change
- [x] Logic test: duplicate row → `Row 6: duplicate of Row 4 (ITEM CODE "A3" at BRANCH "Main Warehouse")`; same SKU at a different branch NOT flagged

### 3. Show skipped-row count in preview (optional, touches page)
Count rows skipped for blank count; add `rowsSkippedBlankCount` to preview `summary`;
render one line on page under summary. Skip if you want server-only change.

- [ ] Apply change (only if approved)

### 4. Filter soft-deleted variations (optional, one line, zero impact today)
Add `deletedAt: null` to `productVariation.findMany` where clause at line 282.
Effect today: none (0 soft-deleted variations). Future: deleted variation SKU → "not found" → reject.

- [ ] Apply change (only if approved)

## Verification before commit
- [x] `npx tsc --noEmit` → only error in route.ts is pre-existing `correctionId: null` (line 559 before, 580 after; verified via git stash). Edit adds no TS errors.
- [ ] Preview run against real export with: one 0 row, one blank row, one duplicate row (needs deploy/local server)
- [ ] Commit on branch `tier2-security-fixes` — waiting for user
- Items 3 and 4 declined by user; not applied.

## Review (2026-09-19)
Applied items 1 and 2 only. One file changed: `src/app/api/admin/physical-inventory-upload/route.ts`, 38 lines.

1. `actualCountRaw` now found by iterating `COUNT_COLUMNS` and taking the first value that is
   not `undefined`/`null`/`''`. Alias priority identical to the old `||` chain. Numeric 0 and
   text "0" now flow through to `parseFloat` and compare as 0. Blank still skips. Lines after
   the lookup untouched.
2. New `seenItemAtLocation` map keyed `locationId:variationId`. Second occurrence pushes to
   existing `productErrors` and the upload is rejected via the existing 400 path the page already
   renders. Same SKU at a different branch is allowed.

Behavior change for users: 0 in ACTUAL COUNT now means "counted zero" and will set stock to 0
on apply. Blank means "not counted". User confirmed staff already use 0 this way.

Not changed: page.tsx, export route, updateStock. Preview still auto-applies when no discrepancies.
