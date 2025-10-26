# Service Warranty Slip Module - Complete Implementation

## Quick Access

- **Quick Start**: [SERVICE_WARRANTY_SLIP_QUICK_START.md](./SERVICE_WARRANTY_SLIP_QUICK_START.md)
- **Full Documentation**: [SERVICE_WARRANTY_SLIP_IMPLEMENTATION.md](./SERVICE_WARRANTY_SLIP_IMPLEMENTATION.md)
- **Architecture**: [SERVICE_WARRANTY_SLIP_ARCHITECTURE.md](./SERVICE_WARRANTY_SLIP_ARCHITECTURE.md)
- **Summary**: [SERVICE_WARRANTY_SLIP_SUMMARY.md](./SERVICE_WARRANTY_SLIP_SUMMARY.md)

## What's Included

This module provides a complete **Service Warranty Slip** system for technical service and repair businesses.

### Core Components

1. **Database Models** (Prisma Schema)
   - `ServiceJobOrder` - Main job tracking
   - `ServiceJobPart` - Parts used in repairs

2. **API Endpoint**
   - `GET /api/reports/service-warranty-slip?jobOrderId={id}`

3. **Print Component**
   - `ServiceWarrantySlipPrint.tsx`

4. **Documentation**
   - Implementation guide
   - Quick start guide
   - Architecture diagrams
   - Code examples

## Key Features

- Multi-tenant support (businessId filtering)
- Multi-paper size support (80mm thermal, A4, Letter, Legal)
- Professional warranty slip design
- Complete service tracking (customer, product, technician, parts, costs)
- Payment tracking and balance calculation
- Service warranty terms and conditions
- BIR-compliant formatting (Philippines)
- Print and PDF export functionality
- Customer/Office/Technician copy types

## Installation

### 1. Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database
npm run db:push
```

### 2. Verify Files

Ensure these files exist:
- ✅ `prisma/schema.prisma` (updated with Service models)
- ✅ `src/app/api/reports/service-warranty-slip/route.ts`
- ✅ `src/components/ServiceWarrantySlipPrint.tsx`

### 3. Test Installation

Create a test job order:

```typescript
const jobOrder = await prisma.serviceJobOrder.create({
  data: {
    businessId: 1,
    locationId: 1,
    jobOrderNumber: 'JO-TEST-001',
    orderDate: new Date(),
    customerName: 'Test Customer',
    customerPhone: '+63 912 345 6789',
    productName: 'Test Product',
    problemReported: 'Test problem',
    serviceType: 'Repair',
    dateReceived: new Date(),
    laborCost: 500,
    partsCost: 0,
    subtotal: 500,
    grandTotal: 500,
    amountPaid: 500,
    balanceDue: 0,
    status: 'completed',
    createdBy: 1,
  }
})

console.log('Test Job Order ID:', jobOrder.id)
```

Access the warranty slip:
```
http://localhost:3000/api/reports/service-warranty-slip?jobOrderId={id}
```

## Usage Example

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import ServiceWarrantySlipPrint from '@/components/ServiceWarrantySlipPrint'

export default function ServicePage({ jobOrderId }: { jobOrderId: number }) {
  const [showSlip, setShowSlip] = useState(false)
  const [jobOrder, setJobOrder] = useState(null)

  const handlePrint = async () => {
    const res = await fetch(`/api/reports/service-warranty-slip?jobOrderId=${jobOrderId}`)
    const data = await res.json()
    setJobOrder(data.jobOrder)
    setShowSlip(true)
  }

  return (
    <>
      <Button onClick={handlePrint}>Print Warranty Slip</Button>

      {showSlip && jobOrder && (
        <ServiceWarrantySlipPrint
          jobOrder={jobOrder}
          isOpen={showSlip}
          onClose={() => setShowSlip(false)}
          copyType="customer"
        />
      )}
    </>
  )
}
```

## Data Model

### ServiceJobOrder

Main service job tracking table with:
- Customer information
- Product/device details
- Problem and diagnosis
- Service details and technician
- Cost breakdown
- Payment tracking
- Warranty terms
- Status workflow

### ServiceJobPart

Parts used in service jobs:
- Links to inventory (Product/ProductVariation)
- Quantity and pricing
- Descriptions

## Report Sections

The warranty slip includes:

1. **Header** - Business name, address, contact
2. **Job Info** - Order number, date, status
3. **Customer** - Name, phone, email, address
4. **Product** - Name, serial, purchase date
5. **Problem** - Reported issue, diagnosis
6. **Service** - Technician, dates
7. **Parts** - Detailed parts table
8. **Costs** - Labor, parts, total
9. **Payment** - Paid, balance, method
10. **Warranty** - Terms and coverage
11. **Signatures** - Customer and staff

## Paper Sizes

- **80mm Thermal** - Receipt-style for thermal printers
- **A4** - Standard international (210mm x 297mm)
- **Letter** - US standard (8.5" x 11")
- **Legal** - US legal (8.5" x 14")

## Security

- Multi-tenant data isolation (businessId filtering)
- NextAuth session-based authentication
- API route permission verification
- Cross-tenant access prevention

## BIR Compliance (Philippines)

Includes all required BIR elements:
- Business name and TIN
- Complete address
- Sequential numbering
- Date and time
- Itemized costs
- Customer details
- Authorized signatures

## Workflow

1. **Create Job Order** - Customer brings device for repair
2. **Assign Technician** - Assign repair to technician
3. **Diagnose Problem** - Document findings
4. **Add Parts** - Record parts used
5. **Complete Service** - Update costs and completion date
6. **Quality Check** - Quality checker verifies work
7. **Process Payment** - Record payment
8. **Print Warranty Slip** - Generate slip for customer

## API Reference

### GET /api/reports/service-warranty-slip

**Query Parameters:**
- `jobOrderId` (required) - ID of service job order

**Response:**
```json
{
  "jobOrder": {
    "id": 1,
    "jobOrderNumber": "JO-2025-0001",
    "customerName": "John Doe",
    "productName": "Laptop HP Pavilion",
    "grandTotal": 4000.00,
    "parts": [...],
    "business": {...},
    "location": {...}
  }
}
```

**Errors:**
- `401` - Unauthorized (no session)
- `400` - Bad Request (missing jobOrderId)
- `404` - Not Found (job order doesn't exist)
- `403` - Forbidden (different businessId)
- `500` - Server Error

## Component Props

### ServiceWarrantySlipPrint

```typescript
interface ServiceWarrantySlipPrintProps {
  jobOrder: any              // Complete job order object from API
  isOpen: boolean            // Show/hide dialog
  onClose: () => void        // Close handler
  copyType?: 'customer' | 'office' | 'technician'  // Copy label
}
```

## Customization

### Business Settings

Update in Business model:
- `name` - Business name on slip
- `taxNumber1` - TIN number
- Invoice-related fields

### Location Settings

Update in BusinessLocation:
- `landmark` - Address
- `mobile` - Phone
- `email` - Email

### Default Warranty

Set defaults when creating job orders:
```typescript
{
  serviceWarrantyPeriod: 90,  // Days
  serviceWarrantyConditions: "Your terms here",
  warrantyCovers: "What's covered",
  warrantyNotCovers: "What's NOT covered"
}
```

## Next Steps

### For Full Service Module

1. **Create Job Order Form**
   - Customer selection/creation
   - Product details entry
   - Problem description
   - Technician assignment

2. **Build Service Dashboard**
   - List all job orders
   - Filter by status/technician
   - Quick actions

3. **Add Reports**
   - Service revenue
   - Technician performance
   - Parts usage
   - Warranty claims

4. **Inventory Integration**
   - Auto-deduct parts
   - Stock alerts
   - Parts costing

5. **Customer Portal**
   - View job status
   - Track warranty
   - Request service

## Troubleshooting

### Common Issues

**Warranty slip not loading**
- Check job order ID exists
- Verify user businessId matches
- Check API endpoint is accessible

**Print not working**
- Enable browser popups
- Check printer drivers
- Try different paper size

**Missing data**
- Ensure business settings are complete
- Verify job order has all required fields
- Check parts are properly linked

**Incorrect totals**
- Recalculate: `subtotal - discount + tax = grandTotal`
- Verify decimal precision
- Check parts subtotals

## Performance

- Optimized queries with `include`
- Indexed fields for fast lookups
- Single-query data fetching
- Efficient print rendering

## File Structure

```
ultimatepos-modern/
├── prisma/
│   └── schema.prisma (ServiceJobOrder, ServiceJobPart models)
├── src/
│   ├── app/
│   │   ├── api/reports/service-warranty-slip/route.ts
│   │   └── dashboard/service/example-usage.tsx
│   └── components/
│       └── ServiceWarrantySlipPrint.tsx
├── SERVICE_WARRANTY_SLIP_IMPLEMENTATION.md
├── SERVICE_WARRANTY_SLIP_QUICK_START.md
├── SERVICE_WARRANTY_SLIP_ARCHITECTURE.md
├── SERVICE_WARRANTY_SLIP_SUMMARY.md
└── SERVICE_MODULE_README.md (this file)
```

## Documentation

- **Quick Start** - Get started in 5 minutes
- **Implementation** - Complete technical guide
- **Architecture** - System design and diagrams
- **Summary** - Overview and features
- **README** - This file

## Support

For help:
1. Check Quick Start guide
2. Review Implementation guide
3. See example-usage.tsx for code samples
4. Check Architecture for system design

## Conclusion

You now have a production-ready Service Warranty Slip system with:

✅ Complete database schema
✅ Secure API endpoint
✅ Professional print component
✅ Multi-paper size support
✅ BIR compliance
✅ Comprehensive documentation
✅ Code examples
✅ Multi-tenant security

Start by creating a test job order and printing a warranty slip!

## Version

- **Version**: 1.0.0
- **Date**: January 2025
- **Status**: Production Ready
- **License**: Part of UltimatePOS Modern

---

**Need Help?** See the documentation files listed at the top of this README.
