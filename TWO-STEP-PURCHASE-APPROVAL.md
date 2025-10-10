# Two-Step Purchase Approval Workflow

## Overview

The purchase receipt (GRN - Goods Received Note) system implements a **two-step approval workflow** to ensure proper accountability and control over inventory additions.

## Workflow Steps

### Step 1: Receipt Creation (Encoder)

**Role:** Any user with `PURCHASE_RECEIPT_CREATE` permission

**Actions:**
1. User receives goods from supplier
2. Creates a GRN by going to Purchase Order → "Create GRN" button
3. Records:
   - Quantities received
   - Serial numbers (if applicable)
   - Condition of items
   - Receipt date
   - Notes
4. Submits the GRN

**Important:** At this stage, **NO inventory is added to stock yet**. The receipt is created with status `pending`.

**Tracked Information:**
- `receivedBy` - User ID of the person who created the GRN
- `receivedAt` - Timestamp when GRN was created

### Step 2: Receipt Approval (Approving Officer)

**Role:** Any user with `PURCHASE_RECEIPT_APPROVE` permission

**Actions:**
1. Reviews the pending GRN at `/dashboard/purchases/receipts`
2. Verifies:
   - Quantities match what was actually received
   - Serial numbers are correct
   - Item conditions are accurate
   - All information is complete
3. Approves the GRN

**Important:** Only after approval is inventory added to stock:
- Stock transactions are created
- Variation location details are updated
- Serial numbers are registered
- Product costs are updated (weighted average)
- Purchase item quantities are updated
- Purchase order status is updated

**Tracked Information:**
- `approvedBy` - User ID of the person who approved the GRN
- `approvedAt` - Timestamp when GRN was approved
- `status` - Changed from `pending` to `approved`

## Data Integrity Rules

### 1. Immutability After Approval

Once a GRN is approved:
- ✅ **Status**: `approved` (cannot be changed)
- ❌ **Cannot be edited** - Maintains audit trail integrity
- ❌ **Cannot be deleted** - Preserves transaction history
- ✅ **If corrections needed** - Use Inventory Corrections feature

### 2. Dual Responsibility

- **Encoder Responsibility**: Accurate data entry of received goods
- **Approver Responsibility**: Verification and authorization to add inventory

This separation of duties prevents:
- Unauthorized inventory additions
- Data entry errors going unnoticed
- Single-person fraud

### 3. Audit Trail

Every GRN maintains a complete audit trail:
```
Received By: John Doe (Encoder)
Received At: 2025-01-15 10:30 AM

Approved By: Jane Smith (Manager)
Approved At: 2025-01-15 2:15 PM
```

Both users are permanently recorded in:
- Purchase receipt record
- Audit logs
- Stock transaction records

## Permissions

### Required Permissions

1. **View Receipts**
   - Permission: `PURCHASE_RECEIPT_VIEW`
   - Can view all GRNs and their details

2. **Create Receipts (Encoder)**
   - Permission: `PURCHASE_RECEIPT_CREATE`
   - Can create new GRNs from purchase orders
   - Cannot approve their own receipts (unless they also have approval permission)

3. **Approve Receipts (Approving Officer)**
   - Permission: `PURCHASE_RECEIPT_APPROVE`
   - Can approve pending GRNs
   - Triggers inventory addition

### Typical Role Assignments

- **Cashier/Staff**: `PURCHASE_RECEIPT_CREATE` (Encoder only)
- **Manager/Supervisor**: `PURCHASE_RECEIPT_APPROVE` (Can approve)
- **Admin/Owner**: Both permissions (Can do both, but should follow workflow)

## UI Flow

### For Encoders

1. Go to **Purchases** → **Purchase Orders**
2. Find the purchase order
3. Click **"Create GRN"** button
4. Fill in received quantities and serial numbers
5. Submit
6. Receipt is created with status: **PENDING**

### For Approvers

1. Go to **Purchases** → **Goods Received (GRN)**
2. Filter by status: **Pending Approval**
3. Click **"View"** on a receipt
4. Review all details:
   - Items and quantities
   - Serial numbers
   - Encoder information
   - Total value
5. Click **"Approve & Add Inventory"** button
6. Confirm approval
7. Inventory is added and receipt status changes to: **APPROVED**

## Error Correction

### Before Approval
If encoder made a mistake:
- **Not yet implemented**: Edit functionality for pending receipts
- **Workaround**: Create a new GRN with correct information

### After Approval
Once approved, GRNs are locked. To correct errors:
1. Use **Inventory Corrections** feature
2. Document the reason for correction
3. Corrections also require approval (depending on configuration)

## Reports and Analytics

### Audit Reports
View complete history:
- Who created each GRN
- Who approved each GRN
- Timestamps for all actions
- Changes to inventory levels

### Performance Metrics
Track:
- Average time between receipt creation and approval
- Number of pending approvals
- Encoder accuracy rates
- Approval rejection reasons (if implemented)

## Best Practices

1. **Separation of Duties**
   - Different person should approve than who created
   - Prevents single-person control over inventory

2. **Timely Approvals**
   - Approve GRNs within 24 hours of creation
   - Delays affect inventory accuracy in reports

3. **Thorough Verification**
   - Physically verify quantities
   - Check serial numbers against items
   - Verify item conditions

4. **Documentation**
   - Use notes field for any discrepancies
   - Document reasons for partial receipts
   - Keep physical delivery notes

## Technical Implementation

### Database Changes
- `PurchaseReceipt.status`: `pending` → `approved`
- `PurchaseReceipt.approvedBy`: Set to approver's user ID
- `PurchaseReceipt.approvedAt`: Set to approval timestamp

### Stock Impact (Only on Approval)
1. `StockTransaction` records created
2. `VariationLocationDetails.qtyAvailable` increased
3. `ProductSerialNumber` records created (if applicable)
4. `ProductVariation.purchasePrice` updated (weighted average)
5. `PurchaseItem.quantityReceived` incremented
6. `Purchase.status` updated to `received` or `partially_received`

### API Endpoints

- `POST /api/purchases/[id]/receive` - Create GRN (Encoder)
- `GET /api/purchases/receipts` - List all GRNs
- `GET /api/purchases/receipts/[id]` - Get GRN details
- `POST /api/purchases/receipts/[id]/approve` - Approve GRN (Approver)

### UI Pages

- `/dashboard/purchases/receipts` - GRN list with filters
- `/dashboard/purchases/receipts/[id]` - GRN detail and approval page

## Security Considerations

1. **Permission-Based Access**
   - All endpoints check permissions
   - UI elements hidden if no permission

2. **Location-Based Access**
   - Users can only see GRNs for their assigned locations
   - Unless they have `ACCESS_ALL_LOCATIONS` permission

3. **Immutability**
   - Approved GRNs cannot be modified
   - Maintains financial and audit integrity

4. **Audit Logging**
   - All actions logged with:
     - User ID and username
     - Timestamp
     - IP address
     - User agent
     - Action details

## Integration with Other Features

### With Purchase Orders
- GRNs are linked to purchase orders
- Multiple GRNs can be created for one PO (partial receipts)
- PO status updates based on received quantities

### With Inventory
- Stock added only after approval
- Weighted average costing applied
- Serial numbers tracked from receipt to sale

### With Accounting
- COGS calculated using costs from approved receipts
- Profitability reports use receipt-based costs
- Accounts payable updated on receipt (if implemented)

### With Audit Trail
- Complete history of all approval actions
- Searchable by user, date, location
- Exportable for compliance

---

**Last Updated:** 2025-01-07
**Version:** 1.0
