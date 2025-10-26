# ⚠️ CRITICAL SKILL AUDIT: pos-inventory-transaction-logger

## Executive Summary

**STATUS: ❌ SKILL CONTAINS CRITICAL ERRORS**

The `pos-inventory-transaction-logger` skill contains **significant discrepancies** with your actual codebase. If Claude follows this skill, it will generate code with wrong field names that will cause **runtime errors** and **break your application**.

## Critical Field Name Mismatches

### 1. StockTransaction Model

| Skill Says | Actual Schema | Impact |
|------------|---------------|--------|
| `transactionType` | `type` | ❌ Field doesn't exist - would crash |
| `balance` | `balanceQty` | ❌ Field doesn't exist - would crash |
| `variationId` | `productVariationId` | ❌ Field doesn't exist - would crash |
| `userId` | `createdBy` | ❌ Field doesn't exist - would crash |
| `user` (relation) | `createdByUser` | ❌ Relation doesn't exist - would crash |

### 2. VariationLocationDetails Model

| Skill Says | Actual Schema | Impact |
|------------|---------------|--------|
| `currentQty` | `qtyAvailable` | ❌ Field doesn't exist - would crash |
| `variationId_locationId` | `productVariationId_locationId` | ❌ Composite key mismatch - would crash |

## Missing Critical Features

### 1. ProductHistory Dual Logging (CRITICAL)
Your actual implementation creates **TWO** records for every stock transaction:
- `StockTransaction` record
- `ProductHistory` record (for reporting and audit)

**The skill completely omits ProductHistory creation.** This would cause:
- ❌ Missing audit trail
- ❌ Broken inventory reports
- ❌ Data inconsistency

**Actual Code (lines 230-252 in stockOperations.ts):**
```typescript
await tx.productHistory.create({
  data: {
    businessId,
    locationId,
    productId,
    productVariationId,
    transactionType: type,
    transactionDate: transaction.createdAt,
    referenceType: historyReferenceType,
    referenceId: historyReferenceId,
    referenceNumber: historyReferenceNumber,
    quantityChange: quantityDecimal,
    balanceQuantity: newBalanceDecimal,
    unitCost: unitCostDecimal ?? undefined,
    totalValue: unitCostDecimal !== null
      ? unitCostDecimal.mul(quantityDecimal.abs())
      : undefined,
    createdBy: userId,
    createdByName,
    reason: notes || undefined,
  },
})
```

### 2. Stock Validation (Important)
Your code includes post-operation validation:
```typescript
await validateStockConsistency(
  productVariationId,
  locationId,
  tx,
  `After ${type} operation (qty: ${quantity}, ref: ${referenceType}#${referenceId})`
)
```

**The skill doesn't mention this** - Claude might skip this critical safety check.

### 3. Database Locking (Concurrency Control)
Your code uses `FOR UPDATE` to prevent race conditions:
```sql
SELECT id, qty_available
FROM variation_location_details
WHERE product_variation_id = ${productVariationId}
  AND location_id = ${locationId}
FOR UPDATE
```

**The skill doesn't mention this** - Claude might create code vulnerable to race conditions.

### 4. User Display Name Resolution
Your code has sophisticated user name resolution:
```typescript
const createdByName = await resolveUserDisplayName(tx, userId, userDisplayName)
```

**The skill doesn't mention this** - Claude would miss this feature.

## Architecture Differences

### Skill Shows (Simplified):
```typescript
createStockTransaction(params) {
  // Get stock
  // Create transaction
  // Update stock
}
```

### Actual Implementation (Sophisticated):
```typescript
updateStock()
  ↓
executeStockUpdate()
  ↓
├── Lock record (FOR UPDATE)
├── Calculate new balance
├── Update VariationLocationDetails.qtyAvailable
├── Create StockTransaction record
├── Create ProductHistory record  ← MISSING FROM SKILL
├── Validate consistency           ← MISSING FROM SKILL
└── Return result

Plus wrapper functions:
- addStock()
- deductStock()
- transferStockIn() / transferStockOut()
- processSale()
- processPurchaseReceipt()
- processCustomerReturn()
- processSupplierReturn()
```

## Example: What Would Break

### Skill-Based Code (WRONG):
```typescript
// Claude following the skill would write:
await prisma.stockTransaction.create({
  data: {
    variationId: 123,          // ❌ Field doesn't exist
    transactionType: 'sale',   // ❌ Field doesn't exist
    quantity: -10,
    balance: 90,               // ❌ Field doesn't exist
    userId: 5,                 // ❌ Field doesn't exist
    // Missing ProductHistory creation ❌
  }
})

await prisma.variationLocationDetails.update({
  where: {
    variationId_locationId: { // ❌ Wrong composite key
      variationId: 123,        // ❌ Field doesn't exist
      locationId: 1
    }
  },
  data: {
    currentQty: 90             // ❌ Field doesn't exist
  }
})
```

**ERROR:**
```
Unknown argument `variationId`. Did you mean `productVariationId`?
Unknown argument `transactionType`. Did you mean `type`?
Unknown argument `balance`. Did you mean `balanceQty`?
```

### Actual Correct Code:
```typescript
// What your system actually uses:
await updateStock({
  businessId: 1,
  productId: 456,
  productVariationId: 123,    // ✅ Correct field name
  locationId: 1,
  quantity: -10,
  type: StockTransactionType.SALE,  // ✅ Correct field name
  unitCost: 100,
  referenceType: 'sale',
  referenceId: 789,
  userId: 5,
  tx
})
// This creates BOTH StockTransaction AND ProductHistory ✅
// This validates consistency ✅
// This uses FOR UPDATE locking ✅
```

## Why This Happened

The skill appears to be:
1. **Based on an older schema version** - Your system evolved but the skill wasn't updated
2. **Copied from different project** - Field names suggest different database design
3. **Created from documentation** - Not from actual code inspection

## Recommendations

### ⚠️ IMMEDIATE ACTION REQUIRED

1. **DO NOT use this skill as-is** - It will break your application
2. **Update the skill** to match your actual implementation
3. **Add ProductHistory documentation** to the skill
4. **Add validation and locking** to the skill
5. **Test the updated skill** with a simple scenario

### 🔧 Correct Approach

When Claude needs to work with inventory transactions, it should:
- ✅ Use the `updateStock()` function from `/src/lib/stockOperations.ts`
- ✅ Or use the wrapper functions: `addStock()`, `deductStock()`, etc.
- ✅ Never directly create StockTransaction records
- ✅ Never directly update VariationLocationDetails
- ✅ Always use the provided library functions

### 📋 Skill Update Checklist

- [ ] Fix all field names to match schema
- [ ] Add ProductHistory creation documentation
- [ ] Add validateStockConsistency documentation
- [ ] Add FOR UPDATE locking documentation
- [ ] Add userDisplayName parameter
- [ ] Add referenceNumber parameter
- [ ] Update all code examples
- [ ] Reference actual library functions
- [ ] Add link to stockOperations.ts
- [ ] Add link to stockValidation.ts

## Verification

To verify the skill is correct, check:
```typescript
// These field names should appear in the skill:
- productVariationId  (NOT variationId)
- qtyAvailable       (NOT currentQty)
- type               (NOT transactionType)
- balanceQty         (NOT balance)
- createdBy          (NOT userId)
- createdByUser      (NOT user)
```

## Conclusion

**The skill is fundamentally incompatible with your codebase.** Using it would cause Claude to generate broken code.

**RECOMMENDED:** Either:
1. **Delete this skill entirely** and let Claude use the actual code files as reference
2. **Complete rewrite** of the skill based on actual implementation in `stockOperations.ts`

The skill's conceptual approach is correct (immutable transactions, running balance, dual-entry), but the implementation details are completely wrong for your system.

---

**Audit Date:** 2025-10-26
**Audited By:** Claude Code
**Status:** ❌ UNSAFE TO USE
