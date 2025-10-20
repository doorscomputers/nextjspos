---
name: pos-multi-tenant-validator
description: Validates multi-tenant data isolation and RBAC permissions in UltimatePOS code
---

# POS Multi-Tenant Validator Skill

This skill helps ensure that all database queries, API routes, and components in the UltimatePOS Modern system properly enforce multi-tenant data isolation and RBAC permissions.

## Core Principles

### 1. Multi-Tenant Data Isolation

Every database query MUST filter by `businessId` to ensure tenant isolation:

```typescript
// ✅ CORRECT
const products = await prisma.product.findMany({
  where: {
    businessId: session.user.businessId,
    // ... other conditions
  }
})

// ❌ WRONG - Missing businessId filter
const products = await prisma.product.findMany({
  where: {
    category: 'Electronics'
  }
})
```

### 2. Location-Based Operations

For inventory operations, also filter by `businessLocationId`:

```typescript
// ✅ CORRECT
const stock = await prisma.productHistory.findMany({
  where: {
    businessId: session.user.businessId,
    businessLocationId: userLocation,
    // ... other conditions
  }
})
```

### 3. RBAC Permission Checks

All sensitive operations require permission validation:

```typescript
// In API routes
import { hasPermission } from '@/lib/rbac'
import { PERMISSIONS } from '@/lib/rbac'

const session = await getServerSession(authOptions)
if (!hasPermission(session.user, PERMISSIONS.PRODUCT_CREATE)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

## Validation Checklist

When reviewing or creating code, check:

### API Routes (`src/app/api/**/route.ts`)

- [ ] Session authentication present
- [ ] Permission check for sensitive operations
- [ ] All Prisma queries include `businessId` filter
- [ ] Location-specific queries include `businessLocationId`
- [ ] Error responses don't leak tenant data

### Components (`src/app/dashboard/**/page.tsx`, `src/components/**`)

- [ ] Client components use `usePermissions()` hook
- [ ] UI elements conditionally rendered based on permissions
- [ ] Forms validate user's assigned location
- [ ] Data fetching respects tenant boundaries

### Database Operations

- [ ] All `findMany`, `findFirst`, `findUnique` include tenant filters
- [ ] Update/delete operations verify ownership via businessId
- [ ] Aggregations scoped to businessId
- [ ] Relations properly filtered

## Common Patterns

### Pattern 1: API Route Template

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasPermission(session.user, PERMISSIONS.PRODUCT_VIEW)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await prisma.product.findMany({
    where: { businessId: session.user.businessId }
  })

  return NextResponse.json(data)
}
```

### Pattern 2: Component with Permissions

```typescript
'use client'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

export default function ProductsPage() {
  const { can, user } = usePermissions()

  return (
    <div>
      {can(PERMISSIONS.PRODUCT_CREATE) && (
        <button>Add Product</button>
      )}
      {/* ... */}
    </div>
  )
}
```

### Pattern 3: Location-Specific Operations

```typescript
// For inventory operations
const userLocation = session.user.businessLocationId

await prisma.productHistory.create({
  data: {
    businessId: session.user.businessId,
    businessLocationId: userLocation,
    productId,
    quantity,
    type: 'IN',
    // ...
  }
})
```

## Red Flags to Watch For

1. **No businessId filter**: Any Prisma query without businessId
2. **Hardcoded IDs**: Using specific IDs without tenant validation
3. **Missing permission checks**: Sensitive operations without RBAC
4. **Cross-tenant references**: Allowing users to reference other tenants' data
5. **Exposed tenant info**: Error messages revealing other tenants

## Testing Multi-Tenancy

When testing, verify:

1. User A cannot access User B's data (different businesses)
2. User with limited permissions cannot perform restricted actions
3. Location-based operations respect user's assigned location
4. API returns 403 for unauthorized permission attempts
5. Database queries always include tenant filters

## Integration with Existing Code

This skill integrates with:

- **RBAC system**: `src/lib/rbac.ts`
- **Auth config**: `src/lib/auth.ts`
- **Permissions hook**: `src/hooks/usePermissions.ts`
- **Prisma client**: `src/lib/prisma.ts`

## When to Use This Skill

Invoke this skill when:

- Creating new API routes
- Building new dashboard pages
- Reviewing existing code for security
- Debugging authorization issues
- Implementing new features that access database
- Refactoring queries or components
