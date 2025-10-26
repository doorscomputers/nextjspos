---
name: pos-purchase-return-processor
description: Processes supplier returns (debit notes) for damaged, wrong, or defective items with stock reversal 
---

# pos-purchase-return-processor

## Purpose
Processes supplier returns (debit notes) for damaged, wrong, or defective items with stock reversal and accounts payable adjustments.

## When to Use
- Returning defective items to supplier
- Processing damaged goods from QC
- Handling incorrect deliveries
- Creating debit notes
- Adjusting accounts payable

## Critical Requirements

### Return Reasons
```typescript
enum ReturnReason {
  damaged, wrong_item, quality_issue, overcharge,
  expired, defective, not_as_ordered
}
```

### Workflow
1. Create return request (status: pending)
2. Deduct stock from location
3. Generate debit note
4. Update accounts payable
5. Approve return (status: approved/completed)

## Implementation
```typescript
// Deduct stock when return approved
await updateStock({
  businessId, variationId, locationId,
  quantity: -returnQty,  // NEGATIVE
  transactionType: 'supplier_return',
  unitCost: originalPurchaseCost,
  userId,
  referenceType: 'PurchaseReturn',
  referenceId: returnId.toString()
}, tx)

// Create audit log with debit note details
await createAuditLog({
  action: 'PURCHASE_RETURN_APPROVE',
  entityType: 'PURCHASE_RETURN',
  metadata: {
    supplierId, returnReason, debitNoteNumber,
    returnValue: returnQty * unitCost
  }
})
```

## Best Practices
- **Link to original GRN** for traceability
- **Verify stock available** before return
- **Update AP balance** correctly
- **Generate debit note** automatically
- **Track return rates** by supplier

## Related Skills
- pos-purchase-receipt-manager
- pos-stock-operation-enforcer
- pos-audit-trail-architect
