---
name: pos-stock-adjustment-controller
description: Handles ad-hoc stock adjustments for write-offs, donations, samples, breakage, and other non-transac
---

# pos-stock-adjustment-controller

## Purpose
Handles ad-hoc stock adjustments for write-offs, donations, samples, breakage, and other non-transactional changes.

## When to Use
- Writing off damaged goods
- Recording breakage/spillage
- Processing donations
- Handling product samples
- Correcting data entry errors

## Critical Requirements
```typescript
enum AdjustmentReason {
  damaged, expired, stolen, donated, sample,
  breakage, write_off, data_correction
}

// Requires approval for large adjustments
const requiresApproval = Math.abs(adjustmentQty) > threshold
```

## Implementation
```typescript
// Create adjustment
await updateStock({
  businessId, variationId, locationId,
  quantity: adjustmentQty,  // Can be positive or negative
  transactionType: 'adjustment',
  unitCost: 0,  // No cost impact for adjustments
  userId,
  notes: `${reason}: ${notes}`,
  allowNegative: true
}, tx)

// If write-off, track inventory value loss
const valueLoss = Math.abs(adjustmentQty) * unitCost
await createAuditLog({
  action: 'STOCK_ADJUSTMENT',
  metadata: { reason, valueLoss, approvedBy }
})
```

## Best Practices
- **Require approval** for high-value adjustments
- **Track adjustment reasons**
- **Monitor adjustment patterns** (fraud detection)
- **Limit user permissions** for adjustments
- **Create GL entries** for write-offs

## Related Skills
- pos-stock-operation-enforcer
- pos-audit-trail-architect
- pos-financial-impact-analyzer
