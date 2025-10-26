# Technical Service & Warranty Management RBAC Implementation

## Overview

Complete Role-Based Access Control (RBAC) system for the Technical Service & Warranty Management module in UltimatePOS Modern. This implementation provides granular permission control for all service-related operations including warranty claims, repair job orders, technician management, and service payments.

## Implementation Summary

**File Updated:** `C:\xampp\htdocs\ultimatepos-modern\src\lib\rbac.ts`

**Date:** 2025-10-26

**Total New Permissions:** 68
**Total New Roles:** 8
**Updated Roles:** 2 (System Administrator, Branch Manager)

---

## Permissions Structure

### 1. Serial Number Management (6 permissions)

Product-level serial number tracking for warranty validation and repair tracking.

| Permission Code | Description | Use Case |
|----------------|-------------|----------|
| `SERIAL_NUMBER_CREATE` | Register new serial numbers | When receiving new products with serial numbers |
| `SERIAL_NUMBER_EDIT` | Edit serial number details | Update serial number information |
| `SERIAL_NUMBER_DELETE` | Delete serial numbers (pre-sale only) | Remove incorrectly registered serials |
| `SERIAL_NUMBER_LOOKUP` | Search and lookup serial numbers | Find product by serial number for warranty claims |
| `SERIAL_NUMBER_ASSIGN` | Assign serial to customer via sale | Link serial number to customer on sale |
| `SERIAL_NUMBER_TRANSFER` | Transfer serial between locations | Move serialized products between branches |

### 2. Technician Management (6 permissions)

Manage technical service employees and their assignments.

| Permission Code | Description | Use Case |
|----------------|-------------|----------|
| `TECHNICIAN_VIEW` | View technician list | Display all technicians |
| `TECHNICIAN_CREATE` | Add new technicians | Register new technical staff |
| `TECHNICIAN_EDIT` | Edit technician info | Update technician details |
| `TECHNICIAN_DELETE` | Remove technicians | Deactivate technicians |
| `TECHNICIAN_ASSIGN` | Assign technicians to jobs | Assign repair work to technicians |
| `TECHNICIAN_PERFORMANCE_VIEW` | View performance metrics | Track technician KPIs |

### 3. Service Type Management (5 permissions)

Define repair categories and service pricing.

| Permission Code | Description | Use Case |
|----------------|-------------|----------|
| `SERVICE_TYPE_VIEW` | View service type list | Display repair categories |
| `SERVICE_TYPE_CREATE` | Create service types | Add new service categories |
| `SERVICE_TYPE_EDIT` | Edit service types | Update service definitions |
| `SERVICE_TYPE_DELETE` | Delete service types | Remove unused service types |
| `SERVICE_TYPE_PRICING_MANAGE` | Manage service pricing | Set and update service fees |

### 4. Warranty Claim Management (11 permissions)

Handle customer warranty requests with proper approval workflow.

| Permission Code | Description | Use Case |
|----------------|-------------|----------|
| `WARRANTY_CLAIM_VIEW` | View all warranty claims | Access all warranty claims |
| `WARRANTY_CLAIM_VIEW_OWN` | View own submitted claims | Technicians view assigned claims |
| `WARRANTY_CLAIM_CREATE` | Create new warranty claim | Submit warranty request |
| `WARRANTY_CLAIM_ACCEPT` | Accept claim for processing | Reception accepts claim |
| `WARRANTY_CLAIM_INSPECT` | Conduct inspection/diagnosis | Inspector examines defect |
| `WARRANTY_CLAIM_ASSIGN` | Assign technician to claim | Assign work to technician |
| `WARRANTY_CLAIM_APPROVE` | Approve warranty claim | Honor warranty coverage |
| `WARRANTY_CLAIM_REJECT` | Reject warranty claim | Decline warranty (out of scope) |
| `WARRANTY_CLAIM_UPDATE` | Update claim details | Modify claim information |
| `WARRANTY_CLAIM_DELETE` | Delete warranty claim | Remove incorrect claims |
| `WARRANTY_CLAIM_VOID` | Void processed claim | Cancel completed claim |

### 5. Repair Job Order Management (14 permissions)

Comprehensive repair workflow from diagnosis to completion.

| Permission Code | Description | Use Case |
|----------------|-------------|----------|
| `JOB_ORDER_VIEW` | View all job orders | Access all repair jobs |
| `JOB_ORDER_VIEW_OWN` | View own assigned jobs | Technicians view their work |
| `JOB_ORDER_CREATE` | Create new job order | Start new repair job |
| `JOB_ORDER_EDIT` | Edit job order details | Update job information |
| `JOB_ORDER_DELETE` | Delete job order | Remove incorrect jobs |
| `JOB_ORDER_DIAGNOSE` | Update diagnosis/findings | Record diagnostic results |
| `JOB_ORDER_ADD_PARTS` | Add parts to job order | Add replacement parts |
| `JOB_ORDER_ESTIMATE` | Provide cost estimate | Quote repair cost |
| `JOB_ORDER_APPROVE_ESTIMATE` | Customer approves estimate | Customer accepts quote |
| `JOB_ORDER_START_REPAIR` | Begin repair work | Start repair process |
| `JOB_ORDER_COMPLETE` | Mark repair complete | Finish repair work |
| `JOB_ORDER_QUALITY_CHECK` | Conduct quality inspection | QC before release |
| `JOB_ORDER_CLOSE` | Close job order (final) | Finalize job |
| `JOB_ORDER_REOPEN` | Reopen closed job order | Reopen for rework |

### 6. Service Payment Management (5 permissions)

Handle service payments and receipts.

| Permission Code | Description | Use Case |
|----------------|-------------|----------|
| `SERVICE_PAYMENT_VIEW` | View service payments | Access payment records |
| `SERVICE_PAYMENT_CREATE` | Process service payment | Collect payment for service |
| `SERVICE_PAYMENT_VOID` | Void service payment | Cancel payment |
| `SERVICE_PAYMENT_REFUND` | Refund service payment | Return payment to customer |
| `SERVICE_RECEIPT_PRINT` | Print service receipt | Print payment receipt |

### 7. Service Reports & Analytics (8 permissions)

Comprehensive reporting for service operations.

| Permission Code | Description | Use Case |
|----------------|-------------|----------|
| `SERVICE_REPORT_VIEW` | View service reports | Access service reports |
| `SERVICE_REPORT_EXPORT` | Export service reports | Export to PDF/Excel |
| `SERVICE_WARRANTY_SLIP_VIEW` | View warranty slip | Access warranty documents |
| `SERVICE_WARRANTY_SLIP_PRINT` | Print warranty slip | Print warranty form |
| `TECHNICIAN_PERFORMANCE_REPORT` | Technician performance report | Technician KPI reports |
| `REPAIR_ANALYTICS_VIEW` | Repair analytics dashboard | Service analytics |
| `SERVICE_REVENUE_REPORT` | Service revenue reporting | Revenue from services |
| `WARRANTY_ANALYTICS_VIEW` | Warranty claim analytics | Warranty trends |

---

## Role Definitions

### New Roles

#### 1. Technical Service Manager
**Category:** Technical Service
**Description:** Full access to all technical service and warranty operations

**Key Responsibilities:**
- Manage all service operations
- Oversee warranty claims
- Supervise technicians
- Configure service types and pricing
- Access all service reports

**Permission Count:** 60+

**Use Cases:**
- Service center manager
- Technical department head
- Service operations director

---

#### 2. Technician
**Category:** Technical Service
**Description:** Performs repairs, diagnoses issues, and updates job orders

**Key Responsibilities:**
- Diagnose and repair products
- Update job order progress
- View assigned warranty claims
- Request parts for repairs
- Track own performance

**Permission Count:** 15

**Use Cases:**
- Field technician
- Repair specialist
- Technical support engineer

**Workflow:**
1. View assigned warranty claims and job orders
2. Conduct inspection and diagnosis
3. Update job order with findings
4. Add required parts
5. Perform repair work
6. Mark repair complete

---

#### 3. Service Cashier
**Category:** Technical Service
**Description:** Processes service payments, prints receipts and warranty slips

**Key Responsibilities:**
- Create warranty claims for customers
- Process service payments
- Print warranty slips
- Print service receipts
- View service pricing

**Permission Count:** 18

**Use Cases:**
- Service center cashier
- Front desk clerk
- Payment processor

**Workflow:**
1. Customer brings defective product
2. Create warranty claim
3. Print warranty slip for customer
4. Process payment (if applicable)
5. Print service receipt

---

#### 4. Warranty Inspector
**Category:** Technical Service
**Description:** Inspects warranty claims and approves/rejects coverage

**Key Responsibilities:**
- Inspect product defects
- Validate warranty eligibility
- Approve or reject warranty claims
- Review warranty analytics
- Check warranty terms

**Permission Count:** 17

**Use Cases:**
- Warranty specialist
- Quality inspector
- Warranty claims adjuster

**Workflow:**
1. View pending warranty claims
2. Inspect product and serial number
3. Verify warranty coverage (check original sale)
4. Approve or reject claim with reason
5. Update claim with findings

---

#### 5. Service Receptionist
**Category:** Technical Service
**Description:** Receives warranty claims, creates job orders, and assigns technicians

**Key Responsibilities:**
- Receive warranty claims
- Create job orders
- Assign technicians to jobs
- Print warranty slips
- Manage customer information

**Permission Count:** 19

**Use Cases:**
- Service reception desk
- Customer service representative
- Job coordinator

**Workflow:**
1. Receive customer with warranty claim
2. Accept claim for processing
3. Create job order
4. Assign available technician
5. Print warranty slip for customer

---

#### 6. Repair Quality Inspector
**Category:** Technical Service
**Description:** Conducts quality checks on completed repairs before delivery

**Key Responsibilities:**
- Quality check completed repairs
- Approve or reject repair work
- Close successful repairs
- Reopen failed repairs
- Monitor repair quality trends

**Permission Count:** 13

**Use Cases:**
- Quality control inspector
- Final QC specialist
- Service quality manager

**Workflow:**
1. View completed job orders
2. Conduct quality inspection
3. If pass: Close job order
4. If fail: Reopen for rework

---

#### 7. Service Parts Coordinator
**Category:** Technical Service
**Description:** Manages parts inventory for repairs and adds parts to job orders

**Key Responsibilities:**
- Manage service parts inventory
- Add parts to job orders
- Create purchase orders for parts
- Track parts usage
- Monitor parts stock levels

**Permission Count:** 16

**Use Cases:**
- Parts coordinator
- Service inventory manager
- Parts requisition specialist

**Workflow:**
1. View job orders requiring parts
2. Check parts availability
3. Add parts to job order
4. If parts unavailable: Create purchase order
5. Track parts consumption

---

#### 8. Service Report Viewer
**Category:** Technical Service
**Description:** View-only access to all service and warranty reports

**Key Responsibilities:**
- View all service reports
- Export service data
- Monitor service analytics
- Track technician performance
- Review warranty trends

**Permission Count:** 13

**Use Cases:**
- Service analyst
- Management reporting
- Business intelligence

---

### Updated Existing Roles

#### System Administrator
**Updates:** Now includes ALL 68 technical service permissions
**Impact:** Full access to entire service management system

#### Branch Manager
**Updates:** Added all service management permissions except DELETE operations
**New Capabilities:**
- Full warranty claim management
- Technician management (create, edit, assign)
- Service type configuration
- Job order oversight
- Service reports access

---

## Permission Groups for Sidebar Menu

Recommended menu structure for Technical Service module:

```typescript
// Technical Service Menu Group
{
  title: 'Technical Service',
  icon: 'wrench',
  requiredPermissions: [
    PERMISSIONS.WARRANTY_CLAIM_VIEW,
    PERMISSIONS.JOB_ORDER_VIEW,
    PERMISSIONS.TECHNICIAN_VIEW,
    PERMISSIONS.SERVICE_TYPE_VIEW,
  ],
  anyPermission: true, // Show if user has ANY of the above
  items: [
    {
      title: 'Warranty Claims',
      href: '/dashboard/service/warranty-claims',
      requiredPermission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
    },
    {
      title: 'Job Orders',
      href: '/dashboard/service/job-orders',
      requiredPermission: PERMISSIONS.JOB_ORDER_VIEW,
    },
    {
      title: 'Technicians',
      href: '/dashboard/service/technicians',
      requiredPermission: PERMISSIONS.TECHNICIAN_VIEW,
    },
    {
      title: 'Service Types',
      href: '/dashboard/service/service-types',
      requiredPermission: PERMISSIONS.SERVICE_TYPE_VIEW,
    },
    {
      title: 'Serial Numbers',
      href: '/dashboard/service/serial-numbers',
      requiredPermission: PERMISSIONS.SERIAL_NUMBER_VIEW,
    },
    {
      title: 'Service Payments',
      href: '/dashboard/service/payments',
      requiredPermission: PERMISSIONS.SERVICE_PAYMENT_VIEW,
    },
    {
      title: 'Service Reports',
      href: '/dashboard/service/reports',
      requiredPermission: PERMISSIONS.SERVICE_REPORT_VIEW,
      subItems: [
        {
          title: 'Warranty Slip',
          href: '/dashboard/service/reports/warranty-slip',
          requiredPermission: PERMISSIONS.SERVICE_WARRANTY_SLIP_VIEW,
        },
        {
          title: 'Technician Performance',
          href: '/dashboard/service/reports/technician-performance',
          requiredPermission: PERMISSIONS.TECHNICIAN_PERFORMANCE_REPORT,
        },
        {
          title: 'Repair Analytics',
          href: '/dashboard/service/reports/repair-analytics',
          requiredPermission: PERMISSIONS.REPAIR_ANALYTICS_VIEW,
        },
        {
          title: 'Service Revenue',
          href: '/dashboard/service/reports/revenue',
          requiredPermission: PERMISSIONS.SERVICE_REVENUE_REPORT,
        },
        {
          title: 'Warranty Analytics',
          href: '/dashboard/service/reports/warranty-analytics',
          requiredPermission: PERMISSIONS.WARRANTY_ANALYTICS_VIEW,
        },
      ],
    },
  ],
}
```

---

## Usage Examples

### API Route Protection

#### Example 1: Warranty Claim Creation
```typescript
// src/app/api/service/warranty-claims/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check permission
  if (!hasPermission(session.user, PERMISSIONS.WARRANTY_CLAIM_CREATE)) {
    return new Response('Forbidden - Missing WARRANTY_CLAIM_CREATE permission', {
      status: 403
    })
  }

  // Enforce multi-tenant isolation
  const businessId = session.user.businessId

  // Proceed with warranty claim creation
  // ...
}
```

#### Example 2: Technician Assignment
```typescript
// src/app/api/service/warranty-claims/[id]/assign/route.ts
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check permission to assign technicians
  if (!hasPermission(session.user, PERMISSIONS.WARRANTY_CLAIM_ASSIGN)) {
    return new Response('Forbidden - Missing WARRANTY_CLAIM_ASSIGN permission', {
      status: 403
    })
  }

  // Verify claim belongs to user's business
  const claim = await prisma.warrantyClaim.findFirst({
    where: {
      id: params.id,
      businessId: session.user.businessId,
    },
  })

  if (!claim) {
    return new Response('Warranty claim not found', { status: 404 })
  }

  // Proceed with technician assignment
  // ...
}
```

#### Example 3: Service Payment Processing
```typescript
// src/app/api/service/payments/route.ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check payment creation permission
  if (!hasPermission(session.user, PERMISSIONS.SERVICE_PAYMENT_CREATE)) {
    return new Response('Forbidden - Missing SERVICE_PAYMENT_CREATE permission', {
      status: 403
    })
  }

  const data = await req.json()

  // Verify job order belongs to user's business
  const jobOrder = await prisma.jobOrder.findFirst({
    where: {
      id: data.jobOrderId,
      businessId: session.user.businessId,
    },
  })

  if (!jobOrder) {
    return new Response('Job order not found', { status: 404 })
  }

  // Process payment
  // ...
}
```

### Frontend Component Protection

#### Example 1: Conditional Button Rendering
```typescript
// src/components/WarrantyClaimActions.tsx
'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

export function WarrantyClaimActions({ claim }: { claim: WarrantyClaim }) {
  const { can } = usePermissions()

  return (
    <div className="flex gap-2">
      {can(PERMISSIONS.WARRANTY_CLAIM_INSPECT) && (
        <button onClick={() => inspectClaim(claim)}>
          Inspect
        </button>
      )}

      {can(PERMISSIONS.WARRANTY_CLAIM_APPROVE) && (
        <button onClick={() => approveClaim(claim)}>
          Approve
        </button>
      )}

      {can(PERMISSIONS.WARRANTY_CLAIM_REJECT) && (
        <button onClick={() => rejectClaim(claim)}>
          Reject
        </button>
      )}

      {can(PERMISSIONS.WARRANTY_CLAIM_ASSIGN) && (
        <button onClick={() => assignTechnician(claim)}>
          Assign Technician
        </button>
      )}
    </div>
  )
}
```

#### Example 2: Multiple Permission Check
```typescript
// src/components/JobOrderEditor.tsx
'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS, hasAllPermissions } from '@/lib/rbac'

export function JobOrderEditor({ jobOrder }: { jobOrder: JobOrder }) {
  const { user, can } = usePermissions()

  const canEditAndDiagnose = hasAllPermissions(user, [
    PERMISSIONS.JOB_ORDER_EDIT,
    PERMISSIONS.JOB_ORDER_DIAGNOSE,
  ])

  return (
    <div>
      {canEditAndDiagnose && (
        <section>
          <h2>Diagnosis</h2>
          <textarea
            placeholder="Enter diagnosis findings..."
            onChange={handleDiagnosisUpdate}
          />
        </section>
      )}

      {can(PERMISSIONS.JOB_ORDER_ADD_PARTS) && (
        <section>
          <h2>Parts Required</h2>
          <button onClick={addPart}>Add Part</button>
        </section>
      )}

      {can(PERMISSIONS.JOB_ORDER_QUALITY_CHECK) && (
        <section>
          <h2>Quality Inspection</h2>
          <button onClick={performQC}>Conduct QC</button>
        </section>
      )}
    </div>
  )
}
```

---

## Database Seeding

Add these roles to your seed file:

```typescript
// prisma/seed.ts

// Technical Service Roles
const technicalServiceManager = await prisma.role.create({
  data: {
    name: 'Technical Service Manager',
    description: 'Full access to all technical service and warranty operations',
    businessId: business.id,
    permissions: {
      create: DEFAULT_ROLES.TECHNICAL_SERVICE_MANAGER.permissions.map(p => ({
        permission: { connect: { code: p } },
      })),
    },
  },
})

const technician = await prisma.role.create({
  data: {
    name: 'Technician',
    description: 'Performs repairs, diagnoses issues, and updates job orders',
    businessId: business.id,
    permissions: {
      create: DEFAULT_ROLES.TECHNICIAN.permissions.map(p => ({
        permission: { connect: { code: p } },
      })),
    },
  },
})

// Create sample technician user
const technicianUser = await prisma.user.create({
  data: {
    username: 'technician',
    password: await bcrypt.hash('password', 10),
    firstName: 'John',
    lastName: 'Technician',
    email: 'technician@example.com',
    businessId: business.id,
    roles: {
      connect: [{ id: technician.id }],
    },
  },
})
```

---

## Security Best Practices

### 1. Multi-Tenant Isolation
Always filter by `businessId` in all queries:

```typescript
const warrantyClaims = await prisma.warrantyClaim.findMany({
  where: {
    businessId: session.user.businessId, // CRITICAL
  },
})
```

### 2. Permission Verification
Check permissions before executing operations:

```typescript
// WRONG - No permission check
export async function DELETE(req: Request) {
  // Delete warranty claim
}

// CORRECT - Permission check first
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)

  if (!hasPermission(session.user, PERMISSIONS.WARRANTY_CLAIM_DELETE)) {
    return new Response('Forbidden', { status: 403 })
  }

  // Delete warranty claim
}
```

### 3. Ownership Validation
For "view own" permissions, verify ownership:

```typescript
// Technician can only view their assigned job orders
if (hasPermission(user, PERMISSIONS.JOB_ORDER_VIEW_OWN) &&
    !hasPermission(user, PERMISSIONS.JOB_ORDER_VIEW)) {

  const jobOrders = await prisma.jobOrder.findMany({
    where: {
      businessId: user.businessId,
      assignedToId: user.id, // Only own jobs
    },
  })
}
```

### 4. Audit Trail
Log all warranty and service operations:

```typescript
await prisma.auditLog.create({
  data: {
    userId: session.user.id,
    businessId: session.user.businessId,
    action: 'WARRANTY_CLAIM_APPROVED',
    entityType: 'WarrantyClaim',
    entityId: claim.id,
    metadata: {
      claimNumber: claim.claimNumber,
      approvedBy: session.user.username,
      approvedAt: new Date(),
    },
  },
})
```

---

## Testing Checklist

### Permission Tests
- [ ] System Administrator has all 68 service permissions
- [ ] Branch Manager has service permissions (except deletes)
- [ ] Technical Service Manager has full service access
- [ ] Technician can only view own job orders
- [ ] Service Cashier can create warranty claims
- [ ] Warranty Inspector can approve/reject claims
- [ ] Service Receptionist can assign technicians
- [ ] Repair Quality Inspector can close job orders
- [ ] Service Parts Coordinator can add parts
- [ ] Service Report Viewer has read-only access

### Multi-Tenant Tests
- [ ] Users can only access warranty claims from their business
- [ ] Technicians only see job orders from their business
- [ ] Service payments are isolated by business
- [ ] Serial numbers are business-specific

### Workflow Tests
- [ ] Complete warranty claim workflow (create → accept → inspect → approve → repair → close)
- [ ] Job order workflow (create → diagnose → estimate → repair → QC → close)
- [ ] Service payment processing
- [ ] Technician assignment
- [ ] Parts addition to job orders

---

## Migration Guide

### For Existing Installations

1. **Update rbac.ts** - Already completed
2. **Run permission seeding:**
   ```bash
   npx ts-node scripts/seed-service-permissions.ts
   ```
3. **Assign roles to users:**
   - Identify users who need service access
   - Assign appropriate service roles
4. **Update sidebar menu:**
   - Add Technical Service menu group
   - Configure permission checks
5. **Test thoroughly:**
   - Verify all permission checks work
   - Test multi-tenant isolation
   - Validate workflows

---

## Future Enhancements

### Potential Additions
1. **Service Level Agreements (SLA)**
   - Permission: `SLA_MANAGE`, `SLA_VIEW`
   - Track repair turnaround time

2. **Technician Certifications**
   - Permission: `TECHNICIAN_CERTIFICATION_MANAGE`
   - Track technician qualifications

3. **Extended Warranty Management**
   - Permission: `EXTENDED_WARRANTY_MANAGE`
   - Sell and track extended warranties

4. **Customer Portal Access**
   - Permission: `SERVICE_CUSTOMER_PORTAL`
   - Allow customers to track repairs

5. **Service Contracts**
   - Permission: `SERVICE_CONTRACT_MANAGE`
   - Annual maintenance contracts

---

## Support & Documentation

### Key Files
- **Permissions:** `src/lib/rbac.ts` (lines 496-566)
- **Roles:** `src/lib/rbac.ts` (lines 2171-2537)
- **This Documentation:** `TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md`

### Related Documentation
- Main RBAC guide: `README.md` (RBAC section)
- API route protection: `docs/API_SECURITY.md`
- Permission hook usage: `docs/PERMISSION_HOOKS.md`

### Questions or Issues?
Contact your system administrator or development team.

---

**Implementation Status:** ✅ COMPLETE

**Total Permissions Added:** 68
**Total Roles Created:** 8
**Existing Roles Updated:** 2
**Documentation Pages:** 1 (this file)

**Ready for:**
- Frontend UI development
- API route implementation
- Database schema creation
- User role assignment
