# CRITICAL FIX: Serial Number Movement Linking

## Issue Description
Serial number movement records are created with `serialNumberId: 0` (hardcoded), which means the movement history is not linked to the actual serial number records. This breaks the ability to track serial number movements for warranty, returns, and audits.

## File to Edit
`src/app/api/purchases/[id]/receive/route.ts`

## Location
Lines 309-341

---

## Current Code (BROKEN)

```typescript
// Create serial number records if provided
if (purchaseItem.requiresSerial && item.serialNumbers) {
  for (const sn of item.serialNumbers) {
    await tx.productSerialNumber.create({
      data: {
        businessId: parseInt(businessId),
        productId: purchaseItem.productId,
        productVariationId: purchaseItem.productVariationId,
        serialNumber: sn.serialNumber,
        imei: sn.imei || null,
        status: 'in_stock',
        condition: (sn.condition as SerialNumberCondition) || SerialNumberCondition.NEW,
        currentLocationId: purchase.locationId,
        purchaseId: parseInt(purchaseId),
        purchaseReceiptId: newReceipt.id,
        purchasedAt: new Date(receiptDate),
        purchaseCost: parseFloat(purchaseItem.unitCost.toString()),
      },
    })

    // ❌ BUG: serialNumberId is hardcoded to 0
    // This comment says "Will be filled by trigger or updated" but no such trigger exists
    await tx.serialNumberMovement.create({
      data: {
        serialNumberId: 0, // ❌ BROKEN: No trigger exists to update this
        movementType: 'purchase',
        toLocationId: purchase.locationId,
        referenceType: 'purchase',
        referenceId: newReceipt.id,
        movedBy: parseInt(userId),
        notes: `Received via ${grnNumber}`,
      },
    })
  }
}
```

---

## Fixed Code (CORRECT)

```typescript
// Create serial number records if provided
if (purchaseItem.requiresSerial && item.serialNumbers) {
  for (const sn of item.serialNumbers) {
    // ✅ FIX: Capture the created serial number record
    const createdSerial = await tx.productSerialNumber.create({
      data: {
        businessId: parseInt(businessId),
        productId: purchaseItem.productId,
        productVariationId: purchaseItem.productVariationId,
        serialNumber: sn.serialNumber,
        imei: sn.imei || null,
        status: 'in_stock',
        condition: (sn.condition as SerialNumberCondition) || SerialNumberCondition.NEW,
        currentLocationId: purchase.locationId,
        purchaseId: parseInt(purchaseId),
        purchaseReceiptId: newReceipt.id,
        purchasedAt: new Date(receiptDate),
        purchaseCost: parseFloat(purchaseItem.unitCost.toString()),
      },
    })

    // ✅ FIX: Use the actual serial number ID from the created record
    await tx.serialNumberMovement.create({
      data: {
        serialNumberId: createdSerial.id, // ✅ CORRECT: Use actual ID
        movementType: 'purchase',
        toLocationId: purchase.locationId,
        referenceType: 'purchase',
        referenceId: newReceipt.id,
        movedBy: parseInt(userId),
        notes: `Received via ${grnNumber}`,
      },
    })
  }
}
```

---

## Step-by-Step Fix Instructions

1. **Open the file:**
   ```
   src/app/api/purchases/[id]/receive/route.ts
   ```

2. **Find the problematic code** (around line 309):
   - Look for the comment: `// Create serial number records if provided`
   - Inside the `for (const sn of item.serialNumbers)` loop

3. **Change line 309-326:**
   - Find: `await tx.productSerialNumber.create({`
   - Change to: `const createdSerial = await tx.productSerialNumber.create({`
   - This captures the created record in a variable

4. **Change line 332:**
   - Find: `serialNumberId: 0, // Will be filled by trigger or updated`
   - Change to: `serialNumberId: createdSerial.id, // Use actual ID from created record`

5. **Remove the misleading comment:**
   - Delete the comment about "trigger or updated" as no trigger exists

6. **Save the file**

---

## Verification Steps

### 1. After Applying Fix, Run These Tests:

#### Test 1: Create PO and Receive with Serial Numbers
```bash
# Via Postman or curl:
POST http://localhost:3008/api/purchases
{
  "locationId": 1,
  "supplierId": 1,
  "purchaseDate": "2025-01-06",
  "items": [
    {
      "productId": <serialized_product_id>,
      "productVariationId": <variation_id>,
      "quantity": 3,
      "unitCost": 500.00,
      "requiresSerial": true
    }
  ]
}

# Then receive:
POST http://localhost:3008/api/purchases/<purchase_id>/receive
{
  "receiptDate": "2025-01-06",
  "items": [
    {
      "purchaseItemId": <purchase_item_id>,
      "quantityReceived": 3,
      "serialNumbers": [
        { "serialNumber": "SN-TEST-001", "imei": "IMEI001", "condition": "new" },
        { "serialNumber": "SN-TEST-002", "imei": "IMEI002", "condition": "new" },
        { "serialNumber": "SN-TEST-003", "imei": "IMEI003", "condition": "new" }
      ]
    }
  ]
}
```

### 2. Verify in Database:

```sql
-- Check serial numbers were created
SELECT id, serial_number, status, current_location_id
FROM product_serial_numbers
WHERE purchase_id = <purchase_id>;
-- Should return 3 records with valid IDs

-- Check movements are linked correctly (THIS IS THE FIX)
SELECT
  snm.id,
  snm.serial_number_id, -- ✅ Should be > 0, not 0
  sn.serial_number,
  snm.movement_type,
  snm.to_location_id,
  snm.moved_at
FROM serial_number_movements snm
JOIN product_serial_numbers sn ON snm.serial_number_id = sn.id
WHERE snm.reference_type = 'purchase'
  AND snm.reference_id = <receipt_id>;
-- Should return 3 records with valid serial_number_id (NOT 0)
```

### 3. Expected Results AFTER Fix:

**BEFORE Fix:**
```
serial_number_movements table:
id | serial_number_id | movement_type | serial_number
1  | 0                | purchase      | (cannot join, ID is 0)
2  | 0                | purchase      | (cannot join, ID is 0)
3  | 0                | purchase      | (cannot join, ID is 0)
```

**AFTER Fix:**
```
serial_number_movements table:
id | serial_number_id | movement_type | serial_number
1  | 45               | purchase      | SN-TEST-001
2  | 46               | purchase      | SN-TEST-002
3  | 47               | purchase      | SN-TEST-003
```

---

## Why This Bug Matters

### Impact of Bug:
1. **Warranty Tracking:** Cannot trace which serial number was purchased when
2. **Return Processing:** Cannot verify serial number movement history
3. **Audit Compliance:** Movement history incomplete
4. **Inventory Audits:** Cannot prove serial number chain of custody
5. **Theft Prevention:** No way to track if serial number moved correctly

### What Works After Fix:
1. ✅ Complete movement history for each serial number
2. ✅ Can query all movements for a specific serial number
3. ✅ Can verify serial number was received via correct PO/GRN
4. ✅ Can trace serial number from purchase → sale → return
5. ✅ Audit trail is complete and accurate

---

## Testing Checklist

After applying fix, verify:

- [ ] Application compiles without errors
- [ ] Can create PO with serialized products
- [ ] Can receive serialized products with serial numbers
- [ ] Serial number records are created (check product_serial_numbers table)
- [ ] Movement records are created with correct serialNumberId (check serial_number_movements table)
- [ ] Can join serial_number_movements to product_serial_numbers successfully
- [ ] No errors in application logs
- [ ] Audit logs are created correctly

---

## Additional Recommendations

### 1. Add Database Constraint (Optional but Recommended)
Prevent future bugs by adding a NOT NULL constraint:

```sql
-- Add constraint to prevent serialNumberId = 0
ALTER TABLE serial_number_movements
ADD CONSTRAINT check_valid_serial_number_id
CHECK (serial_number_id > 0);
```

### 2. Add Unit Test (Recommended)
Create a test to ensure movement records are linked:

```typescript
test('GRN with serial numbers creates linked movement records', async () => {
  // Create PO and GRN with serial numbers
  // ...

  const movements = await prisma.serialNumberMovement.findMany({
    where: { referenceType: 'purchase', referenceId: grnId },
    include: { serialNumber: true }
  })

  // Verify each movement is linked to a serial number
  for (const movement of movements) {
    expect(movement.serialNumberId).toBeGreaterThan(0)
    expect(movement.serialNumber).toBeTruthy()
    expect(movement.serialNumber.serialNumber).toBeTruthy()
  }
})
```

### 3. Migrate Existing Data (If Any)
If this system is already in production with broken movement records:

```sql
-- WARNING: Only run this if you have existing data with serialNumberId = 0
-- This attempts to fix historical records by matching on receipt and timestamp

UPDATE serial_number_movements snm
SET serial_number_id = (
  SELECT sn.id
  FROM product_serial_numbers sn
  WHERE sn.purchase_receipt_id = snm.reference_id
    AND sn.purchased_at >= DATE_SUB(snm.moved_at, INTERVAL 1 MINUTE)
    AND sn.purchased_at <= DATE_ADD(snm.moved_at, INTERVAL 1 MINUTE)
  LIMIT 1
)
WHERE snm.serial_number_id = 0
  AND snm.movement_type = 'purchase';

-- Verify the fix worked
SELECT COUNT(*) FROM serial_number_movements WHERE serial_number_id = 0;
-- Should return 0
```

---

## Summary

**What to do:**
1. Open `src/app/api/purchases/[id]/receive/route.ts`
2. Change line 309: Add `const createdSerial =` before `await tx.productSerialNumber.create(`
3. Change line 332: Replace `serialNumberId: 0` with `serialNumberId: createdSerial.id`
4. Save file
5. Restart server
6. Test with actual serial numbers
7. Verify in database that movement records are linked

**Expected outcome:**
- Serial number movement records will have valid `serialNumberId` values
- Complete audit trail for all serial number movements
- Can trace any serial number from purchase through its entire lifecycle

**This fix is CRITICAL for:**
- Warranty tracking
- Return processing
- Audit compliance
- Inventory control
- Customer service

---

**DO NOT DEPLOY TO PRODUCTION without this fix applied and tested.**
