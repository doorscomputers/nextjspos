# Transfer Receive Prisma Schema Fix

## 🐛 Problems Fixed

**Error 1:** 500 Internal Server Error - Unknown field `serialNumbers`
**Error 2:** 500 Internal Server Error - Unknown argument `receiveNotes`
**Error 3:** Field name mismatch - `quantityReceived` vs `receivedQuantity`

---

## 🔍 Root Causes

### Issue 1: Non-existent `serialNumbers` Relation
The receive endpoint (`src/app/api/transfers/[id]/receive/route.ts`) was trying to include a **non-existent relation** called `serialNumbers` on the `StockTransferItem` model.

### Issue 2: Non-existent `receiveNotes` Field
The endpoint was trying to update a field `receiveNotes` that doesn't exist in the `StockTransfer` schema.

### Issue 3: Wrong Field Name
Using `quantityReceived` instead of the correct `receivedQuantity`.

### Incorrect Assumption:
The code assumed serial numbers were stored as a **relation** (junction table).

### Actual Schema:
Serial numbers are stored as **JSON fields** in `StockTransferItem`:
- `serialNumbersSent` - JSON array of serial number IDs sent from origin
- `serialNumbersReceived` - JSON array of serial number IDs verified at destination

```prisma
model StockTransferItem {
  id                    Int           @id @default(autoincrement())
  stockTransferId       Int
  stockTransfer         StockTransfer @relation(...)

  productId             Int
  productVariationId    Int
  quantity              Decimal

  // ✅ Serial numbers stored as JSON (NOT relations)
  serialNumbersSent     Json?  // Scanned at source
  serialNumbersReceived Json?  // Verified at destination

  receivedQuantity      Decimal?
  verified              Boolean   @default(false)
  verifiedBy            Int?
  verifiedAt            DateTime?

  hasDiscrepancy        Boolean   @default(false)
  discrepancyNotes      String?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@map("stock_transfer_items")
}
```

---

## ✅ Fixes Applied

### **File:** `src/app/api/transfers/[id]/receive/route.ts`

### **Fix 1: Initial Transfer Fetch (Lines 59-80)**

**OLD CODE (BROKEN):**
```typescript
const transfer = await prisma.stockTransfer.findFirst({
  where: { id: transferIdNumber, businessId: businessIdNumber, deletedAt: null },
  include: {
    fromLocation: { select: { id: true, name: true } },
    toLocation: { select: { id: true, name: true } },
    items: {
      include: {
        serialNumbers: {  // ❌ This field doesn't exist!
          include: {
            serialNumber: {
              select: {
                id: true,
                serialNumber: true,
                imei: true,
                status: true,
                productId: true,
                productVariationId: true,
              }
            }
          }
        }
      }
    }
  }
})
```

**NEW CODE (FIXED):**
```typescript
const transfer = await prisma.stockTransfer.findFirst({
  where: { id: transferIdNumber, businessId: businessIdNumber, deletedAt: null },
  include: {
    fromLocation: { select: { id: true, name: true } },
    toLocation: { select: { id: true, name: true } },
    items: true  // ✅ Serial numbers stored as JSON in serialNumbersSent/serialNumbersReceived
  }
})
```

---

### **Fix 2: Serial Number Validation (Lines 198-250)**

**OLD CODE (BROKEN):**
```typescript
if (transferItem.serialNumbers && transferItem.serialNumbers.length > 0) {
  // Verify all serial numbers are part of this transfer
  for (const snId of receivedItem.serialNumberIds) {
    const snInTransfer = transferItem.serialNumbers.find(
      (ts) => ts.serialNumberId === Number(snId)  // ❌ Wrong structure
    )
    // ... validation
  }
}
```

**NEW CODE (FIXED):**
```typescript
// Parse JSON field to get serial number IDs
const serialNumbersSent = transferItem.serialNumbersSent
  ? (Array.isArray(transferItem.serialNumbersSent)
      ? transferItem.serialNumbersSent
      : JSON.parse(transferItem.serialNumbersSent as string))
  : []

if (serialNumbersSent.length > 0) {
  // Verify all serial numbers are part of this transfer
  for (const snId of receivedItem.serialNumberIds) {
    const snIdNumber = Number(snId)
    const snInTransfer = serialNumbersSent.find(
      (id: number) => id === snIdNumber  // ✅ Correct - comparing IDs directly
    )
    // ... validation
  }
}
```

---

### **Fix 3: Update Transfer Status - Field Name Corrections (Lines 257-266)**

**OLD CODE (BROKEN):**
```typescript
await tx.stockTransfer.update({
  where: { id: transferIdNumber },
  data: {
    status: 'received',
    stockDeducted: true,
    receivedBy: userIdNumber,
    receivedAt: receivedDate ? new Date(receivedDate) : new Date(),
    receiveNotes: notes,  // ❌ Field doesn't exist!
  },
})
```

**NEW CODE (FIXED):**
```typescript
await tx.stockTransfer.update({
  where: { id: transferIdNumber },
  data: {
    status: 'received',
    stockDeducted: true,
    receivedBy: userIdNumber,
    receivedAt: receivedDate ? new Date(receivedDate) : new Date(),
    verifierNotes: notes,  // ✅ Use existing verifierNotes field
  },
})
```

---

### **Fix 4: Update Transfer Item - Field Name Correction (Lines 283-288)**

**OLD CODE (BROKEN):**
```typescript
await tx.stockTransferItem.update({
  where: { id: transferItem.id },
  data: {
    quantityReceived,  // ❌ Wrong field name!
  },
})
```

**NEW CODE (FIXED):**
```typescript
await tx.stockTransferItem.update({
  where: { id: transferItem.id },
  data: {
    receivedQuantity: quantityReceived,  // ✅ Correct field name
  },
})
```

---

### **Fix 5: Final Transfer Fetch (Lines 380-387)**

**OLD CODE (BROKEN):**
```typescript
const updatedTransfer = await prisma.stockTransfer.findUnique({
  where: { id: transfer.id },
  include: {
    fromLocation: true,
    toLocation: true,
    items: {
      include: {
        serialNumbers: {  // ❌ This field doesn't exist!
          include: {
            serialNumber: {
              select: {
                id: true,
                serialNumber: true,
                imei: true,
                status: true,
                currentLocationId: true,
              }
            }
          }
        }
      }
    }
  }
})
```

**NEW CODE (FIXED):**
```typescript
const updatedTransfer = await prisma.stockTransfer.findUnique({
  where: { id: transfer.id },
  include: {
    fromLocation: true,
    toLocation: true,
    items: true  // ✅ Serial numbers stored as JSON in serialNumbersSent/serialNumbersReceived
  }
})
```

---

## 🎯 What Changed

### Summary of All Fixes:
1. ✅ **Fix 1:** Removed incorrect `serialNumbers` relation include statement in initial fetch
2. ✅ **Fix 2:** Updated serial number validation to parse JSON fields (`serialNumbersSent`)
3. ✅ **Fix 3:** Changed `receiveNotes` to `verifierNotes` (correct field name)
4. ✅ **Fix 4:** Changed `quantityReceived` to `receivedQuantity` (correct field name)
5. ✅ **Fix 5:** Removed incorrect `serialNumbers` relation include in final fetch

### No Breaking Changes:
- Transfer workflow still works the same
- Serial number tracking still works (just reads from JSON instead of relation)
- All validation rules preserved
- Audit logging unchanged
- Notes are stored in `verifierNotes` instead of non-existent `receiveNotes`

---

## 🧪 Testing

### **Test Steps:**

1. **Login as store_manager**
   - User at Main Store location
   - Has `stock_transfer.receive` permission

2. **View Transfer TR-202510-0001**
   - Status should be "Arrived"
   - Should see "Receive Transfer" button

3. **Click "Receive Transfer"**
   - Confirmation dialog appears
   - Click "OK"

4. **Expected Result:**
   - ✅ Success message: "Transfer received - stock added to destination location"
   - ✅ Transfer status changes to "Received"
   - ✅ Stock added to Main Store inventory
   - ✅ ProductHistory shows TRANSFER_IN entry
   - ✅ Inventory Ledger shows correct quantities
   - ✅ No variance or discrepancy

---

## 🔧 Technical Notes

### Why JSON Instead of Relations?

**Advantages of JSON storage:**
- ✅ Simpler schema (no junction table needed)
- ✅ Faster queries (no joins required)
- ✅ Easier to track "sent vs received" separately
- ✅ Supports partial receives (some items accepted, some rejected)

**When it works:**
- ✅ Serial numbers are simple ID references
- ✅ Don't need complex queries on serial numbers within transfers
- ✅ Transfer items are self-contained

**Trade-off:**
- ❌ Can't use Prisma relations for serial numbers on transfer items
- ❌ Need to parse JSON when validating
- ✅ But serial number movements are tracked in `SerialNumberMovement` table anyway

---

## 📊 Related Models

### ProductSerialNumber
Tracks individual serial numbers with status:
- `in_stock` - Available at a location
- `in_transit` - Being transferred
- `sold` - Sold to customer
- `damaged` - Damaged/defective

### SerialNumberMovement
Tracks all serial number movements:
- `transfer_out` - Sent from origin location
- `transfer_in` - Received at destination location
- `sale` - Sold to customer
- `purchase` - Received from supplier
- `return` - Returned from customer/to supplier

---

## ✅ Verification

After fix applied, verify:
- [ ] No Prisma validation errors
- [ ] Transfer receives successfully
- [ ] Stock added to Main Store
- [ ] ProductHistory entries created correctly
- [ ] Inventory Ledger shows no variance
- [ ] Audit log records the receive action

---

**Fixed:** 2025-10-19
**Issue:** Prisma schema mismatch - incorrect relation include
**Solution:** Changed to use JSON fields for serial numbers
**Status:** ✅ COMPLETE - Ready for Testing
