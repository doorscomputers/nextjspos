# Stock Transfer Multi-Stage Approval Workflow

## Overview
This document defines the comprehensive stock transfer workflow with multiple approval stages between locations.

## Workflow States

### 1. **DRAFT** (Initial Creation)
- Transfer created by user at origin location
- Items added to transfer
- Can be edited/deleted
- **Actions Available:**
  - Edit items
  - Delete transfer
  - Submit for checking → **PENDING_CHECK**

### 2. **PENDING_CHECK** (Awaiting Origin Verification)
- Submitted for checking by origin checker
- Origin checker must verify physical items match the list
- Cannot be edited once submitted
- **Required Permission:** `STOCK_TRANSFER_CHECK`
- **Actions Available:**
  - Approve (by checker) → **CHECKED**
  - Reject → **DRAFT** (with notes)
  - Cancel → **CANCELLED**

### 3. **CHECKED** (Origin Verified, Ready to Ship)
- Origin checker has verified all items
- Ready for physical transfer
- Printable transfer receipt generated
- **Recorded Data:**
  - `checkedBy` (user ID)
  - `checkedAt` (timestamp)
  - Checker's notes
- **Actions Available:**
  - Send/Ship → **IN_TRANSIT**
  - Cancel → **CANCELLED**

### 4. **IN_TRANSIT** (Physically Shipped)
- Items physically sent to destination
- Stock DEDUCTED from origin location
- Transfer receipt printed for courier
- **Recorded Data:**
  - `sentBy` (user ID)
  - `sentAt` (timestamp)
  - `stockDeducted = true`
- **Actions Available:**
  - Mark as Arrived (destination) → **ARRIVED**
  - Cancel (requires approval) → **CANCELLED** + **stock restoration**

### 5. **ARRIVED** (Received at Destination)
- Physical items arrived at destination
- Destination needs to verify items
- **Recorded Data:**
  - `arrivedBy` (user ID)
  - `arrivedAt` (timestamp)
- **Actions Available:**
  - Start verification → **VERIFYING**
  - Report discrepancy → **DISCREPANCY**

### 6. **VERIFYING** (Destination Checking Items)
- Destination staff checking each item against transfer receipt
- Checkbox for each item to confirm receipt
- Can note discrepancies
- **Actions Available:**
  - Confirm all items → **VERIFIED**
  - Report partial receipt → **PARTIAL**
  - Report full discrepancy → **DISCREPANCY**

### 7. **VERIFIED** (All Items Confirmed)
- All items confirmed by destination
- Ready for final completion
- **Recorded Data:**
  - `verifiedBy` (user ID)
  - `verifiedAt` (timestamp)
  - Item-level verification checkboxes
- **Actions Available:**
  - Complete Transfer → **COMPLETED**

### 8. **COMPLETED** (Inventory Adjusted - LOCKED)
- Stock ADDED to destination location
- Transfer is now IMMUTABLE
- Cannot be edited or cancelled
- Full audit trail recorded
- **Recorded Data:**
  - `completedBy` (user ID)
  - `completedAt` (timestamp)
  - Final inventory adjustment records
- **No Further Actions**

### 9. **CANCELLED** (Transfer Cancelled)
- Transfer cancelled at any stage before completion
- If stock was deducted (IN_TRANSIT), it's restored
- **Recorded Data:**
  - `cancelledBy` (user ID)
  - `cancelledAt` (timestamp)
  - Cancellation reason
- **No Further Actions**

### 10. **DISCREPANCY** (Issues Found)
- Items don't match or damaged
- Requires resolution before proceeding
- **Actions Available:**
  - Resolve and continue → **VERIFIED**
  - Partial accept → **PARTIAL**
  - Cancel → **CANCELLED**

### 11. **PARTIAL** (Partial Receipt)
- Only some items received correctly
- Requires adjustment
- **Actions Available:**
  - Complete with adjustments → **COMPLETED**
  - Create new transfer for missing items
  - Cancel → **CANCELLED**

---

## Permissions Required

### Create Transfer
- `STOCK_TRANSFER_CREATE`
- Access to origin location

### Check/Verify at Origin
- `STOCK_TRANSFER_CHECK`
- Access to origin location
- Must be different user than creator (optional, can be enforced)

### Send Transfer
- `STOCK_TRANSFER_SEND`
- Access to origin location

### Receive at Destination
- `STOCK_TRANSFER_RECEIVE`
- Access to destination location

### Verify Items at Destination
- `STOCK_TRANSFER_VERIFY`
- Access to destination location

### Complete Transfer
- `STOCK_TRANSFER_COMPLETE`
- Access to destination location (or both locations)

### Cancel Transfer
- `STOCK_TRANSFER_CANCEL`
- Access to relevant location
- Different rules based on stage

---

## Database Schema Updates Needed

### StockTransfer Model
```prisma
model StockTransfer {
  // ... existing fields ...

  status String @db.VarChar(50)
  // Values: draft, pending_check, checked, in_transit, arrived, verifying, verified, completed, cancelled, discrepancy, partial

  // Origin checker
  checkedBy Int? @map("checked_by")
  checkedAt DateTime? @map("checked_at")
  checkerNotes String? @map("checker_notes") @db.Text

  // Arrival at destination
  arrivedBy Int? @map("arrived_by")
  arrivedAt DateTime? @map("arrived_at")

  // Destination verification
  verifiedBy Int? @map("verified_by")
  verifiedAt DateTime? @map("verified_at")
  verifierNotes String? @map("verifier_notes") @db.Text

  // Completion
  completedBy Int? @map("completed_by")
  completedAt DateTime? @map("completed_at")

  // Cancellation
  cancelledBy Int? @map("cancelled_by")
  cancelledAt DateTime? @map("cancelled_at")
  cancellationReason String? @map("cancellation_reason") @db.Text

  // Discrepancy tracking
  hasDiscrepancy Boolean @default(false) @map("has_discrepancy")
  discrepancyNotes String? @map("discrepancy_notes") @db.Text
}
```

### StockTransferItem Model
```prisma
model StockTransferItem {
  // ... existing fields ...

  // Destination verification
  receivedQuantity Decimal? @map("received_quantity") @db.Decimal(22, 4)
  verified Boolean @default(false)
  verifiedBy Int? @map("verified_by")
  verifiedAt DateTime? @map("verified_at")

  // Discrepancy
  hasDiscrepancy Boolean @default(false) @map("has_discrepancy")
  discrepancyNotes String? @map("discrepancy_notes") @db.Text
}
```

---

## API Endpoints

### Existing
- `GET /api/transfers` - List transfers
- `POST /api/transfers` - Create transfer (status: draft)
- `GET /api/transfers/[id]` - Get transfer details
- `PUT /api/transfers/[id]` - Update transfer (only in draft)
- `DELETE /api/transfers/[id]` - Delete transfer (only in draft)

### New/Enhanced
- `POST /api/transfers/[id]/submit-for-check` - Submit for checking (draft → pending_check)
- `POST /api/transfers/[id]/check-approve` - Approve at origin (pending_check → checked)
- `POST /api/transfers/[id]/check-reject` - Reject to draft (pending_check → draft)
- `POST /api/transfers/[id]/send` - Send transfer (checked → in_transit)
- `POST /api/transfers/[id]/mark-arrived` - Mark arrived (in_transit → arrived)
- `POST /api/transfers/[id]/start-verification` - Start verification (arrived → verifying)
- `POST /api/transfers/[id]/verify-item` - Verify individual item
- `POST /api/transfers/[id]/complete-verification` - Complete all verification (verifying → verified)
- `POST /api/transfers/[id]/complete` - Final completion (verified → completed) **ADJUSTS INVENTORY**
- `POST /api/transfers/[id]/cancel` - Cancel transfer at any stage
- `POST /api/transfers/[id]/report-discrepancy` - Report issues
- `GET /api/transfers/[id]/receipt` - Get printable receipt

---

## UI Pages

### 1. Transfer List (`/dashboard/transfers`)
- Table showing all transfers
- Filter by status, location, date
- Status badges
- Quick actions based on current status

### 2. Create Transfer (`/dashboard/transfers/create`)
- Select origin and destination locations
- Add items with quantities
- Serial number selection for tracked items
- Notes field
- Save as draft or submit for checking

### 3. Transfer Details (`/dashboard/transfers/[id]`)
- Shows complete transfer information
- Status timeline/progress indicator
- Action buttons based on current status and permissions
- Printable view

### 4. Transfer Approval (`/dashboard/transfers/[id]/check`)
- For origin checkers
- Checklist of items to verify
- Approve or reject with notes

### 5. Transfer Receiving (`/dashboard/transfers/[id]/receive`)
- For destination staff
- Verify each item with checkboxes
- Report discrepancies
- Final confirmation

### 6. Printable Transfer Receipt (`/dashboard/transfers/[id]/print`)
- Professional transfer document
- Origin and destination details
- Checker information
- Item list with quantities and serial numbers
- Signatures section
- Barcode/QR code for quick lookup

---

## Printable Receipt Format

```
╔═══════════════════════════════════════════════════════════╗
║                   STOCK TRANSFER RECEIPT                   ║
╠═══════════════════════════════════════════════════════════╣
║ Transfer #: TRF-202510-00001          Date: Oct 7, 2025   ║
║ Status: IN TRANSIT                                        ║
╠═══════════════════════════════════════════════════════════╣
║ FROM LOCATION:                                            ║
║   Main Warehouse                                          ║
║   123 Main St, City, State 12345                         ║
║                                                           ║
║ TO LOCATION:                                              ║
║   Branch Store #2                                         ║
║   456 Branch Ave, City, State 67890                      ║
╠═══════════════════════════════════════════════════════════╣
║ PREPARED BY:     John Doe              Oct 7, 2025 10:00 ║
║ CHECKED BY:      Jane Smith            Oct 7, 2025 10:30 ║
║ SENT BY:         John Doe              Oct 7, 2025 11:00 ║
╠═══════════════════════════════════════════════════════════╣
║ ITEMS:                                                    ║
║ ┌─────────────────────────────────────────────────────┐  ║
║ │ #  │ Product          │ Qty │ Serial Numbers      │  ║
║ ├─────────────────────────────────────────────────────┤  ║
║ │ 1  │ iPhone 13 Pro    │  5  │ SN-001, SN-002...  │  ║
║ │ 2  │ Samsung Galaxy   │  3  │ SN-010, SN-011...  │  ║
║ │ 3  │ Laptop Dell      │  2  │ Not tracked        │  ║
║ └─────────────────────────────────────────────────────┘  ║
║                                                           ║
║ TOTAL ITEMS: 3                    TOTAL QUANTITY: 10     ║
╠═══════════════════════════════════════════════════════════╣
║ VERIFICATION AT DESTINATION:                              ║
║                                                           ║
║ Received By: ________________  Date: _______________     ║
║                                                           ║
║ Signature: _________________   Time: _______________     ║
║                                                           ║
║ □ All items received in good condition                   ║
║ □ Quantities match                                        ║
║ □ Serial numbers verified                                 ║
║                                                           ║
║ Notes: _______________________________________________    ║
║       _______________________________________________    ║
╠═══════════════════════════════════════════════════════════╣
║                   [QR CODE]                               ║
║           Scan to view transfer details                   ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Implementation Priority

1. ✅ Database schema updates (Prisma migrate)
2. ✅ API endpoints for workflow stages
3. ✅ Transfer list page
4. ✅ Transfer creation page
5. ✅ Transfer details page with approval actions
6. ✅ Printable receipt component
7. ✅ Testing complete workflow

---

## Notes

- All state transitions are logged in audit trail
- Inventory adjustments only happen at COMPLETED stage
- Transfer is immutable once COMPLETED
- Stock restored if cancelled after IN_TRANSIT
- Email notifications can be added for each stage (optional)
- Real-time updates via WebSocket (future enhancement)
