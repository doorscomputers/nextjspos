---
name: pos-inventory-correction-workflow
description: Manages the complete inventory correction workflow from physical count entry to approval, including 
---

# pos-inventory-correction-workflow

## Purpose
Manages the complete inventory correction workflow from physical count entry to approval, including variance detection, stock adjustments, and audit trail creation. Essential for reconciling physical inventory with system records.

## When to Use
- Processing physical inventory counts
- Reconciling cycle counts
- Correcting stock discrepancies
- Period-end inventory adjustments
- Investigating stock variances
- Handling damaged/expired/found items

## Critical Requirements

### 1. Correction Workflow Stages
```typescript
enum CorrectionStatus {
  pending    // Awaiting approval
  approved   // Approved and stock adjusted
  rejected   // Rejected, no stock change
}

enum CorrectionReason {
  expired    // Product expired
  damaged    // Product damaged
  missing    // Product missing/shrinkage
  found      // Product found (overage)
  count_error // Physical count error
  other      // Other reason
}
```

### 2. Separation of Duties
**Best Practice:** The person who creates a correction should NOT be the one who approves it.

```typescript
// Creation: Any user with INVENTORY_CORRECTION_CREATE
// Approval: Only users with INVENTORY_CORRECTION_APPROVE
// Ensures segregation of duties for fraud prevention
```

### 3. Stock Adjustment Logic
```typescript
// Calculate adjustment
const adjustmentQty = physicalCount - systemCount

// Positive adjustment: Stock IN (found items)
// Negative adjustment: Stock OUT (missing/damaged items)

// Stock transaction type: 'correction'
```

## Implementation Pattern

### API Route: Create Correction

```typescript
// /src/app/api/inventory-corrections/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { hasAccessToLocation } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  // Permission check
  if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_CREATE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { productId, variationId, locationId, physicalCount, reason, notes } = body

  // Validation
  if (!productId || !variationId || !locationId || physicalCount === undefined) {
    return NextResponse.json({
      error: 'Missing required fields: productId, variationId, locationId, physicalCount'
    }, { status: 400 })
  }

  // Location access check
  if (!hasAccessToLocation(user, locationId)) {
    return NextResponse.json({
      error: 'Access denied: You do not have access to this location'
    }, { status: 403 })
  }

  try {
    // Get current stock
    const stockRecord = await prisma.variationLocationDetails.findUnique({
      where: {
        variationId_locationId: {
          variationId,
          locationId
        }
      },
      include: {
        variation: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, businessId: true }
            }
          }
        },
        location: {
          select: { id: true, name: true, businessId: true }
        }
      }
    })

    // Verify tenant ownership
    if (!stockRecord || stockRecord.variation.product.businessId !== user.businessId) {
      return NextResponse.json({
        error: 'Product not found or does not belong to your business'
      }, { status: 404 })
    }

    const systemCount = stockRecord.currentQty
    const difference = physicalCount - systemCount

    // Create correction record
    const correction = await prisma.inventoryCorrection.create({
      data: {
        businessId: user.businessId,
        productId,
        variationId,
        locationId,
        systemCount,
        physicalCount,
        difference,
        reason: reason || 'count_error',
        notes,
        status: 'pending',
        createdBy: user.id,
        createdAt: new Date()
      },
      include: {
        product: { select: { name: true, sku: true } },
        variation: { select: { name: true } },
        location: { select: { name: true } },
        createdByUser: { select: { username: true } }
      }
    })

    // Create audit log
    await createAuditLog({
      businessId: user.businessId,
      userId: user.id,
      username: user.username,
      action: 'INVENTORY_CORRECTION_CREATE',
      entityType: 'INVENTORY_CORRECTION',
      entityIds: [correction.id.toString()],
      description: `Created inventory correction for ${correction.product.name} at ${correction.location.name}`,
      metadata: {
        correctionId: correction.id,
        productId,
        productName: correction.product.name,
        productSku: correction.product.sku,
        variationId,
        variationName: correction.variation?.name,
        locationId,
        locationName: correction.location.name,
        systemCount,
        physicalCount,
        difference,
        differencePercentage: systemCount > 0 ? ((difference / systemCount) * 100).toFixed(2) : 'N/A',
        reason: correction.reason,
        notes: correction.notes,
        status: 'pending'
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    })

    return NextResponse.json({
      success: true,
      correction,
      message: `Correction created. Difference: ${difference} (${difference > 0 ? 'overage' : 'shortage'})`
    })

  } catch (error: any) {
    console.error('Correction creation error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to create correction'
    }, { status: 500 })
  }
}

// GET: List corrections with filters
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')
  const status = searchParams.get('status')
  const reason = searchParams.get('reason')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const skip = (page - 1) * limit

  const where: any = {
    businessId: user.businessId,
    deletedAt: null
  }

  // Location filter with access control
  const accessibleLocationIds = getUserAccessibleLocationIds(user)
  if (locationId) {
    const requestedLocationId = parseInt(locationId)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(requestedLocationId)) {
      return NextResponse.json({ error: 'Access denied to location' }, { status: 403 })
    }
    where.locationId = requestedLocationId
  } else if (accessibleLocationIds !== null) {
    where.locationId = { in: accessibleLocationIds }
  }

  if (status) where.status = status
  if (reason) where.reason = reason

  try {
    const [corrections, total] = await Promise.all([
      prisma.inventoryCorrection.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variation: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          createdByUser: { select: { id: true, username: true } },
          approvedByUser: { select: { id: true, username: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.inventoryCorrection.count({ where })
    ])

    return NextResponse.json({
      corrections,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error('Fetch corrections error:', error)
    return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 })
  }
}
```

### API Route: Approve Correction

```typescript
// /src/app/api/inventory-corrections/[id]/approve/route.ts
import { updateStock } from '@/lib/stockOperations'
import { createAuditLog } from '@/lib/auditLog'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const correctionId = parseInt(params.id)
  const body = await request.json()
  const { password, notes } = body

  // Password verification (optional but recommended)
  if (!password) {
    return NextResponse.json({
      error: 'Password required for approval'
    }, { status: 400 })
  }

  // Verify password
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true }
  })

  const passwordValid = await bcrypt.compare(password, userRecord.password)
  if (!passwordValid) {
    return NextResponse.json({
      error: 'Invalid password'
    }, { status: 401 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get correction
      const correction = await tx.inventoryCorrection.findUnique({
        where: { id: correctionId },
        include: {
          product: true,
          variation: true,
          location: true,
          createdByUser: true
        }
      })

      if (!correction) {
        throw new Error('Correction not found')
      }

      if (correction.businessId !== user.businessId) {
        throw new Error('Access denied')
      }

      if (correction.status !== 'pending') {
        throw new Error(`Correction already ${correction.status}`)
      }

      // Prevent self-approval (separation of duties)
      if (correction.createdBy === user.id) {
        throw new Error('You cannot approve your own correction')
      }

      // Calculate adjustment
      const adjustmentQty = correction.difference

      // Update stock using atomic operation
      const stockResult = await updateStock({
        businessId: user.businessId,
        productId: correction.productId,
        variationId: correction.variationId,
        locationId: correction.locationId,
        quantity: adjustmentQty,
        transactionType: 'correction',
        unitCost: correction.unitCost || 0,
        userId: user.id,
        referenceType: 'InventoryCorrection',
        referenceId: correction.id.toString(),
        notes: `Correction approved: ${correction.reason}`,
        allowNegative: true  // Allow negative for corrections
      }, tx)

      // Update correction status
      const updated = await tx.inventoryCorrection.update({
        where: { id: correctionId },
        data: {
          status: 'approved',
          approvedBy: user.id,
          approvedAt: new Date(),
          approvalNotes: notes,
          stockTransactionId: stockResult.stockTransaction.id
        },
        include: {
          product: true,
          variation: true,
          location: true,
          createdByUser: true,
          approvedByUser: true
        }
      })

      // Create comprehensive audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'INVENTORY_CORRECTION_APPROVE',
        entityType: 'INVENTORY_CORRECTION',
        entityIds: [correctionId.toString()],
        description: `Approved inventory correction for ${correction.product.name} at ${correction.location.name}`,
        metadata: {
          correctionId: correction.id,
          productId: correction.productId,
          productName: correction.product.name,
          productSku: correction.product.sku,
          variationId: correction.variationId,
          variationName: correction.variation?.name,
          locationId: correction.locationId,
          locationName: correction.location.name,
          systemCount: correction.systemCount,
          physicalCount: correction.physicalCount,
          difference: correction.difference,
          differencePercentage: ((correction.difference / correction.systemCount) * 100).toFixed(2),
          reason: correction.reason,
          beforeQty: stockResult.previousBalance,
          afterQty: stockResult.newBalance,
          stockTransactionId: stockResult.stockTransaction.id,
          inventoryValueImpact: adjustmentQty * (correction.unitCost || 0),
          createdBy: correction.createdByUser.username,
          approvedBy: user.username,
          approvalNotes: notes
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
        requiresPassword: true,
        passwordVerified: true
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      correction: result,
      message: 'Correction approved and stock adjusted'
    })

  } catch (error: any) {
    console.error('Approval error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to approve correction'
    }, { status: 500 })
  }
}
```

### API Route: Reject Correction

```typescript
// /src/app/api/inventory-corrections/[id]/reject/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const correctionId = parseInt(params.id)
  const body = await request.json()
  const { reason } = body

  if (!reason) {
    return NextResponse.json({
      error: 'Rejection reason required'
    }, { status: 400 })
  }

  try {
    const correction = await prisma.inventoryCorrection.findUnique({
      where: { id: correctionId },
      include: {
        product: true,
        location: true
      }
    })

    if (!correction) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (correction.businessId !== user.businessId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (correction.status !== 'pending') {
      return NextResponse.json({
        error: `Correction already ${correction.status}`
      }, { status: 400 })
    }

    // Update status to rejected
    const updated = await prisma.inventoryCorrection.update({
      where: { id: correctionId },
      data: {
        status: 'rejected',
        approvedBy: user.id,
        approvedAt: new Date(),
        approvalNotes: reason
      }
    })

    // Audit log
    await createAuditLog({
      businessId: user.businessId,
      userId: user.id,
      username: user.username,
      action: 'INVENTORY_CORRECTION_REJECT',
      entityType: 'INVENTORY_CORRECTION',
      entityIds: [correctionId.toString()],
      description: `Rejected inventory correction for ${correction.product.name}`,
      metadata: {
        correctionId: correction.id,
        productName: correction.product.name,
        locationName: correction.location.name,
        systemCount: correction.systemCount,
        physicalCount: correction.physicalCount,
        difference: correction.difference,
        rejectionReason: reason
      }
    })

    return NextResponse.json({
      success: true,
      correction: updated,
      message: 'Correction rejected'
    })

  } catch (error: any) {
    console.error('Rejection error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to reject correction'
    }, { status: 500 })
  }
}
```

## Frontend Component

```typescript
// /src/app/dashboard/inventory-corrections/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordConfirmDialog } from '@/components/PasswordConfirmDialog'
import { PERMISSIONS } from '@/lib/rbac'

export default function InventoryCorrectionsPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCorrection, setSelectedCorrection] = useState(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)

  useEffect(() => {
    fetchCorrections()
  }, [])

  async function fetchCorrections() {
    setLoading(true)
    const res = await fetch('/api/inventory-corrections')
    const data = await res.json()
    setCorrections(data.corrections || [])
    setLoading(false)
  }

  async function handleApprove(correction: any, password: string, notes: string) {
    const res = await fetch(`/api/inventory-corrections/${correction.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, notes })
    })

    const data = await res.json()

    if (res.ok) {
      alert('Correction approved successfully')
      fetchCorrections()
    } else {
      alert(data.error || 'Approval failed')
    }
  }

  async function handleReject(correctionId: number) {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    const res = await fetch(`/api/inventory-corrections/${correctionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })

    if (res.ok) {
      alert('Correction rejected')
      fetchCorrections()
    }
  }

  function getStatusBadge(status: string) {
    const variants: any = {
      pending: 'default',
      approved: 'success',
      rejected: 'destructive'
    }
    return <Badge variant={variants[status] || 'default'}>{status.toUpperCase()}</Badge>
  }

  function getDifferenceBadge(difference: number) {
    if (difference > 0) {
      return <Badge variant="success">+{difference} (Overage)</Badge>
    } else if (difference < 0) {
      return <Badge variant="destructive">{difference} (Shortage)</Badge>
    } else {
      return <Badge>0 (Match)</Badge>
    }
  }

  if (!can(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
    return <div>Access Denied</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventory Corrections</h1>
        {can(PERMISSIONS.INVENTORY_CORRECTION_CREATE) && (
          <Button onClick={() => window.location.href = '/dashboard/inventory-corrections/new'}>
            New Correction
          </Button>
        )}
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>System Count</TableHead>
                <TableHead>Physical Count</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corrections.map((correction: any) => (
                <TableRow key={correction.id}>
                  <TableCell>{correction.id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{correction.product.name}</div>
                      <div className="text-sm text-muted-foreground">{correction.product.sku}</div>
                      {correction.variation && (
                        <div className="text-xs text-muted-foreground">{correction.variation.name}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{correction.location.name}</TableCell>
                  <TableCell className="text-right font-medium">{correction.systemCount}</TableCell>
                  <TableCell className="text-right font-medium">{correction.physicalCount}</TableCell>
                  <TableCell>{getDifferenceBadge(correction.difference)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{correction.reason}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(correction.status)}</TableCell>
                  <TableCell>{correction.createdByUser.username}</TableCell>
                  <TableCell>{new Date(correction.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {correction.status === 'pending' && can(PERMISSIONS.INVENTORY_CORRECTION_APPROVE) && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedCorrection(correction)
                            setShowApprovalDialog(true)
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(correction.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showApprovalDialog && selectedCorrection && (
        <PasswordConfirmDialog
          open={showApprovalDialog}
          onClose={() => setShowApprovalDialog(false)}
          onConfirm={(password, notes) => handleApprove(selectedCorrection, password, notes)}
          title="Approve Inventory Correction"
          description={`This will adjust stock by ${selectedCorrection.difference} for ${selectedCorrection.product.name}`}
          requireNotes={true}
        />
      )}
    </div>
  )
}
```

## Best Practices

### ✅ DO:
- **Require password** for approvals (enhanced security)
- **Prevent self-approval** (separation of duties)
- **Calculate adjustments** automatically (physicalCount - systemCount)
- **Use atomic transactions** for approval + stock update
- **Create comprehensive audit logs** with before/after values
- **Track inventory value impact** in metadata
- **Support different correction reasons** (damaged, expired, found, etc.)
- **Show variance percentage** in reports

### ❌ DON'T:
- **Don't allow self-approval** - major control weakness
- **Don't skip stock validation** before approval
- **Don't forget to create audit logs**
- **Don't allow modifications** after approval
- **Don't approve without reviewing** variance magnitude
- **Don't forget businessId** in all queries

## Variance Analysis

```typescript
// Identify high-value variances
const highValueCorrections = corrections.filter(c => {
  const valueLoss = Math.abs(c.difference * c.unitCost)
  return valueLoss > 1000  // $1000+ variance
})

// Flag unusual patterns
const frequentCorrections = await prisma.inventoryCorrection.groupBy({
  by: ['productId'],
  where: {
    businessId: user.businessId,
    createdAt: { gte: last30Days }
  },
  _count: { id: true },
  having: { id: { _count: { gt: 5 } } }  // More than 5 corrections in 30 days
})
```

## Related Skills
- `pos-inventory-transaction-logger` - Logs correction transactions
- `pos-stock-operation-enforcer` - Executes stock adjustments
- `pos-audit-trail-architect` - Creates approval audit logs
- `pos-item-ledger-engine` - Shows corrections in ledger

## References
- Schema: `/prisma/schema.prisma` lines 1913-1966 (InventoryCorrection)
- Example: `/src/app/api/inventory-corrections/` (existing implementation)
- RBAC: `/src/lib/rbac.ts` (INVENTORY_CORRECTION_* permissions)
