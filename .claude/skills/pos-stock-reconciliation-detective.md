# pos-stock-reconciliation-detective

## Purpose
Detects and investigates discrepancies between ledger balances, system stock, and physical counts. Identifies data integrity issues, missing transactions, and variances requiring correction.

## When to Use
- Period-end reconciliation
- Investigating stock discrepancies
- Data integrity audits
- After system migrations
- Detecting shrinkage/theft
- Validating transaction completeness

## Critical Requirements

### 1. Reconciliation Types
```typescript
enum ReconciliationType {
  LEDGER_VS_SYSTEM    // StockTransaction balance vs VariationLocationDetails.currentQty
  SYSTEM_VS_PHYSICAL  // VariationLocationDetails vs actual count
  VALUATION_VS_GL     // Inventory value vs General Ledger
}
```

### 2. Variance Detection
```typescript
interface VarianceDetection {
  variationId: number
  locationId: number
  ledgerBalance: number        // From StockTransaction
  systemBalance: number        // From VariationLocationDetails
  physicalCount: number | null // From physical count (if available)
  variance: number
  variancePercentage: number
  varianceType: 'overage' | 'shortage' | 'match'
  lastTransaction: Date
  requiresInvestigation: boolean
}
```

## Implementation Pattern

### Ledger vs System Reconciliation

```typescript
// /src/lib/reconciliation.ts
async function reconcileLedgerVsSystem(
  businessId: number,
  locationId?: number
): Promise<VarianceDetection[]> {

  const where: any = {
    variation: {
      product: { businessId }
    }
  }

  if (locationId) {
    where.locationId = locationId
  }

  // Get all stock records
  const stockRecords = await prisma.variationLocationDetails.findMany({
    where,
    include: {
      variation: {
        include: { product: { select: { id: true, name: true, sku: true } } }
      },
      location: { select: { id: true, name: true } }
    }
  })

  const variances: VarianceDetection[] = []

  for (const record of stockRecords) {
    // Get ledger balance (last transaction balance)
    const lastTransaction = await prisma.stockTransaction.findFirst({
      where: {
        businessId,
        variationId: record.variationId,
        locationId: record.locationId
      },
      orderBy: { createdAt: 'desc' },
      select: { balance: true, createdAt: true }
    })

    const ledgerBalance = lastTransaction?.balance || 0
    const systemBalance = record.currentQty
    const variance = systemBalance - ledgerBalance

    if (variance !== 0) {
      variances.push({
        variationId: record.variationId,
        locationId: record.locationId,
        productName: record.variation.product.name,
        productSku: record.variation.product.sku,
        variationName: record.variation.name,
        locationName: record.location.name,
        ledgerBalance,
        systemBalance,
        physicalCount: null,
        variance,
        variancePercentage: ledgerBalance !== 0 ? (variance / ledgerBalance) * 100 : 0,
        varianceType: variance > 0 ? 'overage' : 'shortage',
        lastTransaction: lastTransaction?.createdAt || new Date(),
        requiresInvestigation: Math.abs(variance) > 0
      })
    }
  }

  return variances
}

export { reconcileLedgerVsSystem }
```

### Automatic Reconciliation Fixer

```typescript
async function fixLedgerVsSystemVariances(
  businessId: number,
  userId: number
): Promise<{ fixed: number, errors: string[] }> {

  const variances = await reconcileLedgerVsSystem(businessId)
  const results = { fixed: 0, errors: [] }

  for (const variance of variances) {
    if (variance.variance === 0) continue

    try {
      await prisma.$transaction(async (tx) => {
        // Create correction transaction to align ledger with system
        await tx.stockTransaction.create({
          data: {
            businessId,
            productId: variance.productId,
            variationId: variance.variationId,
            locationId: variance.locationId,
            transactionType: 'correction',
            quantity: variance.variance,
            unitCost: 0,  // Reconciliation doesn't affect cost
            balance: variance.systemBalance,  // New ledger balance
            userId,
            referenceType: 'Reconciliation',
            referenceId: `AUTO-${Date.now()}`,
            notes: `Auto-reconciliation: Ledger ${variance.ledgerBalance} → System ${variance.systemBalance}`,
            createdAt: new Date()
          }
        })

        // Audit log
        await createAuditLog({
          businessId,
          userId,
          username: 'SYSTEM',
          action: 'INVENTORY_RECONCILIATION',
          entityType: 'STOCK_TRANSACTION',
          entityIds: [variance.variationId.toString()],
          description: `Auto-reconciled variance for ${variance.productName}`,
          metadata: {
            variationId: variance.variationId,
            locationId: variance.locationId,
            ledgerBalance: variance.ledgerBalance,
            systemBalance: variance.systemBalance,
            variance: variance.variance,
            fixed: true
          }
        })

        results.fixed++
      })
    } catch (error: any) {
      results.errors.push(`${variance.productName}: ${error.message}`)
    }
  }

  return results
}
```

### API Route: Reconciliation Report

```typescript
// /src/app/api/reports/reconciliation/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')
  const autoFix = searchParams.get('autoFix') === 'true'

  try {
    const variances = await reconcileLedgerVsSystem(
      user.businessId,
      locationId ? parseInt(locationId) : undefined
    )

    // Optionally auto-fix small variances
    let fixResults = null
    if (autoFix && user.permissions?.includes('INVENTORY_RECONCILIATION_AUTO_FIX')) {
      // Only fix variances < 5% or absolute value < 10
      const fixable = variances.filter(v =>
        Math.abs(v.variancePercentage) < 5 || Math.abs(v.variance) < 10
      )

      fixResults = await fixLedgerVsSystemVariances(user.businessId, user.id)
    }

    // Categorize variances
    const summary = {
      total: variances.length,
      overages: variances.filter(v => v.variance > 0).length,
      shortages: variances.filter(v => v.variance < 0).length,
      totalVarianceValue: 0,  // Calculate if costs available
      requiresAction: variances.filter(v => v.requiresInvestigation).length
    }

    return NextResponse.json({
      success: true,
      variances,
      summary,
      fixResults,
      reportDate: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Reconciliation error:', error)
    return NextResponse.json({
      error: error.message || 'Reconciliation failed'
    }, { status: 500 })
  }
}
```

## Variance Investigation Workflow

```typescript
// 1. Detect variance
const variances = await reconcileLedgerVsSystem(businessId)

// 2. Investigate high-value variances
const significant = variances.filter(v => Math.abs(v.variance) > 100)

// 3. Check for missing transactions
for (const variance of significant) {
  const transactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      variationId: variance.variationId,
      locationId: variance.locationId
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  // Look for patterns:
  // - Large gaps in time
  // - Unusual transaction types
  // - Missing expected transactions (e.g., sales without stock deduction)
}

// 4. Create correction if root cause found
// 5. Lock affected products pending investigation if suspicious
```

## Best Practices

### ✅ DO:
- **Run reconciliation regularly** (daily/weekly)
- **Investigate ALL variances** before fixing
- **Auto-fix only small variances** (< 5%)
- **Require approval** for manual fixes
- **Track reconciliation history**
- **Alert on suspicious patterns**
- **Document root causes**

### ❌ DON'T:
- **Don't auto-fix large variances** without investigation
- **Don't ignore recurring variances**
- **Don't skip audit logging**
- **Don't allow unsupervised reconciliation**

## Related Skills
- `pos-inventory-transaction-logger` - Source of ledger data
- `pos-item-ledger-engine` - Transaction history analysis
- `pos-inventory-correction-workflow` - Corrects identified variances
- `pos-audit-trail-architect` - Logs all reconciliations

## References
- Schema: `/prisma/schema.prisma` (StockTransaction, VariationLocationDetails)
- Library: `/src/lib/stockOperations.ts`
