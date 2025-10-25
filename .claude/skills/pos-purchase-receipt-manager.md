# pos-purchase-receipt-manager

## Purpose
Manages Goods Receipt Notes (GRN) for purchase orders, integrating with quality control, stock updates, accounts payable, and supplier management. Handles both PO-based and direct receipts.

## When to Use
- Receiving goods from suppliers
- Creating GRNs (Goods Receipt Notes)
- Processing purchase order deliveries
- Direct purchases without PO
- Quality control integration
- Updating inventory from purchases

## Critical Requirements

### 1. Receipt Types
```typescript
// With Purchase Order
interface POReceipt {
  purchaseOrderId: number
  items: Array<{
    purchaseOrderItemId: number
    receivedQty: number
    acceptedQty: number  // After QC
    rejectedQty: number  // QC failed
  }>
}

// Direct Receipt (No PO)
interface DirectReceipt {
  supplierId: number
  items: Array<{
    productId: number
    variationId: number
    receivedQty: number
    unitCost: number
  }>
}
```

### 2. Quality Control Integration
```typescript
enum QCStatus {
  pending      // Awaiting QC inspection
  passed       // All items passed
  partial      // Some items failed
  failed       // All items failed
}

// Only accepted items add to stock
// Rejected items trigger supplier return
```

### 3. Stock Update Timing
**Stock is added ONLY when:**
- GRN status = 'approved'
- QC status = 'passed' or 'partial'
- Only accepted quantities are added

### 4. Main Warehouse Restriction
**Per CLAUDE.md:** Only the Main Warehouse processes purchase orders.

```typescript
// Verify location is main warehouse
const location = await prisma.businessLocation.findUnique({
  where: { id: locationId }
})

if (!location.isMainWarehouse) {
  throw new Error('Only main warehouse can process purchases')
}
```

## Implementation Pattern

### API Route: Create GRN

```typescript
// /src/app/api/purchase-receipts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_CREATE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    purchaseOrderId,
    supplierId,
    locationId,
    items,
    invoiceNumber,
    invoiceDate,
    notes
  } = body

  // Validation
  if (!locationId || !items || items.length === 0) {
    return NextResponse.json({
      error: 'Missing required fields'
    }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify location is main warehouse
      const location = await tx.businessLocation.findUnique({
        where: { id: locationId },
        select: { id: true, name: true, businessId: true, isMainWarehouse: true }
      })

      if (!location) {
        throw new Error('Location not found')
      }

      if (location.businessId !== user.businessId) {
        throw new Error('Location does not belong to your business')
      }

      if (!location.isMainWarehouse) {
        throw new Error('Only main warehouse can process purchase receipts')
      }

      // If PO-based, verify PO exists
      let purchaseOrder = null
      if (purchaseOrderId) {
        purchaseOrder = await tx.purchase.findUnique({
          where: { id: purchaseOrderId },
          include: { items: true }
        })

        if (!purchaseOrder || purchaseOrder.businessId !== user.businessId) {
          throw new Error('Invalid purchase order')
        }
      }

      // Verify supplier
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId || purchaseOrder?.supplierId },
        select: { id: true, name: true, businessId: true }
      })

      if (!supplier || supplier.businessId !== user.businessId) {
        throw new Error('Invalid supplier')
      }

      // Generate GRN number
      const grnNumber = await generateGRNNumber(tx, user.businessId)

      // Create receipt
      const receipt = await tx.purchaseReceipt.create({
        data: {
          businessId: user.businessId,
          grnNumber,
          purchaseOrderId: purchaseOrderId || null,
          supplierId: supplier.id,
          locationId,
          invoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
          notes,
          status: 'pending',  // Awaiting QC/approval
          receivedBy: user.id,
          receivedAt: new Date()
        }
      })

      // Create receipt items
      const receiptItems = []
      for (const item of items) {
        // Verify product
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, sku: true, businessId: true }
        })

        if (!product || product.businessId !== user.businessId) {
          throw new Error(`Invalid product: ${item.productId}`)
        }

        const receiptItem = await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            productId: item.productId,
            variationId: item.variationId,
            purchaseOrderItemId: item.purchaseOrderItemId || null,
            orderedQty: item.orderedQty || 0,
            receivedQty: item.receivedQty,
            acceptedQty: item.receivedQty,  // Initially same as received
            rejectedQty: 0,
            unitCost: item.unitCost,
            notes: item.notes
          }
        })

        receiptItems.push(receiptItem)
      }

      // Create QC inspection if required
      const requiresQC = await shouldRequireQC(tx, user.businessId)
      if (requiresQC) {
        await tx.qualityControlInspection.create({
          data: {
            businessId: user.businessId,
            receiptId: receipt.id,
            status: 'pending',
            scheduledDate: new Date(),
            createdBy: user.id
          }
        })
      }

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'PURCHASE_RECEIPT_CREATE',
        entityType: 'PURCHASE_RECEIPT',
        entityIds: [receipt.id.toString()],
        description: `Created GRN #${grnNumber} from ${supplier.name}`,
        metadata: {
          receiptId: receipt.id,
          grnNumber,
          supplierId: supplier.id,
          supplierName: supplier.name,
          locationId,
          locationName: location.name,
          purchaseOrderId,
          invoiceNumber,
          itemCount: receiptItems.length,
          totalQuantity: receiptItems.reduce((sum, item) => sum + item.receivedQty, 0),
          totalValue: receiptItems.reduce((sum, item) => sum + (item.receivedQty * parseFloat(item.unitCost.toString())), 0),
          requiresQC
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return { receipt, items: receiptItems }
    })

    return NextResponse.json({
      success: true,
      receipt: result.receipt,
      items: result.items,
      message: `GRN #${result.receipt.grnNumber} created successfully`
    })

  } catch (error: any) {
    console.error('GRN creation error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to create GRN'
    }, { status: 500 })
  }
}

// Helper: Generate GRN number
async function generateGRNNumber(tx: any, businessId: number): Promise<string> {
  const year = new Date().getFullYear()
  const count = await tx.purchaseReceipt.count({
    where: {
      businessId,
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`)
      }
    }
  })

  return `GRN-${year}-${String(count + 1).padStart(6, '0')}`
}

// Helper: Check if QC required
async function shouldRequireQC(tx: any, businessId: number): Promise<boolean> {
  const settings = await tx.businessSettings.findUnique({
    where: { businessId },
    select: { requireQCOnPurchase: true }
  })

  return settings?.requireQCOnPurchase || false
}
```

### API Route: Approve GRN (Add Stock)

```typescript
// /src/app/api/purchase-receipts/[id]/approve/route.ts
import { updateStock } from '@/lib/stockOperations'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_APPROVE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const receiptId = parseInt(params.id)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.findUnique({
        where: { id: receiptId },
        include: {
          items: {
            include: {
              product: true,
              variation: true
            }
          },
          location: true,
          supplier: true,
          qcInspection: true
        }
      })

      if (!receipt) {
        throw new Error('Receipt not found')
      }

      if (receipt.businessId !== user.businessId) {
        throw new Error('Access denied')
      }

      if (receipt.status !== 'pending') {
        throw new Error(`Receipt already ${receipt.status}`)
      }

      // If QC required, check it's passed
      if (receipt.qcInspection) {
        if (receipt.qcInspection.status !== 'passed' && receipt.qcInspection.status !== 'partial') {
          throw new Error('Cannot approve: QC inspection not passed')
        }
      }

      // Add stock for each item (only accepted quantities)
      for (const item of receipt.items) {
        if (item.acceptedQty > 0) {
          await updateStock({
            businessId: user.businessId,
            productId: item.productId,
            variationId: item.variationId,
            locationId: receipt.locationId,
            quantity: item.acceptedQty,  // POSITIVE for IN
            transactionType: 'purchase',
            unitCost: parseFloat(item.unitCost.toString()),
            userId: user.id,
            referenceType: 'PurchaseReceipt',
            referenceId: receipt.id.toString(),
            notes: `GRN #${receipt.grnNumber} from ${receipt.supplier.name}`,
            validateStock: false  // No validation needed for IN
          }, tx)
        }
      }

      // Update receipt status
      const updated = await tx.purchaseReceipt.update({
        where: { id: receiptId },
        data: {
          status: 'approved',
          approvedBy: user.id,
          approvedAt: new Date()
        },
        include: {
          items: true,
          location: true,
          supplier: true
        }
      })

      // Calculate totals
      const totalReceived = receipt.items.reduce((sum, item) => sum + item.receivedQty, 0)
      const totalAccepted = receipt.items.reduce((sum, item) => sum + item.acceptedQty, 0)
      const totalRejected = receipt.items.reduce((sum, item) => sum + item.rejectedQty, 0)
      const totalValue = receipt.items.reduce((sum, item) =>
        sum + (item.acceptedQty * parseFloat(item.unitCost.toString())), 0
      )

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'PURCHASE_RECEIPT_APPROVE',
        entityType: 'PURCHASE_RECEIPT',
        entityIds: [receiptId.toString()],
        description: `Approved GRN #${receipt.grnNumber} and added stock`,
        metadata: {
          receiptId: receipt.id,
          grnNumber: receipt.grnNumber,
          supplierId: receipt.supplierId,
          supplierName: receipt.supplier.name,
          locationId: receipt.locationId,
          locationName: receipt.location.name,
          itemCount: receipt.items.length,
          totalReceived,
          totalAccepted,
          totalRejected,
          totalValue,
          qcStatus: receipt.qcInspection?.status,
          approvedBy: user.username,
          approvedAt: new Date().toISOString()
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
        requiresPassword: true
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      receipt: result,
      message: 'GRN approved and stock added'
    })

  } catch (error: any) {
    console.error('Approval error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to approve GRN'
    }, { status: 500 })
  }
}
```

## Quality Control Integration

```typescript
// After QC inspection, update accepted/rejected quantities
async function processQCResults(receiptId: number, qcResults: any[]) {
  await prisma.$transaction(async (tx) => {
    for (const result of qcResults) {
      await tx.purchaseReceiptItem.update({
        where: { id: result.itemId },
        data: {
          acceptedQty: result.passedQty,
          rejectedQty: result.failedQty,
          qcNotes: result.notes
        }
      })
    }

    // Update QC inspection status
    const allPassed = qcResults.every(r => r.failedQty === 0)
    const allFailed = qcResults.every(r => r.passedQty === 0)

    await tx.qualityControlInspection.update({
      where: { receiptId },
      data: {
        status: allPassed ? 'passed' : allFailed ? 'failed' : 'partial',
        inspectedAt: new Date()
      }
    })
  })
}
```

## PO vs Direct Receipt Comparison

### With Purchase Order
```typescript
// Items linked to PO items
// Received qty compared to ordered qty
// PO status updated based on received quantities
// Partial receipts supported (multiple GRNs per PO)
```

### Direct Receipt
```typescript
// No PO linkage
// Items created fresh
// Unit costs entered manually
// Faster for ad-hoc purchases
```

## Best Practices

### ✅ DO:
- **Enforce main warehouse restriction** for purchases
- **Integrate with QC** before adding stock
- **Add only accepted quantities** to stock
- **Handle rejected items** (trigger supplier return)
- **Support partial receipts** for large POs
- **Verify unit costs** match PO or market rates
- **Create comprehensive audit logs**
- **Link to accounts payable** for payment tracking
- **Generate GRN numbers** automatically

### ❌ DON'T:
- **Don't add stock before approval**
- **Don't skip QC** when required by settings
- **Don't allow non-warehouse locations** to process purchases
- **Don't ignore rejected items** from QC
- **Don't forget to update PO status** (partial/complete)
- **Don't skip supplier verification**

## Rejected Items Handling

```typescript
// Create supplier return for rejected items
async function createReturnForRejectedItems(receiptId: number) {
  const rejectedItems = await prisma.purchaseReceiptItem.findMany({
    where: {
      receiptId,
      rejectedQty: { gt: 0 }
    },
    include: { product: true }
  })

  if (rejectedItems.length === 0) return

  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id: receiptId },
    include: { supplier: true }
  })

  // Create supplier return
  await prisma.purchaseReturn.create({
    data: {
      businessId: receipt.businessId,
      supplierId: receipt.supplierId,
      receiptId: receipt.id,
      reason: 'quality_issue',
      status: 'pending',
      items: {
        create: rejectedItems.map(item => ({
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.rejectedQty,
          unitCost: item.unitCost,
          reason: 'Failed QC inspection'
        }))
      }
    }
  })
}
```

## Related Skills
- `pos-stock-operation-enforcer` - Adds stock on approval
- `pos-inventory-transaction-logger` - Logs purchase transactions
- `pos-quality-control-workflow` - QC inspection process
- `pos-purchase-return-processor` - Handles rejected items
- `pos-audit-trail-architect` - Creates approval audits

## References
- Schema: `/prisma/schema.prisma` lines 1183-1227 (PurchaseReceipt)
- Schema: `/prisma/schema.prisma` lines 1267-1377 (QualityControl)
- RBAC: `/src/lib/rbac.ts` (PURCHASE_RECEIPT_* permissions)
- CLAUDE.md: Main warehouse restriction
