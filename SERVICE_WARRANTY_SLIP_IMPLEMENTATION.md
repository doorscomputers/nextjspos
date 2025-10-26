# Service Warranty Slip Implementation Guide

## Overview

This document describes the complete implementation of the **Service Warranty Slip** system for the Technical Service & Repair Management module in UltimatePOS Modern.

## Features Implemented

### 1. Database Schema

Two new models added to `prisma/schema.prisma`:

#### ServiceJobOrder Model
- Complete job order tracking with customer, product, and service details
- Multi-tenant support (businessId filtering)
- Location-based assignment
- Technician assignment and quality control tracking
- Comprehensive cost breakdown (labor, parts, additional charges)
- Payment tracking (amount paid, balance due, payment method)
- Service warranty terms (period, conditions, coverage)
- Customer signatures and delivery tracking
- Status workflow (pending, in_progress, completed, delivered, cancelled)

#### ServiceJobPart Model
- Parts used in service jobs
- Links to Product/ProductVariation inventory
- Quantity, pricing, and subtotal tracking
- Part descriptions and details

### 2. API Route

**Location:** `src/app/api/reports/service-warranty-slip/route.ts`

**Endpoint:** `GET /api/reports/service-warranty-slip?jobOrderId={id}`

**Features:**
- Multi-tenant data isolation (businessId verification)
- Complete data fetching with all relations (business, location, customer, technician, parts, etc.)
- Automatic warranty expiry calculation
- Decimal formatting for accurate currency calculations
- Comprehensive error handling

**Response Structure:**
```json
{
  "jobOrder": {
    "id": 1,
    "jobOrderNumber": "JO-2025-0001",
    "customerName": "John Doe",
    "productName": "Laptop HP Pavilion",
    "serialNumber": "SN123456",
    "laborCost": 1500.00,
    "partsCost": 2500.00,
    "grandTotal": 4000.00,
    "parts": [
      {
        "partName": "RAM 8GB DDR4",
        "quantity": 1,
        "unitPrice": 2500.00,
        "subtotal": 2500.00
      }
    ],
    "business": {...},
    "location": {...},
    "technician": {...}
  }
}
```

### 3. Print Component

**Location:** `src/components/ServiceWarrantySlipPrint.tsx`

**Features:**

#### Multi-Paper Size Support
- **80mm Thermal**: For thermal printers (receipt-style)
- **A4**: Standard international paper
- **Letter**: US standard (8.5" x 11")
- **Legal**: US legal size (8.5" x 14")

#### Professional Layout Sections
1. **Header**: Business name, address, contact information
2. **Document Title**: "SERVICE WARRANTY SLIP" with copy type label
3. **Job Order Information**: Job number, date, status, service type
4. **Customer Information**: Name, phone, email, address
5. **Product/Device Information**: Product name, serial number, purchase date, warranty expiry
6. **Problem & Diagnosis**: Problem reported, diagnosis findings, recommended action
7. **Service Details**: Technician, dates (received, estimated, completed)
8. **Parts Used Table**: Detailed parts list with quantities and prices
9. **Cost Breakdown**: Labor, parts, additional charges, discounts, tax, grand total
10. **Payment Information**: Amount paid, balance due, payment method, received by
11. **Service Warranty Terms**: Warranty period, conditions, coverage details
12. **Quality Check**: Quality checker name and date
13. **Signature Lines**: Customer signature and date received
14. **Footer**: Thank you message, warranty claim instructions

#### Print Functionality
- Opens new window with formatted content
- Applies paper-size-specific styling
- Professional print preview
- Automatic window cleanup after printing
- BIR-compliant formatting (for Philippines)

#### Copy Types
- **Customer Copy**: For customer records
- **Office Copy**: For business filing
- **Technician Copy**: For technician reference

### 4. Styling & Design

**Design Principles:**
- Clean, professional appearance
- Clear section separators
- Easy-to-read typography
- Responsive to different paper sizes
- Accessible color contrast
- Print-optimized layout

**Color Coding:**
- Blue highlight for warranty terms section
- Green for amounts paid
- Red for balance due and discounts
- Gray for secondary information

## Database Migration

To implement this feature, run:

```bash
# Generate Prisma Client with new models
npx prisma generate

# Push schema changes to database
npm run db:push
```

## Usage Example

### In a Service Job Order Page

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import ServiceWarrantySlipPrint from '@/components/ServiceWarrantySlipPrint'

export default function ServiceJobOrderPage({ jobOrderId }: { jobOrderId: number }) {
  const [showWarrantySlip, setShowWarrantySlip] = useState(false)
  const [jobOrder, setJobOrder] = useState<any>(null)

  const handlePrintWarrantySlip = async () => {
    // Fetch job order data
    const response = await fetch(
      `/api/reports/service-warranty-slip?jobOrderId=${jobOrderId}`
    )
    const data = await response.json()

    if (data.jobOrder) {
      setJobOrder(data.jobOrder)
      setShowWarrantySlip(true)
    }
  }

  return (
    <div>
      <Button onClick={handlePrintWarrantySlip}>
        Print Warranty Slip
      </Button>

      {showWarrantySlip && jobOrder && (
        <ServiceWarrantySlipPrint
          jobOrder={jobOrder}
          isOpen={showWarrantySlip}
          onClose={() => setShowWarrantySlip(false)}
          copyType="customer"
        />
      )}
    </div>
  )
}
```

## Required Permissions

Add to `src/lib/rbac.ts`:

```typescript
export const PERMISSIONS = {
  // ... existing permissions
  SERVICE_VIEW: 'service.view',
  SERVICE_CREATE: 'service.create',
  SERVICE_UPDATE: 'service.update',
  SERVICE_DELETE: 'service.delete',
  SERVICE_PRINT_WARRANTY: 'service.print_warranty',
  SERVICE_QUALITY_CHECK: 'service.quality_check',
}
```

## Workflow

### Creating a Service Job Order

1. Customer brings device for repair
2. Create `ServiceJobOrder` record:
   - Capture customer information
   - Record product details and serial number
   - Document problem reported
   - Assign technician
   - Set estimated completion date

3. Add parts used during repair:
   - Create `ServiceJobPart` records
   - Link to inventory items (optional)
   - Calculate costs

4. Complete the job:
   - Update `actualCompletionDate`
   - Calculate total costs (labor + parts + charges)
   - Quality check
   - Process payment

5. Print warranty slip:
   - Fetch complete job order data
   - Generate warranty slip with all details
   - Print for customer, office, and technician

### Warranty Claim Process

1. Customer presents warranty slip
2. Verify warranty period (within `serviceWarrantyPeriod` days)
3. Check warranty conditions
4. Create new job order for warranty service
5. Link to original job order (via notes or custom field)

## BIR Compliance (Philippines)

The warranty slip includes:
- Business name and TIN (from Business settings)
- Complete business address
- Sequential job order numbering
- Date and time of service
- Itemized costs and taxes
- Customer information
- Authorized signatures

## Customization Options

### Business Settings

Customize warranty slip appearance via Business model:
- `invoiceHeaderName`: Business name on slip
- `ownerName`: Proprietor/owner name
- `taxNumber1`: TIN number
- `invoiceWarrantyRemarks`: Default warranty terms

### Location Settings

Customize per-location details:
- `landmark`: Address line 1
- `city`, `state`, `zipCode`: Address components
- `mobile`, `email`: Contact information

### Default Warranty Terms

Set default values in ServiceJobOrder creation:
```typescript
const defaultWarrantyTerms = {
  serviceWarrantyPeriod: 90, // 90 days
  serviceWarrantyConditions: "Warranty covers parts and labor for the specific repair performed. Does not cover new issues or user damage.",
  warrantyCovers: "Parts replacement and labor for the same issue within warranty period.",
  warrantyNotCovers: "Physical damage, water damage, user negligence, new issues, wear and tear."
}
```

## Best Practices

### Data Entry
1. Always capture serial numbers for trackability
2. Document problem clearly and thoroughly
3. Take photos before/after repair (store URLs in notes)
4. Get customer signature on completion

### Warranty Management
1. Set realistic warranty periods based on service type
2. Clearly document warranty conditions
3. Train staff on warranty policies
4. Keep warranty slips on file for audit

### Financial Tracking
1. Separate labor and parts costs
2. Track quality check failures
3. Monitor warranty claim rates
4. Analyze technician performance

### Customer Service
1. Provide detailed warranty information
2. Explain warranty coverage clearly
3. Give customer multiple copies (customer + duplicate)
4. Follow up after warranty period

## Reports & Analytics

Create additional reports using the ServiceJobOrder data:
- Service revenue by technician
- Average repair time by service type
- Parts usage frequency
- Warranty claim analysis
- Customer satisfaction tracking
- Pending vs completed jobs

## Future Enhancements

Potential additions:
1. SMS/Email notification for job status updates
2. Customer portal to view job status
3. Parts inventory auto-deduction
4. Technician performance dashboards
5. Automated warranty expiry reminders
6. Integration with accounting module
7. Before/after photo gallery
8. Customer feedback/rating system
9. Recurring service packages
10. Service appointment scheduling

## Support & Troubleshooting

### Common Issues

**Issue:** Warranty slip not printing
- **Solution:** Check browser popup settings, ensure printer permissions

**Issue:** Missing business information
- **Solution:** Update Business and BusinessLocation models with complete details

**Issue:** Parts not showing
- **Solution:** Ensure ServiceJobPart records are created with jobOrderId relation

**Issue:** Incorrect totals
- **Solution:** Recalculate totals when parts/labor costs change:
  ```typescript
  const subtotal = laborCost + partsCost + additionalCharges
  const grandTotal = subtotal - discountAmount + taxAmount
  const balanceDue = grandTotal - amountPaid
  ```

## Technical Notes

### Multi-Tenant Security
- All queries filtered by `businessId`
- API route verifies session user's businessId matches job order's businessId
- Prevents cross-tenant data access

### Performance Optimization
- Use `include` for related data fetching (single query)
- Index on frequently queried fields (jobOrderNumber, serialNumber, status)
- Paginate job order lists

### Decimal Precision
- All currency fields use `Decimal(22, 4)` for accuracy
- Convert to float for JSON serialization
- Format to 2 decimal places for display

## Conclusion

The Service Warranty Slip system provides a complete solution for technical service and repair businesses to:
- Track service jobs from start to finish
- Generate professional warranty documentation
- Maintain customer trust with clear warranty terms
- Comply with BIR requirements
- Analyze service performance and profitability

The implementation is production-ready and follows UltimatePOS Modern conventions for multi-tenancy, RBAC, and professional report generation.
