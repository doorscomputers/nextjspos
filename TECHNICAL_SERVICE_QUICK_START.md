# Technical Service & Warranty Management - Quick Start Guide

## For Developers

Quick reference for implementing Technical Service features with proper RBAC.

---

## 1. Import Permissions

```typescript
import { PERMISSIONS, hasPermission } from '@/lib/rbac'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
```

---

## 2. API Route Template

### Create Warranty Claim
```typescript
// src/app/api/service/warranty-claims/route.ts

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // 1. Get session
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check permission
  if (!hasPermission(session.user, PERMISSIONS.WARRANTY_CLAIM_VIEW)) {
    return Response.json(
      { error: 'Forbidden - Missing WARRANTY_CLAIM_VIEW permission' },
      { status: 403 }
    )
  }

  // 3. Query with multi-tenant isolation
  const claims = await prisma.warrantyClaim.findMany({
    where: {
      businessId: session.user.businessId, // CRITICAL - Multi-tenant filter
    },
    include: {
      customer: true,
      product: true,
      assignedTechnician: true,
    },
  })

  return Response.json({ claims })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasPermission(session.user, PERMISSIONS.WARRANTY_CLAIM_CREATE)) {
    return Response.json(
      { error: 'Forbidden - Missing WARRANTY_CLAIM_CREATE permission' },
      { status: 403 }
    )
  }

  const data = await req.json()

  const claim = await prisma.warrantyClaim.create({
    data: {
      ...data,
      businessId: session.user.businessId, // CRITICAL - Assign to user's business
      createdById: session.user.id,
      status: 'PENDING',
    },
  })

  return Response.json({ claim }, { status: 201 })
}
```

### Approve Warranty Claim
```typescript
// src/app/api/service/warranty-claims/[id]/approve/route.ts

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check approval permission
  if (!hasPermission(session.user, PERMISSIONS.WARRANTY_CLAIM_APPROVE)) {
    return Response.json(
      { error: 'Forbidden - Missing WARRANTY_CLAIM_APPROVE permission' },
      { status: 403 }
    )
  }

  // Verify claim exists and belongs to user's business
  const claim = await prisma.warrantyClaim.findFirst({
    where: {
      id: params.id,
      businessId: session.user.businessId, // Multi-tenant check
    },
  })

  if (!claim) {
    return Response.json({ error: 'Warranty claim not found' }, { status: 404 })
  }

  // Update claim
  const updatedClaim = await prisma.warrantyClaim.update({
    where: { id: params.id },
    data: {
      status: 'APPROVED',
      approvedById: session.user.id,
      approvedAt: new Date(),
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      businessId: session.user.businessId,
      action: 'WARRANTY_CLAIM_APPROVED',
      entityType: 'WarrantyClaim',
      entityId: claim.id,
      metadata: {
        claimNumber: claim.claimNumber,
      },
    },
  })

  return Response.json({ claim: updatedClaim })
}
```

### Assign Technician
```typescript
// src/app/api/service/warranty-claims/[id]/assign/route.ts

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasPermission(session.user, PERMISSIONS.WARRANTY_CLAIM_ASSIGN)) {
    return Response.json(
      { error: 'Forbidden - Missing WARRANTY_CLAIM_ASSIGN permission' },
      { status: 403 }
    )
  }

  const { technicianId } = await req.json()

  // Verify claim belongs to business
  const claim = await prisma.warrantyClaim.findFirst({
    where: {
      id: params.id,
      businessId: session.user.businessId,
    },
  })

  if (!claim) {
    return Response.json({ error: 'Warranty claim not found' }, { status: 404 })
  }

  // Verify technician belongs to business
  const technician = await prisma.technician.findFirst({
    where: {
      id: technicianId,
      businessId: session.user.businessId,
    },
  })

  if (!technician) {
    return Response.json({ error: 'Technician not found' }, { status: 404 })
  }

  // Assign technician
  const updatedClaim = await prisma.warrantyClaim.update({
    where: { id: params.id },
    data: {
      assignedTechnicianId: technicianId,
      status: 'ASSIGNED',
    },
  })

  return Response.json({ claim: updatedClaim })
}
```

---

## 3. Frontend Component Template

### Warranty Claim List
```typescript
// src/components/WarrantyClaimList.tsx
'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

export function WarrantyClaimList({ claims }: { claims: WarrantyClaim[] }) {
  const { can } = usePermissions()

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h1>Warranty Claims</h1>
        {can(PERMISSIONS.WARRANTY_CLAIM_CREATE) && (
          <button onClick={createClaim}>Create Claim</button>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Claim #</th>
            <th>Customer</th>
            <th>Product</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map(claim => (
            <tr key={claim.id}>
              <td>{claim.claimNumber}</td>
              <td>{claim.customer.name}</td>
              <td>{claim.product.name}</td>
              <td>{claim.status}</td>
              <td>
                {can(PERMISSIONS.WARRANTY_CLAIM_INSPECT) && (
                  <button onClick={() => inspect(claim)}>Inspect</button>
                )}
                {can(PERMISSIONS.WARRANTY_CLAIM_APPROVE) && (
                  <button onClick={() => approve(claim)}>Approve</button>
                )}
                {can(PERMISSIONS.WARRANTY_CLAIM_REJECT) && (
                  <button onClick={() => reject(claim)}>Reject</button>
                )}
                {can(PERMISSIONS.WARRANTY_CLAIM_ASSIGN) && (
                  <button onClick={() => assignTech(claim)}>Assign</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Job Order Editor
```typescript
// src/components/JobOrderEditor.tsx
'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

export function JobOrderEditor({ jobOrder }: { jobOrder: JobOrder }) {
  const { can } = usePermissions()

  return (
    <div className="space-y-4">
      {/* Diagnosis Section */}
      {can(PERMISSIONS.JOB_ORDER_DIAGNOSE) && (
        <section>
          <h2>Diagnosis</h2>
          <textarea
            placeholder="Enter diagnosis findings..."
            onChange={e => updateDiagnosis(e.target.value)}
          />
        </section>
      )}

      {/* Parts Section */}
      {can(PERMISSIONS.JOB_ORDER_ADD_PARTS) && (
        <section>
          <h2>Parts Required</h2>
          <button onClick={addPart}>Add Part</button>
          <ul>
            {jobOrder.parts.map(part => (
              <li key={part.id}>{part.name} - {part.quantity}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Estimate Section */}
      {can(PERMISSIONS.JOB_ORDER_ESTIMATE) && (
        <section>
          <h2>Cost Estimate</h2>
          <input
            type="number"
            placeholder="Labor cost"
            onChange={e => updateEstimate(e.target.value)}
          />
        </section>
      )}

      {/* Repair Actions */}
      <div className="flex gap-2">
        {can(PERMISSIONS.JOB_ORDER_START_REPAIR) && (
          <button onClick={startRepair}>Start Repair</button>
        )}
        {can(PERMISSIONS.JOB_ORDER_COMPLETE) && (
          <button onClick={completeRepair}>Complete</button>
        )}
        {can(PERMISSIONS.JOB_ORDER_QUALITY_CHECK) && (
          <button onClick={qualityCheck}>QC Check</button>
        )}
        {can(PERMISSIONS.JOB_ORDER_CLOSE) && (
          <button onClick={closeJob}>Close Job</button>
        )}
      </div>
    </div>
  )
}
```

---

## 4. Common Permission Checks

### Single Permission
```typescript
if (can(PERMISSIONS.WARRANTY_CLAIM_CREATE)) {
  // Show create button
}
```

### Multiple Permissions (ANY)
```typescript
import { hasAnyPermission } from '@/lib/rbac'

if (hasAnyPermission(user, [
  PERMISSIONS.WARRANTY_CLAIM_APPROVE,
  PERMISSIONS.WARRANTY_CLAIM_REJECT,
])) {
  // Show approval section
}
```

### Multiple Permissions (ALL)
```typescript
import { hasAllPermissions } from '@/lib/rbac'

if (hasAllPermissions(user, [
  PERMISSIONS.JOB_ORDER_EDIT,
  PERMISSIONS.JOB_ORDER_ADD_PARTS,
])) {
  // Show advanced editing
}
```

### Own vs All
```typescript
// Technicians can view only their assigned jobs
if (hasPermission(user, PERMISSIONS.JOB_ORDER_VIEW_OWN) &&
    !hasPermission(user, PERMISSIONS.JOB_ORDER_VIEW)) {

  const myJobs = await prisma.jobOrder.findMany({
    where: {
      businessId: user.businessId,
      assignedToId: user.id, // Own jobs only
    },
  })
}
```

---

## 5. Permission Constants Reference

### Quick Copy-Paste

```typescript
// Serial Numbers
PERMISSIONS.SERIAL_NUMBER_VIEW
PERMISSIONS.SERIAL_NUMBER_CREATE
PERMISSIONS.SERIAL_NUMBER_EDIT
PERMISSIONS.SERIAL_NUMBER_DELETE
PERMISSIONS.SERIAL_NUMBER_LOOKUP
PERMISSIONS.SERIAL_NUMBER_ASSIGN
PERMISSIONS.SERIAL_NUMBER_TRACK
PERMISSIONS.SERIAL_NUMBER_SCAN
PERMISSIONS.SERIAL_NUMBER_TRANSFER

// Technicians
PERMISSIONS.TECHNICIAN_VIEW
PERMISSIONS.TECHNICIAN_CREATE
PERMISSIONS.TECHNICIAN_EDIT
PERMISSIONS.TECHNICIAN_DELETE
PERMISSIONS.TECHNICIAN_ASSIGN
PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW

// Service Types
PERMISSIONS.SERVICE_TYPE_VIEW
PERMISSIONS.SERVICE_TYPE_CREATE
PERMISSIONS.SERVICE_TYPE_EDIT
PERMISSIONS.SERVICE_TYPE_DELETE
PERMISSIONS.SERVICE_TYPE_PRICING_MANAGE

// Warranty Claims
PERMISSIONS.WARRANTY_CLAIM_VIEW
PERMISSIONS.WARRANTY_CLAIM_VIEW_OWN
PERMISSIONS.WARRANTY_CLAIM_CREATE
PERMISSIONS.WARRANTY_CLAIM_ACCEPT
PERMISSIONS.WARRANTY_CLAIM_INSPECT
PERMISSIONS.WARRANTY_CLAIM_ASSIGN
PERMISSIONS.WARRANTY_CLAIM_APPROVE
PERMISSIONS.WARRANTY_CLAIM_REJECT
PERMISSIONS.WARRANTY_CLAIM_UPDATE
PERMISSIONS.WARRANTY_CLAIM_DELETE
PERMISSIONS.WARRANTY_CLAIM_VOID

// Job Orders
PERMISSIONS.JOB_ORDER_VIEW
PERMISSIONS.JOB_ORDER_VIEW_OWN
PERMISSIONS.JOB_ORDER_CREATE
PERMISSIONS.JOB_ORDER_EDIT
PERMISSIONS.JOB_ORDER_DELETE
PERMISSIONS.JOB_ORDER_DIAGNOSE
PERMISSIONS.JOB_ORDER_ADD_PARTS
PERMISSIONS.JOB_ORDER_ESTIMATE
PERMISSIONS.JOB_ORDER_APPROVE_ESTIMATE
PERMISSIONS.JOB_ORDER_START_REPAIR
PERMISSIONS.JOB_ORDER_COMPLETE
PERMISSIONS.JOB_ORDER_QUALITY_CHECK
PERMISSIONS.JOB_ORDER_CLOSE
PERMISSIONS.JOB_ORDER_REOPEN

// Service Payments
PERMISSIONS.SERVICE_PAYMENT_VIEW
PERMISSIONS.SERVICE_PAYMENT_CREATE
PERMISSIONS.SERVICE_PAYMENT_VOID
PERMISSIONS.SERVICE_PAYMENT_REFUND
PERMISSIONS.SERVICE_RECEIPT_PRINT

// Service Reports
PERMISSIONS.SERVICE_REPORT_VIEW
PERMISSIONS.SERVICE_REPORT_EXPORT
PERMISSIONS.SERVICE_WARRANTY_SLIP_VIEW
PERMISSIONS.SERVICE_WARRANTY_SLIP_PRINT
PERMISSIONS.TECHNICIAN_PERFORMANCE_REPORT
PERMISSIONS.REPAIR_ANALYTICS_VIEW
PERMISSIONS.SERVICE_REVENUE_REPORT
PERMISSIONS.WARRANTY_ANALYTICS_VIEW
```

---

## 6. Role Assignment Examples

### Assign Single Role
```typescript
// Assign Technician role
await prisma.user.update({
  where: { id: userId },
  data: {
    roles: {
      connect: { id: technicianRoleId },
    },
  },
})
```

### Assign Multiple Roles
```typescript
// User can be both Technician AND Service Cashier
await prisma.user.update({
  where: { id: userId },
  data: {
    roles: {
      connect: [
        { id: technicianRoleId },
        { id: serviceCashierRoleId },
      ],
    },
  },
})
```

---

## 7. Multi-Tenant Best Practices

### Always Filter by businessId
```typescript
// ❌ WRONG - No multi-tenant filter
const claims = await prisma.warrantyClaim.findMany()

// ✅ CORRECT - Filter by business
const claims = await prisma.warrantyClaim.findMany({
  where: { businessId: session.user.businessId }
})
```

### Verify Ownership Before Updates
```typescript
// ✅ CORRECT - Verify first
const claim = await prisma.warrantyClaim.findFirst({
  where: {
    id: claimId,
    businessId: session.user.businessId, // Critical check
  },
})

if (!claim) {
  return Response.json({ error: 'Not found' }, { status: 404 })
}

// Now safe to update
await prisma.warrantyClaim.update({
  where: { id: claimId },
  data: { status: 'APPROVED' },
})
```

---

## 8. Testing Checklist

### Permission Tests
```typescript
// Test permission check
test('Non-authorized user cannot approve warranty claim', async () => {
  const response = await fetch('/api/service/warranty-claims/123/approve', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${technicianToken}`, // Technician doesn't have APPROVE
    },
  })

  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({
    error: 'Forbidden - Missing WARRANTY_CLAIM_APPROVE permission'
  })
})
```

### Multi-Tenant Tests
```typescript
// Test multi-tenant isolation
test('User cannot access claims from other business', async () => {
  const otherBusinessClaim = await createClaim({ businessId: otherBusinessId })

  const response = await fetch(`/api/service/warranty-claims/${otherBusinessClaim.id}`, {
    headers: { 'Authorization': `Bearer ${userToken}` },
  })

  expect(response.status).toBe(404)
})
```

---

## 9. Common Workflows

### Complete Warranty Claim Flow
```typescript
// 1. Service Receptionist creates claim
POST /api/service/warranty-claims
Permission: WARRANTY_CLAIM_CREATE

// 2. Service Receptionist accepts claim
PUT /api/service/warranty-claims/{id}/accept
Permission: WARRANTY_CLAIM_ACCEPT

// 3. Warranty Inspector inspects claim
PUT /api/service/warranty-claims/{id}/inspect
Permission: WARRANTY_CLAIM_INSPECT

// 4. Warranty Inspector approves claim
PUT /api/service/warranty-claims/{id}/approve
Permission: WARRANTY_CLAIM_APPROVE

// 5. Service Receptionist assigns technician
PUT /api/service/warranty-claims/{id}/assign
Permission: WARRANTY_CLAIM_ASSIGN

// 6. Technician creates job order
POST /api/service/job-orders
Permission: JOB_ORDER_CREATE

// 7. Technician diagnoses issue
PUT /api/service/job-orders/{id}/diagnose
Permission: JOB_ORDER_DIAGNOSE

// 8. Technician adds parts
POST /api/service/job-orders/{id}/parts
Permission: JOB_ORDER_ADD_PARTS

// 9. Technician completes repair
PUT /api/service/job-orders/{id}/complete
Permission: JOB_ORDER_COMPLETE

// 10. Quality Inspector performs QC
PUT /api/service/job-orders/{id}/quality-check
Permission: JOB_ORDER_QUALITY_CHECK

// 11. Quality Inspector closes job
PUT /api/service/job-orders/{id}/close
Permission: JOB_ORDER_CLOSE

// 12. Service Cashier processes payment
POST /api/service/payments
Permission: SERVICE_PAYMENT_CREATE
```

---

## 10. Error Handling

### Standard Error Responses
```typescript
// Unauthorized (no session)
return Response.json(
  { error: 'Unauthorized - Please log in' },
  { status: 401 }
)

// Forbidden (no permission)
return Response.json(
  { error: 'Forbidden - Missing WARRANTY_CLAIM_APPROVE permission' },
  { status: 403 }
)

// Not Found (wrong business or doesn't exist)
return Response.json(
  { error: 'Warranty claim not found' },
  { status: 404 }
)

// Validation Error
return Response.json(
  { error: 'Invalid data', details: validationErrors },
  { status: 400 }
)
```

---

## Quick Links

- **Full Documentation:** [TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md](./TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md)
- **Permission Matrix:** [TECHNICAL_SERVICE_PERMISSION_MATRIX.md](./TECHNICAL_SERVICE_PERMISSION_MATRIX.md)
- **RBAC Source:** [src/lib/rbac.ts](./src/lib/rbac.ts)

---

**Last Updated:** 2025-10-26
