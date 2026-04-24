# Dashboard V2/V3/V4 — Date Filter & V4 Receivables Fix

## Problems

### 1. Unreliable date filtering (V2, V3, V4)

- **V3/V4 client** send dates via `date.toISOString().split('T')[0]`. In PH (UTC+8), local midnight converts to previous-day UTC → user picks `2026-04-24`, server receives `"2026-04-23"`.
- **All three APIs** (`/api/dashboard/analytics`, `/api/dashboard/intelligence-optimized`, `/api/dashboard/financial-v4`) parse `YYYY-MM-DD` via `new Date(str)` → UTC midnight = 8am PH. `lte: endDate` cuts off the last day at 8am PH.
- **V4 default filter**: `new Date(currentYear, 0, 1).toISOString().split('T')[0]` sends the previous year's Dec 31 for PH users.

### 2. V4 Receivables `Paid` is wrong

In `src/app/api/dashboard/financial-v4/route.ts` (~line 246-263):

```ts
if (balance > 0) { receivablesUnpaid += balance; /* aging */ }
else { receivablesPaid += totalAmount }
```

Partial payments never contribute to `receivablesPaid`. A sale that is 50% paid adds the full balance to `Unpaid` and nothing to `Paid`.

## Todo

- [x] Fix V4 page client date formatting + default
- [x] Fix V3 page client date formatting
- [x] Fix V2 analytics API date boundaries (PH day)
- [x] Fix V3 intelligence-optimized API date boundaries (PH day)
- [x] Fix V4 financial-v4 API date boundaries (PH day)
- [x] Fix V4 receivables: always add `paidAmount`; bucket only `balance` when > 0
- [x] Typecheck / build verification

## Approach

Treat `YYYY-MM-DD` as an Asia/Manila calendar day:
- `startDate` → `new Date(\`${s}T00:00:00+08:00\`)`
- `endDate`   → `new Date(\`${e}T23:59:59.999+08:00\`)`

Client formats Date → YYYY-MM-DD using local components (no UTC shift):
```ts
const y = d.getFullYear()
const m = String(d.getMonth() + 1).padStart(2, '0')
const day = String(d.getDate()).padStart(2, '0')
return `${y}-${m}-${day}`
```

## Review

### Files changed (5, surgical)

1. `src/app/api/dashboard/financial-v4/route.ts`
   - Date filter now parses `YYYY-MM-DD` as Asia/Manila day (`T00:00:00+08:00` → `T23:59:59.999+08:00`) with strict regex validation; default start uses the same PH-aware constructor.
   - Receivables loop rewritten: `receivablesPaid += min(paidAmount, totalAmount)` **always** (so partial payments count); balance-based aging unchanged, with `Math.max(0, daysOld)` guard against future-dated sales. `nowMs` hoisted out of the loop.

2. `src/app/api/dashboard/analytics/route.ts` (V2)
   - Same PH-day parser added locally. Main sales filter and the previous-period comparison window now both use it, falling back to legacy `new Date()` only for non-YMD inputs. `previousEnd` is now `start - 1ms` (clean end of previous window).

3. `src/app/api/dashboard/intelligence-optimized/route.ts` (V3)
   - Same PH-day parser applied to user-supplied `startDate` / `endDate`. Empty-string default (last 30 days) untouched.

4. `src/app/dashboard/dashboard-v3/page.tsx`
   - Replaced `date.toISOString().split('T')[0]` with a local-component formatter `toLocalYmd(d)` so picking April 24 in PH actually sends `"2026-04-24"`.

5. `src/app/dashboard/dashboard-v4/page.tsx`
   - Same `toLocalYmd` swap for the two `toISOString` calls; default `startDate = new Date(currentYear, 0, 1)` now serializes as the correct local Jan 1.

### Safety notes

- No schema changes, no new files, no refactors.
- All date helpers are scoped inside the existing function — nothing exported or shared across modules.
- Fallbacks preserved: non-`YYYY-MM-DD` inputs still fall through to the old `new Date(str)` path, so any existing callers passing ISO strings continue to work.
- `typecheck` on the 5 edited files: clean. Pre-existing errors in `src/hooks/useCurrency.ts` are unrelated (file untouched; `git status` confirms no diff).

### Behavioral change for users

- Date range filters now include the **entire last day** (PH time) — previously cut off at 8 AM.
- Dates picked in the UI are transmitted as the day shown on screen — previously shifted 1 day back for PH users.
- V4 "Paid" on receivables now includes partial payments — previously only fully-paid sales contributed.

### Not touched

- Payables loop in V4 API (bucket math looked correct; only receivables was called out).
- Inventory aging (noted as simplified/synthetic in code; out of scope).
- `useCurrency.ts` pre-existing parse errors (unrelated to this task).
