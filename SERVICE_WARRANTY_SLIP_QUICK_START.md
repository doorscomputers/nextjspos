# Service Warranty Slip - Quick Start Guide

## Installation Steps

### 1. Update Database Schema

```bash
# Generate Prisma Client
npx prisma generate

# Push changes to database
npm run db:push
```

This will create two new tables:
- `service_job_orders`
- `service_job_parts`

### 2. Add Permissions (Optional)

Add to `src/lib/rbac.ts`:

```typescript
export const PERMISSIONS = {
  // ... existing permissions
  SERVICE_VIEW: 'service.view',
  SERVICE_CREATE: 'service.create',
  SERVICE_PRINT_WARRANTY: 'service.print_warranty',
}
```

### 3. Create a Test Service Job Order

Use Prisma Studio or create via API:

```typescript
// Example: Create test job order
const jobOrder = await prisma.serviceJobOrder.create({
  data: {
    businessId: 1,
    locationId: 1,
    jobOrderNumber: 'JO-2025-0001',
    orderDate: new Date(),
    customerName: 'John Doe',
    customerPhone: '+63 912 345 6789',
    customerEmail: 'john@example.com',
    productName: 'Laptop HP Pavilion 15',
    serialNumber: 'SN123456789',
    productPurchaseDate: new Date('2024-01-15'),
    problemReported: 'Laptop not turning on, no display',
    diagnosisFindings: 'Faulty RAM module, needs replacement',
    recommendedAction: 'Replace RAM with 8GB DDR4',
    serviceType: 'Repair',
    dateReceived: new Date(),
    estimatedCompletion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    laborCost: 500,
    partsCost: 2500,
    subtotal: 3000,
    grandTotal: 3000,
    amountPaid: 3000,
    balanceDue: 0,
    serviceWarrantyPeriod: 90,
    serviceWarrantyConditions: 'Covers parts and labor for this specific repair only',
    warrantyCovers: 'RAM module replacement and related labor',
    warrantyNotCovers: 'Physical damage, liquid damage, new issues',
    status: 'completed',
    createdBy: 1, // User ID
  },
})

// Add parts used
await prisma.serviceJobPart.create({
  data: {
    jobOrderId: jobOrder.id,
    partName: 'RAM 8GB DDR4',
    description: 'Crucial 8GB DDR4-2666 SODIMM',
    quantity: 1,
    unitPrice: 2500,
    subtotal: 2500,
  },
})
```

### 4. Create a Service Page Component

Create `src/app/dashboard/service/[id]/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import ServiceWarrantySlipPrint from '@/components/ServiceWarrantySlipPrint'
import { Printer } from 'lucide-react'

export default function ServiceJobOrderPage({ params }: { params: { id: string } }) {
  const [showWarrantySlip, setShowWarrantySlip] = useState(false)
  const [jobOrder, setJobOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchAndPrintWarrantySlip = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/reports/service-warranty-slip?jobOrderId=${params.id}`
      )
      const data = await response.json()

      if (data.jobOrder) {
        setJobOrder(data.jobOrder)
        setShowWarrantySlip(true)
      } else {
        alert('Job order not found')
      }
    } catch (error) {
      console.error('Error fetching warranty slip:', error)
      alert('Failed to load warranty slip')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Service Job Order #{params.id}</h1>

          <div className="flex gap-4">
            <Button
              onClick={fetchAndPrintWarrantySlip}
              disabled={loading}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              {loading ? 'Loading...' : 'Print Warranty Slip'}
            </Button>
          </div>
        </div>
      </div>

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

### 5. Add to Navigation (Optional)

Update `src/components/Sidebar.tsx`:

```tsx
// Add to menu items
{
  label: 'Service Management',
  icon: Wrench,
  href: '/dashboard/service',
  permission: PERMISSIONS.SERVICE_VIEW,
},
```

## Testing

### 1. Access the Service Page

Navigate to: `http://localhost:3000/dashboard/service/1`

(Replace `1` with your test job order ID)

### 2. Click "Print Warranty Slip"

This will:
- Fetch the job order data from the API
- Open the warranty slip dialog
- Show paper size selection buttons
- Display the formatted warranty slip

### 3. Select Paper Size

Choose from:
- **80mm Thermal** - Compact receipt format
- **A4** - Standard international paper
- **Letter** - US standard (recommended for most printers)
- **Legal** - US legal size

### 4. Print

Click "Print Warranty Slip" button to generate a print preview and send to printer.

## Customization

### Change Default Warranty Period

Edit the default in `ServiceJobOrder` creation:

```typescript
serviceWarrantyPeriod: 90, // Change to desired days
```

### Customize Warranty Terms

Update default warranty conditions:

```typescript
serviceWarrantyConditions: "Your custom warranty conditions here",
warrantyCovers: "What your warranty covers",
warrantyNotCovers: "What your warranty does NOT cover",
```

### Business Information

Update business details in database or Business settings page:
- Business name
- Tax number (TIN)
- Address
- Contact information

These will appear on the warranty slip header.

## API Testing

### Using cURL

```bash
curl -X GET "http://localhost:3000/api/reports/service-warranty-slip?jobOrderId=1" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie"
```

### Using Browser Console

```javascript
fetch('/api/reports/service-warranty-slip?jobOrderId=1')
  .then(res => res.json())
  .then(data => console.log(data))
```

## Production Checklist

Before going live:

- [ ] Update business information (name, TIN, address)
- [ ] Configure default warranty terms
- [ ] Set appropriate warranty periods for different service types
- [ ] Train staff on warranty slip generation
- [ ] Test printing on actual printers (thermal and standard)
- [ ] Create service job order workflow/UI
- [ ] Set up RBAC permissions
- [ ] Configure sequential job order numbering
- [ ] Test multi-tenant data isolation
- [ ] Create backup procedures for service records

## Troubleshooting

### Warranty Slip Not Loading

**Check:**
1. Job order ID exists in database
2. User has permission to view job orders
3. BusinessId matches between user and job order
4. All required fields are populated

### Print Not Working

**Solutions:**
1. Enable browser popups for your domain
2. Check printer drivers installed
3. Try different paper size
4. Use browser's native print dialog (Ctrl+P)

### Missing Data on Slip

**Fix:**
1. Ensure all job order relations are included in API query
2. Check that business and location data is complete
3. Verify parts are linked correctly

### Incorrect Totals

**Recalculate:**
```typescript
const subtotal = laborCost + partsCost + additionalCharges
const afterDiscount = subtotal - discountAmount
const grandTotal = afterDiscount + taxAmount
const balanceDue = grandTotal - amountPaid
```

## Next Steps

1. **Create Service Job Order Form**
   - Build UI for creating/editing job orders
   - Add technician assignment
   - Implement status workflow

2. **Build Service Management Dashboard**
   - List all job orders
   - Filter by status, technician, date
   - Quick actions (print, edit, complete)

3. **Add Reports**
   - Service revenue report
   - Technician performance
   - Warranty claim tracking
   - Parts usage analysis

4. **Integrate with Inventory**
   - Auto-deduct parts from inventory
   - Track parts used per technician
   - Reorder alerts for service parts

5. **Customer Notifications**
   - SMS/Email when service is complete
   - Warranty expiry reminders
   - Service due notifications

## Support

For questions or issues:
1. Check the full documentation: `SERVICE_WARRANTY_SLIP_IMPLEMENTATION.md`
2. Review Prisma schema: `prisma/schema.prisma`
3. Examine API route: `src/app/api/reports/service-warranty-slip/route.ts`
4. Check component: `src/components/ServiceWarrantySlipPrint.tsx`

## Summary

You now have a complete Service Warranty Slip system with:
- ✅ Database models for job orders and parts
- ✅ API endpoint for fetching complete job data
- ✅ Professional print component with multiple paper sizes
- ✅ Multi-tenant security
- ✅ BIR-compliant formatting
- ✅ Comprehensive warranty information

Start by creating a test job order and printing a warranty slip to see it in action!
