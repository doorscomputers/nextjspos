# pos-supplier-performance-tracker

## Purpose
Tracks supplier performance metrics (lead time, quality, pricing) for vendor evaluation.

## Implementation
```typescript
async function getSupplierPerformance(supplierId: number) {
  // Lead time analysis
  const avgLeadTime = await prisma.purchase.aggregate({
    where: { supplierId },
    _avg: { leadTimeDays: true }
  })

  // Quality metrics
  const qcInspections = await prisma.qualityControlInspection.findMany({
    where: {
      receipt: { supplierId }
    }
  })
  
  const passRate = qcInspections.filter(i => i.status === 'passed').length / qcInspections.length

  // Pricing trend
  const priceHistory = await getPriceHistory(supplierId)

  return {
    avgLeadTime: avgLeadTime._avg.leadTimeDays,
    qualityPassRate: passRate * 100,
    priceTrend: priceHistory,
    rating: calculateRating(passRate, avgLeadTime)
  }
}
```
