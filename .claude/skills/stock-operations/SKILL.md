# stock-operations

## Purpose
Manages all inventory stock movements using the centralized `stockOperations.ts` library. This skill ensures you never directly modify stock quantities but always use the validated, atomic operations.

## When to Use
- **ALWAYS** when inventory quantities need to change
- Creating sales, purchases, transfers, returns, corrections
- Any operation affecting `VariationLocationDetails.qtyAvailable`
- **NEVER** directly update stock - always use this library

## Critical Implementation Details

### 1. Schema Field Names (CRITICAL)

**StockTransaction Model:**
```typescript
{
  id: number
  businessId: number
  productId: number
  productVariationId: number    // NOT variationId
  locationId: number
  type: string                   // NOT transactionType
  quantity: Decimal              // Signed: positive=IN, negative=OUT
  unitCost: Decimal?
  balanceQty: Decimal            // NOT balance
  referenceType: string?
  referenceId: number?
  createdBy: number              // NOT userId
  createdByUser: User            // Relation name
  notes: string?
  createdAt: DateTime
}
```

**VariationLocationDetails Model:**
```typescript
{
  id: number
  productId: number
  productVariationId: number     // NOT variationId
  locationId: number
  qtyAvailable: Decimal          // NOT currentQty
  sellingPrice: Decimal?
  // Composite unique key: productVariationId_locationId
}
```

### 2. Dual-Record System (CRITICAL)

Every stock transaction creates **TWO** records:

**Record 1: StockTransaction** (Technical tracking)
```typescript
await tx.stockTransaction.create({
  data: {
    businessId,
    productId,
    productVariationId,
    locationId,
    type: 'sale',
    quantity: -10,
    unitCost: 100,
    balanceQty: 90,
    referenceType: 'sale',
    referenceId: 123,
    createdBy: userId,
    notes: 'Sale - Invoice #123'
  }
})
```

**Record 2: ProductHistory** (Reporting & Audit)
```typescript
await tx.productHistory.create({
  data: {
    businessId,
    locationId,
    productId,
    productVariationId,
    transactionType: 'sale',
    transactionDate: new Date(),
    referenceType: 'sale',
    referenceId: 123,
    referenceNumber: 'INV-123',
    quantityChange: -10,
    balanceQuantity: 90,
    unitCost: 100,
    totalValue: 1000,
    createdBy: userId,
    createdByName: 'John Doe',
    reason: 'Sale - Invoice #123'
  }
})
```

**⚠️ NEVER create StockTransaction without ProductHistory!**

### 3. The ONLY Function You Should Use

**Import:**
```typescript
import { updateStock, StockTransactionType } from '@/lib/stockOperations'
```

**Core Function:**
```typescript
await updateStock({
  businessId: number,           // Multi-tenant isolation
  productId: number,
  productVariationId: number,   // Specific variation
  locationId: number,           // Branch/warehouse
  quantity: number,             // Signed: +IN / -OUT
  type: StockTransactionType,   // Enum value
  unitCost?: number,
  referenceType?: string,       // 'sale', 'purchase', 'transfer'
  referenceId?: number,         // ID of source document
  referenceNumber?: string,     // Human-readable reference
  userId: number,               // Who initiated
  userDisplayName?: string,     // Optional display name
  notes?: string,
  allowNegative?: boolean,      // Default: false
  tx?: TransactionClient        // Pass existing transaction
})
```

**Returns:**
```typescript
{
  transaction: StockTransaction
  previousBalance: number
  newBalance: number
}
```

### 4. Stock Transaction Types

**Enum Definition:**
```typescript
export enum StockTransactionType {
  OPENING_STOCK = 'opening_stock',
  PURCHASE = 'purchase',
  SALE = 'sale',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  ADJUSTMENT = 'adjustment',
  CUSTOMER_RETURN = 'customer_return',
  SUPPLIER_RETURN = 'supplier_return',
  CORRECTION = 'correction',
}
```

### 5. Helper Functions (Recommended)

**For Adding Stock:**
```typescript
import { addStock, StockTransactionType } from '@/lib/stockOperations'

await addStock({
  businessId, productId, productVariationId, locationId,
  quantity: 50,  // Positive number
  type: StockTransactionType.PURCHASE,
  unitCost: 100,
  referenceType: 'purchase',
  referenceId: receiptId,
  referenceNumber: 'GRN-001',
  userId,
  tx
})
```

**For Deducting Stock:**
```typescript
import { deductStock, StockTransactionType } from '@/lib/stockOperations'

await deductStock({
  businessId, productId, productVariationId, locationId,
  quantity: 10,  // Positive number (will be made negative)
  type: StockTransactionType.SALE,
  unitCost: 100,
  referenceType: 'sale',
  referenceId: saleId,
  referenceNumber: 'INV-123',
  userId,
  notes: 'Sale to customer',
  allowNegative: false,  // Blocks sale if insufficient stock
  tx
})
```

**Specialized Functions:**
```typescript
// Sale
await processSale({
  businessId, productId, productVariationId, locationId,
  quantity: 5, unitCost: 100, saleId, userId, tx
})

// Purchase Receipt
await processPurchaseReceipt({
  businessId, productId, productVariationId, locationId,
  quantity: 100, unitCost: 80,
  purchaseId, receiptId, userId, tx
})

// Customer Return
await processCustomerReturn({
  businessId, productId, productVariationId, locationId,
  quantity: 2, unitCost: 100, returnId, userId, tx
})

// Supplier Return
await processSupplierReturn({
  businessId, productId, productVariationId, locationId,
  quantity: 5, unitCost: 80,
  returnId, returnNumber: 'SR-001',
  supplierName: 'ABC Corp',
  returnReason: 'Damaged',
  userId, tx
})

// Transfer (2-step process)
await transferStockOut({
  businessId, productId, productVariationId,
  fromLocationId, quantity: 20,
  transferId, userId, tx
})

await transferStockIn({
  businessId, productId, productVariationId,
  toLocationId, quantity: 20, unitCost: 100,
  transferId, userId, tx
})
```

## Implementation Pattern

### Example 1: Sales Transaction
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductStock, StockTransactionType } from '@/lib/stockOperations'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user
  const body = await request.json()

  // ALWAYS use prisma.$transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create sale record
    const sale = await tx.sale.create({
      data: {
        businessId: user.businessId,
        locationId: body.locationId,
        totalAmount: body.totalAmount,
        // ... other fields
      }
    })

    // 2. Create sale items and deduct stock
    for (const item of body.items) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          productVariationId: item.variationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
        }
      })

      // 3. Deduct stock using validated library function
      await deductStock({
        businessId: user.businessId,
        productId: item.productId,
        productVariationId: item.variationId,
        locationId: body.locationId,
        quantity: item.quantity,
        type: StockTransactionType.SALE,
        unitCost: item.costPrice,
        referenceType: 'sale',
        referenceId: sale.id,
        referenceNumber: sale.invoiceNumber,
        userId: user.id,
        userDisplayName: `${user.firstName} ${user.lastName}`,
        notes: `Sale - Invoice #${sale.invoiceNumber}`,
        allowNegative: false,  // Prevent overselling
        tx  // Pass transaction context
      })
    }

    return sale
  })

  return NextResponse.json(result, { status: 201 })
}
```

### Example 2: Purchase Receipt
```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session.user
  const body = await request.json()

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create purchase receipt
    const receipt = await tx.purchaseReceipt.create({
      data: {
        businessId: user.businessId,
        purchaseId: body.purchaseId,
        locationId: body.locationId,
        grnNumber: body.grnNumber,
        receivedAt: new Date(),
      }
    })

    // 2. Add items and increase stock
    for (const item of body.items) {
      await tx.purchaseReceiptItem.create({
        data: {
          receiptId: receipt.id,
          productId: item.productId,
          productVariationId: item.variationId,
          orderedQty: item.orderedQty,
          receivedQty: item.receivedQty,
          unitCost: item.unitCost,
        }
      })

      // Use the specialized purchase function
      await processPurchaseReceipt({
        businessId: user.businessId,
        productId: item.productId,
        productVariationId: item.variationId,
        locationId: body.locationId,
        quantity: item.receivedQty,
        unitCost: item.unitCost,
        purchaseId: body.purchaseId,
        receiptId: receipt.id,
        userId: user.id,
        userDisplayName: `${user.firstName} ${user.lastName}`,
        tx
      })
    }

    return receipt
  })

  return NextResponse.json(result, { status: 201 })
}
```

### Example 3: Stock Transfer
```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session.user
  const body = await request.json()

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create transfer record
    const transfer = await tx.stockTransfer.create({
      data: {
        businessId: user.businessId,
        fromLocationId: body.fromLocationId,
        toLocationId: body.toLocationId,
        transferNumber: body.transferNumber,
        status: 'pending',
      }
    })

    // 2. Create items and deduct from source
    for (const item of body.items) {
      await tx.stockTransferItem.create({
        data: {
          transferId: transfer.id,
          productId: item.productId,
          productVariationId: item.variationId,
          quantity: item.quantity,
          costPrice: item.costPrice,
        }
      })

      // STEP 1: Deduct from source location
      await transferStockOut({
        businessId: user.businessId,
        productId: item.productId,
        productVariationId: item.variationId,
        fromLocationId: body.fromLocationId,
        quantity: item.quantity,
        transferId: transfer.id,
        userId: user.id,
        userDisplayName: `${user.firstName} ${user.lastName}`,
        notes: `Transfer out - ${body.transferNumber}`,
        tx
      })
    }

    // Note: transferStockIn is called when destination receives the stock
    // (in a separate "receive transfer" API call)

    return transfer
  })

  return NextResponse.json(result, { status: 201 })
}

// Separate endpoint to receive transfer
export async function receiveTransfer(transferId: number, userId: number) {
  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true }
    })

    if (transfer.status !== 'pending') {
      throw new Error('Transfer already received')
    }

    // Add stock to destination
    for (const item of transfer.items) {
      await transferStockIn({
        businessId: transfer.businessId,
        productId: item.productId,
        productVariationId: item.productVariationId,
        toLocationId: transfer.toLocationId,
        quantity: item.quantity,
        unitCost: item.costPrice,
        transferId: transfer.id,
        userId,
        tx
      })
    }

    // Update transfer status
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'completed', receivedAt: new Date() }
    })

    return transfer
  })

  return result
}
```

## Important Safety Features

### 1. Database Locking (Automatic)
The library uses `FOR UPDATE` to prevent race conditions:
```sql
SELECT id, qty_available
FROM variation_location_details
WHERE product_variation_id = ${productVariationId}
  AND location_id = ${locationId}
FOR UPDATE  -- Locks the row until transaction commits
```

### 2. Stock Validation (Automatic)
After each operation, the library validates consistency:
```typescript
await validateStockConsistency(
  productVariationId,
  locationId,
  tx,
  `After ${type} operation`
)
```

This ensures the ledger balance matches physical stock.

### 3. Negative Stock Prevention
```typescript
await deductStock({
  // ...
  allowNegative: false  // Default: blocks negative stock
})
```

Set `allowNegative: true` only when business rules allow it.

### 4. Atomic Transactions
**ALWAYS** wrap stock operations in `prisma.$transaction`:
```typescript
await prisma.$transaction(async (tx) => {
  // Multiple operations here
  // All succeed or all fail together
})
```

## Querying Stock Information

### Check Current Stock
```typescript
import { getCurrentStock } from '@/lib/stockOperations'

const currentQty = await getCurrentStock({
  productVariationId: 123,
  locationId: 1,
  tx  // Optional: use within transaction
})
```

### Check Stock Availability
```typescript
import { checkStockAvailability } from '@/lib/stockOperations'

const check = await checkStockAvailability({
  productVariationId: 123,
  locationId: 1,
  quantity: 10,
  tx
})

if (!check.available) {
  console.log(`Shortage: ${check.shortage} units`)
  console.log(`Available: ${check.currentStock}`)
}
```

### Get Transaction History
```typescript
import { getStockTransactionHistory } from '@/lib/stockOperations'

const history = await getStockTransactionHistory({
  productId: 456,
  productVariationId: 123,
  locationId: 1,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  limit: 50,
  offset: 0
})

console.log(`Total transactions: ${history.total}`)
history.transactions.forEach(txn => {
  console.log(`${txn.createdAt}: ${txn.type} ${txn.quantity} (Balance: ${txn.balanceQty})`)
})
```

### Get Low Stock Products
```typescript
import { getLowStockProducts } from '@/lib/stockOperations'

const lowStock = await getLowStockProducts({
  businessId: 1,
  locationId: 1  // Optional: filter by location
})

lowStock.forEach(item => {
  console.log(`${item.product.name}: ${item.qtyAvailable} (Alert: ${item.product.alertQuantity})`)
})
```

## Best Practices

### ✅ DO:
- **Always use** `updateStock()` or helper functions (`addStock`, `deductStock`)
- **Always pass** `tx` parameter when inside a transaction
- **Always include** `businessId` for multi-tenant isolation
- **Always set** `referenceType` and `referenceId` for audit trail
- **Always use** `StockTransactionType` enum (not strings)
- **Always wrap** in `prisma.$transaction` for atomicity
- **Always provide** `unitCost` when available
- **Use** `allowNegative: false` by default

### ❌ DON'T:
- **Never** directly create `StockTransaction` records
- **Never** directly update `VariationLocationDetails.qtyAvailable`
- **Never** forget to pass `tx` when inside a transaction
- **Never** use string literals for transaction types
- **Never** skip the dual-record creation (StockTransaction + ProductHistory)
- **Never** modify existing transaction records (immutable audit trail)

## Troubleshooting

### Error: "Insufficient stock"
```typescript
// Check what's available first
const check = await checkStockAvailability({
  productVariationId: 123,
  locationId: 1,
  quantity: 10
})

if (!check.available) {
  return NextResponse.json({
    error: 'Insufficient stock',
    available: check.currentStock,
    requested: 10,
    shortage: check.shortage
  }, { status: 400 })
}
```

### Error: "Unknown argument variationId"
You're using old field names. Always use:
- `productVariationId` (NOT `variationId`)
- `qtyAvailable` (NOT `currentQty`)
- `type` (NOT `transactionType`)
- `balanceQty` (NOT `balance`)

### Validation Failed
If stock validation fails, check:
1. Are you creating both StockTransaction AND ProductHistory?
2. Are you using the correct quantity signs (+ for IN, - for OUT)?
3. Is the balance calculation correct?

## File Locations

- **Library:** `/src/lib/stockOperations.ts`
- **Validation:** `/src/lib/stockValidation.ts`
- **Schema:** `/prisma/schema.prisma` (StockTransaction, VariationLocationDetails, ProductHistory)
- **Examples:**
  - `/src/app/api/sales/route.ts`
  - `/src/app/api/purchases/receipts/[id]/approve/route.ts`
  - `/src/app/api/transfers/[id]/send/route.ts`

## Summary

This skill ensures you:
1. Use the correct field names from the actual schema
2. Create both StockTransaction AND ProductHistory records
3. Use the validated library functions instead of raw Prisma
4. Maintain data integrity with locking and validation
5. Follow the project's established patterns

**Remember:** This is the ONLY correct way to modify stock in this project!
