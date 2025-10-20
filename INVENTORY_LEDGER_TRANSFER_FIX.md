# Inventory Ledger Transfer Fix - Complete

## 🐛 Problem Identified

**Issue:** Inventory Ledger showed discrepancy for products that had transfers in `in_transit` status.

**Example:**
- Calculated Balance: 10.00
- System Inventory: 8.00
- **Variance: 2.00** ❌

**Root Cause:**
The Inventory Ledger report was only querying transfers with `status: 'completed'`, but stock is **deducted when SENT** (status becomes `in_transit`), NOT when completed.

---

## 🔍 Technical Analysis

### Transfer Stock Deduction Flow

```
Stage 1: CREATE     → status: draft           → Stock: NO change
Stage 2: CHECK      → status: checked         → Stock: NO change
Stage 3: SEND       → status: in_transit      → Stock: DEDUCTED ✅
Stage 4: RECEIVE    → status: received        → Stock: ADDED at destination
```

**Key Point:** Stock is deducted at **SEND** (in_transit), not at **RECEIVE** (completed).

### ProductHistory is Correct ✅

The `transferStockOut()` function correctly creates `ProductHistory` entries with:
- `transactionType: 'transfer_out'`
- `quantityChange: -2` (negative for deduction)
- `balanceQuantity: 8` (correct balance)
- `transactionDate: sentAt` timestamp

**Verified:** ProductHistory table has correct entries.

### Inventory Ledger Query Was Wrong ❌

**OLD CODE:**
```typescript
// c) Stock Transferred Out
prisma.stockTransfer.findMany({
  where: {
    businessId,
    fromLocationId: locId,
    status: 'completed',  // ❌ WRONG: Only shows completed transfers
    completedAt: {        // ❌ WRONG: Uses completedAt instead of sentAt
      gte: startDate,
      lte: endDate
    }
  }
})
```

**Problem:** Transfers in `in_transit` status (stock already deducted) were excluded!

---

## ✅ Fix Applied

**File:** `src/app/api/reports/inventory-ledger/route.ts`

### Change 1: Query Transfers with in_transit Status

**Lines 464-497:**
```typescript
// c) Stock Transferred Out
// NOTE: Include both 'in_transit' and 'completed' because stock is deducted at SEND (in_transit), not at completion
prisma.stockTransfer.findMany({
  where: {
    businessId,
    fromLocationId: locId,
    status: {
      in: ['in_transit', 'received', 'completed']  // ✅ Include in_transit
    },
    stockDeducted: true, // ✅ Only transfers where stock was actually deducted
    sentAt: {            // ✅ Use sentAt instead of completedAt
      gte: startDate,
      lte: endDate
    }
  },
  orderBy: { sentAt: 'asc' }  // ✅ Sort by sentAt
})
```

### Change 2: Use sentAt in Transaction Processing

**Lines 674-691:**
```typescript
for (const transfer of transfersOut) {
  transactions.push({
    date: transfer.sentAt || transfer.createdAt,  // ✅ Use sentAt
    type: 'Transfer Out',
    description: `Transfer Out to ${transfer.toLocation?.name || 'Unknown'} - TR #${transfer.transferNumber}${transfer.status === 'in_transit' ? ' (In Transit)' : ''}`,  // ✅ Show status
    quantityOut: parseFloat(item.quantity.toString()),
    // ...
  })
}
```

### Change 3: Fix "Before Start Date" Calculation

**Lines 215-241:**
```typescript
// Transfers Out before start date
prisma.stockTransfer.findMany({
  where: {
    businessId,
    fromLocationId: locId,
    status: {
      in: ['in_transit', 'received', 'completed']  // ✅ Include in_transit
    },
    stockDeducted: true,  // ✅ Only deducted transfers
    sentAt: { lt: startDate }  // ✅ Use sentAt
  }
})
```

---

## 🧪 Testing

### Test Scenario:
1. Create transfer from Main Warehouse → Main Store (2 units)
2. Send transfer (status becomes `in_transit`)
3. Check Inventory Ledger for Main Warehouse

### Expected Result: ✅
- **Total Stock In:** 10.00
- **Total Stock Out:** 2.00 ← **Now shows transfer out!**
- **Net Change:** 8.00
- **Calculated Balance:** 8.00
- **System Inventory:** 8.00
- **Variance:** 0.00 ✅ **No discrepancy!**

### Ledger Should Show:
```
DATE         TYPE              REFERENCE      QTY IN  QTY OUT  BALANCE
----------------------------------------------------------------------
10/18/2025   Opening Stock     CSV-IMPORT     1.00    -        1.00
10/19/2025   Stock Received    GRN-202510     9.00    -        10.00
10/19/2025   Transfer Out      TR-202510-0001 -       2.00     8.00  ← NEW!
             (In Transit)
```

---

## 📊 Impact

### What Was Fixed:
1. ✅ Transfer Out transactions now appear in ledger immediately when sent
2. ✅ No more variance/discrepancy for in-transit transfers
3. ✅ Ledger reconciliation now matches system inventory
4. ✅ Shows "(In Transit)" label for transfers not yet received

### What's Working Correctly:
- ✅ ProductHistory table (was always correct)
- ✅ Stock deduction at SEND (was always correct)
- ✅ System inventory balances (were always correct)
- ❌ **Inventory Ledger report** (NOW FIXED!)

---

## 🎯 Key Takeaways

1. **Stock deduction happens at SEND, not RECEIVE**
   - When transfer is sent → status = `in_transit` + stock deducted
   - When transfer is received → status = `completed` + stock added at destination

2. **Ledger should use sentAt, not completedAt**
   - `sentAt`: When stock left the origin location
   - `completedAt`: When stock arrived at destination
   - Ledger for origin location cares about `sentAt`

3. **Include in_transit transfers in queries**
   - Transfers can be `in_transit` for days/weeks
   - Stock is already gone from origin
   - Ledger must show these transactions

4. **Use stockDeducted flag**
   - Prevents showing draft/checked transfers (no stock movement yet)
   - Only shows transfers where stock was actually deducted

---

## 🔄 Related Files

- ✅ Fixed: `src/app/api/reports/inventory-ledger/route.ts`
- ✅ Correct: `src/lib/stockOperations.ts` (transferStockOut)
- ✅ Correct: `src/app/api/transfers/[id]/send/route.ts`
- ✅ Correct: ProductHistory table entries

---

## 📝 Notes for Future

- The `inventory-ledger-new` route may need the same fix if it's being used
- Consider adding automated tests for transfer ledger entries
- Document that ledger shows transactions based on when stock moved, not when paperwork completed

---

**Fixed:** 2025-10-19
**Issue:** Transfer OUT not appearing in Inventory Ledger for in_transit transfers
**Solution:** Include in_transit status and use sentAt instead of completedAt
**Status:** ✅ RESOLVED
