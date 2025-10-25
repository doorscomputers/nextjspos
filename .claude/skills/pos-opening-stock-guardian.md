# pos-opening-stock-guardian

## Purpose
Manages initial stock setup for product variations at each location with locking mechanism to prevent unauthorized modifications after audit periods. Critical for accurate inventory valuation and compliance.

## When to Use
- Setting up initial inventory when starting the system
- Adding new products to locations
- After physical inventory counts
- Beginning new accounting periods
- System migrations from legacy systems

## Critical Requirements

### 1. Opening Stock Workflow
```typescript
1. Create product and variations
2. Set opening stock quantities and costs at each location
3. Lock opening stock after verification
4. Opening stock CANNOT be modified once locked (audit security)
5. Unlocking requires special permission + password
```

### 2. Opening Stock States
```typescript
interface VariationLocationDetails {
  openingStockQty: number
  openingStockCost: number
  openingStockValue: number          // qty * cost
  openingStockSet: boolean           // Has it been set?
  openingStockSetBy: number?         // Who set it
  openingStockSetAt: DateTime?       // When set
  openingStockLocked: boolean        // Is it locked?
  openingStockLockedBy: number?      // Who locked it
  openingStockLockedAt: DateTime?    // When locked
}
```

### 3. Permission Requirements
```typescript
PRODUCT_OPENING_STOCK         // Set opening stock
PRODUCT_LOCK_OPENING_STOCK    // Lock opening stock
PRODUCT_UNLOCK_OPENING_STOCK  // Unlock (requires password + audit)
```

### 4. Stock Transaction Creation
Setting opening stock creates a `StockTransaction` with:
- `transactionType: 'opening_stock'`
- `quantity: openingStockQty`
- `unitCost: openingStockCost`
- `balance: openingStockQty` (becomes starting balance)

## Implementation Pattern

### API Route: Set Opening Stock

```typescript
// /src/app/api/products/variations/[id]/opening-stock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasAccessToLocation } from '@/lib/rbac'
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

  if (!user.permissions?.includes(PERMISSIONS.PRODUCT_OPENING_STOCK)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const variationId = parseInt(params.id)
  const body = await request.json()
  const { locationId, quantity, unitCost } = body

  // Validation
  if (!locationId || quantity === undefined || unitCost === undefined) {
    return NextResponse.json({
      error: 'Missing required fields: locationId, quantity, unitCost'
    }, { status: 400 })
  }

  if (quantity < 0 || unitCost < 0) {
    return NextResponse.json({
      error: 'Quantity and unit cost must be non-negative'
    }, { status: 400 })
  }

  // Location access check
  if (!hasAccessToLocation(user, locationId)) {
    return NextResponse.json({
      error: 'Access denied: No access to this location'
    }, { status: 403 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify variation belongs to business
      const variation = await tx.productVariation.findUnique({
        where: { id: variationId },
        include: {
          product: {
            select: { id: true, name: true, sku: true, businessId: true }
          }
        }
      })

      if (!variation || variation.product.businessId !== user.businessId) {
        throw new Error('Variation not found or access denied')
      }

      // Get location details
      const locationDetails = await tx.variationLocationDetails.findUnique({
        where: {
          variationId_locationId: { variationId, locationId }
        },
        include: {
          location: { select: { id: true, name: true } }
        }
      })

      if (!locationDetails) {
        throw new Error('Location details not found')
      }

      // Check if already locked
      if (locationDetails.openingStockLocked) {
        throw new Error(
          `Opening stock is locked. Locked by user ${locationDetails.openingStockLockedBy} ` +
          `at ${locationDetails.openingStockLockedAt}. Unlock required before modification.`
        )
      }

      // Check if already set (warn but allow override)
      if (locationDetails.openingStockSet) {
        console.warn(`Overriding existing opening stock for variation ${variationId} at location ${locationId}`)
      }

      // Calculate opening stock value
      const openingStockValue = quantity * unitCost

      // If this is a fresh opening stock (currentQty is 0 or matches old opening stock)
      // we can set it directly. Otherwise, we need to adjust.
      const needsAdjustment = locationDetails.currentQty !== (locationDetails.openingStockQty || 0)

      if (needsAdjustment && locationDetails.openingStockSet) {
        // Current stock has transactions. Need to create adjustment instead.
        throw new Error(
          'Cannot modify opening stock after transactions exist. ' +
          'Use inventory correction instead.'
        )
      }

      // Set opening stock
      await tx.variationLocationDetails.update({
        where: {
          variationId_locationId: { variationId, locationId }
        },
        data: {
          openingStockQty: quantity,
          openingStockCost: unitCost,
          openingStockValue,
          openingStockSet: true,
          openingStockSetBy: user.id,
          openingStockSetAt: new Date(),
          currentQty: quantity,  // Set current to opening
          updatedAt: new Date()
        }
      })

      // Create opening stock transaction
      const stockTransaction = await tx.stockTransaction.create({
        data: {
          businessId: user.businessId,
          productId: variation.productId,
          variationId: variation.id,
          locationId,
          transactionType: 'opening_stock',
          quantity,
          unitCost,
          balance: quantity,  // Opening balance
          userId: user.id,
          referenceType: 'OpeningStock',
          referenceId: `${variationId}-${locationId}`,
          notes: 'Initial opening stock',
          createdAt: new Date()
        }
      })

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'PRODUCT_OPENING_STOCK_SET',
        entityType: 'PRODUCT_VARIATION',
        entityIds: [variationId.toString()],
        description: `Set opening stock for ${variation.product.name} at ${locationDetails.location.name}`,
        metadata: {
          productId: variation.productId,
          productName: variation.product.name,
          productSku: variation.product.sku,
          variationId,
          variationName: variation.name,
          locationId,
          locationName: locationDetails.location.name,
          quantity,
          unitCost,
          totalValue: openingStockValue,
          stockTransactionId: stockTransaction.id,
          previouslySet: locationDetails.openingStockSet,
          previousQuantity: locationDetails.openingStockQty || 0
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return {
        variation,
        location: locationDetails.location,
        openingStock: {
          quantity,
          unitCost,
          totalValue: openingStockValue
        },
        stockTransaction
      }
    })

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Opening stock set successfully'
    })

  } catch (error: any) {
    console.error('Set opening stock error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to set opening stock'
    }, { status: 500 })
  }
}
```

### API Route: Lock Opening Stock

```typescript
// /src/app/api/products/variations/[id]/opening-stock/lock/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.PRODUCT_LOCK_OPENING_STOCK)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const variationId = parseInt(params.id)
  const body = await request.json()
  const { locationId, password } = body

  // Require password for locking
  if (!password) {
    return NextResponse.json({
      error: 'Password required for locking opening stock'
    }, { status: 400 })
  }

  // Verify password
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true }
  })

  const passwordValid = await bcrypt.compare(password, userRecord.password)
  if (!passwordValid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locationDetails = await tx.variationLocationDetails.findUnique({
        where: {
          variationId_locationId: { variationId, locationId }
        },
        include: {
          variation: {
            include: {
              product: { select: { name: true, businessId: true } }
            }
          },
          location: { select: { name: true } }
        }
      })

      if (!locationDetails) {
        throw new Error('Location details not found')
      }

      if (locationDetails.variation.product.businessId !== user.businessId) {
        throw new Error('Access denied')
      }

      if (!locationDetails.openingStockSet) {
        throw new Error('Cannot lock: Opening stock not yet set')
      }

      if (locationDetails.openingStockLocked) {
        throw new Error('Opening stock already locked')
      }

      // Lock it
      const updated = await tx.variationLocationDetails.update({
        where: {
          variationId_locationId: { variationId, locationId }
        },
        data: {
          openingStockLocked: true,
          openingStockLockedBy: user.id,
          openingStockLockedAt: new Date()
        }
      })

      // Audit log
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'PRODUCT_OPENING_STOCK_LOCK',
        entityType: 'PRODUCT_VARIATION',
        entityIds: [variationId.toString()],
        description: `Locked opening stock for ${locationDetails.variation.product.name} at ${locationDetails.location.name}`,
        metadata: {
          variationId,
          locationId,
          productName: locationDetails.variation.product.name,
          locationName: locationDetails.location.name,
          openingStockQty: locationDetails.openingStockQty,
          openingStockCost: parseFloat(locationDetails.openingStockCost?.toString() || '0'),
          openingStockValue: parseFloat(locationDetails.openingStockValue?.toString() || '0'),
          lockedBy: user.username,
          lockedAt: new Date().toISOString()
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
      message: 'Opening stock locked successfully'
    })

  } catch (error: any) {
    console.error('Lock opening stock error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to lock opening stock'
    }, { status: 500 })
  }
}
```

### API Route: Unlock Opening Stock

```typescript
// /src/app/api/products/variations/[id]/opening-stock/unlock/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UNLOCK_OPENING_STOCK)) {
    return NextResponse.json({
      error: 'Forbidden: Requires PRODUCT_UNLOCK_OPENING_STOCK permission'
    }, { status: 403 })
  }

  const variationId = parseInt(params.id)
  const body = await request.json()
  const { locationId, password, reason } = body

  // Require password AND reason for unlocking
  if (!password || !reason) {
    return NextResponse.json({
      error: 'Password and reason required for unlocking opening stock'
    }, { status: 400 })
  }

  // Verify password
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true }
  })

  const passwordValid = await bcrypt.compare(password, userRecord.password)
  if (!passwordValid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locationDetails = await tx.variationLocationDetails.findUnique({
        where: {
          variationId_locationId: { variationId, locationId }
        },
        include: {
          variation: {
            include: {
              product: { select: { name: true, businessId: true } }
            }
          },
          location: { select: { name: true } }
        }
      })

      if (!locationDetails) {
        throw new Error('Location details not found')
      }

      if (locationDetails.variation.product.businessId !== user.businessId) {
        throw new Error('Access denied')
      }

      if (!locationDetails.openingStockLocked) {
        throw new Error('Opening stock is not locked')
      }

      // Unlock it
      const updated = await tx.variationLocationDetails.update({
        where: {
          variationId_locationId: { variationId, locationId }
        },
        data: {
          openingStockLocked: false,
          // Keep track of who locked it for audit
          updatedAt: new Date()
        }
      })

      // CRITICAL AUDIT LOG for unlocking
      await createAuditLog({
        businessId: user.businessId,
        userId: user.id,
        username: user.username,
        action: 'PRODUCT_OPENING_STOCK_UNLOCK',
        entityType: 'PRODUCT_VARIATION',
        entityIds: [variationId.toString()],
        description: `⚠️ UNLOCKED opening stock for ${locationDetails.variation.product.name} at ${locationDetails.location.name}`,
        metadata: {
          variationId,
          locationId,
          productName: locationDetails.variation.product.name,
          locationName: locationDetails.location.name,
          openingStockQty: locationDetails.openingStockQty,
          openingStockCost: parseFloat(locationDetails.openingStockCost?.toString() || '0'),
          openingStockValue: parseFloat(locationDetails.openingStockValue?.toString() || '0'),
          previouslyLockedBy: locationDetails.openingStockLockedBy,
          previouslyLockedAt: locationDetails.openingStockLockedAt?.toISOString(),
          unlockedBy: user.username,
          unlockedAt: new Date().toISOString(),
          unlockReason: reason,
          // Security flags
          SECURITY_CRITICAL: true,
          REQUIRES_REVIEW: true
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
      message: 'Opening stock unlocked. Modification now allowed.',
      warning: 'This action has been logged for security audit.'
    })

  } catch (error: any) {
    console.error('Unlock opening stock error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to unlock opening stock'
    }, { status: 500 })
  }
}
```

## Bulk Opening Stock Import

```typescript
// Import opening stock from CSV
interface OpeningStockCSVRow {
  sku: string
  locationName: string
  quantity: number
  unitCost: number
}

async function bulkImportOpeningStock(
  businessId: number,
  userId: number,
  csvData: OpeningStockCSVRow[]
) {
  const results = { success: 0, errors: [] }

  for (const row of csvData) {
    try {
      await prisma.$transaction(async (tx) => {
        // Find variation by SKU
        const variation = await tx.productVariation.findFirst({
          where: {
            sku: row.sku,
            product: { businessId }
          },
          include: { product: true }
        })

        if (!variation) {
          throw new Error(`Product not found with SKU: ${row.sku}`)
        }

        // Find location by name
        const location = await tx.businessLocation.findFirst({
          where: {
            businessId,
            name: row.locationName
          }
        })

        if (!location) {
          throw new Error(`Location not found: ${row.locationName}`)
        }

        // Set opening stock (using API logic)
        await setOpeningStock(tx, {
          variationId: variation.id,
          locationId: location.id,
          quantity: row.quantity,
          unitCost: row.unitCost,
          userId
        })

        results.success++
      })
    } catch (error: any) {
      results.errors.push({
        sku: row.sku,
        location: row.locationName,
        error: error.message
      })
    }
  }

  return results
}
```

## Frontend Component

```typescript
// Opening stock management UI
function OpeningStockManager({ variationId, locationId }) {
  const [details, setDetails] = useState(null)
  const [quantity, setQuantity] = useState(0)
  const [unitCost, setUnitCost] = useState(0)

  async function handleSetOpeningStock() {
    const res = await fetch(`/api/products/variations/${variationId}/opening-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, quantity, unitCost })
    })

    const data = await res.json()
    if (res.ok) {
      alert('Opening stock set successfully')
      fetchDetails()
    } else {
      alert(data.error)
    }
  }

  async function handleLock() {
    const password = prompt('Enter your password to lock opening stock:')
    if (!password) return

    const res = await fetch(`/api/products/variations/${variationId}/opening-stock/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, password })
    })

    if (res.ok) {
      alert('Opening stock locked')
      fetchDetails()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opening Stock</CardTitle>
      </CardHeader>
      <CardContent>
        {details?.openingStockLocked ? (
          <Alert variant="warning">
            <Lock className="h-4 w-4" />
            <AlertTitle>Locked</AlertTitle>
            <AlertDescription>
              Opening stock was locked on {new Date(details.openingStockLockedAt).toLocaleString()}.
              Contact administrator to unlock.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Unit Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Total Value</Label>
              <div className="text-2xl font-bold">${(quantity * unitCost).toFixed(2)}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSetOpeningStock}>
                Set Opening Stock
              </Button>
              {details?.openingStockSet && (
                <Button onClick={handleLock} variant="outline">
                  Lock Opening Stock
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

## Best Practices

### ✅ DO:
- **Lock opening stock** after verification period
- **Require password** for lock/unlock operations
- **Create detailed audit logs** for all opening stock operations
- **Validate quantities and costs** are non-negative
- **Create stock transaction** when setting opening stock
- **Support bulk import** for efficiency
- **Prevent modification** after transactions exist
- **Log unlock actions** with reason and security flags

### ❌ DON'T:
- **Don't allow unlocking without password + reason**
- **Don't skip audit logs** for unlock operations
- **Don't allow negative quantities/costs**
- **Don't modify after lock** without proper unlock
- **Don't forget to create stock transaction**
- **Don't allow opening stock changes** after regular transactions
- **Don't skip multi-tenant validation**

## Security Considerations

```typescript
// Monitor opening stock unlocks
async function getOpeningStockUnlocks(businessId: number, days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const unlocks = await prisma.auditLog.findMany({
    where: {
      businessId,
      action: 'PRODUCT_OPENING_STOCK_UNLOCK',
      createdAt: { gte: since }
    },
    include: {
      user: { select: { username: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return unlocks
}

// Alert on suspicious unlocks
if (unlocks.length > 5) {
  console.warn(`⚠️ High number of opening stock unlocks: ${unlocks.length} in last ${days} days`)
  // Send alert to management
}
```

## Related Skills
- `pos-inventory-transaction-logger` - Creates opening stock transactions
- `pos-audit-trail-architect` - Logs lock/unlock actions
- `pos-product-variation-builder` - Creates products that need opening stock
- `pos-bulk-import-wizard` - Imports opening stock from CSV

## References
- Schema: `/prisma/schema.prisma` lines 737-764 (VariationLocationDetails)
- RBAC: `/src/lib/rbac.ts` (PRODUCT_OPENING_STOCK, PRODUCT_LOCK_OPENING_STOCK, PRODUCT_UNLOCK_OPENING_STOCK)
- CLAUDE.md: Opening stock locking requirements
