---
name: pos-serial-number-tracker
description: Tracks individual serial numbers (IMEI, MAC, etc.) for high-value items with complete movement histo
---

# pos-serial-number-tracker

## Purpose
Tracks individual serial numbers (IMEI, MAC, etc.) for high-value items with complete movement history.

## Implementation
```typescript
// Record serial on purchase
await prisma.productSerialNumber.create({
  data: {
    variationId, serialNumber: 'IMEI123456',
    status: 'in_stock', locationId,
    purchaseReceiptItemId: itemId
  }
})

// Update on sale
await prisma.productSerialNumber.update({
  where: { serialNumber: 'IMEI123456' },
  data: {
    status: 'sold', soldAt: new Date(),
    saleItemId: saleItemId
  }
})

// Track movements
await prisma.serialNumberMovement.create({
  data: {
    serialNumberId, fromLocationId, toLocationId,
    movementType: 'transfer', movedBy: userId
  }
})
```

## Best Practices
- **Barcode scanning** for accuracy
- **Warranty tracking** by serial
- **Return verification** by serial
- **Theft/loss reporting**
