---
name: pos-api-route-creator
description: Template for creating secure, multi-tenant API routes in UltimatePOS with proper error handling
---

# POS API Route Creator Skill

This skill provides standardized templates for creating API routes in the UltimatePOS Modern system with proper authentication, authorization, multi-tenant isolation, and error handling.

## Route Types

### 1. GET Routes (List/Read)
- Fetch multiple records
- Fetch single record by ID
- Search and filtering

### 2. POST Routes (Create)
- Create new records
- Batch operations
- File uploads

### 3. PUT/PATCH Routes (Update)
- Update existing records
- Partial updates

### 4. DELETE Routes (Remove)
- Delete records
- Soft delete

## Standard API Route Template

### GET Route (List with Filtering)

```typescript
// src/app/api/[resource]/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Permission check
    if (!hasPermission(session.user, PERMISSIONS.RESOURCE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const locationId = searchParams.get('locationId')

    // 4. Build filters
    const where = {
      businessId: session.user.businessId, // Multi-tenant isolation
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ]
      }),
      ...(locationId && { businessLocationId: locationId }),
    }

    // 5. Fetch data with pagination
    const [data, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // Include relations as needed
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.resource.count({ where }),
    ])

    // 6. Return response with metadata
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching resources:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### GET Route (Single Record by ID)

```typescript
// src/app/api/[resource]/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.RESOURCE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resource = await prisma.resource.findFirst({
      where: {
        id: params.id,
        businessId: session.user.businessId, // Prevent cross-tenant access
      },
      include: {
        // Include relations
      },
    })

    if (!resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(resource)
  } catch (error) {
    console.error('Error fetching resource:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### POST Route (Create)

```typescript
// src/app/api/[resource]/route.ts
import { z } from 'zod'

// Define validation schema
const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  // Add more fields
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.RESOURCE_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Create resource with tenant isolation
    const resource = await prisma.resource.create({
      data: {
        ...data,
        businessId: session.user.businessId,
        createdBy: session.user.id,
      },
      include: {
        // Include relations for response
      },
    })

    return NextResponse.json(resource, { status: 201 })
  } catch (error) {
    console.error('Error creating resource:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### PUT/PATCH Route (Update)

```typescript
// src/app/api/[resource]/[id]/route.ts
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  // Fields are optional for partial updates
})

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.RESOURCE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify resource exists and belongs to user's business
    const existing = await prisma.resource.findFirst({
      where: {
        id: params.id,
        businessId: session.user.businessId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validationResult = updateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    // Update resource
    const updated = await prisma.resource.update({
      where: { id: params.id },
      data: {
        ...validationResult.data,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
      include: {
        // Include relations
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating resource:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### DELETE Route

```typescript
// src/app/api/[resource]/[id]/route.ts
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.RESOURCE_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify resource exists and belongs to user's business
    const existing = await prisma.resource.findFirst({
      where: {
        id: params.id,
        businessId: session.user.businessId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    // Option 1: Hard delete
    await prisma.resource.delete({
      where: { id: params.id },
    })

    // Option 2: Soft delete (if deletedAt field exists)
    // await prisma.resource.update({
    //   where: { id: params.id },
    //   data: {
    //     deletedAt: new Date(),
    //     deletedBy: session.user.id,
    //   },
    // })

    return NextResponse.json({
      message: 'Resource deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Advanced Patterns

### Batch Operations

```typescript
export async function POST(request: Request) {
  // For batch create/update/delete
  const body = await request.json()
  const { ids, action, data } = body

  if (action === 'delete') {
    await prisma.resource.deleteMany({
      where: {
        id: { in: ids },
        businessId: session.user.businessId, // Important!
      },
    })
  }

  return NextResponse.json({ message: 'Batch operation completed' })
}
```

### File Upload

```typescript
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Process file upload
  const buffer = await file.arrayBuffer()
  // Save to storage or process

  return NextResponse.json({ message: 'File uploaded' })
}
```

### Transaction with Inventory Update

```typescript
export async function POST(request: Request) {
  // Use Prisma transaction for atomic operations
  const result = await prisma.$transaction(async (tx) => {
    // Create sale
    const sale = await tx.sale.create({
      data: { /* ... */ },
    })

    // Update inventory
    await tx.productHistory.create({
      data: {
        productId: item.productId,
        type: 'OUT',
        quantity: item.quantity,
        businessId: session.user.businessId,
        businessLocationId: session.user.businessLocationId,
      },
    })

    return sale
  })

  return NextResponse.json(result)
}
```

## Error Handling Best Practices

```typescript
try {
  // Route logic
} catch (error) {
  // Log error with context
  console.error('Error in [resource] route:', {
    error,
    userId: session?.user?.id,
    businessId: session?.user?.businessId,
    path: request.url,
  })

  // Return user-friendly error
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A resource with this value already exists' },
        { status: 409 }
      )
    }
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

## Response Formats

### Success Response
```json
{
  "data": { /* resource */ },
  "message": "Operation successful"
}
```

### List Response with Pagination
```json
{
  "data": [ /* resources */ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": [ /* validation errors */ ]
}
```

## When to Use This Skill

Invoke this skill when:

- Creating new API endpoints
- Implementing CRUD operations
- Adding batch operations
- Building file upload endpoints
- Refactoring existing routes for security
- Adding pagination to list endpoints
- Implementing complex transactions
