---
name: pos-cost-basis-tracker
description: Tracks cost basis for each inventory transaction, enabling accurate COGS (Cost of Goods Sold) calcul
---

# pos-cost-basis-tracker

## Purpose
Tracks cost basis for each inventory transaction, enabling accurate COGS (Cost of Goods Sold) calculations, profitability analysis, and margin reporting.

## When to Use
- Calculating COGS for sales
- Profit margin analysis
- Pricing decisions
- Financial statement preparation
- Product profitability reports

## Critical Requirements

### 1. Cost Basis Storage
```typescript
// Stored in StockTransaction.unitCost
interface CostBasis {
  transactionId: number
  transactionType: string
  quantity: number
  unitCost: number          // Cost at time of transaction
  totalCost: number         // quantity * unitCost
  transactionDate: Date
}
```

### 2. COGS Calculation Methods
```typescript
// Based on business valuation method (FIFO/LIFO/WAC)
async function calculateCOGS(
  saleItems: SaleItem[],
  businessId: number,
  method: ValuationMethod
): Promise<COGSResult> {
  // Returns: totalCOGS, perItemCOGS, grossProfit
}
```

## Implementation Pattern

### Track Cost on Purchase

```typescript
// When creating purchase receipt
await updateStock({
  businessId,
  variationId,
  locationId,
  quantity: receivedQty,
  transactionType: 'purchase',
  unitCost: purchaseUnitCost,  // ⚡ Record actual purchase cost
  userId,
  referenceType: 'PurchaseReceipt',
  referenceId: receipt.id.toString()
}, tx)
```

### Calculate COGS on Sale

```typescript
async function calculateSaleCOGS(
  businessId: number,
  saleItems: Array<{
    variationId: number
    locationId: number
    quantity: number
    sellingPrice: number
  }>,
  method?: ValuationMethod
): Promise<{
  totalCOGS: number
  totalRevenue: number
  grossProfit: number
  grossMargin: number
  items: Array<{
    variationId: number
    quantity: number
    revenue: number
    cogs: number
    profit: number
    margin: number
  }>
}> {

  // Get business valuation method
  if (!method) {
    const settings = await prisma.businessSettings.findUnique({
      where: { businessId },
      select: { inventoryValuationMethod: true }
    })
    method = settings?.inventoryValuationMethod || 'WEIGHTED_AVG'
  }

  const itemResults = []
  let totalCOGS = 0
  let totalRevenue = 0

  for (const item of saleItems) {
    // Get cost using valuation method
    const valuation = await getInventoryValuation(
      item.variationId,
      item.locationId,
      businessId,
      method
    )

    const unitCost = valuation.unitCost
    const itemCOGS = item.quantity * unitCost
    const itemRevenue = item.quantity * item.sellingPrice
    const itemProfit = itemRevenue - itemCOGS
    const itemMargin = itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0

    itemResults.push({
      variationId: item.variationId,
      quantity: item.quantity,
      revenue: itemRevenue,
      cogs: itemCOGS,
      profit: itemProfit,
      margin: itemMargin
    })

    totalCOGS += itemCOGS
    totalRevenue += itemRevenue
  }

  const grossProfit = totalRevenue - totalCOGS
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  return {
    totalCOGS,
    totalRevenue,
    grossProfit,
    grossMargin,
    items: itemResults
  }
}
```

### Store COGS in Sale

```typescript
// When creating sale
const cogsCalc = await calculateSaleCOGS(businessId, items)

await prisma.sale.create({
  data: {
    businessId,
    // ... other fields
    totalAmount: cogsCalc.totalRevenue,
    totalCost: cogsCalc.totalCOGS,
    grossProfit: cogsCalc.grossProfit,
    items: {
      create: items.map((item, idx) => ({
        variationId: item.variationId,
        quantity: item.quantity,
        unitPrice: item.sellingPrice,
        costPrice: cogsCalc.items[idx].cogs / item.quantity,  // Store unit cost
        lineTotal: cogsCalc.items[idx].revenue,
        lineProfit: cogsCalc.items[idx].profit
      }))
    }
  }
})
```

## API Route: Profitability Report

```typescript
// /src/app/api/reports/profitability/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const sales = await prisma.sale.findMany({
    where: {
      businessId: session.user.businessId,
      createdAt: {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined
      }
    },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
          variation: { select: { name: true } }
        }
      }
    }
  })

  // Aggregate by product
  const productProfitability = new Map()

  for (const sale of sales) {
    for (const item of sale.items) {
      const key = `${item.productId}-${item.variationId}`
      if (!productProfitability.has(key)) {
        productProfitability.set(key, {
          productName: item.product.name,
          variationName: item.variation?.name,
          totalRevenue: 0,
          totalCOGS: 0,
          totalProfit: 0,
          unitsSold: 0
        })
      }

      const data = productProfitability.get(key)
      data.totalRevenue += item.unitPrice * item.quantity
      data.totalCOGS += item.costPrice * item.quantity
      data.totalProfit += (item.unitPrice - item.costPrice) * item.quantity
      data.unitsSold += item.quantity
    }
  }

  const profitabilityReport = Array.from(productProfitability.values()).map(item => ({
    ...item,
    avgMargin: item.totalRevenue > 0 ? (item.totalProfit / item.totalRevenue) * 100 : 0,
    avgUnitProfit: item.unitsSold > 0 ? item.totalProfit / item.unitsSold : 0
  }))

  // Sort by total profit desc
  profitabilityReport.sort((a, b) => b.totalProfit - a.totalProfit)

  return NextResponse.json({
    success: true,
    report: profitabilityReport,
    summary: {
      totalRevenue: profitabilityReport.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalCOGS: profitabilityReport.reduce((sum, item) => sum + item.totalCOGS, 0),
      totalProfit: profitabilityReport.reduce((sum, item) => sum + item.totalProfit, 0),
      avgMargin: profitabilityReport.reduce((sum, item) => sum + item.avgMargin, 0) / profitabilityReport.length
    }
  })
}
```

## Best Practices

### ✅ DO:
- **Record unit cost** with every transaction
- **Calculate COGS** using business valuation method
- **Store COGS** in sale records
- **Track profit** per sale item
- **Monitor margins** continuously
- **Alert on negative margins**

### ❌ DON'T:
- **Don't use selling price** as cost
- **Don't skip COGS calculation**
- **Don't ignore negative margins**
- **Don't mix valuation methods**

## Related Skills
- `pos-inventory-valuation-engine` - Provides cost basis calculation
- `pos-inventory-transaction-logger` - Stores unit costs
- `pos-financial-impact-analyzer` - GL entries for COGS

## References
- Schema: `/prisma/schema.prisma` (StockTransaction.unitCost)
- Library: `/src/lib/inventoryValuation.ts`
