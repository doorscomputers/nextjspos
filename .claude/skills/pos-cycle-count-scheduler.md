# pos-cycle-count-scheduler

## Purpose
Automates cycle counting schedules (ABC analysis) for continuous inventory accuracy.

## Implementation
```typescript
// ABC Classification
interface ABCClassification {
  category: 'A' | 'B' | 'C'
  countFrequency: number  // Days
  products: Product[]
}

async function classifyABC(businessId: number) {
  // Get products with sales value
  const products = await prisma.product.findMany({
    where: { businessId },
    include: { sales: true }
  })
  
  // Sort by annual sales value
  products.sort((a, b) => b.annualValue - a.annualValue)
  
  // A items: Top 20% (80% of value) - Count monthly
  // B items: Next 30% (15% of value) - Count quarterly
  // C items: Last 50% (5% of value) - Count annually
  
  return {
    A: { products: products.slice(0, products.length * 0.2), frequency: 30 },
    B: { products: products.slice(products.length * 0.2, products.length * 0.5), frequency: 90 },
    C: { products: products.slice(products.length * 0.5), frequency: 365 }
  }
}

// Schedule cycle counts
async function scheduleCycleCounts() {
  const classification = await classifyABC(businessId)
  
  for (const [category, data] of Object.entries(classification)) {
    for (const product of data.products) {
      await prisma.cycleCountSchedule.create({
        data: {
          productId: product.id,
          category,
          nextCountDate: addDays(new Date(), data.frequency),
          frequency: data.frequency
        }
      })
    }
  }
}
```
