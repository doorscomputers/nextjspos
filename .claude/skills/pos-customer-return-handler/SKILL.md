---
name: pos-customer-return-handler
description: Processes customer returns with condition tracking (resellable/damaged), refunds, or replacements, a
---

# pos-customer-return-handler

## Purpose
Processes customer returns with condition tracking (resellable/damaged), refunds, or replacements, and stock adjustments.

## When to Use
- Processing customer returns
- Issuing refunds or replacements
- Tracking return reasons
- Handling damaged returns
- Restocking resellable items

## Critical Requirements
```typescript
enum ReturnCondition { resellable, damaged, defective }
enum ReturnType { refund, replacement }

// Workflow
1. Create return (link to original sale)
2. Inspect condition
3. If resellable → add stock back
4. If damaged → don't restock, write off
5. Process refund/replacement
6. Update sale record
```

## Implementation
```typescript
// Resellable: Add back to stock
if (condition === 'resellable') {
  await updateStock({
    quantity: returnQty,  // POSITIVE
    transactionType: 'customer_return',
    referenceType: 'CustomerReturn'
  }, tx)
}

// Update sale profit (reduce by return value)
await prisma.sale.update({
  where: { id: saleId },
  data: {
    totalAmount: { decrement: refundAmount },
    grossProfit: { decrement: returnProfit }
  }
})
```

## Best Practices
- **Link to original sale** for traceability
- **Verify return window** (e.g., 30 days)
- **Inspect condition** before restocking
- **Track return patterns** by customer
- **Update customer balance** if credit

## Related Skills
- pos-stock-operation-enforcer
- pos-audit-trail-architect
