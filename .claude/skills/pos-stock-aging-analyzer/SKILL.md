---
name: pos-stock-aging-analyzer
description: Analyzes inventory age to identify slow-moving, fast-moving, and dead stock for optimization.
---

# pos-stock-aging-analyzer

## Purpose
Analyzes inventory age to identify slow-moving, fast-moving, and dead stock for optimization.

## Implementation
```typescript
async function analyzeStockAging(businessId: number) {
  const items = await prisma.variationLocationDetails.findMany({
    where: { variation: { product: { businessId } } },
    include: {
      variation: {
        include: {
          product: true,
          stockTransactions: {
            where: { transactionType: 'opening_stock' },
            orderBy: { createdAt: 'asc' },
            take: 1
          }
        }
      }
    }
  })

  return items.map(item => {
    const firstTransaction = item.variation.stockTransactions[0]
    const daysInStock = differenceInDays(new Date(), firstTransaction?.createdAt)
    
    return {
      productName: item.variation.product.name,
      currentQty: item.currentQty,
      daysInStock,
      category: daysInStock > 365 ? 'dead' :
                daysInStock > 180 ? 'slow' :
                daysInStock > 90 ? 'normal' : 'fast',
      recommendedAction: daysInStock > 365 ? 'Clearance sale' :
                         daysInStock > 180 ? 'Promotion' : 'Monitor'
    }
  })
}
```
