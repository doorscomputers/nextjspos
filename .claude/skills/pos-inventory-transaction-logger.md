# pos-inventory-transaction-logger

## Purpose
Creates immutable inventory transaction logs for every stock movement in the system. This is the foundation of audit trails, item ledgers, and inventory history tracking.

## When to Use
- **ALWAYS** when inventory quantities change
- Creating purchases, sales, transfers, returns, or adjustments
- Setting opening stock
- Processing inventory corrections
- Any operation that affects VariationLocationDetails.currentQty

## Critical Requirements

### 1. Transaction Type Classification
Use the correct `transactionType` from StockTransaction model:
```typescript
enum TransactionType {
  opening_stock      // Initial stock setup
  purchase          // Goods received from supplier
  sale              // Goods sold to customer
  transfer_in       // Stock received from another location
  transfer_out      // Stock sent to another location
  adjustment        // Manual correction/adjustment
  customer_return   // Customer returned goods
  supplier_return   // Returned goods to supplier
  correction        // Physical count correction
}
```

### 2. Immutable Record Structure
Every StockTransaction MUST include:
```typescript
{
  // Core identification
  businessId: number           // Tenant isolation
  productId: number           // Product being moved
  variationId: number         // Specific variation
  locationId: number          // Location where movement occurred

  // Transaction details
  transactionType: TransactionType
  quantity: number            // Signed: positive for IN, negative for OUT
  unitCost: Decimal           // Cost basis at time of transaction
  balance: number             // Running balance AFTER this transaction

  // Audit trail
  userId: number              // Who initiated this transaction
  createdAt: DateTime         // When transaction occurred

  // References (optional but recommended)
  referenceType: string?      // e.g., "Sale", "Purchase", "Transfer"
  referenceId: string?        // ID of originating document
  notes: string?              // Additional context
}
```

### 3. Multi-Tenant Isolation
**CRITICAL**: Always include `businessId` in:
- StockTransaction creation
- All queries to retrieve transactions
- Ledger reports and history views

### 4. Running Balance Calculation
**MUST** maintain accurate running balance:
```typescript
// Pattern for calculating balance:
1. Get current stock quantity from VariationLocationDetails
2. Calculate new balance: currentQty + transactionQty
3. Store balance in StockTransaction.balance
4. Update VariationLocationDetails.currentQty to new balance

// Example:
const currentStock = await prisma.variationLocationDetails.findUnique({
  where: {
    variationId_locationId: { variationId, locationId },
    variation: { product: { businessId } }
  }
})

const currentQty = currentStock?.currentQty || 0
const newBalance = currentQty + transactionQty  // transactionQty is signed

await prisma.stockTransaction.create({
  data: {
    // ... other fields
    quantity: transactionQty,
    balance: newBalance,
    // ...
  }
})

await prisma.variationLocationDetails.update({
  where: { /* ... */ },
  data: { currentQty: newBalance }
})
```

## Implementation Pattern

### Standard Transaction Creation
```typescript
import { prisma } from '@/lib/prisma'

interface CreateStockTransactionParams {
  businessId: number
  productId: number
  variationId: number
  locationId: number
  transactionType: string
  quantity: number           // Signed: +IN / -OUT
  unitCost: number
  userId: number
  referenceType?: string
  referenceId?: string
  notes?: string
}

async function createStockTransaction(
  params: CreateStockTransactionParams,
  tx: Prisma.TransactionClient  // Always use transactions!
): Promise<StockTransaction> {

  // 1. Get current stock
  const currentStock = await tx.variationLocationDetails.findUnique({
    where: {
      variationId_locationId: {
        variationId: params.variationId,
        locationId: params.locationId
      }
    },
    include: {
      variation: {
        include: { product: true }
      }
    }
  })

  // 2. Validate tenant isolation
  if (currentStock?.variation?.product?.businessId !== params.businessId) {
    throw new Error('Multi-tenant violation: Product does not belong to business')
  }

  const currentQty = currentStock?.currentQty || 0
  const newBalance = currentQty + params.quantity

  // 3. Validate non-negative stock (optional, based on settings)
  if (newBalance < 0 && params.transactionType === 'sale') {
    throw new Error(`Insufficient stock: Current=${currentQty}, Requested=${Math.abs(params.quantity)}`)
  }

  // 4. Create transaction record
  const transaction = await tx.stockTransaction.create({
    data: {
      businessId: params.businessId,
      productId: params.productId,
      variationId: params.variationId,
      locationId: params.locationId,
      transactionType: params.transactionType,
      quantity: params.quantity,
      unitCost: params.unitCost,
      balance: newBalance,
      userId: params.userId,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      notes: params.notes,
      createdAt: new Date()
    }
  })

  // 5. Update current stock
  await tx.variationLocationDetails.upsert({
    where: {
      variationId_locationId: {
        variationId: params.variationId,
        locationId: params.locationId
      }
    },
    update: {
      currentQty: newBalance,
      updatedAt: new Date()
    },
    create: {
      variationId: params.variationId,
      locationId: params.locationId,
      currentQty: newBalance,
      createdAt: new Date()
    }
  })

  return transaction
}
```

### Usage in Business Operations

#### Example 1: Purchase Receipt (Stock IN)
```typescript
export async function POST(request: NextRequest) {
  // ... auth & validation

  await prisma.$transaction(async (tx) => {
    // Create purchase receipt
    const receipt = await tx.purchaseReceipt.create({ /* ... */ })

    // Create stock transactions for each item
    for (const item of receiptItems) {
      await createStockTransaction({
        businessId: user.businessId,
        productId: item.productId,
        variationId: item.variationId,
        locationId: warehouseLocationId,
        transactionType: 'purchase',
        quantity: item.receivedQty,  // Positive for IN
        unitCost: item.unitCost,
        userId: user.id,
        referenceType: 'PurchaseReceipt',
        referenceId: receipt.id.toString(),
        notes: `GRN #${receipt.grnNumber}`
      }, tx)
    }
  })
}
```

#### Example 2: Sales (Stock OUT)
```typescript
export async function POST(request: NextRequest) {
  // ... auth & validation

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({ /* ... */ })

    for (const item of saleItems) {
      await createStockTransaction({
        businessId: user.businessId,
        productId: item.productId,
        variationId: item.variationId,
        locationId: sale.locationId,
        transactionType: 'sale',
        quantity: -item.quantity,  // NEGATIVE for OUT
        unitCost: item.costPrice,
        userId: user.id,
        referenceType: 'Sale',
        referenceId: sale.id.toString(),
        notes: `Invoice #${sale.invoiceNumber}`
      }, tx)
    }
  })
}
```

#### Example 3: Stock Transfer (2 transactions)
```typescript
// Transfer creates TWO transactions: OUT from source, IN to destination
await prisma.$transaction(async (tx) => {
  const transfer = await tx.stockTransfer.create({ /* ... */ })

  for (const item of transferItems) {
    // 1. Deduct from source location
    await createStockTransaction({
      businessId: user.businessId,
      productId: item.productId,
      variationId: item.variationId,
      locationId: transfer.fromLocationId,
      transactionType: 'transfer_out',
      quantity: -item.quantity,  // NEGATIVE
      unitCost: item.costPrice,
      userId: user.id,
      referenceType: 'StockTransfer',
      referenceId: transfer.id.toString()
    }, tx)

    // 2. Add to destination location
    await createStockTransaction({
      businessId: user.businessId,
      productId: item.productId,
      variationId: item.variationId,
      locationId: transfer.toLocationId,
      transactionType: 'transfer_in',
      quantity: item.quantity,  // POSITIVE
      unitCost: item.costPrice,
      userId: user.id,
      referenceType: 'StockTransfer',
      referenceId: transfer.id.toString()
    }, tx)
  }
})
```

#### Example 4: Inventory Correction
```typescript
await prisma.$transaction(async (tx) => {
  const correction = await tx.inventoryCorrection.create({ /* ... */ })

  // Calculate adjustment quantity
  const adjustmentQty = correction.physicalCount - correction.systemCount

  await createStockTransaction({
    businessId: user.businessId,
    productId: correction.productId,
    variationId: correction.variationId,
    locationId: correction.locationId,
    transactionType: 'correction',
    quantity: adjustmentQty,  // Can be positive or negative
    unitCost: correction.unitCost || 0,
    userId: user.id,
    referenceType: 'InventoryCorrection',
    referenceId: correction.id.toString(),
    notes: `Correction: System=${correction.systemCount}, Physical=${correction.physicalCount}`
  }, tx)
})
```

## Querying Transaction History

### Item Ledger Report
```typescript
// Get all transactions for a product variation at a location
const transactions = await prisma.stockTransaction.findMany({
  where: {
    businessId: user.businessId,
    variationId: variationId,
    locationId: locationId,
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  },
  include: {
    user: { select: { username: true } },
    product: { select: { name: true, sku: true } },
    variation: { select: { name: true } },
    location: { select: { name: true } }
  },
  orderBy: { createdAt: 'asc' }
})

// Display chronologically with running balance
transactions.forEach(txn => {
  console.log({
    date: txn.createdAt,
    type: txn.transactionType,
    in: txn.quantity > 0 ? txn.quantity : null,
    out: txn.quantity < 0 ? Math.abs(txn.quantity) : null,
    balance: txn.balance,
    reference: `${txn.referenceType} #${txn.referenceId}`,
    user: txn.user.username
  })
})
```

### Variance Detection
```typescript
// Compare calculated balance vs actual stock
const latestTransaction = await prisma.stockTransaction.findFirst({
  where: { businessId, variationId, locationId },
  orderBy: { createdAt: 'desc' }
})

const currentStock = await prisma.variationLocationDetails.findUnique({
  where: { variationId_locationId: { variationId, locationId } }
})

if (latestTransaction.balance !== currentStock.currentQty) {
  console.error('VARIANCE DETECTED!', {
    ledgerBalance: latestTransaction.balance,
    systemStock: currentStock.currentQty,
    difference: currentStock.currentQty - latestTransaction.balance
  })
  // Trigger reconciliation workflow
}
```

## Best Practices

### ✅ DO:
- **Always use Prisma transactions** (`prisma.$transaction`) for atomicity
- **Always include businessId** for multi-tenant isolation
- **Always use signed quantities** (positive IN, negative OUT)
- **Always record unitCost** at time of transaction
- **Always update balance** after each transaction
- **Always link to source document** (referenceType/referenceId)
- **Validate stock availability** before OUT transactions
- **Include meaningful notes** for audit trail

### ❌ DON'T:
- **Never modify existing StockTransaction records** (immutable audit trail)
- **Never skip transaction creation** for any stock movement
- **Never use unsigned quantities** (use negative for OUT)
- **Never forget businessId** in queries (security risk)
- **Never update stock without creating transaction** (breaks ledger)
- **Never allow negative balance** without explicit business approval

## Troubleshooting

### Issue: Balance Mismatch
```typescript
// Recalculate balance from transaction history
const transactions = await prisma.stockTransaction.findMany({
  where: { businessId, variationId, locationId },
  orderBy: { createdAt: 'asc' }
})

let calculatedBalance = 0
transactions.forEach(txn => {
  calculatedBalance += txn.quantity
  if (txn.balance !== calculatedBalance) {
    console.error(`Balance mismatch at transaction ${txn.id}:
      Recorded: ${txn.balance}, Calculated: ${calculatedBalance}`)
  }
})
```

### Issue: Missing Transactions
```typescript
// Audit: Find stock changes without corresponding transactions
const stockWithoutTransactions = await prisma.$queryRaw`
  SELECT vld.*, p.name, v.name as variation_name
  FROM VariationLocationDetails vld
  JOIN ProductVariation v ON vld.variationId = v.id
  JOIN Product p ON v.productId = p.id
  LEFT JOIN StockTransaction st ON st.variationId = vld.variationId
    AND st.locationId = vld.locationId
  WHERE p.businessId = ${businessId}
    AND st.id IS NULL
    AND vld.currentQty > 0
`
// These items have stock but no transaction history - investigate!
```

## Related Skills
- `pos-stock-operation-enforcer` - Validates and executes stock operations
- `pos-audit-trail-architect` - Creates audit logs for sensitive operations
- `pos-item-ledger-engine` - Generates ledger reports from transactions
- `pos-stock-reconciliation-detective` - Detects and corrects variances

## References
- Schema: `/prisma/schema.prisma` lines 766-804 (StockTransaction model)
- Library: `/src/lib/stockOperations.ts` (updateStock function)
- Example: `/src/app/api/inventory-corrections/[id]/approve/route.ts`
