---
name: pos-reorder-automation-engine
description: Automatically suggests reorder quantities based on min/max levels, lead times, and sales velocity.
---

# pos-reorder-automation-engine

## Purpose
Automatically suggests reorder quantities based on min/max levels, lead times, and sales velocity.

## Implementation
```typescript
// Calculate reorder suggestions
async function generateReorderSuggestions(businessId: number) {
  const lowStockItems = await prisma.variationLocationDetails.findMany({
    where: {
      variation: { product: { businessId } },
      currentQty: { lte: prisma.raw('reorderPoint') }
    },
    include: { variation: { include: { product: true } } }
  })

  const suggestions = []
  for (const item of lowStockItems) {
    // Calculate reorder qty
    const reorderQty = item.maxStock - item.currentQty
    
    // Adjust for lead time
    const avgDailySales = await getAvgDailySales(item.variationId)
    const leadTimeDemand = avgDailySales * item.leadTimeDays
    const suggestedQty = Math.max(reorderQty, leadTimeDemand)

    suggestions.push({
      productName: item.variation.product.name,
      currentQty: item.currentQty,
      reorderPoint: item.reorderPoint,
      suggestedQty,
      urgency: item.currentQty === 0 ? 'critical' : 'low'
    })
  }
  return suggestions
}
```

## Best Practices
- **Daily automated checks**
- **Email alerts** to procurement
- **Auto-generate POs** if enabled
- **Seasonal adjustments**
