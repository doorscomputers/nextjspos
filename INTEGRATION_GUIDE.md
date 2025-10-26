# Transaction Impact Report - Integration Guide

## Overview
This guide shows how to integrate the Transaction Impact Report into any transaction API that affects inventory.

## Quick Integration Pattern

For any transaction that changes inventory, follow these 4 steps:

### Step 1: Import the Tracker
```typescript
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker'
```

### Step 2: Capture BEFORE Transaction
```typescript
// Create tracker instance
const impactTracker = new InventoryImpactTracker()

// Collect product variation IDs and location IDs from your transaction
const productVariationIds = receipt.items.map(item => item.productVariationId)
const locationIds = [receipt.locationId]

// Capture inventory state BEFORE transaction
await impactTracker.captureBefore(productVariationIds, locationIds)
```

### Step 3: Execute Transaction (as normal)
```typescript
// Your existing transaction code here
const result = await prisma.$transaction(async (tx) => {
  // ... your transaction logic
})
```

### Step 4: Generate Impact Report AFTER Transaction
```typescript
// Capture inventory state AFTER and generate report
const impact = await impactTracker.captureAfterAndReport(
  productVariationIds,
  locationIds,
  'purchase',  // transaction type
  result.id,   // transaction ID
  result.receiptNumber, // reference number
  undefined,   // locationTypes (only for transfers)
  userDisplayName // performed by
)

// Return impact in response
return NextResponse.json({
  ...result,
  inventoryImpact: impact  // Add this to your response
})
```

## Complete Example: Purchase Receipt Approval

```typescript
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... existing auth and validation code

  // STEP 1: Create impact tracker
  const impactTracker = new InventoryImpactTracker()

  // STEP 2: Collect product/location info from receipt
  const productVariationIds = receipt.items.map(item => item.productVariationId)
  const locationIds = [receipt.locationId]

  // STEP 3: Capture inventory BEFORE
  await impactTracker.captureBefore(productVariationIds, locationIds)

  // STEP 4: Execute transaction (existing code)
  const updatedReceipt = await prisma.$transaction(async (tx) => {
    // ... all your existing transaction logic
    return approved
  })

  // STEP 5: Capture AFTER and generate report
  const impact = await impactTracker.captureAfterAndReport(
    productVariationIds,
    locationIds,
    'purchase',
    updatedReceipt.id,
    receipt.receiptNumber,
    undefined,
    userDisplayName
  )

  // STEP 6: Return with impact
  return NextResponse.json({
    ...updatedReceipt,
    inventoryImpact: impact
  })
}
```

## Example: Stock Transfer (Two Locations)

For transfers, you need to track BOTH source and destination:

```typescript
// Get both locations
const productVariationIds = transfer.items.map(item => item.productVariationId)
const locationIds = [transfer.fromLocationId, transfer.toLocationId]

// Capture before
await impactTracker.captureBefore(productVariationIds, locationIds)

// Execute transfer...

// Generate report with location types
const locationTypes = {
  [transfer.fromLocationId]: 'source' as const,
  [transfer.toLocationId]: 'destination' as const
}

const impact = await impactTracker.captureAfterAndReport(
  productVariationIds,
  locationIds,
  'transfer',
  transfer.id,
  transfer.transferNumber,
  locationTypes,  // Specify which is source/destination
  userDisplayName
)
```

## Frontend Integration

In your frontend component (e.g., Purchase Receipt page):

```typescript
import TransactionImpactReport from '@/components/TransactionImpactReport'
import { TransactionImpact } from '@/types/inventory-impact'

function PurchaseReceiptPage() {
  const [impactReport, setImpactReport] = useState<TransactionImpact | null>(null)
  const [showImpactReport, setShowImpactReport] = useState(false)

  const handleApprove = async () => {
    const response = await fetch(`/api/purchases/receipts/${id}/approve`, {
      method: 'POST'
    })

    const data = await response.json()

    // Show impact report if included
    if (data.inventoryImpact) {
      setImpactReport(data.inventoryImpact)
      setShowImpactReport(true)
    }

    // ... rest of your success handling
  }

  return (
    <>
      {/* Your existing UI */}
      <Button onClick={handleApprove}>Approve Receipt</Button>

      {/* Impact Report Modal */}
      <TransactionImpactReport
        impact={impactReport}
        open={showImpactReport}
        onClose={() => setShowImpactReport(false)}
      />
    </>
  )
}
```

## Transaction Types Supported

| Transaction Type | Location Type | Example |
|-----------------|---------------|---------|
| `purchase` | `single` | Purchase receipts, goods received |
| `sale` | `single` | POS sales, customer orders |
| `transfer` | `source` + `destination` | Stock transfers between locations |
| `adjustment` | `single` | Inventory corrections, adjustments |
| `correction` | `single` | Stock count corrections |
| `return` | `single` | Customer returns, supplier returns |

## Files to Integrate

### 1. Purchase Receipts ✅
- **File:** `src/app/api/purchases/receipts/[id]/approve/route.ts`
- **Frontend:** `src/app/dashboard/purchases/receipts/[id]/page.tsx`

### 2. Sales
- **File:** `src/app/api/sales/route.ts`
- **Frontend:** `src/app/dashboard/pos/page.tsx`

### 3. Stock Transfers (Send)
- **File:** `src/app/api/transfers/[id]/send/route.ts`
- **Frontend:** `src/app/dashboard/transfers/[id]/page.tsx`

### 4. Stock Transfers (Receive)
- **File:** `src/app/api/transfers/[id]/complete/route.ts`
- **Frontend:** `src/app/dashboard/transfers/[id]/page.tsx`

### 5. Inventory Adjustments
- **File:** `src/app/api/adjustments/route.ts` or `corrections/route.ts`
- **Frontend:** Adjustment/correction pages

## Testing Checklist

After integration, test each transaction type:

- [ ] Purchase Receipt approval shows impact report
- [ ] Report shows correct previous, change, and new quantities
- [ ] Products are listed correctly with SKUs
- [ ] Location names are displayed
- [ ] Can export to CSV
- [ ] Can print report
- [ ] Works for multi-product transactions
- [ ] Works for transfers (shows both locations)
- [ ] Modal closes properly

## Benefits

1. **Instant Verification** - See immediately what changed
2. **Error Detection** - Catch inventory issues in real-time
3. **Audit Trail** - Export reports for record-keeping
4. **User Confidence** - Visual confirmation of changes
5. **Debugging** - Quickly identify inventory problems

## Next Steps

1. Integrate into Purchase Receipts (as shown above)
2. Test with real data
3. Integrate into other transaction types
4. Train users on the new report feature
5. Monitor for any issues

---

**Need Help?** All integration code is in:
- Types: `src/types/inventory-impact.ts`
- Service: `src/lib/inventory-impact-tracker.ts`
- Component: `src/components/TransactionImpactReport.tsx`
