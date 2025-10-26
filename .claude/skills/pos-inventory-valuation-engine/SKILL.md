---
name: pos-inventory-valuation-engine
description: Calculates inventory valuation using FIFO, LIFO, or Weighted Average cost methods. Essential for acc
---

# pos-inventory-valuation-engine

## Purpose
Calculates inventory valuation using FIFO, LIFO, or Weighted Average cost methods. Essential for accurate financial statements, COGS calculations, and tax compliance.

## When to Use
- Period-end inventory valuation
- Financial statement preparation
- COGS (Cost of Goods Sold) calculations
- Tax reporting
- Inventory write-downs
- Profitability analysis

## Critical Requirements

### 1. Valuation Methods
```typescript
enum ValuationMethod {
  FIFO            // First In, First Out
  LIFO            // Last In, First Out
  WEIGHTED_AVG    // Weighted Average Cost
  STANDARD_COST   // Fixed standard cost
}
```

### 2. Valuation Data Structure
```typescript
interface InventoryValuation {
  productId: number
  variationId: number
  locationId: number
  method: ValuationMethod
  currentQty: number
  unitCost: number
  totalValue: number
  valuationDate: Date
  costLayers?: CostLayer[]  // For FIFO/LIFO
}

interface CostLayer {
  purchaseDate: Date
  quantity: number
  remaining Qty: number
  unitCost: number
  totalValue: number
  transactionId: number
}
```

### 3. Business Setting
```typescript
// Each business chooses ONE method globally
interface BusinessSettings {
  inventoryValuationMethod: ValuationMethod  // Default: WEIGHTED_AVG
  allowNegativeStock: boolean
  stockValueDecimalPlaces: number  // Default: 2
}
```

## Implementation Patterns

### FIFO (First In, First Out)

```typescript
// /src/lib/inventoryValuation.ts

interface FIFOCalculation {
  currentQty: number
  unitCost: number
  totalValue: number
  costLayers: CostLayer[]
}

async function calculateFIFOValue(
  variationId: number,
  locationId: number,
  businessId: number
): Promise<FIFOCalculation> {

  // Get all purchase transactions (IN) in chronological order
  const inboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      variationId,
      locationId,
      quantity: { gt: 0 }  // Only IN transactions
    },
    orderBy: { createdAt: 'asc' },  // FIFO: Oldest first
    select: {
      id: true,
      quantity: true,
      unitCost: true,
      createdAt: true
    }
  })

  // Get all outbound transactions (OUT) in chronological order
  const outboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      variationId,
      locationId,
      quantity: { lt: 0 }  // Only OUT transactions
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      quantity: true,  // Negative
      createdAt: true
    }
  })

  // Build cost layers
  const costLayers: CostLayer[] = inboundTransactions.map(txn => ({
    purchaseDate: txn.createdAt,
    quantity: txn.quantity,
    remainingQty: txn.quantity,  // Initially all remaining
    unitCost: parseFloat(txn.unitCost.toString()),
    totalValue: txn.quantity * parseFloat(txn.unitCost.toString()),
    transactionId: txn.id
  }))

  // Consume layers using FIFO (oldest first)
  let totalOut = Math.abs(
    outboundTransactions.reduce((sum, txn) => sum + txn.quantity, 0)
  )

  for (const layer of costLayers) {
    if (totalOut === 0) break

    const toConsume = Math.min(layer.remainingQty, totalOut)
    layer.remainingQty -= toConsume
    layer.totalValue = layer.remainingQty * layer.unitCost
    totalOut -= toConsume
  }

  // Remaining layers have value
  const remainingLayers = costLayers.filter(layer => layer.remainingQty > 0)
  const currentQty = remainingLayers.reduce((sum, layer) => sum + layer.remainingQty, 0)
  const totalValue = remainingLayers.reduce((sum, layer) => sum + layer.totalValue, 0)
  const unitCost = currentQty > 0 ? totalValue / currentQty : 0

  return {
    currentQty,
    unitCost,
    totalValue,
    costLayers: remainingLayers
  }
}
```

### LIFO (Last In, First Out)

```typescript
async function calculateLIFOValue(
  variationId: number,
  locationId: number,
  businessId: number
): Promise<FIFOCalculation> {

  // Same as FIFO but consume from NEWEST layers first
  const inboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      variationId,
      locationId,
      quantity: { gt: 0 }
    },
    orderBy: { createdAt: 'desc' },  // LIFO: Newest first
    select: {
      id: true,
      quantity: true,
      unitCost: true,
      createdAt: true
    }
  })

  // Build layers (same as FIFO)
  const costLayers: CostLayer[] = inboundTransactions.map(txn => ({
    purchaseDate: txn.createdAt,
    quantity: txn.quantity,
    remainingQty: txn.quantity,
    unitCost: parseFloat(txn.unitCost.toString()),
    totalValue: txn.quantity * parseFloat(txn.unitCost.toString()),
    transactionId: txn.id
  }))

  // Get total OUT
  const totalOut = await prisma.stockTransaction.aggregate({
    where: {
      businessId,
      variationId,
      locationId,
      quantity: { lt: 0 }
    },
    _sum: { quantity: true }
  })

  let remaining = Math.abs(totalOut._sum.quantity || 0)

  // Consume from NEWEST layers first
  for (const layer of costLayers) {  // Already sorted DESC
    if (remaining === 0) break

    const toConsume = Math.min(layer.remainingQty, remaining)
    layer.remainingQty -= toConsume
    layer.totalValue = layer.remainingQty * layer.unitCost
    remaining -= toConsume
  }

  const remainingLayers = costLayers.filter(layer => layer.remainingQty > 0)
  const currentQty = remainingLayers.reduce((sum, layer) => sum + layer.remainingQty, 0)
  const totalValue = remainingLayers.reduce((sum, layer) => sum + layer.totalValue, 0)
  const unitCost = currentQty > 0 ? totalValue / currentQty : 0

  return {
    currentQty,
    unitCost,
    totalValue,
    costLayers: remainingLayers
  }
}
```

### Weighted Average Cost

```typescript
async function calculateWeightedAverageValue(
  variationId: number,
  locationId: number,
  businessId: number
): Promise<FIFOCalculation> {

  // Get all IN transactions
  const inboundTotal = await prisma.stockTransaction.aggregate({
    where: {
      businessId,
      variationId,
      locationId,
      quantity: { gt: 0 }
    },
    _sum: { quantity: true }
  })

  // Calculate weighted average cost
  const inboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      variationId,
      locationId,
      quantity: { gt: 0 }
    },
    select: { quantity: true, unitCost: true }
  })

  let totalCost = 0
  let totalQty = 0

  for (const txn of inboundTransactions) {
    totalCost += txn.quantity * parseFloat(txn.unitCost.toString())
    totalQty += txn.quantity
  }

  const weightedAvgCost = totalQty > 0 ? totalCost / totalQty : 0

  // Get current stock quantity
  const stockRecord = await prisma.variationLocationDetails.findUnique({
    where: {
      variationId_locationId: { variationId, locationId }
    },
    select: { currentQty: true }
  })

  const currentQty = stockRecord?.currentQty || 0
  const totalValue = currentQty * weightedAvgCost

  return {
    currentQty,
    unitCost: weightedAvgCost,
    totalValue,
    costLayers: []  // No layers for weighted average
  }
}
```

### Standard Cost

```typescript
async function calculateStandardCostValue(
  variationId: number,
  locationId: number,
  businessId: number
): Promise<FIFOCalculation> {

  // Use the product variation's default cost price
  const variation = await prisma.productVariation.findUnique({
    where: { id: variationId },
    select: { costPrice: true }
  })

  const standardCost = parseFloat(variation?.costPrice.toString() || '0')

  // Get current stock
  const stockRecord = await prisma.variationLocationDetails.findUnique({
    where: {
      variationId_locationId: { variationId, locationId }
    },
    select: { currentQty: true }
  })

  const currentQty = stockRecord?.currentQty || 0
  const totalValue = currentQty * standardCost

  return {
    currentQty,
    unitCost: standardCost,
    totalValue,
    costLayers: []
  }
}
```

### Main Valuation Function

```typescript
async function getInventoryValuation(
  variationId: number,
  locationId: number,
  businessId: number,
  method?: ValuationMethod
): Promise<FIFOCalculation> {

  // Get business valuation method if not specified
  if (!method) {
    const settings = await prisma.businessSettings.findUnique({
      where: { businessId },
      select: { inventoryValuationMethod: true }
    })
    method = settings?.inventoryValuationMethod || 'WEIGHTED_AVG'
  }

  switch (method) {
    case 'FIFO':
      return calculateFIFOValue(variationId, locationId, businessId)

    case 'LIFO':
      return calculateLIFOValue(variationId, locationId, businessId)

    case 'WEIGHTED_AVG':
      return calculateWeightedAverageValue(variationId, locationId, businessId)

    case 'STANDARD_COST':
      return calculateStandardCostValue(variationId, locationId, businessId)

    default:
      throw new Error(`Unsupported valuation method: ${method}`)
  }
}

export { getInventoryValuation, ValuationMethod }
```

## API Route: Inventory Valuation Report

```typescript
// /src/app/api/reports/inventory-valuation/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')
  const method = searchParams.get('method') as ValuationMethod | undefined

  try {
    // Get all products with variations
    const variations = await prisma.productVariation.findMany({
      where: {
        product: { businessId: user.businessId }
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, categoryId: true }
        }
      }
    })

    // Calculate valuation for each variation at location
    const valuations = []

    for (const variation of variations) {
      const valuation = await getInventoryValuation(
        variation.id,
        locationId ? parseInt(locationId) : null,
        user.businessId,
        method
      )

      if (valuation.currentQty > 0) {
        valuations.push({
          productId: variation.productId,
          productName: variation.product.name,
          productSku: variation.product.sku,
          variationId: variation.id,
          variationName: variation.name,
          method: method || 'WEIGHTED_AVG',
          currentQty: valuation.currentQty,
          unitCost: valuation.unitCost,
          totalValue: valuation.totalValue,
          costLayers: valuation.costLayers
        })
      }
    }

    // Calculate totals
    const totalInventoryValue = valuations.reduce((sum, v) => sum + v.totalValue, 0)
    const totalItems = valuations.length
    const totalQuantity = valuations.reduce((sum, v) => sum + v.currentQty, 0)

    return NextResponse.json({
      success: true,
      valuations,
      summary: {
        totalInventoryValue,
        totalItems,
        totalQuantity,
        valuationMethod: method || 'WEIGHTED_AVG',
        valuationDate: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Valuation calculation error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to calculate valuation'
    }, { status: 500 })
  }
}
```

## Comparison of Methods

### FIFO (First In, First Out)
**Pros:**
- Matches physical flow of goods
- Higher inventory value in inflation
- Better gross profit in rising costs

**Cons:**
- More complex to calculate
- Requires tracking cost layers

**Best for:** Perishable goods, retail

### LIFO (Last In, First Out)
**Pros:**
- Tax advantage in inflation
- Matches current costs to revenue

**Cons:**
- Not allowed under IFRS
- Can understate inventory value
- Complex layer tracking

**Best for:** Non-perishables in inflationary environment

### Weighted Average
**Pros:**
- Simple to calculate
- Smooths price fluctuations
- No layer tracking needed

**Cons:**
- Doesn't reflect actual flow
- Can lag behind price changes

**Best for:** Commodities, bulk items

### Standard Cost
**Pros:**
- Simplest method
- Variance analysis possible

**Cons:**
- Requires periodic updates
- Can deviate from actual costs

**Best for:** Manufacturing, budgeting

## Best Practices

### ✅ DO:
- **Choose ONE method** per business (consistency)
- **Document method** in financial statements
- **Recalculate regularly** (monthly/quarterly)
- **Track cost layers** for FIFO/LIFO
- **Update standard costs** periodically
- **Validate against general ledger**
- **Consider tax implications** of method choice
- **Support method comparison** for analysis

### ❌ DON'T:
- **Don't change methods** frequently (consistency principle)
- **Don't mix methods** for same product
- **Don't forget negative stock** impact on valuation
- **Don't skip layer cleanup** (fully consumed layers)
- **Don't ignore variances** between methods
- **Don't use LIFO** if under IFRS

## Related Skills
- `pos-cost-basis-tracker` - Tracks individual transaction costs
- `pos-stock-reconciliation-detective` - Validates valuation accuracy
- `pos-financial-impact-analyzer` - Prepares GL entries
- `pos-item-ledger-engine` - Provides transaction history

## References
- Schema: `/prisma/schema.prisma` (StockTransaction for cost basis)
- Schema: `/prisma/schema.prisma` (BusinessSettings for valuation method)
- Accounting: Generally Accepted Accounting Principles (GAAP)
- Tax: IRS regulations on inventory valuation
