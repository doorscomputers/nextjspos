---
name: pos-stock-transfer-orchestrator
description: Manages the complete 8-stage stock transfer workflow between business locations, ensuring proper aut
---

# pos-stock-transfer-orchestrator

## Purpose
Manages the complete 8-stage stock transfer workflow between business locations, ensuring proper authorization, stock deduction, in-transit tracking, verification, and completion with full audit trail.

## When to Use
- Transferring inventory between branches/warehouses
- Inter-location stock movements
- Store replenishment from warehouse
- Consolidating inventory
- Balancing stock across locations

## Critical Requirements

### 1. 8-Stage Transfer Workflow

```typescript
enum TransferStatus {
  draft           // Initial creation, can be edited
  pending_check   // Submitted for checking
  checked         // Verified by checker, ready to send
  in_transit      // Stock deducted from source, in transit
  arrived         // Arrived at destination, pending verification
  verifying       // Being verified at destination
  verified        // Verified, ready to complete
  completed       // Stock added to destination
  cancelled       // Cancelled before completion
}
```

### 2. Stock Deduction Timing
**CRITICAL:** Stock is deducted from source location when status changes to `in_transit`, NOT at creation!

```typescript
// draft → pending_check → checked → IN_TRANSIT (DEDUCT HERE)
// → arrived → verifying → verified → COMPLETED (ADD HERE)
```

### 3. Discrepancy Handling
Track differences between sent and received quantities:

```typescript
interface TransferItem {
  quantitySent: number      // What was sent from source
  quantityReceived: number  // What was received at destination
  discrepancyQty: number    // Difference (sent - received)
  discrepancyReason: string // Damaged, lost, shortage, etc.
}
```

### 4. Separation of Duties
Different users should handle different stages:
- **Creator:** Initiates transfer
- **Checker:** Verifies before sending
- **Sender:** Confirms dispatch
- **Receiver:** Confirms arrival
- **Verifier:** Verifies received quantities
- **Completer:** Finalizes transfer

## Implementation Pattern

### API Route: Create Transfer

```typescript
// /src/app/api/stock-transfers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasAccessToLocation } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_CREATE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { fromLocationId, toLocationId, items, notes, requestedDeliveryDate } = body

  // Validation
  if (!fromLocationId || !toLocationId || !items || items.length === 0) {
    return NextResponse.json({
      error: 'Missing required fields'
    }, { status: 400 })
  }

  if (fromLocationId === toLocationId) {
    return NextResponse.json({
      error: 'Source and destination cannot be the same'
    }, { status: 400 })
  }

  // Location access check
  if (!hasAccessToLocation(user, fromLocationId)) {
    return NextResponse.json({
      error: 'Access denied: No access to source location'
    }, { status: 403 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify locations belong to business
      const [fromLocation, toLocation] = await Promise.all([
        tx.businessLocation.findUnique({
          where: { id: fromLocationId },
          select: { id: true, name: true, businessId: true }
        }),
        tx.businessLocation.findUnique({
          where: { id: toLocationId },
          select: { id: true, name: true, businessId: true }
        })
      ])

      if (!fromLocation || fromLocation.businessId !== user.businessId) {
        throw new Error('Invalid source location')
      }

      if (!toLocation || toLocation.businessId !== user.businessId) {
        throw new Error('Invalid destination location')
      }

      // Generate transfer number
      const transferNumber = await generateTransferNumber(tx, user.businessId)

      // Create transfer
      const transfer = await tx.stockTransfer.create({
        data: {
          businessId: user.businessId,
          transferNumber,
          fromLocationId,
          toLocationId,
          status: 'draft',
          notes,
          requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : null,
          createdBy: user.id,
          createdAt: new Date()
        }
      })

      // Create transfer items
      const transferItems = []
      for (const item of items) {
        // Verify product belongs to business
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, sku: true, businessId: true }
        })

        if (!product || product.businessId !== user.businessId) {
          throw new Error(`Invalid product: ${item.productId}`)
        }

        // Check stock availability at source
        const stockRecord = await tx.variationLocationDetails.findUnique({
          where: {
            variationId_locationId: {
              variationId: item.variationId,
              locationId: fromLocationId
            }
          }
        })

        const availableQty = stockRecord?.currentQty || 0
        if (availableQty < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name} at source location. ` +
            `Available: ${availableQty}, Requested: ${item.quantity}`
          )
        }

        const transferItem = await tx.stockTransferItem.create({
          data: {
            transferId: transfer.id,
            productId: item.productId,
            variationId: item.variationId,
            quantitySent: item.quantity,
            quantityReceived: 0,  // Will be updated on receipt
            costPrice: item.costPrice || 0,
            notes: item.notes
          }
        })

        transferItems.push(transferItem)
      }

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'STOCK_TRANSFER_CREATE',
        entityType: 'STOCK_TRANSFER',
        entityIds: [transfer.id.toString()],
        description: `Created stock transfer #${transfer.transferNumber} from ${fromLocation.name} to ${toLocation.name}`,
        metadata: {
          transferId: transfer.id,
          transferNumber: transfer.transferNumber,
          fromLocationId,
          fromLocationName: fromLocation.name,
          toLocationId,
          toLocationName: toLocation.name,
          itemCount: transferItems.length,
          totalQuantity: transferItems.reduce((sum, item) => sum + item.quantitySent, 0),
          status: 'draft'
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return { transfer, items: transferItems }
    })

    return NextResponse.json({
      success: true,
      transfer: result.transfer,
      items: result.items,
      message: 'Transfer created successfully'
    })

  } catch (error: any) {
    console.error('Transfer creation error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to create transfer'
    }, { status: 500 })
  }
}

// Helper: Generate transfer number
async function generateTransferNumber(
  tx: any,
  businessId: number
): Promise<string> {
  const year = new Date().getFullYear()
  const count = await tx.stockTransfer.count({
    where: {
      businessId,
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`)
      }
    }
  })

  return `ST-${year}-${String(count + 1).padStart(6, '0')}`
}
```

### API Route: Send Transfer (Deduct Stock)

```typescript
// /src/app/api/stock-transfers/[id]/send/route.ts
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

  if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_SEND)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const transferId = parseInt(params.id)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: {
          fromLocation: true,
          toLocation: true,
          items: {
            include: {
              product: true,
              variation: true
            }
          }
        }
      })

      if (!transfer) {
        throw new Error('Transfer not found')
      }

      if (transfer.businessId !== user.businessId) {
        throw new Error('Access denied')
      }

      // Verify status allows sending
      if (transfer.status !== 'checked') {
        throw new Error(`Cannot send transfer with status: ${transfer.status}`)
      }

      // Deduct stock from source location
      for (const item of transfer.items) {
        await updateStock({
          businessId: user.businessId,
          productId: item.productId,
          variationId: item.variationId,
          locationId: transfer.fromLocationId,
          quantity: -item.quantitySent,  // NEGATIVE for OUT
          transactionType: 'transfer_out',
          unitCost: item.costPrice,
          userId: user.id,
          referenceType: 'StockTransfer',
          referenceId: transfer.id.toString(),
          notes: `Transfer to ${transfer.toLocation.name}`,
          validateStock: true  // Ensure stock available
        }, tx)
      }

      // Update transfer status
      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'in_transit',
          sentBy: user.id,
          sentAt: new Date()
        },
        include: {
          fromLocation: true,
          toLocation: true,
          items: true
        }
      })

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'STOCK_TRANSFER_SEND',
        entityType: 'STOCK_TRANSFER',
        entityIds: [transferId.toString()],
        description: `Sent transfer #${transfer.transferNumber} (stock deducted from ${transfer.fromLocation.name})`,
        metadata: {
          transferId: transfer.id,
          transferNumber: transfer.transferNumber,
          fromLocationId: transfer.fromLocationId,
          fromLocationName: transfer.fromLocation.name,
          toLocationId: transfer.toLocationId,
          toLocationName: transfer.toLocation.name,
          itemCount: transfer.items.length,
          totalQuantity: transfer.items.reduce((sum, item) => sum + item.quantitySent, 0),
          totalValue: transfer.items.reduce((sum, item) => sum + (item.quantitySent * item.costPrice), 0),
          sentBy: user.username,
          sentAt: new Date().toISOString()
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      transfer: result,
      message: 'Transfer sent and stock deducted from source'
    })

  } catch (error: any) {
    console.error('Send transfer error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to send transfer'
    }, { status: 500 })
  }
}
```

### API Route: Complete Transfer (Add Stock to Destination)

```typescript
// /src/app/api/stock-transfers/[id]/complete/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_COMPLETE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const transferId = parseInt(params.id)
  const body = await request.json()
  const { receivedItems } = body  // Array of { itemId, quantityReceived, discrepancyReason }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: {
          fromLocation: true,
          toLocation: true,
          items: {
            include: {
              product: true,
              variation: true
            }
          }
        }
      })

      if (!transfer) {
        throw new Error('Transfer not found')
      }

      if (transfer.businessId !== user.businessId) {
        throw new Error('Access denied')
      }

      if (transfer.status !== 'verified') {
        throw new Error(`Cannot complete transfer with status: ${transfer.status}`)
      }

      // Process each item
      for (const receivedItem of receivedItems) {
        const transferItem = transfer.items.find(item => item.id === receivedItem.itemId)
        if (!transferItem) {
          throw new Error(`Transfer item not found: ${receivedItem.itemId}`)
        }

        // Update received quantity
        await tx.stockTransferItem.update({
          where: { id: receivedItem.itemId },
          data: {
            quantityReceived: receivedItem.quantityReceived,
            discrepancyQty: transferItem.quantitySent - receivedItem.quantityReceived,
            discrepancyReason: receivedItem.discrepancyReason,
            verifiedBy: user.id,
            verifiedAt: new Date()
          }
        })

        // Add stock to destination location
        await updateStock({
          businessId: user.businessId,
          productId: transferItem.productId,
          variationId: transferItem.variationId,
          locationId: transfer.toLocationId,
          quantity: receivedItem.quantityReceived,  // POSITIVE for IN
          transactionType: 'transfer_in',
          unitCost: transferItem.costPrice,
          userId: user.id,
          referenceType: 'StockTransfer',
          referenceId: transfer.id.toString(),
          notes: `Transfer from ${transfer.fromLocation.name}`,
          validateStock: false  // No validation needed for IN
        }, tx)

        // If discrepancy exists, log it
        const discrepancy = transferItem.quantitySent - receivedItem.quantityReceived
        if (discrepancy !== 0) {
          // Could create a separate discrepancy record or adjustment
          console.warn(`Transfer discrepancy: Item ${transferItem.id}, Sent: ${transferItem.quantitySent}, Received: ${receivedItem.quantityReceived}`)
        }
      }

      // Update transfer status
      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          completedBy: user.id,
          completedAt: new Date()
        },
        include: {
          fromLocation: true,
          toLocation: true,
          items: true
        }
      })

      // Calculate total discrepancies
      const totalSent = transfer.items.reduce((sum, item) => sum + item.quantitySent, 0)
      const totalReceived = receivedItems.reduce((sum, item) => sum + item.quantityReceived, 0)
      const totalDiscrepancy = totalSent - totalReceived

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'STOCK_TRANSFER_COMPLETE',
        entityType: 'STOCK_TRANSFER',
        entityIds: [transferId.toString()],
        description: `Completed transfer #${transfer.transferNumber} (stock added to ${transfer.toLocation.name})`,
        metadata: {
          transferId: transfer.id,
          transferNumber: transfer.transferNumber,
          fromLocationId: transfer.fromLocationId,
          fromLocationName: transfer.fromLocation.name,
          toLocationId: transfer.toLocationId,
          toLocationName: transfer.toLocation.name,
          totalSent: totalSent,
          totalReceived: totalReceived,
          totalDiscrepancy: totalDiscrepancy,
          hasDiscrepancy: totalDiscrepancy !== 0,
          itemDetails: receivedItems.map((ri: any) => {
            const item = transfer.items.find(i => i.id === ri.itemId)
            return {
              productName: item?.product.name,
              quantitySent: item?.quantitySent,
              quantityReceived: ri.quantityReceived,
              discrepancy: (item?.quantitySent || 0) - ri.quantityReceived,
              discrepancyReason: ri.discrepancyReason
            }
          }),
          completedBy: user.username,
          completedAt: new Date().toISOString()
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      transfer: result,
      message: 'Transfer completed and stock added to destination'
    })

  } catch (error: any) {
    console.error('Complete transfer error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to complete transfer'
    }, { status: 500 })
  }
}
```

## Workflow Stages Implementation

```typescript
// Stage transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_check', 'cancelled'],
  pending_check: ['checked', 'draft', 'cancelled'],
  checked: ['in_transit', 'pending_check', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['verifying', 'in_transit'],
  verifying: ['verified', 'arrived'],
  verified: ['completed', 'verifying'],
  completed: [],  // Terminal state
  cancelled: []   // Terminal state
}

function canTransition(currentStatus: string, newStatus: string): boolean {
  return ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus) || false
}
```

## Best Practices

### ✅ DO:
- **Deduct stock only when in_transit** - not at creation
- **Add stock only when completed** - after verification
- **Track discrepancies** between sent and received
- **Use atomic transactions** for stock operations
- **Implement separation of duties** (different users for stages)
- **Validate stock availability** before sending
- **Create comprehensive audit logs** for each stage
- **Allow cancellation** only before in_transit
- **Support serial number tracking** in items

### ❌ DON'T:
- **Don't deduct stock at creation** - only at in_transit
- **Don't skip verification stage** - important for accuracy
- **Don't allow same user** to create and verify
- **Don't ignore discrepancies** - investigate all variances
- **Don't allow status jumps** - enforce workflow order
- **Don't forget location access control**

## Discrepancy Management

```typescript
// Report transfers with discrepancies
const transfersWithDiscrepancies = await prisma.stockTransfer.findMany({
  where: {
    businessId: user.businessId,
    status: 'completed',
    items: {
      some: {
        discrepancyQty: { not: 0 }
      }
    }
  },
  include: {
    items: {
      where: { discrepancyQty: { not: 0 } },
      include: { product: true }
    }
  }
})
```

## Serial Number Integration

```typescript
// Track serial numbers in transfer items
interface StockTransferItem {
  // ... other fields
  serialNumbersSent: string[]      // Scanned at source
  serialNumbersReceived: string[]  // Scanned at destination
}

// Verify serial numbers match
const missingSerials = sentSerials.filter(s => !receivedSerials.includes(s))
const extraSerials = receivedSerials.filter(s => !sentSerials.includes(s))
```

## Related Skills
- `pos-stock-operation-enforcer` - Executes stock deductions/additions
- `pos-inventory-transaction-logger` - Logs transfer transactions
- `pos-audit-trail-architect` - Creates stage change audits
- `pos-multi-tenant-guardian` - Enforces location access

## References
- Schema: `/prisma/schema.prisma` lines 1655-1770 (StockTransfer, StockTransferItem)
- RBAC: `/src/lib/rbac.ts` (STOCK_TRANSFER_* permissions)
- Example: Existing transfer implementation in codebase
