# Task: Filter products by "Not for selling" on Products page

## Plan
Add a "Selling status" filter (All / For Selling / Not For Selling) to the Products list page, wired to the existing `notForSelling` boolean on Product.

## Todos
- [x] API `src/app/api/products/list/route.ts`: read `notForSelling` query param ('true'/'false'), add to whereClause. Absent = no filter (current behavior unchanged).
- [x] UI `src/app/dashboard/products/page.tsx`:
  - [x] Add `sellingFilter` state ('all' | 'forSelling' | 'notForSelling'), default 'all'
  - [x] Append `notForSelling` param in fetchProducts when not 'all'
  - [x] Add `sellingFilter` to fetch deps and page-reset effect
  - [x] Add Select dropdown next to existing Active/Inactive status filter
- [x] Verify tsc: 0 errors in touched files (95 pre-existing errors elsewhere, e.g. useCurrency.ts, untouched)

## Safety notes
- Default 'all' → query identical to today, zero behavior change unless user picks the filter.
- No schema change; `notForSelling` already exists (`not_for_selling`, default false).

## Review
Added "Selling status" dropdown (Selling: All / For Selling Only / Not For Selling Only) beside the Active/Inactive filter on the Products page. It sends `notForSelling=true|false` to `/api/products/list`, which adds `whereClause.notForSelling` only when the param is present. Two files touched, ~25 lines. Default state makes no query change, so existing behavior is untouched. Type-check clean on both files.

## Branch Stock Pivot V2 export timestamps (2026-07-18)

- [x] Add date/time to Excel/PDF export filenames (branch-stock-pivot-v2_YYYY-MM-DD_HH-mm-ss)
- [x] Add "Extracted: <local datetime>" header inside Excel (rows 1-2, grid starts row 4) and PDF (title + extracted line above table, page 1)

### Review
Single file changed: src/app/dashboard/products/branch-stock-pivot-v2/page.tsx (onExporting only). Excel: title+extracted cells, topLeftCell offset. PDF: autoTable startY 50, header text on page 1 via setPage(1). tsc clean.
