---
name: pos-duplicate-prevention-system
description: Prevents duplicate records (SKUs, barcodes, serial numbers) with unique constraints and validation.
---

# pos-duplicate-prevention-system

## Purpose
Prevents duplicate records (SKUs, barcodes, serial numbers) with unique constraints and validation.

## Implementation
```typescript
// Database unique constraints
@@unique([businessId, sku])
@@unique([businessId, barcode])
@@unique([serialNumber])

// API validation
async function checkDuplicates(data: any, businessId: number) {
  const duplicates = []
  
  // Check SKU
  if (data.sku) {
    const existing = await prisma.productVariation.findFirst({
      where: {
        sku: data.sku,
        product: { businessId }
      }
    })
    if (existing) {
      duplicates.push({ field: 'sku', value: data.sku, existingId: existing.id })
    }
  }
  
  // Check barcode
  if (data.barcode) {
    const existing = await prisma.productVariation.findFirst({
      where: {
        barcode: data.barcode,
        product: { businessId }
      }
    })
    if (existing) {
      duplicates.push({ field: 'barcode', value: data.barcode, existingId: existing.id })
    }
  }
  
  return { hasDuplicates: duplicates.length > 0, duplicates }
}
```

## Best Practices
- Check before save
- Show existing record details
- Offer merge/update options
- Log duplicate attempts (fraud detection)
