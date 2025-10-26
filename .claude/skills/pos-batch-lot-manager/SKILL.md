---
name: pos-batch-lot-manager
description: Tracks batch/lot numbers with expiry dates for product recalls, FIFO rotation, and compliance.
---

# pos-batch-lot-manager

## Purpose
Tracks batch/lot numbers with expiry dates for product recalls, FIFO rotation, and compliance.

## Implementation
```typescript
interface BatchLot {
  batchNumber: string
  expiryDate: Date
  manufactureDate: Date
  quantity: number
  supplier: string
}

// Track batches in purchases
await prisma.batchLot.create({
  data: {
    variationId, locationId,
    batchNumber: 'LOT-2025-001',
    expiryDate: new Date('2026-12-31'),
    quantityReceived: 100,
    quantityRemaining: 100
  }
})

// Deduct from oldest expiry first (FEFO)
const batches = await prisma.batchLot.findMany({
  where: { variationId, quantityRemaining: { gt: 0 } },
  orderBy: { expiryDate: 'asc' }
})
```

## Best Practices
- **FEFO rotation** (First Expiry, First Out)
- **Expiry alerts** (30/60/90 days)
- **Recall capability** by batch
- **Serial number linking**
