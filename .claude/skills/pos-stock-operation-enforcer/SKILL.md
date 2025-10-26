---
name: pos-stock-operation-enforcer
description: Enforces atomic stock operations with validation, transaction safety, and business rule compliance. 
---

# pos-stock-operation-enforcer

## Purpose
Enforces atomic stock operations with validation, transaction safety, and business rule compliance. Ensures all inventory movements are properly validated, logged, and executed within database transactions.

## When to Use
- **Before any stock quantity change** in VariationLocationDetails
- Implementing sales, purchases, transfers, returns, or adjustments
- Validating stock availability before deductions
- Ensuring atomic updates (stock + transaction log together)

## Critical Requirements

### 1. Atomic Operations
**MUST** use Prisma transactions for ACID compliance:
```typescript
// ✅ CORRECT: Atomic transaction
await prisma.$transaction(async (tx) => {
  await updateStock(params, tx)
  await createAuditLog(...)
  await updateSourceDocument(...)
  // All succeed together or all fail together
})

// ❌ WRONG: Non-atomic operations
await updateStock(params)        // Could succeed
await createAuditLog(...)        // Could fail - now data is inconsistent!
```

### 2. Stock Validation
Validate before executing OUT transactions:
```typescript
enum StockValidationMode {
  STRICT    // Reject if insufficient stock
  WARNING   // Allow but log warning
  DISABLED  // Skip validation (use carefully!)
}
```

### 3. Multi-Tenant Enforcement
**ALWAYS** validate that:
- Product belongs to user's business
- Location belongs to user's business
- User has access to the location

## Implementation Pattern

### Core Stock Update Function

```typescript
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface UpdateStockParams {
  businessId: number
  productId: number
  variationId: number
  locationId: number
  quantity: number           // Signed: positive IN, negative OUT
  transactionType: string
  unitCost?: number
  userId: number
  referenceType?: string
  referenceId?: string
  notes?: string
  validateStock?: boolean    // Default: true for OUT transactions
  allowNegative?: boolean    // Default: false
}

interface UpdateStockResult {
  success: boolean
  previousBalance: number
  newBalance: number
  stockTransaction: StockTransaction
  warning?: string
}

async function updateStock(
  params: UpdateStockParams,
  tx: Prisma.TransactionClient
): Promise<UpdateStockResult> {

  // 1. VALIDATION: Get current stock and verify tenant ownership
  const stockRecord = await tx.variationLocationDetails.findUnique({
    where: {
      variationId_locationId: {
        variationId: params.variationId,
        locationId: params.locationId
      }
    },
    include: {
      variation: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              businessId: true
            }
          }
        }
      },
      location: {
        select: {
          id: true,
          name: true,
          businessId: true
        }
      }
    }
  })

  // Validate multi-tenant isolation
  if (stockRecord) {
    if (stockRecord.variation.product.businessId !== params.businessId) {
      throw new Error(`Multi-tenant violation: Product ${params.productId} does not belong to business ${params.businessId}`)
    }
    if (stockRecord.location.businessId !== params.businessId) {
      throw new Error(`Multi-tenant violation: Location ${params.locationId} does not belong to business ${params.businessId}`)
    }
  }

  const currentQty = stockRecord?.currentQty || 0
  const newQty = currentQty + params.quantity
  let warning: string | undefined

  // 2. VALIDATION: Check stock availability for OUT transactions
  if (params.quantity < 0) {  // OUT transaction
    const requiredQty = Math.abs(params.quantity)

    if (currentQty < requiredQty) {
      const validateStock = params.validateStock ?? true
      const allowNegative = params.allowNegative ?? false

      if (validateStock && !allowNegative) {
        throw new Error(
          `Insufficient stock for ${stockRecord?.variation?.product?.name || 'product'} at ${stockRecord?.location?.name || 'location'}. ` +
          `Available: ${currentQty}, Required: ${requiredQty}, Shortage: ${requiredQty - currentQty}`
        )
      } else {
        warning = `Negative stock warning: ${currentQty} - ${requiredQty} = ${newQty}`
      }
    }
  }

  // 3. VALIDATION: Prevent negative stock (unless explicitly allowed)
  if (newQty < 0 && !(params.allowNegative ?? false)) {
    throw new Error(
      `Operation would result in negative stock (${newQty}). ` +
      `Current: ${currentQty}, Change: ${params.quantity}`
    )
  }

  // 4. CREATE TRANSACTION LOG (immutable audit trail)
  const stockTransaction = await tx.stockTransaction.create({
    data: {
      businessId: params.businessId,
      productId: params.productId,
      variationId: params.variationId,
      locationId: params.locationId,
      transactionType: params.transactionType,
      quantity: params.quantity,
      unitCost: params.unitCost || 0,
      balance: newQty,
      userId: params.userId,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      notes: params.notes,
      createdAt: new Date()
    }
  })

  // 5. UPDATE STOCK LEVEL (atomic with transaction)
  await tx.variationLocationDetails.upsert({
    where: {
      variationId_locationId: {
        variationId: params.variationId,
        locationId: params.locationId
      }
    },
    update: {
      currentQty: newQty,
      updatedAt: new Date()
    },
    create: {
      variationId: params.variationId,
      locationId: params.locationId,
      currentQty: newQty,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  return {
    success: true,
    previousBalance: currentQty,
    newBalance: newQty,
    stockTransaction,
    warning
  }
}

export { updateStock, type UpdateStockParams, type UpdateStockResult }
```

### Stock Availability Check

```typescript
interface CheckStockParams {
  businessId: number
  variationId: number
  locationId: number
  requiredQuantity: number
}

interface StockCheckResult {
  available: boolean
  currentStock: number
  requiredStock: number
  shortage: number
  canFulfill: boolean
}

async function checkStockAvailability(
  params: CheckStockParams,
  tx?: Prisma.TransactionClient
): Promise<StockCheckResult> {

  const db = tx || prisma

  const stockRecord = await db.variationLocationDetails.findUnique({
    where: {
      variationId_locationId: {
        variationId: params.variationId,
        locationId: params.locationId
      }
    },
    include: {
      variation: {
        include: {
          product: { select: { businessId: true } }
        }
      }
    }
  })

  // Validate tenant isolation
  if (stockRecord?.variation?.product?.businessId !== params.businessId) {
    throw new Error('Multi-tenant violation in stock check')
  }

  const currentStock = stockRecord?.currentQty || 0
  const shortage = Math.max(0, params.requiredQuantity - currentStock)

  return {
    available: currentStock >= params.requiredQuantity,
    currentStock,
    requiredStock: params.requiredQuantity,
    shortage,
    canFulfill: shortage === 0
  }
}

export { checkStockAvailability }
```

## Usage Examples

### Example 1: Sale Transaction (Stock OUT)

```typescript
// API: /api/sales/route.ts
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { locationId, items } = body

  try {
    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create sale record
      const sale = await tx.sale.create({
        data: {
          businessId: session.user.businessId,
          locationId,
          userId: session.user.id,
          invoiceNumber: await generateInvoiceNumber(tx),
          totalAmount: calculateTotal(items),
          status: 'completed'
        }
      })

      // 2. Process each item with stock validation
      for (const item of items) {
        // Check stock availability first
        const stockCheck = await checkStockAvailability({
          businessId: session.user.businessId,
          variationId: item.variationId,
          locationId,
          requiredQuantity: item.quantity
        }, tx)

        if (!stockCheck.available) {
          throw new Error(
            `Insufficient stock for product ${item.productName}: ` +
            `Available ${stockCheck.currentStock}, Required ${item.quantity}`
          )
        }

        // Deduct stock
        await updateStock({
          businessId: session.user.businessId,
          productId: item.productId,
          variationId: item.variationId,
          locationId,
          quantity: -item.quantity,  // NEGATIVE for OUT
          transactionType: 'sale',
          unitCost: item.costPrice,
          userId: session.user.id,
          referenceType: 'Sale',
          referenceId: sale.id.toString(),
          notes: `Sale Invoice #${sale.invoiceNumber}`,
          validateStock: true  // Enforce validation
        }, tx)

        // Create sale item
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            variationId: item.variationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice
          }
        })
      }

      // 3. Create audit log
      await createAuditLog({
        businessId: session.user.businessId,
        userId: session.user.id,
        username: session.user.username,
        action: 'SALE_CREATE',
        entityType: 'SALE',
        entityIds: [sale.id.toString()],
        description: `Created sale #${sale.invoiceNumber} with ${items.length} items`,
        metadata: {
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          totalAmount: sale.totalAmount,
          itemCount: items.length
        }
      })

      return sale
    })

    return NextResponse.json({ success: true, sale: result })
  } catch (error: any) {
    console.error('Sale creation error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to create sale'
    }, { status: 500 })
  }
}
```

### Example 2: Purchase Receipt (Stock IN)

```typescript
// API: /api/purchase-receipts/route.ts
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const body = await request.json()

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create GRN
      const receipt = await tx.purchaseReceipt.create({
        data: {
          businessId: session.user.businessId,
          locationId: body.locationId,
          supplierId: body.supplierId,
          grnNumber: await generateGRNNumber(tx),
          status: 'pending'
        }
      })

      // Add stock for each item
      for (const item of body.items) {
        await updateStock({
          businessId: session.user.businessId,
          productId: item.productId,
          variationId: item.variationId,
          locationId: body.locationId,
          quantity: item.receivedQty,  // POSITIVE for IN
          transactionType: 'purchase',
          unitCost: item.unitCost,
          userId: session.user.id,
          referenceType: 'PurchaseReceipt',
          referenceId: receipt.id.toString(),
          notes: `GRN #${receipt.grnNumber}`,
          validateStock: false  // No validation needed for IN
        }, tx)

        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            productId: item.productId,
            variationId: item.variationId,
            receivedQty: item.receivedQty,
            unitCost: item.unitCost
          }
        })
      }

      return receipt
    })

    return NextResponse.json({ success: true, receipt: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### Example 3: Stock Transfer (2-step operation)

```typescript
// When transfer status changes to "in_transit", deduct from source
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { transferId, newStatus } = body

  if (newStatus === 'in_transit') {
    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { items: true }
      })

      // Deduct from source location
      for (const item of transfer.items) {
        await updateStock({
          businessId: transfer.businessId,
          productId: item.productId,
          variationId: item.variationId,
          locationId: transfer.fromLocationId,
          quantity: -item.quantitySent,  // NEGATIVE
          transactionType: 'transfer_out',
          unitCost: item.costPrice,
          userId: session.user.id,
          referenceType: 'StockTransfer',
          referenceId: transfer.id.toString(),
          validateStock: true  // Ensure stock available
        }, tx)
      }

      await tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'in_transit', sentAt: new Date() }
      })
    })
  }

  // When transfer status changes to "completed", add to destination
  if (newStatus === 'completed') {
    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: { items: true }
      })

      // Add to destination location
      for (const item of transfer.items) {
        await updateStock({
          businessId: transfer.businessId,
          productId: item.productId,
          variationId: item.variationId,
          locationId: transfer.toLocationId,
          quantity: item.quantityReceived,  // POSITIVE
          transactionType: 'transfer_in',
          unitCost: item.costPrice,
          userId: session.user.id,
          referenceType: 'StockTransfer',
          referenceId: transfer.id.toString(),
          validateStock: false
        }, tx)
      }

      await tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'completed', completedAt: new Date() }
      })
    })
  }
}
```

## Best Practices

### ✅ DO:
- **Always use Prisma transactions** for stock operations
- **Always validate tenant isolation** before stock updates
- **Always check stock availability** for OUT transactions
- **Always create StockTransaction** with every stock change
- **Always use signed quantities** (positive IN, negative OUT)
- **Handle errors gracefully** and rollback on failure
- **Log warnings** for negative stock when allowed

### ❌ DON'T:
- **Never update stock outside a transaction**
- **Never skip stock validation** for sales/transfers
- **Never allow negative stock** without explicit business approval
- **Never forget businessId** in queries
- **Never trust client-provided quantities** without validation
- **Never update VariationLocationDetails directly** (use updateStock)

## Error Handling

```typescript
try {
  await prisma.$transaction(async (tx) => {
    await updateStock(params, tx)
  })
} catch (error: any) {
  if (error.message.includes('Insufficient stock')) {
    return NextResponse.json({
      error: 'Stock not available',
      details: error.message
    }, { status: 400 })
  }

  if (error.message.includes('Multi-tenant violation')) {
    return NextResponse.json({
      error: 'Access denied'
    }, { status: 403 })
  }

  // Generic error
  console.error('Stock operation failed:', error)
  return NextResponse.json({
    error: 'Stock operation failed'
  }, { status: 500 })
}
```

## Related Skills
- `pos-inventory-transaction-logger` - Creates immutable transaction logs
- `pos-multi-tenant-guardian` - Enforces tenant isolation
- `pos-negative-stock-blocker` - Prevents overselling
- `pos-stock-reconciliation-detective` - Detects variances

## References
- Library: `/src/lib/stockOperations.ts` (existing updateStock implementation)
- Schema: `/prisma/schema.prisma` lines 737-764 (VariationLocationDetails)
- Example: `/src/app/api/inventory-corrections/[id]/approve/route.ts` lines 85-131
