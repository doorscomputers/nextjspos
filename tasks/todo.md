# Negative Stock — EPSON 0576 LIGHT MAGENTA (product_id 752)

## Investigation result (2026-09-13)

### Symptom
Branch Stock Pivot shows Total Stock = **-2**, but every location column shows 0.

### Finding 1 — the -2 is REAL and lives in Main Warehouse
`variation_location_details` id 3005, product_id 752, location_id 1 (Main Warehouse),
`qty_available = -2.0000`, `updated_at = 2026-03-20 07:30:42.846`.
It is the ONLY negative stock row in the entire database (1 row, 1 product, -2 total).

### Finding 2 — root cause: duplicate transfer_out (double-send race)
`product_history` shows transfer **TR-202603-0151** deducted stock from Main Warehouse TWICE:

| id    | when                    | qty | balance | user    |
|-------|-------------------------|-----|---------|---------|
| 21197 | 2026-03-20 07:30:40.015 | -2  | 0       | Jheiron |
| 21199 | 2026-03-20 07:30:42.846 | -2  | **-2**  | Brian   |

Only ONE matching `transfer_in` (+2 to Main Store). So 4 units were deducted for a 2-unit transfer.
2.8 seconds apart, two different users clicking Send on the same transfer.

Same pattern found on 12 other transfers (TR-202512-0101, -0166, TR-202601-0207,
TR-202602-0232, TR-202603-0097, -0149, -0150, -0151). Always Main Warehouse,
always Brian + Jheiron seconds apart. **Last occurrence: 2026-03-20.** None since.

### Finding 3 — the race is already fixed in current code
`src/app/api/transfers/[id]/send/route.ts:205-210` and
`src/lib/job-processor.ts:456-462, 597-603` both claim the transfer atomically:
`updateMany({ where: { id, status: 'checked', stockDeducted: false } })` and bail with
`TRANSFER_ALREADY_SENT` when `count === 0`. Second click can no longer deduct.
=> The -2 is **leftover damage from March**, not a live bug.

### Finding 4 — REAL live bug: the UI hides where negative stock is
`src/app/api/products/branch-stock-pivot/route.ts:370-373`

```js
const qty = parseFloat(row[`loc_${i}_qty`] || 0)
if (qty > 0) {
  stockByLocation[i] = qty     // <-- negative qty silently dropped
}
```

`stockByLocation` drops any non-positive qty, so the Main Warehouse cell renders 0.
But `totalStock` (line 389-393) sums the RAW values including the -2.
=> Total says -2, no column shows where it came from. This makes every future
negative-stock incident impossible to trace from the report.

## Todo

- [x] 1. Fix display bug: change `if (qty > 0)` to `if (qty !== 0)` in
        `src/app/api/products/branch-stock-pivot/route.ts:371` so negative stock
        shows in its own location column. (1 line, display only, zero risk.)
- [x] 2. Check `branch-stock-pivot/route-optimized.ts` — same line at :315 but file is NOT served by Next.js (only route.ts is a route). Left untouched. for the same `qty > 0` filter.
- [ ] 3. (USER, in app UI) Correct the data: set product 752 / location 1 `qty_available` from -2 to 0,
        with a `product_history` adjustment row documenting the duplicate TR-202603-0151
        deduction. NEEDS USER APPROVAL + physical count confirmation.

## Review (2026-09-13)

**Code change (1 file, 1 logical line):** `src/app/api/products/branch-stock-pivot/route.ts:371`
`if (qty > 0)` -> `if (qty !== 0)` so negative location quantities reach the grid.
Frontend `getStockColor` already paints <=0 red, so the cell now shows "-2" in red with no UI change.
`totalStock` untouched. `npx tsc --noEmit` reports 0 errors for this file.

**Is 1+2 "the solution"?** No. They only make negative stock VISIBLE in its column.
They do not remove the -2. Nothing in code needs fixing for the cause: the double-send race
that created it (TR-202603-0151, 2026-03-20) is already blocked by the atomic claim in
`send/route.ts:205` and `job-processor.ts:456,597`. Last duplicate ever recorded: 2026-03-20.

**Data fix (user does this in the app, no SQL):** physical count confirmed 0.
Inventory Corrections -> New -> Main Warehouse / EPSON 0576 LIGHT MAGENTA / physical count 0
-> remarks "Duplicate transfer_out on TR-202603-0151 (2026-03-20 double send). Physical count 0."
-> Approve. Approve route computes 0 - (-2) = +2 and writes the audited product_history row.
Then click Refresh Stock on the pivot page (refreshes stock_pivot_view materialized view).

**Verify after:** `SELECT count(*) FROM variation_location_details WHERE qty_available < 0` -> 0.
