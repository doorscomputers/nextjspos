# GRN (Goods Received Note) Approval Process - Implementation Notes

## Current Status

The GRN approval process is **ALREADY IMPLEMENTED** in the codebase! Here's how it works:

### Two-Step Process

#### Step 1: Receiving/Encoding (GRN Creation)
- **Who**: User with `purchase.receipt.create` permission
- **What**: Encoder creates a GRN from a Purchase Order or directly
- **Status**: `pending` (awaiting approval)
- **Inventory Impact**: **NO CHANGE YET** ❌
- **User tracking**: `receivedBy` field stores the encoder's user ID
- **Timestamp**: `receivedAt` field stores when GRN was created

#### Step 2: Approval (Inventory Update)
- **Who**: User with `purchase.receipt.approve` permission
- **What**: Approving officer reviews and approves the GRN
- **Status**: Changes from `pending` to `approved`
- **Inventory Impact**: **STOCK IS ADDED** ✓
- **User tracking**: `approvedBy` field stores the approver's user ID
- **Timestamp**: `approvedAt` field stores when GRN was approved
- **Actions performed on approval**:
  1. Updates `PurchaseReceipt` status to 'approved'
  2. Creates `InventoryMovement` records (audit trail)
  3. Updates `ProductVariation.currentStock`
  4. Creates `AuditLog` entry
  5. Optionally updates Purchase Order status

### Verification Checklist

The approval page (`src/app/dashboard/purchases/receipts/[id]/page.tsx`) includes a comprehensive verification checklist that the approver must acknowledge before clicking "Approve & Update Inventory":

1. ✓ All product details (name, SKU, variation) are correct
2. ✓ Quantities received match the physical count
3. ✓ Unit costs and total values are accurate
4. ✓ Supplier information is correct
5. ✓ Serial numbers (if applicable) are properly recorded
6. ✓ No damaged or defective items are included

The user MUST check the verification box before the approval button becomes active.

### Audit Trail - Product History

The system creates a comprehensive audit trail when inventory is added via GRN approval:

#### 1. Inventory Movement Record
```typescript
{
  movementType: 'purchase_receipt',
  referenceType: 'purchase_receipt',
  referenceId: receipt.id.toString(),  // Links to GRN
  quantityIn: quantityReceived,
  balanceQuantity: newBalance,
  unitCost: cost,
  totalCost: totalCost,
  notes: `GRN ${receiptNumber} from PO ${purchaseOrderNumber}`,  // Shows source!
  createdBy: approvingUserId,
  locationId: warehouseLocationId,
  productId: productId,
  productVariationId: variationId
}
```

**Key Points**:
- `notes` field clearly indicates: **"GRN GRN-000001 from PO PO-000123"**
- For direct entry (no PO): **"GRN GRN-000002 (Direct Entry)"**
- `referenceType` and `referenceId` provide database-level traceability
- `createdBy` shows who approved (added stock)
- `locationId` shows which warehouse received the goods

#### 2. Audit Log Entry
```typescript
{
  userId: approvingUserId,
  action: 'APPROVE_PURCHASE_RECEIPT',
  entityType: 'purchase_receipt',
  entityId: receiptId.toString(),
  details: {
    receiptNumber: 'GRN-000001',
    purchaseId: purchaseOrderId,
    itemsApproved: itemCount,
    totalQuantity: totalQtyAdded,
    totalValue: totalCostAdded
  }
}
```

#### 3. Product History Query Example

To view a product's history showing where stock came from:

```sql
SELECT
  im.createdAt,
  im.movementType,
  im.referenceType,
  im.referenceId,
  im.quantityIn,
  im.balanceQuantity,
  im.notes,
  u.name as approved_by,
  l.name as location
FROM InventoryMovement im
LEFT JOIN User u ON im.createdBy = u.id
LEFT JOIN BusinessLocation l ON im.locationId = l.id
WHERE im.productId = ? AND im.productVariationId = ?
ORDER BY im.createdAt DESC
```

Example output:
```
Date       | Type            | Qty In | Balance | Notes                          | Approved By | Location
-----------|-----------------|--------|---------|--------------------------------|-------------|----------
2025-10-09 | purchase_receipt| 100    | 150     | GRN GRN-000003 from PO PO-0005 | John Smith  | Warehouse
2025-10-08 | purchase_receipt| 50     | 50      | GRN GRN-000001 (Direct Entry)  | Jane Doe    | Warehouse
```

This makes it **VERY EASY** to track:
- ✅ Why stock was increased (Purchase, not a manual adjustment)
- ✅ Which GRN number added the stock
- ✅ Which PO it came from (if any)
- ✅ Who approved the GRN (accountability)
- ✅ When it was approved
- ✅ Which location received it

### API Endpoints

#### GET /api/purchases/receipts
- Lists all GRNs with filtering by status and location
- Returns: GRN number, PO number, supplier, quantities, status, received by, approved by

#### GET /api/purchases/receipts/[id]
- Shows detailed GRN with all items and approval workflow
- Displays verification checklist for pending GRNs

#### POST /api/purchases/receipts/[id]/approve
- **CRITICAL**: This is where inventory is added!
- Validates approver has `purchase.receipt.approve` permission
- Creates inventory movements with full audit trail
- Updates product stock levels
- Records approver and approval timestamp

### Permission Requirements

| Action | Permission | Role Assignment |
|--------|-----------|-----------------|
| Create GRN | `purchase.receipt.create` | Warehouse Manager, Admin |
| View GRN | `purchase.receipt.view` | Warehouse Manager, Admin, Manager |
| Approve GRN | `purchase.receipt.approve` | Warehouse Manager, Admin |

### Current Issue

**Problem**: User Jheirone cannot access the GRN page
**Cause**: Jheirone HAS the permissions via the "Warehouse Manager" role, but the session might not be updated
**Solution**: User needs to log out and log back in to refresh the session with updated permissions

## Files Implementing the GRN Approval Process

1. **API Routes**:
   - `src/app/api/purchases/receipts/route.ts` - List & Create GRNs
   - `src/app/api/purchases/receipts/[id]/route.ts` - View GRN details
   - `src/app/api/purchases/receipts/[id]/approve/route.ts` - **APPROVAL LOGIC**

2. **Frontend Pages**:
   - `src/app/dashboard/purchases/receipts/page.tsx` - GRN list with filters
   - `src/app/dashboard/purchases/receipts/[id]/page.tsx` - **APPROVAL PAGE** with verification checklist
   - `src/app/dashboard/purchases/receipts/new/page.tsx` - Create new GRN

3. **Database Models** (Prisma):
   - `PurchaseReceipt` - Stores GRN header (status, dates, users)
   - `PurchaseReceiptItem` - Stores individual items received
   - `InventoryMovement` - **AUDIT TRAIL** of stock changes
   - `AuditLog` - System-wide audit log

## Workflow Example

### Scenario: Warehouse receives 100 units of Product A from PO-0001

1. **Receiving Clerk (Jheirone)** - 9:00 AM
   - Logs into system
   - Goes to Purchases → View PO-0001
   - Clicks "Receive Goods (GRN)"
   - Enters quantities received
   - Clicks "Create GRN & Add Stock"
   - System creates GRN-000005 with status `pending`
   - **Inventory: NO CHANGE** (still 50 units in stock)

2. **Warehouse Manager (Alex)** - 9:30 AM
   - Goes to Purchases → Goods Received Notes (GRN)
   - Sees GRN-000005 in "Pending Approval" list
   - Clicks "View" to see details
   - Reviews verification checklist:
     - ✓ Product details correct
     - ✓ Quantity matches physical count (100 units)
     - ✓ Unit cost correct (₱500.00)
     - ✓ Supplier correct
     - ✓ No damaged items
   - Checks the verification box
   - Clicks "Approve & Update Inventory"
   - System:
     - Changes GRN status to `approved`
     - Creates InventoryMovement record with notes "GRN GRN-000005 from PO PO-0001"
     - Updates ProductVariation.currentStock from 50 to 150
     - Records approvedBy: Alex, approvedAt: 2025-10-09 09:30:00
     - Creates AuditLog entry
   - **Inventory: UPDATED** (now 150 units in stock)

3. **Product History Query** - Anytime
   - User queries InventoryMovement for Product A
   - Sees: "100 units added via GRN GRN-000005 from PO PO-0001, approved by Alex on 2025-10-09"
   - Clear audit trail of where stock came from!

## Benefits of This Approach

1. **Separation of Duties**: Encoder ≠ Approver (fraud prevention)
2. **Data Accuracy**: Physical verification before inventory update
3. **Audit Trail**: Complete history of who did what and when
4. **Traceability**: Easy to track stock origin (PO → GRN → Inventory)
5. **Compliance**: Meets internal control requirements
6. **Accountability**: Every action is logged with user ID and timestamp

## Next Steps

1. ✅ GRN approval process is fully implemented
2. ✅ Audit trail is comprehensive
3. ✅ Permission system is in place
4. ⚠️ **PENDING**: User needs to re-login to get updated permissions
5. 📝 **TODO**: Test the full workflow end-to-end
6. 📝 **TODO**: Ensure approval notifications/alerts are working
7. 📝 **TODO**: Add reports for pending approvals
