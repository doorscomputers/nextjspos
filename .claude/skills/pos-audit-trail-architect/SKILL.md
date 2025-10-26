---
name: pos-audit-trail-architect
description: Creates comprehensive, detailed audit logs for all sensitive inventory operations. Provides complete
---

# pos-audit-trail-architect

## Purpose
Creates comprehensive, detailed audit logs for all sensitive inventory operations. Provides complete traceability of who did what, when, where, and why with extensive metadata for compliance and forensic analysis.

## When to Use
- **After EVERY sensitive inventory operation:**
  - Inventory corrections and approvals
  - Stock transfers (create, send, receive)
  - Purchase orders and receipts
  - Sales transactions
  - Opening stock setup/locks
  - Returns (customer/supplier)
  - Price changes
  - Product modifications
  - User permission changes
  - Business settings updates

## Critical Requirements

### 1. Audit Log Structure
Every audit entry MUST include:
```typescript
{
  // Tenant & User Context
  businessId: number           // Multi-tenant isolation
  userId: number              // Who performed the action
  username: string            // Username for readability

  // Action Details
  action: AuditAction         // Enum: PRODUCT_CREATE, SALE_CREATE, etc.
  entityType: EntityType      // Enum: PRODUCT, SALE, TRANSFER, etc.
  entityIds: string[]         // Array of affected record IDs

  // Description
  description: string         // Human-readable summary

  // Metadata (Critical!)
  metadata: JSON              // Extensive details (before/after, calculations, etc.)

  // Security Context
  ipAddress: string?          // Client IP for security
  userAgent: string?          // Browser/device info
  requiresPassword: boolean?  // Was password required?
  passwordVerified: boolean?  // Was password verified?

  // Timestamp
  createdAt: DateTime         // When action occurred
}
```

### 2. Comprehensive Metadata
Include detailed metadata with before/after values:
```typescript
metadata: {
  // Record identifiers
  recordId: number,
  recordName: string,
  recordNumber: string,

  // Location context
  locationId: number,
  locationName: string,

  // Before/After values (for updates)
  before: { field1: oldValue1, field2: oldValue2 },
  after: { field1: newValue1, field2: newValue2 },
  changes: ['field1', 'field2'],

  // Financial impact
  inventoryValueImpact: number,
  costBasisChange: number,

  // Quantities
  quantityBefore: number,
  quantityAfter: number,
  quantityChange: number,

  // Related records
  relatedRecordType: string,
  relatedRecordId: number,

  // Approval workflow
  approver: string,
  approvalNotes: string,

  // Additional context
  reason: string,
  notes: string
}
```

### 3. Security Context
Capture client information for security auditing:
```typescript
import { NextRequest } from 'next/server'

function getIpAddress(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         null
}

function getUserAgent(request: NextRequest): string | null {
  return request.headers.get('user-agent') || null
}
```

## Implementation Pattern

### Core Audit Logging Function

```typescript
import { prisma } from '@/lib/prisma'
import { AuditAction, EntityType } from '@/lib/auditLog'

interface CreateAuditLogParams {
  businessId: number
  userId: number
  username: string
  action: AuditAction
  entityType: EntityType
  entityIds: string[]
  description: string
  metadata?: Record<string, any>
  ipAddress?: string | null
  userAgent?: string | null
  requiresPassword?: boolean
  passwordVerified?: boolean
}

async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: params.businessId,
        userId: params.userId,
        username: params.username,
        action: params.action,
        entityType: params.entityType,
        entityIds: params.entityIds,
        description: params.description,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requiresPassword: params.requiresPassword || false,
        passwordVerified: params.passwordVerified || false,
        createdAt: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't fail the main operation if audit logging fails
    // But log the error for monitoring
  }
}

export { createAuditLog }
```

### Audit Action Enums

```typescript
// /src/lib/auditLog.ts
export enum AuditAction {
  // Product Management
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  PRODUCT_PRICE_CHANGE = 'PRODUCT_PRICE_CHANGE',
  PRODUCT_OPENING_STOCK_SET = 'PRODUCT_OPENING_STOCK_SET',
  PRODUCT_OPENING_STOCK_LOCK = 'PRODUCT_OPENING_STOCK_LOCK',
  PRODUCT_OPENING_STOCK_UNLOCK = 'PRODUCT_OPENING_STOCK_UNLOCK',

  // Inventory Corrections
  INVENTORY_CORRECTION_CREATE = 'INVENTORY_CORRECTION_CREATE',
  INVENTORY_CORRECTION_UPDATE = 'INVENTORY_CORRECTION_UPDATE',
  INVENTORY_CORRECTION_DELETE = 'INVENTORY_CORRECTION_DELETE',
  INVENTORY_CORRECTION_APPROVE = 'INVENTORY_CORRECTION_APPROVE',
  INVENTORY_CORRECTION_REJECT = 'INVENTORY_CORRECTION_REJECT',

  // Stock Transfers
  STOCK_TRANSFER_CREATE = 'STOCK_TRANSFER_CREATE',
  STOCK_TRANSFER_UPDATE = 'STOCK_TRANSFER_UPDATE',
  STOCK_TRANSFER_DELETE = 'STOCK_TRANSFER_DELETE',
  STOCK_TRANSFER_SEND = 'STOCK_TRANSFER_SEND',
  STOCK_TRANSFER_RECEIVE = 'STOCK_TRANSFER_RECEIVE',
  STOCK_TRANSFER_COMPLETE = 'STOCK_TRANSFER_COMPLETE',
  STOCK_TRANSFER_CANCEL = 'STOCK_TRANSFER_CANCEL',

  // Purchases
  PURCHASE_ORDER_CREATE = 'PURCHASE_ORDER_CREATE',
  PURCHASE_ORDER_UPDATE = 'PURCHASE_ORDER_UPDATE',
  PURCHASE_ORDER_DELETE = 'PURCHASE_ORDER_DELETE',
  PURCHASE_ORDER_APPROVE = 'PURCHASE_ORDER_APPROVE',
  PURCHASE_RECEIPT_CREATE = 'PURCHASE_RECEIPT_CREATE',
  PURCHASE_RECEIPT_APPROVE = 'PURCHASE_RECEIPT_APPROVE',

  // Sales
  SALE_CREATE = 'SALE_CREATE',
  SALE_UPDATE = 'SALE_UPDATE',
  SALE_DELETE = 'SALE_DELETE',
  SALE_VOID = 'SALE_VOID',
  SALE_REFUND = 'SALE_REFUND',

  // Returns
  PURCHASE_RETURN_CREATE = 'PURCHASE_RETURN_CREATE',
  PURCHASE_RETURN_APPROVE = 'PURCHASE_RETURN_APPROVE',
  CUSTOMER_RETURN_CREATE = 'CUSTOMER_RETURN_CREATE',
  CUSTOMER_RETURN_APPROVE = 'CUSTOMER_RETURN_APPROVE',

  // Users & Permissions
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_PASSWORD_CHANGE = 'USER_PASSWORD_CHANGE',
  USER_PERMISSION_CHANGE = 'USER_PERMISSION_CHANGE',
  USER_ROLE_ASSIGN = 'USER_ROLE_ASSIGN',

  // Business Settings
  BUSINESS_SETTINGS_UPDATE = 'BUSINESS_SETTINGS_UPDATE',
  LOCATION_CREATE = 'LOCATION_CREATE',
  LOCATION_UPDATE = 'LOCATION_UPDATE',
  LOCATION_DELETE = 'LOCATION_DELETE',

  // Reports & Exports
  REPORT_EXPORT = 'REPORT_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  DATA_EXPORT = 'DATA_EXPORT'
}

export enum EntityType {
  PRODUCT = 'PRODUCT',
  PRODUCT_VARIATION = 'PRODUCT_VARIATION',
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  PURCHASE_RECEIPT = 'PURCHASE_RECEIPT',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  CUSTOMER_RETURN = 'CUSTOMER_RETURN',
  STOCK_TRANSFER = 'STOCK_TRANSFER',
  INVENTORY_CORRECTION = 'INVENTORY_CORRECTION',
  USER = 'USER',
  ROLE = 'ROLE',
  BUSINESS = 'BUSINESS',
  LOCATION = 'LOCATION',
  SUPPLIER = 'SUPPLIER',
  CUSTOMER = 'CUSTOMER',
  EXPENSE = 'EXPENSE',
  REPORT = 'REPORT'
}
```

## Usage Examples

### Example 1: Inventory Correction Approval

```typescript
// /src/app/api/inventory-corrections/[id]/approve/route.ts
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const correctionId = parseInt(params.id)

  const result = await prisma.$transaction(async (tx) => {
    // Get correction details
    const correction = await tx.inventoryCorrection.findUnique({
      where: { id: correctionId },
      include: {
        product: true,
        variation: true,
        location: true,
        createdByUser: true
      }
    })

    // Update stock
    const currentQty = correction.systemCount
    const adjustmentQty = correction.physicalCount - correction.systemCount
    const newQty = correction.physicalCount

    const stockResult = await updateStock({
      businessId: session.user.businessId,
      productId: correction.productId,
      variationId: correction.variationId,
      locationId: correction.locationId,
      quantity: adjustmentQty,
      transactionType: 'correction',
      unitCost: correction.unitCost || 0,
      userId: session.user.id,
      referenceType: 'InventoryCorrection',
      referenceId: correction.id.toString()
    }, tx)

    // Update correction status
    const updated = await tx.inventoryCorrection.update({
      where: { id: correctionId },
      data: {
        status: 'approved',
        approvedBy: session.user.id,
        approvedAt: new Date()
      }
    })

    // ⚡ CREATE COMPREHENSIVE AUDIT LOG
    await createAuditLog({
      businessId: session.user.businessId,
      userId: session.user.id,
      username: session.user.username,
      action: AuditAction.INVENTORY_CORRECTION_APPROVE,
      entityType: EntityType.INVENTORY_CORRECTION,
      entityIds: [correctionId.toString()],
      description: `Approved inventory correction for ${correction.product.name} at ${correction.location.name}`,
      metadata: {
        // Correction details
        correctionId: correction.id,
        correctionReason: correction.reason,

        // Location context
        locationId: correction.locationId,
        locationName: correction.location.name,

        // Product details
        productId: correction.productId,
        productName: correction.product.name,
        productSku: correction.product.sku,
        variationId: correction.variationId,
        variationName: correction.variation?.name,

        // Quantity changes
        systemCount: correction.systemCount,
        physicalCount: correction.physicalCount,
        difference: adjustmentQty,
        differencePercentage: ((adjustmentQty / currentQty) * 100).toFixed(2),

        // Stock impact
        beforeQty: currentQty,
        afterQty: newQty,
        stockTransactionId: stockResult.stockTransaction.id,

        // Financial impact
        unitCost: correction.unitCost,
        inventoryValueImpact: (adjustmentQty * (correction.unitCost || 0)),

        // Approval details
        approvedBy: session.user.id,
        approvedByUsername: session.user.username,
        approvedAt: new Date().toISOString(),
        createdBy: correction.createdBy,
        createdByUsername: correction.createdByUser.username,
        createdAt: correction.createdAt.toISOString(),

        // Notes
        notes: correction.notes
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      requiresPassword: true,
      passwordVerified: true  // Assuming password was verified
    })

    return updated
  })

  return NextResponse.json({ success: true, correction: result })
}
```

### Example 2: Stock Transfer Send

```typescript
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const transferId = parseInt(params.id)

  await prisma.$transaction(async (tx) => {
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

    // Deduct stock from source
    for (const item of transfer.items) {
      await updateStock({
        businessId: transfer.businessId,
        productId: item.productId,
        variationId: item.variationId,
        locationId: transfer.fromLocationId,
        quantity: -item.quantitySent,
        transactionType: 'transfer_out',
        unitCost: item.costPrice,
        userId: session.user.id,
        referenceType: 'StockTransfer',
        referenceId: transfer.id.toString()
      }, tx)
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'in_transit',
        sentBy: session.user.id,
        sentAt: new Date()
      }
    })

    // ⚡ AUDIT LOG with detailed metadata
    await createAuditLog({
      businessId: session.user.businessId,
      userId: session.user.id,
      username: session.user.username,
      action: AuditAction.STOCK_TRANSFER_SEND,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId.toString()],
      description: `Sent transfer #${transfer.transferNumber} from ${transfer.fromLocation.name} to ${transfer.toLocation.name}`,
      metadata: {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        fromLocationName: transfer.fromLocation.name,
        toLocationId: transfer.toLocationId,
        toLocationName: transfer.toLocation.name,
        itemCount: transfer.items.length,
        items: transfer.items.map(item => ({
          productId: item.productId,
          productName: item.product.name,
          productSku: item.product.sku,
          variationId: item.variationId,
          variationName: item.variation?.name,
          quantitySent: item.quantitySent,
          costPrice: item.costPrice,
          totalValue: item.quantitySent * item.costPrice
        })),
        totalValue: transfer.items.reduce((sum, item) =>
          sum + (item.quantitySent * item.costPrice), 0
        ),
        sentBy: session.user.username,
        sentAt: new Date().toISOString()
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    })
  })
}
```

### Example 3: Price Change

```typescript
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const productId = parseInt(params.id)
  const body = await request.json()

  // Get old values
  const oldProduct = await prisma.product.findUnique({
    where: { id: productId }
  })

  // Update product
  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      costPrice: body.costPrice,
      sellingPrice: body.sellingPrice
    }
  })

  // ⚡ AUDIT LOG for price changes
  await createAuditLog({
    businessId: session.user.businessId,
    userId: session.user.id,
    username: session.user.username,
    action: AuditAction.PRODUCT_PRICE_CHANGE,
    entityType: EntityType.PRODUCT,
    entityIds: [productId.toString()],
    description: `Updated prices for ${updated.name}`,
    metadata: {
      productId: updated.id,
      productName: updated.name,
      productSku: updated.sku,
      before: {
        costPrice: oldProduct.costPrice,
        sellingPrice: oldProduct.sellingPrice,
        profitMargin: oldProduct.sellingPrice - oldProduct.costPrice,
        profitPercentage: ((oldProduct.sellingPrice - oldProduct.costPrice) / oldProduct.costPrice * 100).toFixed(2)
      },
      after: {
        costPrice: updated.costPrice,
        sellingPrice: updated.sellingPrice,
        profitMargin: updated.sellingPrice - updated.costPrice,
        profitPercentage: ((updated.sellingPrice - updated.costPrice) / updated.costPrice * 100).toFixed(2)
      },
      changes: {
        costPriceChange: updated.costPrice - oldProduct.costPrice,
        sellingPriceChange: updated.sellingPrice - oldProduct.sellingPrice,
        marginChange: (updated.sellingPrice - updated.costPrice) - (oldProduct.sellingPrice - oldProduct.costPrice)
      },
      reason: body.reason || 'Not specified'
    },
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    requiresPassword: true
  })

  return NextResponse.json({ success: true, product: updated })
}
```

### Example 4: Sale Creation

```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const body = await request.json()

  const result = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        businessId: session.user.businessId,
        locationId: body.locationId,
        userId: session.user.id,
        customerId: body.customerId,
        invoiceNumber: await generateInvoiceNumber(tx),
        totalAmount: body.totalAmount,
        status: 'completed'
      },
      include: {
        location: true,
        customer: true
      }
    })

    // Create sale items and deduct stock
    const items = []
    for (const item of body.items) {
      await updateStock({
        businessId: session.user.businessId,
        productId: item.productId,
        variationId: item.variationId,
        locationId: body.locationId,
        quantity: -item.quantity,
        transactionType: 'sale',
        unitCost: item.costPrice,
        userId: session.user.id,
        referenceType: 'Sale',
        referenceId: sale.id.toString()
      }, tx)

      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice
        }
      })
      items.push(saleItem)
    }

    // ⚡ AUDIT LOG
    await createAuditLog({
      businessId: session.user.businessId,
      userId: session.user.id,
      username: session.user.username,
      action: AuditAction.SALE_CREATE,
      entityType: EntityType.SALE,
      entityIds: [sale.id.toString()],
      description: `Created sale #${sale.invoiceNumber} at ${sale.location.name}${sale.customer ? ` for ${sale.customer.name}` : ''}`,
      metadata: {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        locationId: sale.locationId,
        locationName: sale.location.name,
        customerId: sale.customerId,
        customerName: sale.customer?.name,
        totalAmount: sale.totalAmount,
        itemCount: items.length,
        items: items.map(item => ({
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          profit: (item.unitPrice - item.costPrice) * item.quantity
        })),
        totalCost: items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0),
        totalProfit: items.reduce((sum, item) => sum + ((item.unitPrice - item.costPrice) * item.quantity), 0),
        paymentMethod: body.paymentMethod,
        paymentStatus: body.paymentStatus
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    })

    return sale
  })

  return NextResponse.json({ success: true, sale: result })
}
```

## Querying Audit Logs

### Get Audit Trail for Specific Record
```typescript
const auditTrail = await prisma.auditLog.findMany({
  where: {
    businessId: user.businessId,
    entityType: 'PRODUCT',
    entityIds: { has: productId.toString() }
  },
  include: {
    user: { select: { username: true, email: true } }
  },
  orderBy: { createdAt: 'desc' }
})
```

### Get User Activity Report
```typescript
const userActivity = await prisma.auditLog.findMany({
  where: {
    businessId: user.businessId,
    userId: targetUserId,
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  },
  orderBy: { createdAt: 'desc' }
})
```

### Get Critical Actions Requiring Review
```typescript
const criticalActions = await prisma.auditLog.findMany({
  where: {
    businessId: user.businessId,
    action: {
      in: [
        'INVENTORY_CORRECTION_APPROVE',
        'PRODUCT_PRICE_CHANGE',
        'STOCK_TRANSFER_SEND',
        'USER_PERMISSION_CHANGE'
      ]
    },
    createdAt: { gte: last24Hours }
  },
  orderBy: { createdAt: 'desc' }
})
```

## Best Practices

### ✅ DO:
- **Log ALL sensitive operations** immediately after success
- **Include detailed metadata** with before/after values
- **Capture IP address and user agent** for security
- **Log financial impacts** for inventory value changes
- **Include human-readable descriptions**
- **Link to source documents** via entityIds
- **Log in try-catch** to prevent main operation failure
- **Include businessId** for multi-tenant isolation

### ❌ DON'T:
- **Don't log passwords** or sensitive credentials
- **Don't fail main operation** if audit logging fails
- **Don't skimp on metadata** - more is better
- **Don't forget businessId** in queries
- **Don't expose sensitive data** in descriptions
- **Don't log before operation completes** (log after success)

## Security Considerations

```typescript
// ✅ GOOD: Log after operation succeeds
try {
  const result = await performOperation()
  await createAuditLog({ /* ... */ })
  return result
} catch (error) {
  // Don't log failed operations (or log as ATTEMPT_FAILED)
  throw error
}

// ✅ GOOD: Sanitize sensitive data
metadata: {
  userEmail: user.email,
  // Don't include: password, tokens, API keys
}

// ✅ GOOD: Non-blocking audit logging
try {
  await createAuditLog({ /* ... */ })
} catch (auditError) {
  console.error('Audit logging failed:', auditError)
  // Continue - don't fail the main operation
}
```

## Related Skills
- `pos-inventory-transaction-logger` - Creates stock transaction logs
- `pos-multi-tenant-guardian` - Ensures tenant isolation in audits
- `pos-item-ledger-engine` - Generates ledger from audit trail

## References
- Schema: `/prisma/schema.prisma` lines 846-880 (AuditLog model)
- Library: `/src/lib/auditLog.ts` (Enums and helpers)
- Example: `/src/app/api/inventory-corrections/[id]/approve/route.ts` lines 132-171
