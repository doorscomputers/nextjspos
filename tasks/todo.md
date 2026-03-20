# Fix Dashboard Purchase Data Bugs

## Todo

### Fix 1: Intelligence API - Add Real Purchase Data
- [x] Add `accountsPayable.aggregate` query to the Promise.all block in intelligence route
- [x] Add daily purchase trends query (groupBy on invoiceDate)
- [x] Add `totalPurchases` and `purchaseTrends` to the response
- [x] Update analytics-devextreme page to use real `totalPurchases` from API
- [x] Update analytics-devextreme page trend chart to use real purchase data

### Fix 2: Stats Route - Add Date Filter to Purchase Query
- [x] Add `invoiceDate: dateFilter` to the purchase aggregate query in stats route

### Fix 3: Stats-Progressive Route - Add Date Filter to Purchase Query
- [x] Add `invoiceDate: dateFilter` to the purchase aggregate query in stats-progressive route

### Verification
- [x] TypeScript compiles cleanly for all modified files

## Review

### Files Modified

**1. `src/app/api/dashboard/intelligence/route.ts`**
- Added `purchaseWhere` clause with date range and location filtering (matches existing pattern from stats-cached)
- Added `purchaseAggregate` query (`accountsPayable.aggregate`) to the existing Promise.all block
- Added `purchaseTrends` query (`accountsPayable.groupBy` on `invoiceDate`) for daily purchase amounts
- Added `totalPurchases` to the `executive` response object (real data from AccountsPayable)
- Added `purchaseTrends` array to the response

**2. `src/app/dashboard/analytics-devextreme/page.tsx`**
- Added `purchaseTrends` to the `AnalyticsData` interface
- Replaced fake `executive.revenue - executive.profit` (COGS) with real `executive.totalPurchases`
- Replaced fake `trend.revenue * 0.6` (hardcoded 60% multiplier) with real daily purchase amounts from `purchaseTrends`, merged by date

**3. `src/app/api/dashboard/stats/route.ts`**
- Added `...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {})` to the purchase aggregate query's where clause

**4. `src/app/api/dashboard/stats-progressive/route.ts`**
- Same fix as stats route - added date filter to purchase aggregate query

### Impact
- 4 files modified
- All changes are additive (new queries) or simple replacements (fake → real data)
- Main dashboard (`stats-cached`) is NOT touched - already correct
- No changes to database schema or RBAC
