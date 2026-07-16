# Phantom Stock Fix — enable_stock=false on real products

Investigation complete (see `tasks/phantom-stock-enable-stock-bug.md`). Plan below. NO changes made yet.

## Todo

### Phase 1 — Data fixes (production DB, Supabase) — DONE
- [x] 1. Flag fix: `enable_stock = true` on 9 real products (139, 59, 554, 1931, 1944, 1949, 1985, 1989, 1991)
- [x] 2. Flag fix: `not_for_selling = false` on 3 TECNO phones (1985, 1989, 1991)
      — SF1 (1544) and PARTSBATTERY (2000) untouched
- [x] 3. Stock correction: variation 1984 @ Bambang 1 → 0 with full audit trail:
      inventory_corrections #544 (approved) → stock_transactions #38983 (adjustment −1,
      unit cost 11592.42) → product_history row → VLD 0. Done via stored function
      `update_inventory_with_history` (same locked path app uses).
- [x] 4. Verified: flags_enabled=9, nfs_cleared=3, Bambang qty=0.0000, correction linked.

### Phase 2 — Code fix (prevent recurrence) — DONE
- [x] 5. `src/app/api/sales/route.ts`: stock skip was based on CLIENT-SENT `item.notForSelling`
      (both availability check ~889 and deduction ~1184). Now based on server-side
      `product.enableStock` (added to variationsMap select). Client flag can no longer
      skip stock handling.
- [x] 6. Origin was NOT CSV import (import route forces enableStock=true). Origin =
      product Add/Edit forms: "Not for selling" checkbox force-set `enableStock: false`
      and disabled the Manage Stock checkbox. Decoupled in both
      `products/add/page.tsx` and `products/[id]/edit/page.tsx` — notForSelling now
      only hides from POS, never touches enableStock.
- [x] 7. Build verify (npm run build — exit 0)

## Review

**Data (production, Supabase project ydytljrzuhvimrtixinw):**
- 9 products re-enabled for stock tracking; 3 TECNO phones made sellable again.
- One quantity change only: TECNO SPARK 50 5G @ Bambang 1→0 (correction #544,
  stock tx #38983). Reported discrepancy resolved. Main Store TECNO qty 1 = correct
  (never sold there).

**Code (3 files):**
- `src/app/api/sales/route.ts` — server-authoritative `enableStock` decides stock
  skip; client `notForSelling` ignored for stock decisions.
- `src/app/dashboard/products/add/page.tsx`, `products/[id]/edit/page.tsx` —
  "Not for selling" no longer forces/disables "Manage Stock".

**Known pre-existing asymmetry (NOT touched, minimal-change rule):** void route
restores stock for ALL sale items unconditionally, incl. enable_stock=false services.
Existed before this fix; same-day void policy limits exposure. Flag if it matters.

**Note:** sale 11783 (the TECNO sale) still has no ledger rows — intentionally left;
correction #544 documents and fixes the net effect instead of rewriting history.

---

# Same-day void policy (follow-up to exchange-void fix)

## Decision (user approved 2026-07-16)

Voids allowed only on the sale's own business day while its shift is still open.
Past-day / post-Z corrections must use the Customer Return / Exchange flow
(handles stock, price difference, expected cash correctly — no oversales, no
mystery over/short). Super Admin may override. NO inventory-correction+re-punch.

## Todo

- [x] 1. `void/route.ts`: block void when sale.saleDate ≠ Manila today (non-super-admin)
- [x] 2. `void/route.ts`: block void when sale's shift is closed (Z done) (non-super-admin)
- [x] 3. `void/route.ts`: skip shift running-total decrement when shift no longer open
      (protects frozen Z totals on Super Admin override path)
- [x] 4. Build verify (`npm run build` exit 0)

## Review (same-day void policy)

Single file changed: `src/app/api/sales/[id]/void/route.ts` (+1 import `isSuperAdmin`).
- Policy check placed after ownership/status checks, before any mutation.
- `sale_date` is a DATE column holding PH calendar date → string compare with
  `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila'})` today. No timezone math.
- Shift check via one `cashierShift.findUnique` on status only.
- Inside transaction: running-total decrement now conditional on shift status
  'open' — same-day normal voids unaffected (shift is open), closed-shift
  totals never touched.
- No schema, RBAC, or DB changes. Super Admin override uses existing
  `isSuperAdmin()` (role check, already grants all permissions).

---

# Fix: Voiding an exchange sale corrupts inventory (Bambang HIKSEMI case)

## Root cause (confirmed in production DB)

Exchange `EXC-202607-0006` (2026-07-15, Bambang): customer returned 1× HIKSEMI 16GB
(product 1580, +1 stock) and took 2× HIKSEMI 8GB (product 1579, −2 stock). Stock was
correct after the exchange (16GB=1, 8GB=0). Cashier then voided the exchange sale
("WRONG INPUT"). The void handler (`src/app/api/sales/[id]/void/route.ts`) treats an
exchange sale like a plain sale:

- restores the ISSUED items (+2 8GB → overstated, items are with the customer)
- does NOT reverse the RETURN leg (customer_returns stays `exchanged`, 16GB +1 kept)
- decrements shift VAT/discount running totals that the exchange never incremented

4 voided exchange sales exist historically (Dec 2025 ×1, Jun 2026 ×2, Jul 2026 ×1),
all with dangling `customer_returns` rows.

## Todo

- [x] 1. `src/lib/shift-running-totals.ts`: add `decrementShiftTotalsForExchangeVoid()`
      that exactly mirrors `incrementShiftTotalsForExchange()` (exchange count/sales,
      return amount, payment field) + void tracking. No VAT/discount fields.
- [x] 2. `src/app/api/sales/[id]/void/route.ts`:
      - Block voiding a NON-exchange sale that has active linked customer_returns
        (status not in rejected/cancelled/voided) — prevents double-restore.
      - When voiding an EXCHANGE sale (`saleType === 'exchange'`): find linked return
        via `returnNumber = 'RTN-' + invoiceNumber`, deduct each returned item back out
        (deductStock, ADJUSTMENT, allowNegative, ref sale_void), set return status
        `voided`, revert serials from both legs via serial_number_movements.
      - Use the new exchange-specific shift decrement instead of
        `decrementShiftTotalsForVoid` for exchange sales.
      - Response message tells cashier to re-enter the exchange if the swap really happened.
- [x] 3. `scripts/audit-voided-exchanges.ts`: read-only report of every voided exchange
      sale, its return/issue legs, whether reversal is missing, current qty per product —
      so the user can recount and correct the older 3 cases.
- [ ] 4. Data fix for the live incident: product 1579 (8GB GOLD) @ Bambang must go 2 → 0.
      Recommend Inventory Correction in dashboard (physical count 0), OR approve script fix.
      **AWAITING USER** — needs physical recount confirmation before touching production stock.
- [x] 5. Verify: `npm run build` exit 0; tsc clean on touched files (pre-existing
      `useCurrency.ts` JSDoc parse errors unrelated); audit script ran against production
      and produced sane output for all 4 voided exchanges.

## Review

### Files changed (2 code + 1 new script)

1. **`src/app/api/sales/[id]/void/route.ts`**
   - New guard: voiding any sale that has active linked `customer_returns`
     (status not rejected/cancelled/voided) is now blocked with a clear error —
     prevents double-restoring stock that a return/exchange already restored.
     (Exchange sales link their return via `returnNumber`, not `saleId`, so the
     exchange itself remains voidable.)
   - When voiding an exchange sale (`saleType === 'exchange'`), inside the same
     transaction: finds linked return `RTN-<invoiceNumber>` with status
     'exchanged', deducts each returned item back out of stock (ADJUSTMENT,
     `allowNegative` for safety), sets the return status to `voided`, and
     reverts serial numbers from both legs (returned serials → back to sold on
     original sale; issued serials → back to in_stock).
   - Exchange voids now use `decrementShiftTotalsForExchangeVoid` instead of the
     plain-sale decrement, which was corrupting VAT/discount running totals the
     exchange never incremented.
   - Response message on exchange void warns cashier to re-enter the exchange if
     the physical swap actually happened.

2. **`src/lib/shift-running-totals.ts`**
   - New `decrementShiftTotalsForExchangeVoid()` — exact mirror of
     `incrementShiftTotalsForExchange()`: decrements exchange count/sales,
     return amount, and per-payment-method fields; increments void tracking.
     Does NOT touch VAT/discount fields.

3. **`scripts/audit-voided-exchanges.ts`** (new, read-only)
   - Prints every voided exchange: void record, linked return, whether the
     return leg was reversed, both legs' products with current stock and
     surrounding product_history. Run: `npx tsx scripts/audit-voided-exchanges.ts`

### Audit findings (production, needs physical recounts)

| Exchange | Location | Product to recount | System qty |
|---|---|---|---|
| EXC-202607-0006 (the incident) | Bambang | HIKSEMI 8GB DDR4 GOLD | 2 (should be 0) |
| EXC-202512-0014 | Bambang | POWER CORD 2HOLES | 27 (likely +1 over) |
| EXC-202606-0002 | Main Store | MERCUSYS MS110P | 2 |
| EXC-202606-0002 | Main Store | VENTION HDMI switcher | 1 |
| EXC-202606-0003 | Bambang | TPLINK TL-SG108 | 2 |

### Remediation path
Physical recount each product above → apply Inventory Correction in dashboard
(reference the exchange number). No script writes to production stock were made.

---

# Dashboard Period Filter — Add Presets + Custom Range (Phase 2)

## Plan

Frontend-only change in `src/app/dashboard/page.tsx`. Backend `stats-cached` and `/api/payments` already accept arbitrary `startDate`/`endDate` — no API changes.

- [x] 1. Extend `getDateRange()` with new presets (all PH-timezone calendar based):
  - Yesterday (start = end = today − 1)
  - Last Week (Monday–Sunday of previous week)
  - Last Month (1st–last day of previous month)
  - Last Quarter (3-month block before current quarter)
  - Last Year (Jan 1 – Dec 31 previous year)
  - Custom (passes through user-picked start/end)
- [x] 2. Added new items to both Period dropdowns (metrics header + Payments to Suppliers card)
- [x] 3. Custom range UI on both dropdowns: two native `<input type="date">` fields, fetch only when both dates set, `min`/`max` guard against inverted ranges, dark-mode styled, flex-wrap for mobile
- [x] 4. Build passes (exit 0)
- [x] 5. Committed + pushed

## Review (Phase 2)

Single file changed: `src/app/dashboard/page.tsx`
- New `PeriodFilter` type union shared by both dropdown states
- `getDateRange(filter, customRange?)` extended; existing presets untouched
- Fetch guards skip API calls while custom range is half-filled (old data stays, no flicker)
- No backend changes: `stats-cached` and `/api/payments` already accept `startDate`/`endDate`

---

# Dashboard Date Filter Accuracy Fix (main /dashboard)

## Investigation Findings (verified against production DB)

**Symptom:** Main dashboard (`/dashboard`) "This Month" sales tile shows ~₱13.36M while actual June 1–10 completed sales are ~₱4.17M (~3.2x overstatement).

### Root Cause 1 — Frontend: "This Month" is actually "last 30 days"
`src/app/dashboard/page.tsx` `getDateRange()` (lines 238–241):
- `month` filter computes `now − 30 days` (rolling window May 11–Jun 10), but UI label says "This Month".
- `week` filter computes `now − 7 days` (8 days inclusive), labeled "This Week".
- `today`, `quarter`, `year` are correct (calendar-based).

### Root Cause 2 — Backend: Total Sales includes voided + soft-deleted sales
`src/app/api/dashboard/stats-cached/route.ts`:
- Total Sales aggregate (line 242) has NO `status` filter and NO `deletedAt: null`.
  Voided sales: ₱33,311 in June alone; ₱118,742 in the rolling window.
- Same problem in chart queries `salesLast30Days` (line 307) and `salesCurrentYear` (line 317).
- Trusted report convention (`/api/reports/sales-today` lines 61–72): `status IN ('completed','pending')` + `deletedAt: null`. Pending = credit sales, counted as sales.

### Verified NOT bugs
- `sale_date` is a DATE column storing PH calendar date (POS client sends +8h-shifted timestamp). Server-side `new Date(y,m-1,d)` boundaries are safe against DATE columns regardless of server timezone.
- Purchases/returns/payments date columns are also DATE — same safety.

## Todo

- [x] 1. Frontend `page.tsx` `getDateRange()`: `month` → start at 1st of current month (`formatDate(year, month, 1)`)
- [x] 2. Frontend `week` → Monday-start calendar week (user approved)
- [x] 3. Backend `stats-cached/route.ts`: add `status: { in: ['completed','pending'] }, deletedAt: null` to Total Sales aggregate
- [x] 4. Same filter on `salesLast30Days` and `salesCurrentYear` chart queries
- [x] 5. Bonus: `sales-by-location/route.ts` chart also counted voided sales (`notIn ['cancelled','draft']`) → aligned to `in ['completed','pending'] + deletedAt: null`
- [x] 6. Verify: `npm run build` passed (exit 0); expected values pulled from production DB

## Review

### Files changed (3, all minimal)
1. `src/app/dashboard/page.tsx` — `getDateRange()`: `month` now starts at 1st of current month; `week` now starts at Monday of current week (was rolling 30/7 days). Affects metrics tiles + supplier payments tile (both callers share the labels "This Month"/"This Week").
2. `src/app/api/dashboard/stats-cached/route.ts` — Total Sales aggregate + `salesLast30Days` + `salesCurrentYear` chart queries now filter `status IN ('completed','pending')` and `deletedAt: null` (was: no filter — voided + soft-deleted counted).
3. `src/app/api/dashboard/sales-by-location/route.ts` — status filter changed from `notIn ('cancelled','draft')` (voided counted) to `in ('completed','pending')` + `deletedAt: null`.

### Expected dashboard values after deploy (as of 2026-06-10, all locations)
- Today: ₱79,239.00
- This Week (Mon Jun 8 – Jun 10): ₱1,172,217.00
- This Month (Jun 1 – 10): ₱4,774,575.32 (was showing ~₱13.36M)

### Not bugs (verified)
- `sale_date` is a DATE column holding PH calendar date; server timezone cannot shift day boundaries. Today/Quarter/Year filters were already calendar-correct.

### Pre-existing, untouched
- `src/hooks/useCurrency.ts` JSDoc contains nested `*/` (line 45) → breaks `tsc --noEmit` parse. Build unaffected. Fix separately.
- Dashboards V2/V3/V4 use different endpoints (fixed in earlier commits), not touched here.
