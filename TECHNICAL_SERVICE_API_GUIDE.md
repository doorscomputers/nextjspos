# Technical Service API Implementation Guide

## Overview
This guide provides the API endpoint specifications needed to support the Technical Service & Warranty Management pages.

## API Endpoints Structure

### Base Path
All technical service endpoints should be under:
```
/api/technical/
```

---

## 1. Service Types API

### GET `/api/technical/service-types`
**Description:** Get all service types for the business

**Response:**
```typescript
{
  serviceTypes: [
    {
      id: number
      code: string
      name: string
      description: string | null
      category: string
      standardPrice: number
      laborCostPerHour: number
      estimatedHours: number
      warrantyPeriodDays: number
      isCoveredByWarranty: boolean
      isActive: boolean
      createdAt: string
    }
  ]
}
```

**Permissions Required:** `SERVICE_TYPE_VIEW`

---

### POST `/api/technical/service-types`
**Description:** Create a new service type

**Request Body:**
```typescript
{
  code: string
  name: string
  description?: string
  category: string
  standardPrice: number
  laborCostPerHour: number
  estimatedHours: number
  warrantyPeriodDays: number
  isCoveredByWarranty: boolean
  isActive: boolean
}
```

**Permissions Required:** `SERVICE_TYPE_CREATE`

---

### PUT `/api/technical/service-types/:id`
**Description:** Update an existing service type

**Request Body:** Same as POST

**Permissions Required:** `SERVICE_TYPE_EDIT`

---

### DELETE `/api/technical/service-types/:id`
**Description:** Delete a service type

**Permissions Required:** `SERVICE_TYPE_DELETE`

---

## 2. Technicians API

### GET `/api/technical/technicians`
**Description:** Get all technicians with their assigned job orders

**Response:**
```typescript
{
  technicians: [
    {
      id: number
      employeeCode: string
      employeeName: string
      position: string
      specialization: string
      certifications: string | null
      skillLevel: string
      hourlyRate: number
      isAvailable: boolean
      isActive: boolean
      jobsCompleted: number
      avgRepairTimeHours: number
      customerRating: number
      assignedJobOrders: [
        {
          jobNumber: string
          customerName: string
          productName: string
          serviceTypeName: string
          status: string
          totalCost: number
        }
      ]
      createdAt: string
    }
  ]
}
```

**Permissions Required:** `TECHNICIAN_VIEW`

**Notes:**
- Join with `RepairJobOrder` to get assigned jobs
- Calculate `jobsCompleted` from completed job orders
- Calculate `avgRepairTimeHours` from job durations
- Calculate `customerRating` from feedback (if implemented)

---

### PATCH `/api/technical/technicians/:id/availability`
**Description:** Toggle technician availability

**Request Body:**
```typescript
{
  isAvailable: boolean
}
```

**Permissions Required:** `TECHNICIAN_EDIT`

---

## 3. Warranty Claims API

### GET `/api/technical/warranty-claims`
**Description:** Get all warranty claims

**Response:**
```typescript
{
  claims: [
    {
      id: number
      claimNumber: string
      claimDate: string
      customerName: string | null
      productName: string
      serialNumber: string | null
      status: string
      isUnderWarranty: boolean
      issueDescription: string
      technicianName: string | null
      estimatedCost: number | null
      actualCost: number | null
      jobOrders: [
        {
          jobNumber: string
          serviceTypeName: string
          status: string
          totalCost: number
        }
      ]
      createdAt: string
    }
  ]
}
```

**Permissions Required:** `WARRANTY_CLAIM_VIEW`

**Query Parameters:**
- `status` (optional) - Filter by status
- `startDate`, `endDate` (optional) - Date range filter

---

### POST `/api/technical/warranty-claims`
**Description:** Create a new warranty claim

**Request Body:**
```typescript
{
  serialNumberId?: number
  productId: number
  productVariationId: number
  customerId?: number
  saleId?: number
  issueDescription: string
  reportedIssue: string
}
```

**Permissions Required:** `WARRANTY_CLAIM_CREATE`

**Notes:**
- Automatically validate warranty status
- Set `isUnderWarranty` based on sale date and warranty period

---

### PATCH `/api/technical/warranty-claims/:id/status`
**Description:** Update claim status (workflow transitions)

**Request Body:**
```typescript
{
  status: 'accepted' | 'inspected' | 'approved' | 'rejected'
  notes?: string
  technicianId?: number // For assignment
}
```

**Permissions Required:**
- `WARRANTY_CLAIM_ACCEPT` for 'accepted'
- `WARRANTY_CLAIM_INSPECT` for 'inspected'
- `WARRANTY_CLAIM_APPROVE` for 'approved' or 'rejected'

**Status Workflow:**
```
pending → accepted → inspected → approved/rejected
```

---

## 4. Job Orders API

### GET `/api/technical/job-orders`
**Description:** Get all job orders with parts and payments

**Response:**
```typescript
{
  jobOrders: [
    {
      id: number
      jobNumber: string
      jobDate: string
      customerName: string | null
      productName: string
      serviceTypeName: string
      technicianName: string | null
      status: string
      paymentStatus: string
      laborCost: number
      partsCost: number
      totalCost: number
      paidAmount: number
      parts: [
        {
          partName: string
          quantity: number
          unitPrice: number
        }
      ]
      payments: [
        {
          paymentDate: string
          paymentMethod: string
          amount: number
        }
      ]
      createdAt: string
    }
  ]
}
```

**Permissions Required:** `JOB_ORDER_VIEW`

**Query Parameters:**
- `status` (optional) - Filter by status
- `technicianId` (optional) - Filter by technician
- `startDate`, `endDate` (optional) - Date range filter

**Notes:**
- `paymentStatus` calculated from: pending (no payment), partial (some payment), paid (full payment)
- `partsCost` = sum of all parts
- `totalCost` = laborCost + partsCost
- `paidAmount` = sum of all payments

---

### POST `/api/technical/job-orders`
**Description:** Create a new job order

**Request Body:**
```typescript
{
  warrantyClaimId?: number
  serviceTypeId: number
  productId: number
  productVariationId: number
  customerId?: number
  technicianId?: number
  diagnosisFindings?: string
  estimatedCost?: number
  estimatedCompletionDate?: string
}
```

**Permissions Required:** `JOB_ORDER_CREATE`

**Notes:**
- Auto-generate job number
- Initialize status as 'pending'
- Link to warranty claim if provided

---

## 5. Serial Number Lookup API

### GET `/api/technical/serial-lookup`
**Description:** Search for a serial number and get warranty/service history

**Query Parameters:**
- `serialNumber` (required) - The serial number to look up

**Response:**
```typescript
{
  serialNumber: string
  product: {
    id: number
    name: string
    sku: string
    category: string | null
    brand: string | null
  }
  warranty: {
    isUnderWarranty: boolean
    warrantyPeriodDays: number
    saleDate: string | null
    warrantyExpiryDate: string | null
    daysRemaining: number | null
  }
  customer: {
    id: number | null
    name: string | null
    mobile: string | null
    email: string | null
  }
  sale: {
    id: number | null
    invoiceNumber: string | null
    saleDate: string | null
    soldBy: string | null
    location: string | null
  }
  claimHistory: [
    {
      id: number
      claimNumber: string
      claimDate: string
      issueDescription: string
      status: string
    }
  ]
  repairHistory: [
    {
      id: number
      jobNumber: string
      jobDate: string
      serviceType: string
      technician: string
      status: string
      totalCost: number
    }
  ]
}
```

**Permissions Required:** `WARRANTY_CLAIM_VIEW`

**Status:** 404 if serial number not found

**Warranty Calculation:**
```typescript
// Pseudo-code
const saleDate = sale.createdAt
const warrantyPeriodDays = product.warranty?.warrantyPeriodDays || 0
const expiryDate = addDays(saleDate, warrantyPeriodDays)
const isUnderWarranty = new Date() < expiryDate
const daysRemaining = differenceInDays(expiryDate, new Date())
```

---

## 6. Service Payments API

### GET `/api/technical/payments`
**Description:** Get all service payments

**Response:**
```typescript
{
  payments: [
    {
      id: number
      paymentNumber: string
      paymentDate: string
      jobOrderNumber: string
      customerName: string | null
      amount: number
      paymentMethod: string
      referenceNumber: string | null
      receivedBy: string
      isVoided: boolean
      voidedAt: string | null
      voidedBy: string | null
      voidReason: string | null
      createdAt: string
    }
  ]
}
```

**Permissions Required:** `SERVICE_PAYMENT_VIEW`

**Query Parameters:**
- `startDate`, `endDate` (optional) - Date range filter
- `paymentMethod` (optional) - Filter by payment method
- `includeVoided` (optional) - Include voided payments (default: true)

---

### POST `/api/technical/payments/:id/void`
**Description:** Void a payment

**Request Body:**
```typescript
{
  voidReason: string
}
```

**Permissions Required:** `SERVICE_PAYMENT_VOID`

**Notes:**
- Set `isVoided = true`
- Record `voidedAt`, `voidedBy`, `voidReason`
- Update job order payment status

---

### GET `/api/technical/payments/:id/receipt`
**Description:** Generate and return a receipt (PDF or HTML)

**Permissions Required:** `SERVICE_RECEIPT_PRINT`

**Response:** PDF file or HTML page

---

## 7. Dashboard API

### GET `/api/technical/dashboard`
**Description:** Get all dashboard data

**Response:**
```typescript
{
  stats: {
    pendingClaims: number
    activeJobs: number
    availableTechnicians: number
    todayCompletions: number
    todayRevenue: number
    weekRevenue: number
    monthRevenue: number
    avgRepairTime: number
  }
  claimsByStatus: [
    { status: string, count: number }
  ]
  jobsByTechnician: [
    { technician: string, completed: number, inProgress: number }
  ]
  revenueByDay: [
    { day: string, revenue: number }
  ]
  recentActivity: [
    {
      id: number
      type: 'claim' | 'job' | 'payment'
      description: string
      time: string
      status: string
    }
  ]
}
```

**Permissions Required:** `WARRANTY_CLAIM_VIEW` or `JOB_ORDER_VIEW`

**Notes:**
- `avgRepairTime` = average hours from job start to completion
- `revenueByDay` = last 7 days
- `recentActivity` = last 10 activities

---

## Multi-Tenant Considerations

All API endpoints MUST:
1. Filter by `businessId` from the session
2. Check RBAC permissions before processing
3. Only allow access to data belonging to the user's business

Example middleware:
```typescript
const session = await getServerSession(authOptions)
if (!session?.user?.businessId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Check permission
if (!hasPermission(session.user, PERMISSIONS.SERVICE_TYPE_VIEW)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Filter by businessId
const serviceTypes = await prisma.repairServiceType.findMany({
  where: { businessId: session.user.businessId }
})
```

---

## Error Responses

All endpoints should return consistent error responses:

**400 Bad Request:**
```typescript
{
  error: 'Validation error',
  details: { field: 'error message' }
}
```

**401 Unauthorized:**
```typescript
{
  error: 'Authentication required'
}
```

**403 Forbidden:**
```typescript
{
  error: 'You do not have permission to perform this action',
  requiredPermission: 'service_type.create'
}
```

**404 Not Found:**
```typescript
{
  error: 'Resource not found'
}
```

**500 Internal Server Error:**
```typescript
{
  error: 'Internal server error',
  message: 'Error description'
}
```

---

## Database Models Reference

The API endpoints use these Prisma models:
- `RepairServiceType`
- `TechnicalServiceEmployee`
- `ServiceTechnician`
- `ServiceWarrantyClaim`
- `RepairJobOrder`
- `RepairJobOrderPart`
- `ServiceRepairPayment`
- `ProductSerialNumber`
- `Customer`
- `Sale`
- `Product`
- `ProductVariation`

All models are already defined in `prisma/schema.prisma`.

---

## Testing Checklist

For each API endpoint, test:
- [ ] Multi-tenant isolation (can only access own business data)
- [ ] RBAC permissions (correct permissions checked)
- [ ] Input validation (invalid data rejected)
- [ ] Error handling (proper error responses)
- [ ] Success responses (correct data format)
- [ ] Edge cases (not found, duplicate, etc.)

---

## Next Steps

1. **Create API Route Files**: Create route handler files for each endpoint
2. **Implement Business Logic**: Add service layer functions for complex operations
3. **Add Validation**: Use Zod or similar for request validation
4. **Test Endpoints**: Use Postman or similar to test each endpoint
5. **Frontend Integration**: Connect frontend pages to API endpoints
6. **Add Error Handling**: Ensure all errors are properly caught and returned

---

## Example API Route Implementation

```typescript
// src/app/api/technical/service-types/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { PERMISSIONS } from '@/lib/rbac'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.SERVICE_TYPE_VIEW)) {
      return NextResponse.json(
        { error: 'You do not have permission to view service types' },
        { status: 403 }
      )
    }

    const serviceTypes = await prisma.repairServiceType.findMany({
      where: {
        businessId: session.user.businessId,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ serviceTypes })
  } catch (error) {
    console.error('Error fetching service types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch service types' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.SERVICE_TYPE_CREATE)) {
      return NextResponse.json(
        { error: 'You do not have permission to create service types' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.code || !body.name || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const serviceType = await prisma.repairServiceType.create({
      data: {
        businessId: session.user.businessId,
        code: body.code,
        name: body.name,
        description: body.description,
        category: body.category,
        standardPrice: body.standardPrice,
        laborCostPerHour: body.laborCostPerHour,
        estimatedHours: body.estimatedHours,
        warrantyPeriodDays: body.warrantyPeriodDays,
        isCoveredByWarranty: body.isCoveredByWarranty,
        isActive: body.isActive,
      },
    })

    return NextResponse.json({ serviceType }, { status: 201 })
  } catch (error) {
    console.error('Error creating service type:', error)
    return NextResponse.json(
      { error: 'Failed to create service type' },
      { status: 500 }
    )
  }
}
```

This structure should be followed for all API endpoints.
