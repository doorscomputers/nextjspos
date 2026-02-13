# Add Product History to Physical Inventory Discrepancy Report

## Todo
- [x] Backend: Add `variationId` and `locationId` to preview response
- [x] Frontend: Update `PreviewUpdate` interface with new fields
- [x] Frontend: Add imports, state variables, and toggle function
- [x] Frontend: Replace static discrepancy table rows with expandable rows + history sub-table
- [x] Frontend: Reset expanded state on cancel/confirm

## Review

### Changes Made

**File: `src/app/api/admin/physical-inventory-upload/route.ts`**
- Added `locationId` and `variationId` to the `previewUpdates` response mapping (2 lines). These fields already existed on `updateItems` but were omitted from the preview API response.

**File: `src/app/dashboard/admin/physical-inventory-upload/page.tsx`**
- Added `React` import and `StockHistoryEntry` type import, plus `ChevronDownIcon`/`ChevronUpIcon`
- Added `locationId` and `variationId` fields to `PreviewUpdate` interface
- Added 3 state variables: `expandedRows`, `historyCache`, `loadingHistory`
- Added `toggleHistoryRow()` function that lazy-loads stock history from `/api/products/[id]/stock-history` on expand, caches results, and shows last 20 transactions
- Replaced the static discrepancy table with expandable rows: each row has a chevron button, and when expanded shows a sub-table with Date, Type, Reference, Qty Change, Balance, Notes columns. Color-coded green for additions, red for removals.
- State is cleared on cancel preview and on successful confirm upload

### Impact
- No new API endpoints created (reuses existing stock-history API)
- Only 2 files modified
- History is lazy-loaded per item on demand, keeping initial preview fast
- Backward-compatible: `locationId`/`variationId` are additive fields in the API response
