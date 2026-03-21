# Fix Remaining Dashboard Bugs

## Todo

### Fix 1: Expense Card Shows 0 (3 routes)
- [x] Add `prisma.expense.aggregate` to stats/route.ts Promise.all, remove hardcoded line
- [x] Add `prisma.expense.aggregate` to stats-progressive/route.ts Promise.all, remove hardcoded line
- [x] Add `prisma.expense.aggregate` to stats-cached/route.ts Promise.all, remove hardcoded line

### Fix 2: Analytics Route Uses Wrong Date Field
- [x] Change `createdAt: dateFilter` to `saleDate: dateFilter` in sale count query
- [x] Change `createdAt: dateFilter` to `saleDate: dateFilter` in salesData findMany query
- [x] Change `createdAt: { gte, lte }` to `saleDate: { gte, lte }` in previous period comparison

### Fix 3: Customer Sales Report Uses Wrong Date Field
- [x] Change `where.createdAt` to `where.saleDate` for date filtering
- [x] Change `sale.createdAt` references to `sale.saleDate` for first/last purchase tracking

### Fix 4: Intelligence Dashboard Missing Location Filter in Raw SQL
- [x] Add `import { Prisma } from '@prisma/client'`
- [x] Add location filter to low stock raw SQL query
- [x] Add location filter to out-of-stock raw SQL query

### Verification
- [x] TypeScript compiles cleanly for all modified files (0 errors in changed files)

## Review

### Files Modified

**1. `src/app/api/dashboard/stats/route.ts`**
- Added `prisma.expense.aggregate` query to Promise.all (filters by businessId, status in ['approved','posted'], dateFilter on expenseDate, locationId)
- Added `expenseData` to destructured results
- Removed hardcoded `expenseData = { _sum: { amount: null } }`

**2. `src/app/api/dashboard/stats-progressive/route.ts`**
- Same expense aggregate query added to metrics section Promise.all
- Removed hardcoded `expenseData`

**3. `src/app/api/dashboard/stats-cached/route.ts`**
- Same expense aggregate query added to the merged Promise.all
- Added `expenseData` to destructured results
- Removed hardcoded `expenseData`

**4. `src/app/api/dashboard/analytics/route.ts`**
- 3 instances of `createdAt` changed to `saleDate` for correct date-based filtering

**5. `src/app/api/reports/customer-sales/route.ts`**
- Date filter changed from `createdAt` to `saleDate`
- First/last purchase tracking changed from `createdAt` to `saleDate`
- Purchase history date changed from `createdAt` to `saleDate`

**6. `src/app/api/dashboard/intelligence/route.ts`**
- Added `import { Prisma } from '@prisma/client'`
- Low stock raw SQL: added conditional `AND vld."location_id" IN (...)` when locationIds provided
- Out-of-stock raw SQL: same location filter added

### Impact
- 6 files modified
- All changes are minimal: adding real queries or swapping field names
- No schema changes, no RBAC changes
- Pattern for expense query follows existing financial-v4 implementation
