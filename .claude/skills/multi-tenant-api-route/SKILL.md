# multi-tenant-api-route

## Purpose
Creates secure, multi-tenant API routes with proper authentication, authorization, and business data isolation. This skill ensures every API route properly validates users and isolates data by `businessId`.

## When to Use
- Creating ANY new API route in `/src/app/api/`
- Modifying existing API routes
- Implementing GET, POST, PUT, DELETE endpoints
- Any operation that accesses business data

## Critical Security Pattern

### The Standard API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET endpoint example
export async function GET(request: NextRequest) {
  try {
    // STEP 1: Authenticate user
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // STEP 2: Extract user details
    const user = session.user as any
    const businessId = user.businessId  // Multi-tenant key

    // STEP 3: Check permissions (if required)
    if (!user.permissions?.includes(PERMISSIONS.RESOURCE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // STEP 4: Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // STEP 5: Build query with MANDATORY businessId filter
    const where: any = {
      businessId: parseInt(businessId),  // ⚠️ CRITICAL: Always filter by businessId
      deletedAt: null,  // Soft delete pattern
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    // STEP 6: Execute query
    const items = await prisma.yourModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    })

    // STEP 7: Return response
    return NextResponse.json(items)

  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

// POST endpoint example
export async function POST(request: NextRequest) {
  try {
    // STEP 1: Authenticate
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    // STEP 2: Check permissions
    if (!user.permissions?.includes(PERMISSIONS.RESOURCE_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // STEP 3: Parse request body
    const body = await request.json()
    const { name, description, isActive = true } = body

    // STEP 4: Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // STEP 5: Create record with businessId
    const item = await prisma.yourModel.create({
      data: {
        businessId: parseInt(businessId),  // ⚠️ CRITICAL: Set businessId
        name: name.trim(),
        description,
        isActive,
        createdBy: parseInt(userId),
      },
    })

    // STEP 6: Return created resource
    return NextResponse.json(item, { status: 201 })

  } catch (error) {
    console.error('Error creating item:', error)
    return NextResponse.json(
      {
        error: 'Failed to create item',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

## Session User Object Structure

After authentication, `session.user` contains:

```typescript
{
  id: string                 // User ID
  username: string          // Login username
  firstName: string         // First name
  lastName: string          // Last name
  surname: string           // Surname
  email: string            // Email address
  businessId: string       // ⚠️ CRITICAL: Multi-tenant isolation key
  businessName: string     // Business name
  permissions: string[]    // Array of permission codes
  roles: string[]          // Array of role names
  locationIds: number[]    // Accessible location IDs
}
```

### Accessing User Properties

```typescript
const user = session.user as any

// User identification
const userId = user.id              // String: "123"
const username = user.username      // String: "john.doe"
const fullName = `${user.firstName} ${user.lastName}`

// Business context
const businessId = user.businessId  // String: "1"
const businessName = user.businessName

// Permissions
const hasPermission = user.permissions?.includes(PERMISSIONS.PRODUCT_CREATE)
const isAdmin = user.roles?.includes('Super Admin')

// Location access
const accessibleLocations = user.locationIds  // number[]
```

## Multi-Tenant Data Isolation

### ✅ MANDATORY Pattern

**Every query MUST include `businessId` filter:**

```typescript
// ✅ CORRECT: Filters by businessId
const products = await prisma.product.findMany({
  where: {
    businessId: parseInt(businessId),  // Always required
    deletedAt: null,
  },
})

// ✅ CORRECT: Verify ownership before operations
const product = await prisma.product.findFirst({
  where: {
    id: productId,
    businessId: parseInt(businessId),  // Prevents cross-tenant access
  },
})

if (!product) {
  return NextResponse.json(
    { error: 'Product not found or access denied' },
    { status: 404 }
  )
}
```

### ❌ CRITICAL SECURITY FLAW

**NEVER query without businessId filter:**

```typescript
// ❌ WRONG: Exposes data from all businesses
const products = await prisma.product.findMany({
  where: {
    id: productId,  // Missing businessId!
  },
})

// ❌ WRONG: User can access other businesses' data
const sale = await prisma.sale.findUnique({
  where: { id: saleId }  // Missing businessId validation!
})
```

## Permission Checking

### Standard Permission Check

```typescript
import { PERMISSIONS } from '@/lib/rbac'

// Check single permission
if (!user.permissions?.includes(PERMISSIONS.PRODUCT_CREATE)) {
  return NextResponse.json(
    { error: 'Forbidden - Insufficient permissions' },
    { status: 403 }
  )
}

// Check multiple permissions (any)
const hasAnyPermission = [
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.PRODUCT_VIEW_OWN
].some(perm => user.permissions?.includes(perm))

if (!hasAnyPermission) {
  return NextResponse.json(
    { error: 'Forbidden - Insufficient permissions' },
    { status: 403 }
  )
}

// Check role
if (!user.roles?.includes('Super Admin')) {
  return NextResponse.json(
    { error: 'Forbidden - Admin access required' },
    { status: 403 }
  )
}
```

### Available Permissions

Import from `@/lib/rbac`:

```typescript
PERMISSIONS.PRODUCT_VIEW
PERMISSIONS.PRODUCT_CREATE
PERMISSIONS.PRODUCT_EDIT
PERMISSIONS.PRODUCT_DELETE
PERMISSIONS.SALE_VIEW
PERMISSIONS.SALE_CREATE
PERMISSIONS.PURCHASE_VIEW
PERMISSIONS.PURCHASE_CREATE
// ... and many more
```

## Common Patterns

### Pattern 1: List with Pagination

```typescript
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as any
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const where: any = {
    businessId: parseInt(user.businessId),
    deletedAt: null,
  }

  const [items, total] = await Promise.all([
    prisma.yourModel.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.yourModel.count({ where }),
  ])

  return NextResponse.json({
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
}
```

### Pattern 2: Get Single Record by ID

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as any
  const id = parseInt((await params).id)

  // Find with businessId validation
  const item = await prisma.yourModel.findFirst({
    where: {
      id,
      businessId: parseInt(user.businessId),  // ⚠️ CRITICAL
      deletedAt: null,
    },
  })

  if (!item) {
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(item)
}
```

### Pattern 3: Update with Ownership Verification

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as any

  if (!user.permissions?.includes(PERMISSIONS.RESOURCE_EDIT)) {
    return NextResponse.json(
      { error: 'Forbidden - Insufficient permissions' },
      { status: 403 }
    )
  }

  const id = parseInt((await params).id)
  const body = await request.json()

  // Verify ownership before update
  const existing = await prisma.yourModel.findFirst({
    where: {
      id,
      businessId: parseInt(user.businessId),
      deletedAt: null,
    },
  })

  if (!existing) {
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    )
  }

  // Update
  const updated = await prisma.yourModel.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}
```

### Pattern 4: Soft Delete

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as any

  if (!user.permissions?.includes(PERMISSIONS.RESOURCE_DELETE)) {
    return NextResponse.json(
      { error: 'Forbidden - Insufficient permissions' },
      { status: 403 }
    )
  }

  const id = parseInt((await params).id)

  // Verify ownership
  const item = await prisma.yourModel.findFirst({
    where: {
      id,
      businessId: parseInt(user.businessId),
      deletedAt: null,
    },
  })

  if (!item) {
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    )
  }

  // Soft delete
  await prisma.yourModel.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy: parseInt(user.id),
    },
  })

  return NextResponse.json(
    { message: 'Item deleted successfully' },
    { status: 200 }
  )
}
```

### Pattern 5: Related Records with businessId

```typescript
// When querying related records, ensure businessId is checked
const sale = await prisma.sale.findFirst({
  where: {
    id: saleId,
    businessId: parseInt(user.businessId),
  },
  include: {
    items: {
      include: {
        product: {
          where: {
            businessId: parseInt(user.businessId),  // Also check related
          },
        },
      },
    },
    customer: {
      where: {
        businessId: parseInt(user.businessId),  // Also check related
      },
    },
  },
})
```

## Error Handling

### Standard Error Responses

```typescript
// 401 Unauthorized - Not logged in
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
)

// 403 Forbidden - Logged in but no permission
return NextResponse.json(
  { error: 'Forbidden - Insufficient permissions' },
  { status: 403 }
)

// 404 Not Found
return NextResponse.json(
  { error: 'Resource not found' },
  { status: 404 }
)

// 400 Bad Request - Validation error
return NextResponse.json(
  { error: 'Name is required' },
  { status: 400 }
)

// 500 Internal Server Error
return NextResponse.json(
  {
    error: 'Failed to process request',
    details: error instanceof Error ? error.message : 'Unknown error',
  },
  { status: 500 }
)
```

### Try-Catch Pattern

```typescript
export async function POST(request: NextRequest) {
  try {
    // ... implementation
  } catch (error) {
    console.error('Error in API route:', error)

    // Provide helpful error message
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

## Security Checklist

Before deploying any API route, verify:

- [ ] ✅ Authentication check using `getServerSession(authOptions)`
- [ ] ✅ User extracted as `const user = session.user as any`
- [ ] ✅ BusinessId extracted as `const businessId = user.businessId`
- [ ] ✅ Permission check using `user.permissions?.includes(PERMISSIONS.XXX)`
- [ ] ✅ **ALL queries include `businessId: parseInt(businessId)` filter**
- [ ] ✅ Soft delete filter `deletedAt: null` where applicable
- [ ] ✅ Input validation before database operations
- [ ] ✅ Proper error handling with try-catch
- [ ] ✅ Appropriate HTTP status codes (401, 403, 404, 400, 500)
- [ ] ✅ No sensitive data leaked in error messages

## Common Mistakes

### ❌ Mistake 1: Forgetting businessId

```typescript
// ❌ WRONG: Missing businessId filter
const products = await prisma.product.findMany({
  where: { deletedAt: null }
})
```

```typescript
// ✅ CORRECT: Include businessId
const products = await prisma.product.findMany({
  where: {
    businessId: parseInt(user.businessId),
    deletedAt: null
  }
})
```

### ❌ Mistake 2: Using String Instead of Number

```typescript
// ❌ WRONG: businessId as string
businessId: user.businessId  // "1" as string
```

```typescript
// ✅ CORRECT: Parse to integer
businessId: parseInt(user.businessId)  // 1 as number
```

### ❌ Mistake 3: No Permission Check

```typescript
// ❌ WRONG: No permission validation
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  // ... directly create resource
}
```

```typescript
// ✅ CORRECT: Check permissions
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session.user as any

  if (!user.permissions?.includes(PERMISSIONS.RESOURCE_CREATE)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ... create resource
}
```

### ❌ Mistake 4: Not Verifying Ownership on Update/Delete

```typescript
// ❌ WRONG: Update without ownership check
await prisma.product.update({
  where: { id: productId },
  data: { name: 'New Name' }
})
```

```typescript
// ✅ CORRECT: Verify ownership first
const product = await prisma.product.findFirst({
  where: {
    id: productId,
    businessId: parseInt(user.businessId)
  }
})

if (!product) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

await prisma.product.update({
  where: { id: productId },
  data: { name: 'New Name' }
})
```

## File Structure

API routes are organized as:

```
src/app/api/
├── customers/
│   ├── route.ts           # GET (list), POST (create)
│   ├── [id]/
│   │   ├── route.ts       # GET (one), PUT (update), DELETE
│   │   └── archive/
│   │       └── route.ts   # Custom action
├── products/
│   ├── route.ts
│   └── [id]/
│       └── route.ts
└── sales/
    ├── route.ts
    └── [id]/
        ├── route.ts
        ├── payment/
        │   └── route.ts   # POST sales/123/payment
        └── void/
            └── route.ts   # POST sales/123/void
```

## Summary

This skill ensures:
1. ✅ Proper authentication on every route
2. ✅ Multi-tenant data isolation via businessId
3. ✅ Permission-based authorization
4. ✅ Secure query patterns
5. ✅ Consistent error handling
6. ✅ Protection against cross-tenant data access

**Remember:** Multi-tenant isolation is CRITICAL - always filter by `businessId`!
