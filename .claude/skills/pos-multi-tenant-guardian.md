# pos-multi-tenant-guardian

## Purpose
Enforces bulletproof multi-tenant data isolation across all database queries and operations. Prevents data leakage between businesses and ensures users can only access data belonging to their business.

## When to Use
- **EVERY database query** in API routes
- **EVERY create/update/delete operation**
- Before displaying any data to users
- When validating user permissions
- In reports and analytics

## Critical Requirements

### 1. Universal businessId Filtering
**EVERY query MUST include businessId:**
```typescript
// ✅ CORRECT: Always filter by businessId
const products = await prisma.product.findMany({
  where: {
    businessId: session.user.businessId,  // MANDATORY
    // ... other filters
  }
})

// ❌ WRONG: Missing businessId filter
const products = await prisma.product.findMany({
  where: { category: 'Electronics' }  // DANGER: Cross-tenant data leak!
})
```

### 2. Location-Based Access Control
Users can be restricted to specific locations:
```typescript
// Super Admin / Full Access roles: see all locations
if (user.permissions.includes('ACCESS_ALL_LOCATIONS')) {
  // No location restriction
}

// Regular users: restricted to assigned locations
const accessibleLocationIds = getUserAccessibleLocationIds(user)
if (accessibleLocationIds !== null) {
  where.locationId = { in: accessibleLocationIds }
}
```

### 3. Nested Relation Validation
Validate tenant ownership in nested relations:
```typescript
// When updating a sale item, verify the sale belongs to user's business
const saleItem = await prisma.saleItem.findUnique({
  where: { id: itemId },
  include: {
    sale: { select: { businessId: true } }
  }
})

if (saleItem.sale.businessId !== user.businessId) {
  throw new Error('Access denied: Resource belongs to different business')
}
```

## Implementation Patterns

### Pattern 1: API Route with Multi-Tenant Filtering

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAccessibleLocationIds } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  // 1. SESSION CHECK
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  // 2. PERMISSION CHECK
  if (!user.permissions?.includes('PRODUCT_VIEW')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. EXTRACT QUERY PARAMETERS
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')
  const category = searchParams.get('category')

  // 4. BUILD WHERE CLAUSE WITH businessId
  const where: any = {
    businessId: user.businessId,  // ⚡ CRITICAL: Multi-tenant isolation
    deletedAt: null
  }

  // 5. LOCATION-BASED ACCESS CONTROL
  const accessibleLocationIds = getUserAccessibleLocationIds(user)

  if (locationId) {
    // User requested specific location
    const requestedLocationId = parseInt(locationId)

    // Verify user has access to this location
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(requestedLocationId)) {
      return NextResponse.json({
        error: 'Access denied: You do not have access to this location'
      }, { status: 403 })
    }

    where.locationId = requestedLocationId
  } else if (accessibleLocationIds !== null) {
    // User is restricted to specific locations
    where.locationId = { in: accessibleLocationIds }
  }
  // else: User has ACCESS_ALL_LOCATIONS, no filter needed

  // 6. ADDITIONAL FILTERS (always within businessId scope)
  if (category) {
    where.category = category
  }

  // 7. EXECUTE QUERY
  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      variations: {
        include: {
          locationDetails: {
            where: accessibleLocationIds !== null
              ? { locationId: { in: accessibleLocationIds } }
              : undefined
          }
        }
      }
    }
  })

  return NextResponse.json({ products })
}
```

### Pattern 2: Creating Records with Tenant Ownership

```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user
  const body = await request.json()

  // VALIDATION: Verify related records belong to user's business
  if (body.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: body.supplierId },
      select: { businessId: true }
    })

    if (!supplier || supplier.businessId !== user.businessId) {
      return NextResponse.json({
        error: 'Invalid supplier: Supplier does not belong to your business'
      }, { status: 400 })
    }
  }

  if (body.locationId) {
    const location = await prisma.businessLocation.findUnique({
      where: { id: body.locationId },
      select: { businessId: true }
    })

    if (!location || location.businessId !== user.businessId) {
      return NextResponse.json({
        error: 'Invalid location: Location does not belong to your business'
      }, { status: 400 })
    }

    // Check user access to location
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(body.locationId)) {
      return NextResponse.json({
        error: 'Access denied: You do not have access to this location'
      }, { status: 403 })
    }
  }

  // CREATE with businessId
  const purchase = await prisma.purchase.create({
    data: {
      businessId: user.businessId,  // ⚡ ALWAYS set on create
      supplierId: body.supplierId,
      locationId: body.locationId,
      userId: user.id,
      // ... other fields
    }
  })

  return NextResponse.json({ success: true, purchase })
}
```

### Pattern 3: Updating Records with Tenant Verification

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user
  const recordId = parseInt(params.id)

  // FETCH and VERIFY tenant ownership
  const existingRecord = await prisma.product.findUnique({
    where: { id: recordId },
    select: { id: true, businessId: true, name: true }
  })

  if (!existingRecord) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ⚡ CRITICAL: Verify record belongs to user's business
  if (existingRecord.businessId !== user.businessId) {
    return NextResponse.json({
      error: 'Access denied: This resource belongs to a different business'
    }, { status: 403 })
  }

  // UPDATE (no need to set businessId again, it's immutable)
  const body = await request.json()
  const updated = await prisma.product.update({
    where: { id: recordId },
    data: {
      name: body.name,
      // ... other updatable fields
      // DO NOT update businessId - it should never change
    }
  })

  return NextResponse.json({ success: true, product: updated })
}
```

### Pattern 4: Deleting Records with Tenant Verification

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user
  const recordId = parseInt(params.id)

  // Soft delete with tenant verification
  const record = await prisma.product.findUnique({
    where: { id: recordId },
    select: { businessId: true }
  })

  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ⚡ CRITICAL: Verify ownership before deletion
  if (record.businessId !== user.businessId) {
    return NextResponse.json({
      error: 'Access denied'
    }, { status: 403 })
  }

  // Soft delete
  await prisma.product.update({
    where: { id: recordId },
    data: {
      deletedAt: new Date(),
      deletedBy: user.id
    }
  })

  return NextResponse.json({ success: true })
}
```

### Pattern 5: Location Access Control Helper

```typescript
import { SessionUser } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * Get location IDs user can access
 * @returns null if user has ACCESS_ALL_LOCATIONS (no restriction)
 * @returns number[] of accessible location IDs if restricted
 */
export function getUserAccessibleLocationIds(user: SessionUser): number[] | null {
  // Super Admin or users with ACCESS_ALL_LOCATIONS permission
  if (
    user.isSuperAdmin ||
    user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
  ) {
    return null  // No restriction
  }

  // Return user's assigned locations
  return user.assignedLocationIds || []
}

/**
 * Check if user has access to specific location
 */
export function hasAccessToLocation(user: SessionUser, locationId: number): boolean {
  const accessibleLocationIds = getUserAccessibleLocationIds(user)

  if (accessibleLocationIds === null) {
    return true  // User has access to all locations
  }

  return accessibleLocationIds.includes(locationId)
}

/**
 * Generate Prisma where clause for location filtering
 */
export function getLocationWhereClause(
  user: SessionUser,
  fieldName: string = 'locationId'
): any {
  const accessibleLocationIds = getUserAccessibleLocationIds(user)

  if (accessibleLocationIds === null) {
    return {}  // No filter needed
  }

  return {
    [fieldName]: { in: accessibleLocationIds }
  }
}
```

### Pattern 6: Bulk Operations with Tenant Safety

```typescript
// Bulk delete with tenant verification
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const body = await request.json()
  const { ids } = body  // Array of IDs to delete

  // Verify ALL records belong to user's business
  const records = await prisma.product.findMany({
    where: {
      id: { in: ids },
      businessId: session.user.businessId  // ⚡ Filter by businessId
    },
    select: { id: true }
  })

  // If count mismatch, some IDs don't belong to this business
  if (records.length !== ids.length) {
    return NextResponse.json({
      error: 'Invalid request: Some records do not belong to your business'
    }, { status: 400 })
  }

  // Safe to bulk delete
  await prisma.product.updateMany({
    where: {
      id: { in: ids },
      businessId: session.user.businessId  // ⚡ Double-check
    },
    data: {
      deletedAt: new Date(),
      deletedBy: session.user.id
    }
  })

  return NextResponse.json({ success: true, deletedCount: ids.length })
}
```

## Location Access Control Examples

### Example 1: User with Full Access
```typescript
// User has ACCESS_ALL_LOCATIONS permission
const user = {
  id: 1,
  businessId: 5,
  permissions: ['PRODUCT_VIEW', 'ACCESS_ALL_LOCATIONS'],
  assignedLocationIds: []
}

const accessibleLocationIds = getUserAccessibleLocationIds(user)
// Returns: null (no restriction)

// Query all products across all business locations
const products = await prisma.product.findMany({
  where: {
    businessId: user.businessId  // Only business filter
  }
})
```

### Example 2: User Restricted to Specific Locations
```typescript
// User assigned to locations 10 and 20
const user = {
  id: 2,
  businessId: 5,
  permissions: ['PRODUCT_VIEW'],
  assignedLocationIds: [10, 20]
}

const accessibleLocationIds = getUserAccessibleLocationIds(user)
// Returns: [10, 20]

// Query products only from assigned locations
const where = {
  businessId: user.businessId,
  variations: {
    some: {
      locationDetails: {
        some: {
          locationId: { in: accessibleLocationIds }
        }
      }
    }
  }
}
```

### Example 3: Verify User Access Before Operation
```typescript
// User tries to create a transfer from location 15
const requestedFromLocationId = 15

if (!hasAccessToLocation(user, requestedFromLocationId)) {
  return NextResponse.json({
    error: 'Access denied: You do not have access to source location'
  }, { status: 403 })
}

// Proceed with transfer creation
```

## Multi-Tenant Audit Trail

Always log tenant context in audit logs:

```typescript
import { createAuditLog } from '@/lib/auditLog'

await createAuditLog({
  businessId: session.user.businessId,  // ⚡ Tenant context
  userId: session.user.id,
  username: session.user.username,
  action: 'PRODUCT_UPDATE',
  entityType: 'PRODUCT',
  entityIds: [product.id.toString()],
  description: `Updated product: ${product.name}`,
  metadata: {
    productId: product.id,
    businessId: session.user.businessId,  // Include in metadata too
    changes: { before: oldValues, after: newValues }
  }
})
```

## Security Checklist

### ✅ Before Deploying Any API Route:
- [ ] Session authentication check present
- [ ] Permission validation present
- [ ] businessId included in ALL queries
- [ ] businessId set on ALL creates
- [ ] Tenant ownership verified before updates/deletes
- [ ] Location access control applied where needed
- [ ] Related records validated for tenant ownership
- [ ] Bulk operations verify ALL records
- [ ] Audit logs include businessId
- [ ] Error messages don't leak cross-tenant data

## Common Vulnerabilities to Avoid

### ❌ Vulnerability 1: Missing businessId Filter
```typescript
// DANGER: Returns products from ALL businesses
const products = await prisma.product.findMany({
  where: { category: 'Electronics' }
})
```

### ❌ Vulnerability 2: Direct ID Access Without Verification
```typescript
// DANGER: User can access any product by guessing IDs
const product = await prisma.product.findUnique({
  where: { id: parseInt(params.id) }
})
// Missing: businessId verification!
```

### ❌ Vulnerability 3: Trusting Client-Provided businessId
```typescript
// DANGER: Client could send different businessId
const body = await request.json()
await prisma.product.create({
  data: {
    businessId: body.businessId,  // ❌ NEVER trust client
    name: body.name
  }
})

// CORRECT: Use session businessId
await prisma.product.create({
  data: {
    businessId: session.user.businessId,  // ✅ From server session
    name: body.name
  }
})
```

### ❌ Vulnerability 4: Nested Relations Without Validation
```typescript
// DANGER: Updating sale item without verifying sale ownership
const body = await request.json()
await prisma.saleItem.update({
  where: { id: itemId },
  data: { quantity: body.quantity }
})

// CORRECT: Verify parent record ownership
const saleItem = await prisma.saleItem.findUnique({
  where: { id: itemId },
  include: { sale: { select: { businessId: true } } }
})

if (saleItem.sale.businessId !== user.businessId) {
  throw new Error('Access denied')
}
```

## Testing Multi-Tenant Isolation

```typescript
// Test script to verify tenant isolation
async function testTenantIsolation() {
  // Setup: Create 2 businesses with products
  const business1 = await prisma.business.create({ data: { name: 'Business 1' } })
  const business2 = await prisma.business.create({ data: { name: 'Business 2' } })

  const product1 = await prisma.product.create({
    data: { businessId: business1.id, name: 'Product 1' }
  })
  const product2 = await prisma.product.create({
    data: { businessId: business2.id, name: 'Product 2' }
  })

  // Test: User from business1 should NOT see product2
  const user1Products = await prisma.product.findMany({
    where: { businessId: business1.id }
  })

  console.assert(user1Products.length === 1, 'Should only see 1 product')
  console.assert(user1Products[0].id === product1.id, 'Should only see own product')
  console.assert(!user1Products.find(p => p.id === product2.id), 'Should NOT see other business product')

  console.log('✅ Multi-tenant isolation test passed')
}
```

## Best Practices

### ✅ DO:
- **Always include businessId** in where clauses
- **Always verify tenant ownership** before updates/deletes
- **Always use session.user.businessId** (never trust client)
- **Always validate related records** belong to same business
- **Apply location access control** for restricted users
- **Log businessId** in all audit trails
- **Test tenant isolation** regularly

### ❌ DON'T:
- **Never trust client-provided businessId**
- **Never skip tenant verification** in updates/deletes
- **Never query without businessId filter**
- **Never expose cross-tenant data** in error messages
- **Never allow businessId changes** after creation
- **Never assume user has access** to all locations

## Related Skills
- `pos-audit-trail-architect` - Logs tenant context in audits
- `pos-data-validator` - Validates tenant ownership
- `pos-api-route-creator` - Creates secure multi-tenant APIs

## References
- Auth: `/src/lib/auth.ts` (Session user structure)
- RBAC: `/src/lib/rbac.ts` lines 426-505 (Location access control)
- Example: `/src/app/api/inventory-corrections/route.ts` (Multi-tenant pattern)
- Schema: `/prisma/schema.prisma` (businessId relationships)
