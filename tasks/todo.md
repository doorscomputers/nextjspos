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
