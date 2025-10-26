# Technical Service & Warranty Management - Migration Checklist

## Pre-Implementation Checklist

Use this checklist to ensure smooth implementation of the Technical Service RBAC system.

---

## Phase 1: Code Review & Validation

### 1.1 RBAC Code Review
- [ ] Review `src/lib/rbac.ts` changes (lines 496-566, 2171-2537)
- [ ] Verify all 68 permissions are properly defined
- [ ] Confirm all 8 new roles have correct permission assignments
- [ ] Check System Administrator and Branch Manager updates
- [ ] Run TypeScript compiler: `npx tsc --noEmit`
- [ ] Test RBAC module loading

**Command:**
```bash
node -e "const rbac = require('./src/lib/rbac.ts'); console.log('Permissions:', Object.keys(rbac.PERMISSIONS).length);"
```

**Expected Output:** `Permissions: 341`

### 1.2 Documentation Review
- [ ] Read [TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md](./TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md)
- [ ] Review [TECHNICAL_SERVICE_PERMISSION_MATRIX.md](./TECHNICAL_SERVICE_PERMISSION_MATRIX.md)
- [ ] Study [TECHNICAL_SERVICE_QUICK_START.md](./TECHNICAL_SERVICE_QUICK_START.md)
- [ ] Understand workflow diagrams and examples

---

## Phase 2: Database Schema Implementation

### 2.1 Create Prisma Models

Add to `prisma/schema.prisma`:

```prisma
// Technical Service Employees
model Technician {
  id          String   @id @default(cuid())
  userId      String   @unique // Link to User table
  user        User     @relation(fields: [userId], references: [id])

  businessId  String
  business    Business @relation(fields: [businessId], references: [id])

  specialization String? // e.g., "Computer Repair", "Mobile Repair"
  certifications Json? // Array of certifications

  warrantyClaims WarrantyClaim[]
  jobOrders      JobOrder[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([businessId])
  @@index([userId])
}

// Service Type Definitions
model ServiceType {
  id          String   @id @default(cuid())

  businessId  String
  business    Business @relation(fields: [businessId], references: [id])

  name        String // e.g., "Screen Replacement", "Battery Replacement"
  description String?
  category    String? // e.g., "Repair", "Maintenance", "Upgrade"

  baseLaborCost Decimal @default(0)
  estimatedMinutes Int @default(0)

  isActive    Boolean @default(true)

  jobOrders   JobOrder[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([businessId, name])
  @@index([businessId])
}

// Warranty Claims
model WarrantyClaim {
  id              String   @id @default(cuid())
  claimNumber     String   @unique

  businessId      String
  business        Business @relation(fields: [businessId], references: [id])

  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])

  productId       String
  product         Product @relation(fields: [productId], references: [id])

  serialNumberId  String?
  serialNumber    SerialNumber? @relation(fields: [serialNumberId], references: [id])

  originalSaleId  String? // Reference to original sale
  originalSale    Sale? @relation(fields: [originalSaleId], references: [id])

  issueDescription String
  photos          Json? // Array of photo URLs

  status          String @default("PENDING") // PENDING, ACCEPTED, INSPECTED, APPROVED, REJECTED, COMPLETED

  assignedTechnicianId String?
  assignedTechnician   Technician? @relation(fields: [assignedTechnicianId], references: [id])

  createdById     String
  createdBy       User @relation("CreatedWarrantyClaims", fields: [createdById], references: [id])

  acceptedById    String?
  acceptedBy      User? @relation("AcceptedWarrantyClaims", fields: [acceptedById], references: [id])
  acceptedAt      DateTime?

  inspectedById   String?
  inspectedBy     User? @relation("InspectedWarrantyClaims", fields: [inspectedById], references: [id])
  inspectedAt     DateTime?
  inspectionNotes String?

  approvedById    String?
  approvedBy      User? @relation("ApprovedWarrantyClaims", fields: [approvedById], references: [id])
  approvedAt      DateTime?

  rejectedById    String?
  rejectedBy      User? @relation("RejectedWarrantyClaims", fields: [rejectedById], references: [id])
  rejectedAt      DateTime?
  rejectionReason String?

  jobOrders       JobOrder[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([businessId])
  @@index([customerId])
  @@index([productId])
  @@index([status])
  @@index([assignedTechnicianId])
}

// Repair Job Orders
model JobOrder {
  id              String   @id @default(cuid())
  jobNumber       String   @unique

  businessId      String
  business        Business @relation(fields: [businessId], references: [id])

  warrantyClaimId String?
  warrantyClaim   WarrantyClaim? @relation(fields: [warrantyClaimId], references: [id])

  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])

  productId       String
  product         Product @relation(fields: [productId], references: [id])

  serviceTypeId   String
  serviceType     ServiceType @relation(fields: [serviceTypeId], references: [id])

  assignedToId    String
  assignedTo      Technician @relation(fields: [assignedToId], references: [id])

  status          String @default("PENDING") // PENDING, DIAGNOSING, ESTIMATED, APPROVED, IN_PROGRESS, COMPLETED, QC, CLOSED

  problemDescription String
  diagnosisNotes  String?
  diagnosedAt     DateTime?

  estimatedLaborCost  Decimal?
  estimatedPartsCost  Decimal?
  estimatedTotalCost  Decimal?
  estimatedAt         DateTime?
  estimateApprovedAt  DateTime?

  actualLaborCost     Decimal?
  actualPartsCost     Decimal?
  actualTotalCost     Decimal?

  startedAt       DateTime?
  completedAt     DateTime?

  qcCheckerId     String?
  qcChecker       User? @relation("QCCheckedJobOrders", fields: [qcCheckerId], references: [id])
  qcCheckedAt     DateTime?
  qcPassed        Boolean?
  qcNotes         String?

  closedById      String?
  closedBy        User? @relation("ClosedJobOrders", fields: [closedById], references: [id])
  closedAt        DateTime?

  parts           JobOrderPart[]
  payments        ServicePayment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([businessId])
  @@index([warrantyClaimId])
  @@index([customerId])
  @@index([status])
  @@index([assignedToId])
}

// Parts Used in Job Orders
model JobOrderPart {
  id          String   @id @default(cuid())

  jobOrderId  String
  jobOrder    JobOrder @relation(fields: [jobOrderId], references: [id], onDelete: Cascade)

  productId   String
  product     Product @relation(fields: [productId], references: [id])

  quantity    Int @default(1)
  unitCost    Decimal
  totalCost   Decimal

  addedById   String
  addedBy     User @relation("AddedJobOrderParts", fields: [addedById], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([jobOrderId])
  @@index([productId])
}

// Service Payments
model ServicePayment {
  id              String   @id @default(cuid())
  receiptNumber   String   @unique

  businessId      String
  business        Business @relation(fields: [businessId], references: [id])

  jobOrderId      String
  jobOrder        JobOrder @relation(fields: [jobOrderId], references: [id])

  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])

  amount          Decimal
  paymentMethod   String // CASH, CARD, BANK_TRANSFER, etc.

  status          String @default("COMPLETED") // COMPLETED, VOIDED, REFUNDED

  processedById   String
  processedBy     User @relation("ProcessedServicePayments", fields: [processedById], references: [id])
  processedAt     DateTime @default(now())

  voidedById      String?
  voidedBy        User? @relation("VoidedServicePayments", fields: [voidedById], references: [id])
  voidedAt        DateTime?
  voidReason      String?

  refundedById    String?
  refundedBy      User? @relation("RefundedServicePayments", fields: [refundedById], references: [id])
  refundedAt      DateTime?
  refundReason    String?

  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([businessId])
  @@index([jobOrderId])
  @@index([customerId])
  @@index([status])
}
```

**Checklist:**
- [ ] Add models to schema.prisma
- [ ] Review relationships and indexes
- [ ] Add necessary User relations
- [ ] Run `npx prisma format`
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma db push` (or create migration)

---

## Phase 3: Permission Seeding

### 3.1 Create Permission Seed Script

Create `scripts/seed-service-permissions.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { PERMISSIONS } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function seedServicePermissions() {
  console.log('Seeding Technical Service permissions...')

  const servicePermissions = [
    // Serial Numbers
    { code: PERMISSIONS.SERIAL_NUMBER_CREATE, name: 'Create Serial Numbers', category: 'Technical Service' },
    { code: PERMISSIONS.SERIAL_NUMBER_EDIT, name: 'Edit Serial Numbers', category: 'Technical Service' },
    // ... (add all 68 permissions)
  ]

  for (const perm of servicePermissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    })
  }

  console.log(`✓ Seeded ${servicePermissions.length} service permissions`)
}

seedServicePermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Checklist:**
- [ ] Create seed script
- [ ] Add all 68 permissions
- [ ] Test seed script: `npx ts-node scripts/seed-service-permissions.ts`
- [ ] Verify permissions in database

### 3.2 Create Role Seed Script

Create `scripts/seed-service-roles.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { DEFAULT_ROLES, PERMISSIONS } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function seedServiceRoles(businessId: string) {
  console.log('Seeding Technical Service roles...')

  // Technical Service Manager
  const techServiceManager = await prisma.role.create({
    data: {
      name: DEFAULT_ROLES.TECHNICAL_SERVICE_MANAGER.name,
      description: DEFAULT_ROLES.TECHNICAL_SERVICE_MANAGER.description,
      businessId,
    },
  })

  // Add permissions to role
  for (const permCode of DEFAULT_ROLES.TECHNICAL_SERVICE_MANAGER.permissions) {
    const permission = await prisma.permission.findUnique({
      where: { code: permCode },
    })

    if (permission) {
      await prisma.rolePermission.create({
        data: {
          roleId: techServiceManager.id,
          permissionId: permission.id,
        },
      })
    }
  }

  // Repeat for all 8 service roles
  // ...

  console.log('✓ Service roles seeded successfully')
}

// Get business ID from command line or config
const businessId = process.argv[2] || 'default-business-id'
seedServiceRoles(businessId)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Checklist:**
- [ ] Create role seed script
- [ ] Add all 8 service roles
- [ ] Test with: `npx ts-node scripts/seed-service-roles.ts <businessId>`
- [ ] Verify roles in database

---

## Phase 4: API Routes Implementation

### 4.1 Warranty Claims API
- [ ] Create `/api/service/warranty-claims/route.ts` (GET, POST)
- [ ] Create `/api/service/warranty-claims/[id]/route.ts` (GET, PUT, DELETE)
- [ ] Create `/api/service/warranty-claims/[id]/accept/route.ts` (PUT)
- [ ] Create `/api/service/warranty-claims/[id]/inspect/route.ts` (PUT)
- [ ] Create `/api/service/warranty-claims/[id]/approve/route.ts` (PUT)
- [ ] Create `/api/service/warranty-claims/[id]/reject/route.ts` (PUT)
- [ ] Create `/api/service/warranty-claims/[id]/assign/route.ts` (PUT)

### 4.2 Job Orders API
- [ ] Create `/api/service/job-orders/route.ts` (GET, POST)
- [ ] Create `/api/service/job-orders/[id]/route.ts` (GET, PUT, DELETE)
- [ ] Create `/api/service/job-orders/[id]/diagnose/route.ts` (PUT)
- [ ] Create `/api/service/job-orders/[id]/estimate/route.ts` (PUT)
- [ ] Create `/api/service/job-orders/[id]/parts/route.ts` (POST)
- [ ] Create `/api/service/job-orders/[id]/start/route.ts` (PUT)
- [ ] Create `/api/service/job-orders/[id]/complete/route.ts` (PUT)
- [ ] Create `/api/service/job-orders/[id]/quality-check/route.ts` (PUT)
- [ ] Create `/api/service/job-orders/[id]/close/route.ts` (PUT)

### 4.3 Technicians API
- [ ] Create `/api/service/technicians/route.ts` (GET, POST)
- [ ] Create `/api/service/technicians/[id]/route.ts` (GET, PUT, DELETE)
- [ ] Create `/api/service/technicians/[id]/performance/route.ts` (GET)

### 4.4 Service Types API
- [ ] Create `/api/service/service-types/route.ts` (GET, POST)
- [ ] Create `/api/service/service-types/[id]/route.ts` (GET, PUT, DELETE)

### 4.5 Service Payments API
- [ ] Create `/api/service/payments/route.ts` (GET, POST)
- [ ] Create `/api/service/payments/[id]/route.ts` (GET)
- [ ] Create `/api/service/payments/[id]/void/route.ts` (PUT)
- [ ] Create `/api/service/payments/[id]/refund/route.ts` (PUT)

### 4.6 Service Reports API
- [ ] Create `/api/service/reports/warranty-slip/route.ts` (GET)
- [ ] Create `/api/service/reports/technician-performance/route.ts` (GET)
- [ ] Create `/api/service/reports/repair-analytics/route.ts` (GET)
- [ ] Create `/api/service/reports/revenue/route.ts` (GET)

**Template Reference:** See [TECHNICAL_SERVICE_QUICK_START.md](./TECHNICAL_SERVICE_QUICK_START.md) for API route templates.

---

## Phase 5: Frontend Implementation

### 5.1 Warranty Claims Pages
- [ ] Create `/dashboard/service/warranty-claims/page.tsx` (list)
- [ ] Create `/dashboard/service/warranty-claims/[id]/page.tsx` (detail)
- [ ] Create `/dashboard/service/warranty-claims/new/page.tsx` (create)
- [ ] Add permission checks using `usePermissions()` hook

### 5.2 Job Orders Pages
- [ ] Create `/dashboard/service/job-orders/page.tsx` (list)
- [ ] Create `/dashboard/service/job-orders/[id]/page.tsx` (detail)
- [ ] Create `/dashboard/service/job-orders/new/page.tsx` (create)

### 5.3 Technician Pages
- [ ] Create `/dashboard/service/technicians/page.tsx` (list)
- [ ] Create `/dashboard/service/technicians/[id]/page.tsx` (detail)
- [ ] Create `/dashboard/service/technicians/new/page.tsx` (create)

### 5.4 Service Type Pages
- [ ] Create `/dashboard/service/service-types/page.tsx` (list)
- [ ] Create `/dashboard/service/service-types/[id]/page.tsx` (detail)

### 5.5 Service Reports
- [ ] Create `/dashboard/service/reports/warranty-slip/page.tsx`
- [ ] Create `/dashboard/service/reports/technician-performance/page.tsx`
- [ ] Create `/dashboard/service/reports/repair-analytics/page.tsx`
- [ ] Create `/dashboard/service/reports/revenue/page.tsx`

---

## Phase 6: Sidebar Menu Integration

Update `src/components/Sidebar.tsx`:

```typescript
// Add Technical Service menu group
{
  title: 'Technical Service',
  icon: Wrench,
  requiredPermissions: [
    PERMISSIONS.WARRANTY_CLAIM_VIEW,
    PERMISSIONS.JOB_ORDER_VIEW,
    PERMISSIONS.TECHNICIAN_VIEW,
  ],
  anyPermission: true,
  items: [
    {
      title: 'Warranty Claims',
      href: '/dashboard/service/warranty-claims',
      icon: FileWarning,
      requiredPermission: PERMISSIONS.WARRANTY_CLAIM_VIEW,
    },
    {
      title: 'Job Orders',
      href: '/dashboard/service/job-orders',
      icon: ClipboardList,
      requiredPermission: PERMISSIONS.JOB_ORDER_VIEW,
    },
    // ... add all menu items
  ],
}
```

**Checklist:**
- [ ] Add menu group to sidebar
- [ ] Add all menu items with correct permissions
- [ ] Test menu visibility for different roles
- [ ] Verify icons and links

---

## Phase 7: User Role Assignment

### 7.1 Identify Service Users
- [ ] List all users who need service access
- [ ] Determine appropriate role for each user
- [ ] Prepare role assignment script

### 7.2 Assign Roles
```typescript
// Example: Assign Technician role
await prisma.user.update({
  where: { username: 'john.tech' },
  data: {
    roles: {
      connect: { id: technicianRoleId },
    },
  },
})
```

**Checklist:**
- [ ] Create user-role mapping spreadsheet
- [ ] Assign roles via admin UI or script
- [ ] Verify role assignments
- [ ] Test login with different roles

---

## Phase 8: Testing

### 8.1 Unit Tests
- [ ] Test permission helper functions
- [ ] Test role permission calculations
- [ ] Test multi-tenant isolation

### 8.2 Integration Tests
- [ ] Test warranty claim workflow
- [ ] Test job order workflow
- [ ] Test payment processing
- [ ] Test technician assignment

### 8.3 Security Tests
- [ ] Test unauthorized access attempts
- [ ] Test cross-business data access
- [ ] Test permission escalation attempts
- [ ] Test SQL injection protection

### 8.4 User Acceptance Testing
- [ ] Test as System Administrator
- [ ] Test as Branch Manager
- [ ] Test as Technical Service Manager
- [ ] Test as Technician
- [ ] Test as Service Cashier
- [ ] Test as Warranty Inspector
- [ ] Test as Service Receptionist
- [ ] Test as Quality Inspector

---

## Phase 9: Documentation

### 9.1 User Documentation
- [ ] Create user guide for warranty claims
- [ ] Create technician handbook
- [ ] Create service manager guide
- [ ] Create cashier instructions

### 9.2 Admin Documentation
- [ ] Document role assignment process
- [ ] Document permission management
- [ ] Create troubleshooting guide
- [ ] Document backup procedures

---

## Phase 10: Deployment

### 10.1 Pre-Deployment
- [ ] Run all tests
- [ ] Review security checklist
- [ ] Backup production database
- [ ] Prepare rollback plan

### 10.2 Deployment Steps
- [ ] Deploy database migrations
- [ ] Seed permissions
- [ ] Seed roles
- [ ] Deploy code changes
- [ ] Verify deployment

### 10.3 Post-Deployment
- [ ] Assign user roles
- [ ] Test critical workflows
- [ ] Monitor error logs
- [ ] Collect user feedback

---

## Rollback Plan

If issues occur:

### Emergency Rollback
```bash
# Restore database backup
psql -U username -d dbname < backup.sql

# Revert code changes
git revert <commit-hash>

# Redeploy previous version
npm run build
npm run start
```

**Checklist:**
- [ ] Database backup available
- [ ] Git commit tagged
- [ ] Rollback script tested
- [ ] Downtime window planned

---

## Success Criteria

### Functional Requirements
- [ ] All 68 permissions working correctly
- [ ] All 8 roles assigned and functional
- [ ] Complete warranty workflow operational
- [ ] Multi-tenant isolation verified
- [ ] All reports generating correctly

### Performance Requirements
- [ ] Page load times < 2 seconds
- [ ] API response times < 500ms
- [ ] Database queries optimized
- [ ] Proper indexing in place

### Security Requirements
- [ ] All API routes protected
- [ ] Multi-tenant isolation enforced
- [ ] Audit logging in place
- [ ] No permission escalation possible

---

## Support Resources

### Documentation
- [TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md](./TECHNICAL_SERVICE_RBAC_IMPLEMENTATION.md)
- [TECHNICAL_SERVICE_PERMISSION_MATRIX.md](./TECHNICAL_SERVICE_PERMISSION_MATRIX.md)
- [TECHNICAL_SERVICE_QUICK_START.md](./TECHNICAL_SERVICE_QUICK_START.md)

### Code References
- `src/lib/rbac.ts` - Permission definitions
- `prisma/schema.prisma` - Database schema
- API route templates in Quick Start guide

### Contact
- Development Team Lead: [contact info]
- System Administrator: [contact info]
- Database Administrator: [contact info]

---

**Last Updated:** October 26, 2025
**Version:** 1.0
