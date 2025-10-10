# GRN Creation Error Fix - October 9, 2025

## Issue

When attempting to create a GRN (Goods Received Note) from purchase order PO-202510-0001, the API returns 500 error: "Failed to create purchase receipt"

## Root Cause Identified

The `/api/purchases/[id]/receive` endpoint was **missing the required `supplierId` field** when creating a PurchaseReceipt.

### Evidence from Prisma Schema

```prisma
model PurchaseReceipt {
  ...
  // Required when created without PO (direct GRN entry)
  supplierId Int      @map("supplier_id")  // ❌ This field is REQUIRED (not nullable)
  supplier   Supplier @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  ...
}
```

Line 908 in `prisma/schema.prisma` shows `supplierId` is a **required field** (not marked with `?`), but the original code at line 217 of `src/app/api/purchases/[id]/receive/route.ts` was not including it.

## Fix Applied

### File: `src/app/api/purchases/[id]/receive/route.ts`

**Before (lines 213-225):**
```typescript
const newReceipt = await tx.purchaseReceipt.create({
  data: {
    businessId: parseInt(businessId),
    purchaseId: parseInt(purchaseId),
    locationId: purchase.locationId,
    receiptNumber: grnNumber,
    receiptDate: new Date(receiptDate),
    status: 'pending', // Requires approval
    notes,
    receivedBy: parseInt(userId),
    receivedAt: new Date(),
  },
})
```

**After (lines 221-238):**
```typescript
const receiptData = {
  businessId: parseInt(businessId),
  purchaseId: parseInt(purchaseId),
  supplierId: purchase.supplierId,  // ✅ ADDED: Required field
  locationId: purchase.locationId,
  receiptNumber: grnNumber,
  receiptDate: new Date(receiptDate),
  status: 'pending', // Requires approval
  notes,
  receivedBy: parseInt(userId),
  receivedAt: new Date(),
}

console.log('Receipt data to create:', JSON.stringify(receiptData, null, 2))

const newReceipt = await tx.purchaseReceipt.create({
  data: receiptData,
})
```

### Additional Changes:

1. **Added debug logging before transaction** (lines 211-217):
```typescript
console.log('=== Creating GRN ===')
console.log('GRN Number:', grnNumber)
console.log('Purchase ID:', purchaseId, 'Supplier ID:', purchase.supplierId)
console.log('Location ID:', purchase.locationId)
console.log('Business ID:', businessId, 'User ID:', userId)
console.log('Receipt Date:', receiptDate)
console.log('Items count:', items.length)
```

2. **Enhanced error logging** (lines 303-317):
```typescript
} catch (error: any) {
  console.error('=== GRN Creation Error ===')
  console.error('Error type:', error.constructor.name)
  console.error('Error message:', error.message)
  console.error('Full error:', error)
  console.error('Error stack:', error.stack)
  return NextResponse.json(
    {
      error: 'Failed to create purchase receipt',
      details: error.message,
      errorType: error.constructor.name,
    },
    { status: 500 }
  )
}
```

## Testing Instructions

The Next.js dev server needs to recompile the route with the new changes. Please follow these steps:

1. **Navigate to**: http://localhost:3007/dashboard/purchases
2. **Click on**: PO-202510-0001 to view the purchase order details
3. **Click**: "Receive Goods (GRN)" button
4. **Fill in** the receipt form with quantities (10 and 15 as shown in your screenshot)
5. **Submit** the form

### Expected Outcome

The GRN should now be created successfully with:
- GRN Number: `GRN-202510-0001`
- Status: `pending` (requires approval)
- Supplier ID: Correctly populated from purchase order
- All items with their quantities

### Debug Output Expected

You should see in the terminal:
```
=== Creating GRN ===
GRN Number: GRN-202510-0001
Purchase ID: 1 Supplier ID: [supplier_id]
Location ID: [location_id]
Business ID: 1 User ID: 12
Receipt Date: [date]
Items count: 2
Receipt data to create: {
  "businessId": 1,
  "purchaseId": 1,
  "supplierId": [supplier_id],
  "locationId": [location_id],
  "receiptNumber": "GRN-202510-0001",
  ...
}
```

## Related Fix

Also fixed the GRN list endpoint (`src/app/api/purchases/receipts/route.ts`) which had a similar issue with User model field names (using `name` instead of `firstName`, `lastName`, `surname`). This has been fixed and the GRN list page now loads correctly showing "No purchase receipts found" (which is correct since no GRNs exist yet).

## Status

✅ **Fix Applied** - Waiting for user to test GRN creation with the new code.

Once this fix is confirmed working, the user can:
1. Create GRNs from purchase orders (status: pending)
2. View the GRN list
3. Approve GRNs to update inventory (two-step approval process)

## Implementation Notes

The fix ensures that:
- GRNs created from Purchase Orders include the supplier ID from the PO
- GRNs created via direct entry (no PO) include the supplier ID from user input
- Both workflows now correctly populate all required fields per the Prisma schema
