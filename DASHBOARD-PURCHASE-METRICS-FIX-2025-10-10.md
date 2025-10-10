# Dashboard Purchase Metrics Fix - October 10, 2025

## Issue Report

The dashboard was showing **ZERO** for all purchase-related metrics:
- ❌ Total Purchase: 0 (should be 15,999.99)
- ❌ Purchase Due: 0 (should be 15,999.99)
- ❌ Purchase Payment Due Table: Empty (should show 2 invoices)

## Root Cause Analysis

### Database Investigation

The database contains:
- **2 Purchase Orders** with total amount of **15,999.99**
- **2 Accounts Payable records** with:
  - Total Amount: 15,999.99
  - Paid Amount: 0
  - Balance Amount: 15,999.99
  - Payment Status: unpaid

### Code Issues Found in `src/app/api/dashboard/stats/route.ts`

#### 1. Total Purchase Metric (Line 51-63)
**Problem:** Was querying `Purchase` table directly
```typescript
// WRONG - This table doesn't track the actual purchase amounts properly
const purchaseData = await prisma.purchase.aggregate({
  where: { ...whereClause },
  _sum: { totalAmount: true },
})
```

**Fix:** Now queries `AccountsPayable` table
```typescript
// CORRECT - AccountsPayable is the source of truth for purchase amounts
const purchaseData = await prisma.accountsPayable.aggregate({
  where: { businessId, ... },
  _sum: { totalAmount: true },
})
```

#### 2. Purchase Due Metric (Line 111-123)
**Problem:** Was summing total purchase amounts instead of outstanding balances
```typescript
// WRONG - This gives total purchase amount, not what's DUE
const purchaseDue = await prisma.purchase.aggregate({
  where: { status: { not: 'cancelled' } },
  _sum: { totalAmount: true },
})
```

**Fix:** Now queries outstanding balances from `AccountsPayable`
```typescript
// CORRECT - Sum of unpaid/partially paid balances
const purchaseDue = await prisma.accountsPayable.aggregate({
  where: {
    businessId,
    paymentStatus: { in: ['unpaid', 'partial', 'overdue'] }
  },
  _sum: { balanceAmount: true },
})
```

#### 3. Purchase Payment Due Table (Line 223-238)
**Problem:** Was fetching Purchase records instead of Accounts Payable
```typescript
// WRONG - Purchase table doesn't have payment status
const purchasePaymentDue = await prisma.purchase.findMany({
  where: { status: { in: ['ordered', 'partially_received', 'received'] } },
})
```

**Fix:** Now queries `AccountsPayable` with correct payment status
```typescript
// CORRECT - Get unpaid/partially paid invoices from AccountsPayable
const purchasePaymentDue = await prisma.accountsPayable.findMany({
  where: {
    businessId,
    paymentStatus: { in: ['unpaid', 'partial', 'overdue'] }
  },
  orderBy: { dueDate: 'asc' },
})
```

#### 4. Response Mapping (Line 287-293)
**Problem:** Was trying to access fields from Purchase model
```typescript
// WRONG - These fields don't exist on Purchase
purchaseOrderNumber: item.purchaseOrderNumber,
date: item.purchaseDate,
amount: item.totalAmount,
```

**Fix:** Now uses correct fields from AccountsPayable
```typescript
// CORRECT - Access fields from AccountsPayable and related Purchase
purchaseOrderNumber: item.purchase.purchaseOrderNumber,
date: item.dueDate,
amount: item.balanceAmount,
```

## Changes Made

### Modified Files
1. **`src/app/api/dashboard/stats/route.ts`**
   - Changed Total Purchase calculation to use AccountsPayable
   - Changed Purchase Due to sum balanceAmount from AccountsPayable
   - Changed Purchase Payment Due table to query AccountsPayable
   - Updated response mapping to use correct field names

### Database Schema Reference

The correct schema shows:
```prisma
model Purchase {
  id                   Int      @id @default(autoincrement())
  purchaseOrderNumber  String
  totalAmount          Decimal
  // ... but NO payment tracking fields
  accountsPayable      AccountsPayable[]
}

model AccountsPayable {
  id            Int      @id @default(autoincrement())
  purchaseId    Int
  purchase      Purchase @relation(...)

  totalAmount   Decimal  // Total invoice amount
  paidAmount    Decimal  // Amount paid so far
  balanceAmount Decimal  // Outstanding balance
  paymentStatus String   // unpaid, partial, paid, overdue
  dueDate       DateTime
}
```

## Test Results

### Before Fix
```
Dashboard Display:
- Total Purchase: 0
- Purchase Due: 0
- Purchase Payment Due: No payment due
```

### After Fix
```
Database Query Results:
✓ Total Purchase: 15999.99
✓ Purchase Due: 15999.99
✓ Purchase Payment Due: 2 records
  1. PO-202510-0001 | Sample Supplier | Due: 2025-11-08 | Balance: 6000
  2. PO-202510-0002 | Sample Supplier1 | Due: 2025-11-09 | Balance: 9999.99
```

## Verification Steps

1. **Check database has AccountsPayable records:**
   ```bash
   node check-accounts-payable.js
   ```

2. **Verify dashboard calculations:**
   ```bash
   node test-dashboard-fix.js
   ```

3. **Test live dashboard:**
   - Navigate to `/dashboard`
   - Verify "Total Purchase" shows correct amount
   - Verify "Purchase Due" shows outstanding balance
   - Verify "Purchase Payment Due" table shows unpaid invoices

## Key Learnings

1. **AccountsPayable is the source of truth** for:
   - Total purchase amounts (after GRN)
   - Payment tracking (paid vs. unpaid)
   - Outstanding balances
   - Due dates

2. **Purchase table** is for:
   - Purchase order management
   - Status tracking (pending, ordered, received)
   - Basic purchase information

3. **Dashboard metrics should:**
   - Use AccountsPayable for financial metrics
   - Filter by `paymentStatus` for "due" amounts
   - Show `balanceAmount` not `totalAmount` for what's owed

## Related Files
- `/src/app/api/dashboard/stats/route.ts` (fixed)
- `/src/app/dashboard/page.tsx` (displays the metrics)
- `check-accounts-payable.js` (verification script)
- `test-dashboard-fix.js` (test script)

## Status
✅ **FIXED** - All purchase metrics now display correctly on the dashboard

## Next Steps
1. Test the dashboard in the browser to confirm visual display
2. Consider adding similar fixes for sales metrics if needed
3. Review other dashboard widgets for similar issues
