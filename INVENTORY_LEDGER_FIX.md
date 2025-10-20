# Inventory Ledger Duplicate Transaction Fix

## Problem Summary

The inventory ledger was showing duplicate transactions for purchase receipts, causing discrepancies in calculated balances.

### Example Evidence
- **Product**: 1826DJNTY LEATHERETTE EXECUTIVE CHAIR
- **Location**: Main Warehouse
- **Expected final stock**: 20 units (4 opening + 16 purchase)
- **Actual system inventory**: 20 units ✅ CORRECT
- **Ledger calculated balance**: 36 units ❌ WRONG (duplicate showing)

### Duplicate Transactions Found
1. **10/18/2025, 8:00:00 AM** - Type: "Purchase" - Reference: "1" - Description: "Purchase Receipt - PO #1, GRN #1" - QTY IN: +16.00 (ProductHistory record)
2. **10/18/2025, 9:08:43 PM** - Type: "Stock Received" - Reference: "GRN-202510-0001" - Description: "Stock Received - GRN #GRN-202510-0001 (PO #PO-202510-0001)" - QTY IN: +16.00 (StockTransaction record)

## Root Cause Analysis

### The Architecture (By Design)

The system maintains TWO separate tables for tracking inventory:

1. **StockTransaction** - The primary source of truth for inventory movements
   - Created in `stockOperations.ts` (lines 200-214)
   - Records actual stock changes with running balance
   - Used for inventory calculations

2. **ProductHistory** - Audit trail for detailed history
   - Created in `stockOperations.ts` (lines 222-244)
   - Provides additional context and audit information
   - Includes user display names, detailed notes, etc.

Both tables are populated by the SAME stock operation - this is intentional and correct!

### The Bug

The bug was in the **display logic** in `src/lib/stock-history.ts` (lines 99-102):

```typescript
// OLD CODE - WRONG: Merges both tables
const allTransactions: any[] = [
  ...stockTransactions.map(t => ({ source: 'stockTransaction', data: t, date: t.createdAt })),
  ...productHistory.map(h => ({ source: 'productHistory', data: h, date: h.transactionDate }))
].sort((a, b) => a.date.getTime() - b.date.getTime())
```

This code combined records from BOTH tables, effectively showing each purchase TWICE in the ledger!

## The Fix

Modified `src/lib/stock-history.ts` to use ONLY `StockTransaction` records for ledger display:

```typescript
// NEW CODE - CORRECT: Uses only StockTransaction (single source of truth)
const stockTransactions = await prisma.stockTransaction.findMany({
  where,
  include: {
    createdByUser: {
      select: {
        username: true,
        firstName: true,
        lastName: true
      }
    }
  },
  orderBy: {
    createdAt: 'asc'
  }
})

// Map to unified format for display
const allTransactions: any[] = stockTransactions.map(t => ({
  source: 'stockTransaction',
  data: t,
  date: t.createdAt
}))
```

### Files Modified

1. **`src/lib/stock-history.ts`** (lines 56-120)
   - Removed ProductHistory fetching from ledger display function
   - Simplified processing loop to handle only StockTransaction records
   - Added comments explaining the single source of truth approach

## Verification

### Before Fix
```
Stock Transactions (purchase type): 3
Product History (purchase type): 3
⚠️  Found 3 potential duplicates
```

All 3 purchase receipts were showing twice in the ledger!

### After Fix
The ledger now shows only StockTransaction records, eliminating duplicates while maintaining:
- Correct inventory balances
- Proper running balance calculations
- Complete audit trail (ProductHistory still exists for reporting)

### Test Script

Run the duplicate checker to verify:
```bash
node scripts/check-duplicate-transactions.mjs
```

This script:
1. Identifies all purchase transactions in both tables
2. Groups them by product, location, quantity, and reference
3. Reports any that appear in both tables with the same details

## Purchase Receipt Workflow (Correct)

1. **Create Purchase Order** → No stock change
2. **Create GRN** (`POST /api/purchases/[id]/receive`) → No stock change (pending approval)
3. **Approve GRN** (`POST /api/purchases/receipts/[id]/approve`) → Stock added via `processPurchaseReceipt()`
   - Creates ONE StockTransaction record
   - Creates ONE ProductHistory record (for audit)
   - Updates VariationLocationDetails (actual inventory)

## Why Two Tables?

The dual-table approach provides:

1. **StockTransaction** - Source of truth
   - Fast queries for inventory calculations
   - Running balance maintained
   - Used for stock reports and availability checks

2. **ProductHistory** - Audit trail
   - Detailed user information (display names)
   - Rich contextual information
   - Used for audit reports and compliance
   - Can include additional metadata not in StockTransaction

The key is: **Display only ONE table in the ledger to avoid duplicates!**

## Impact

This fix resolves:
- ✅ Duplicate transactions in inventory ledger display
- ✅ Incorrect calculated balances in ledger view
- ✅ Confusion when reconciling inventory

This fix does NOT affect:
- ❌ Actual inventory quantities (were always correct)
- ❌ Stock availability calculations (uses VariationLocationDetails)
- ❌ Purchase receipt approval workflow (working correctly)
- ❌ Historical data integrity (both tables still maintained)

## Future Considerations

1. **ProductHistory Table** - Consider whether it's still needed if StockTransaction provides sufficient audit trail
2. **Ledger Reports** - Ensure all ledger-related reports use the same single-source approach
3. **API Responses** - Verify that inventory history endpoints return deduplicated results

## Testing Checklist

- [ ] Create a new purchase order
- [ ] Create a GRN for the purchase
- [ ] Approve the GRN
- [ ] Check the inventory ledger shows only ONE transaction (not two)
- [ ] Verify the calculated balance matches the actual inventory
- [ ] Test with multiple purchases to ensure consistency
- [ ] Check that ProductHistory is still being created (for audit purposes)
- [ ] Verify stock reports show correct quantities

## Related Files

- `src/lib/stock-history.ts` - Fixed ledger display logic
- `src/lib/stockOperations.ts` - Creates both StockTransaction and ProductHistory (correct behavior)
- `src/app/api/purchases/receipts/[id]/approve/route.ts` - Calls processPurchaseReceipt on approval
- `scripts/check-duplicate-transactions.mjs` - Verification script to detect duplicates

## Conclusion

The bug was NOT in the data creation logic (which correctly maintains audit trails), but in the display logic that inadvertently showed both audit tables together as if they were separate transactions. The fix ensures the ledger displays only the authoritative StockTransaction records while preserving the full audit trail in ProductHistory for compliance and reporting purposes.
