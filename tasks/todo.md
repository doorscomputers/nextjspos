# Fix: Inactive products invisible in Branch Stock Pivot & Pivot V2

Root cause: `stock_pivot_view` materialized view excludes inactive products (`AND p.is_active = true`), so no filter can show them. User approved: default Active-only, inactive on demand.

## Todo

- [x] 1. migration.sql: remove `AND p.is_active = true`, add `p.is_active` column to view
- [x] 2. `src/app/api/products/stock/route.ts`: add `is_active = true` base clause (keeps Branch Stock page active-only)
- [x] 3. V1 page: default `isActive` filter `'all'` → `'true'` (initial + reset)
- [x] 4. V2 page: Status column `defaultFilterValues={['Active']}`
- [x] 5. Typecheck edited files (no errors in edited files)
- [x] 6. Run `npx tsx scripts/run-stock-view-migration.ts` to rebuild view
- [x] 7. Verify in DB: inactive rows present in view

## Review

Root cause: `stock_pivot_view` materialized view was created with `AND p.is_active = true`, so inactive products never existed in its data. V1's "Inactive Only" filter was logically correct but filtered an empty set; V2's DevExtreme Status header filter only listed "Active" because no loaded row was inactive.

Changes (4 files, all minimal):
1. `prisma/migrations/20250131_create_stock_pivot_materialized_view/migration.sql` — dropped the `is_active = true` predicate; added `p.is_active` as a view column.
2. `src/app/api/products/stock/route.ts:68` — base where clause now includes `is_active = true` so the Branch Stock page keeps showing active products only (it has no status filter of its own).
3. `src/app/dashboard/products/branch-stock-pivot/page.tsx` — default/reset `isActive` filter changed `'all'` → `'true'` (Active Only default, per user decision).
4. `src/app/dashboard/products/branch-stock-pivot-v2/page.tsx` — Status column got `defaultFilterValues={['Active']}` (defaults to Active; header filter now lists both values).

DB migration applied to production 2026-08-26 and verified:
- View now holds 2071 rows: 1634 active + 437 inactive.
- All 7 indexes recreated (incl. unique index required by REFRESH CONCURRENTLY).
- `refresh_stock_pivot_view()` concurrent refresh works (148ms).

IMPORTANT: until the code changes are deployed, the live site runs old code against the new view — Branch Stock and both pivot pages will show inactive products mixed in. Deploy promptly.
