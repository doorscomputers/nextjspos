# Dashboard metrics accuracy fixes (2026-08-19)

Production DB verified before coding. Only file touched: `src/app/api/dashboard/stats-cached/route.ts`
(confirmed sole consumer of live dashboard; `page-old.tsx` uses old `/stats` route — untouched).

## Todos

- [x] Fix #2: "Purchases (Period)" card sources `accounts_payable.total_amount`; switch to
      `purchases.total_amount` with `status != 'cancelled'`, `deletedAt: null`, `purchaseDate` in
      period. Expected new value for This Year: **76,914,022.20** (was 78,008,588.50).
- [x] Fix #3: "A/R Outstanding" raw SQL ignores Period selector, location filter, and
      `deleted_at`. Add all three. Expected new value for This Year (all locations):
      **7,557,843.51** (was 8,146,384.59).
- [x] Typecheck the edited file manually (`ignoreBuildErrors` is on — see memory).
- [x] Verify expected values by re-running the exact new query shapes against production SQL.

## Explicitly NOT doing (user's call pending)

- #1 A/P Outstanding — data-entry/process issue (only 3 supplier payments exist, none linked to AP).
- #4 Expense card — draft-only expenses; process issue.
- #5 336 sales rows with subtotal−discount≠total — historical data audit.
- #6 `totalSales`/`netAmount` naming inversion — renaming keys risks breaking other consumers.
- #7 Return cards ignoring filters.

## Review

One file changed: `src/app/api/dashboard/stats-cached/route.ts` (4 edits, all scoped to the
two broken metrics; no other query, metric, or response shape touched).

1. **Purchases (Period)** now aggregates `prisma.purchase` (was `prisma.accountsPayable`),
   excluding `cancelled` and soft-deleted POs, filtered by `purchaseDate` and the
   `locationId` param. This Year: 78,008,588.50 → **76,914,022.20** (166 POs).
2. **A/R Outstanding** raw SQL now has `deleted_at IS NULL`, the Period date bounds, and the
   same location scope as the sales cards (`Prisma.sql`/`Prisma.join` fragments; empty and
   IN-list branches both exercised). This Year: 8,146,384.59 → **7,557,843.51**.
3. Added `Prisma` import; added `arLocationIds` helper derived from existing `whereClause`.

Verification performed (production, read-only):
- Expected values pre-computed via direct SQL, then reproduced by running the *actual edited
  Prisma code* via a temp tsx script (deleted after): both match to the centavo.
- `tsc --noEmit`: 0 errors in the edited file (95 pre-existing elsewhere, untouched).
- Route cache TTL is 60s; new figures appear within a minute of deploy, no cache-key change.

Not done (deliberately — see "NOT doing" above): A/P payment-linkage process issue, draft-only
expenses, 336-row sales arithmetic audit, metric key naming inversion, return-card filters.
