# Stock Transfer Workflow - Complete Status Guide

## Overview
The stock transfer system uses an 8-stage workflow with strict separation of duties. Each stage must be performed by a different user to ensure proper control and audit compliance.

---

## Complete Workflow Diagram

```
┌──────────┐
│  DRAFT   │ ← Transfer Created
└────┬─────┘
     │ API: POST /api/transfers/[id]/submit-for-check
     │ Action: "Submit for Checking" button
     │ Permission: STOCK_TRANSFER_CREATE
     ▼
┌──────────────┐
│ PENDING_CHECK│ ← Awaiting approval from checker
└────┬─────────┘
     │ API: POST /api/transfers/[id]/check-approve
     │ Action: "Approve" button (different user than creator)
     │ Permission: STOCK_TRANSFER_CHECK
     │ Enforcement: Checker CANNOT be the creator
     ▼
┌──────────┐
│ CHECKED  │ ← Approved and ready to send
└────┬─────┘
     │ API: POST /api/transfers/[id]/send
     │ Action: "Send Transfer" button
     │ Permission: STOCK_TRANSFER_SEND
     │ CRITICAL: Stock deducted from source location
     │ Enforcement: Sender CANNOT be creator or checker
     ▼
┌────────────┐
│ IN_TRANSIT │ ← Goods physically moving between locations
└────┬───────┘  Stock has been deducted from source
     │ API: POST /api/transfers/[id]/mark-arrived
     │ Action: "Mark as Arrived" button
     │ Permission: STOCK_TRANSFER_RECEIVE
     │ Enforcement: Must be done at destination location
     │ Enforcement: Arrival marker CANNOT be creator, checker, or sender
     ▼
┌──────────┐
│ ARRIVED  │ ← Goods physically received at destination
└────┬─────┘
     │ API: POST /api/transfers/[id]/start-verification
     │ Action: "Start Verification" button
     │ Permission: STOCK_TRANSFER_VERIFY
     │ Enforcement: Verifier CANNOT be the arrival marker
     ▼
┌───────────┐
│ VERIFYING │ ← Destination staff verifying items one-by-one
└────┬──────┘
     │ API: POST /api/transfers/[id]/verify-item (for each item)
     │ Action: Input received quantity and click "Verify" per item
     │ Permission: STOCK_TRANSFER_VERIFY
     │ When ALL items verified → status auto-updates to "verified"
     ▼
┌──────────┐
│ VERIFIED │ ← All items physically counted and confirmed
└────┬─────┘
     │ API: POST /api/transfers/[id]/complete
     │ Action: "Complete Transfer" button
     │ Permission: STOCK_TRANSFER_COMPLETE
     │ CRITICAL: Stock added to destination location
     │ Enforcement: Completer CANNOT be creator or sender
     ▼
┌───────────┐
│ COMPLETED │ ← Transfer finalized, stock updated
└───────────┘  Stock has been added to destination
               Transfer is now IMMUTABLE

Alternative Flow:
┌──────────────┐
│ PENDING_CHECK│
└────┬─────────┘
     │ API: POST /api/transfers/[id]/check-reject
     │ Action: "Reject" button (with reason)
     │ Permission: STOCK_TRANSFER_CHECK
     ▼
┌───────────┐
│ CANCELLED │ ← Transfer rejected/cancelled
└───────────┘
```

---

## Status Details

### 1. **DRAFT**
- **Description**: Initial state when transfer is created
- **Stock Impact**: None - no inventory changes
- **Available Actions**:
  - Submit for Checking
  - Cancel Transfer
  - Edit (basic fields only - date, notes)
- **Who Can Act**: Creator
- **Next Status**: pending_check (via submit-for-check)

### 2. **PENDING_CHECK**
- **Description**: Awaiting approval from checker/supervisor
- **Stock Impact**: None
- **Available Actions**:
  - Approve (different user than creator)
  - Reject (with reason)
  - Cancel Transfer
- **Who Can Act**: User with STOCK_TRANSFER_CHECK permission (NOT the creator)
- **Separation of Duties**: Checker CANNOT be the same as creator
- **Next Status**:
  - checked (via check-approve)
  - cancelled (via check-reject)

### 3. **CHECKED**
- **Description**: Approved and ready to be sent
- **Stock Impact**: None yet
- **Available Actions**:
  - Send Transfer (will deduct stock)
  - Cancel Transfer
- **Who Can Act**: User with STOCK_TRANSFER_SEND permission (NOT creator or checker)
- **Separation of Duties**: Sender CANNOT be creator or checker
- **Next Status**: in_transit (via send)

### 4. **IN_TRANSIT** ⚠️ **CRITICAL STATUS**
- **Description**: Goods are physically being transported
- **Stock Impact**: **Stock DEDUCTED from source location**
- **Available Actions**:
  - Mark as Arrived (at destination)
  - Cancel Transfer (will restore stock to source)
- **Who Can Act**: User at destination location with STOCK_TRANSFER_RECEIVE permission
- **Separation of Duties**: Arrival marker CANNOT be creator, checker, or sender
- **Next Status**: arrived (via mark-arrived)
- **Important**:
  - This is when stock physically leaves the source location
  - Serial numbers (if any) are marked as "in_transit"
  - Cannot be edited after this point

### 5. **ARRIVED**
- **Description**: Goods physically received at destination, awaiting verification
- **Stock Impact**: Stock still deducted from source, NOT YET added to destination
- **Available Actions**:
  - Start Verification
- **Who Can Act**: User at destination with STOCK_TRANSFER_VERIFY permission (NOT the arrival marker)
- **Separation of Duties**: Verifier CANNOT be the arrival marker
- **Next Status**: verifying (via start-verification)

### 6. **VERIFYING**
- **Description**: Destination staff counting and verifying each item
- **Stock Impact**: Stock still deducted from source, NOT YET added to destination
- **Available Actions**:
  - Verify each item (enter received quantity)
- **Who Can Act**: User with STOCK_TRANSFER_VERIFY permission
- **Process**:
  1. For each item, enter the received quantity
  2. Click "Verify" button for that item
  3. System marks item as verified
  4. When ALL items verified → status automatically becomes "verified"
- **Next Status**: verified (automatically when all items verified)

### 7. **VERIFIED**
- **Description**: All items physically counted and confirmed
- **Stock Impact**: Stock still deducted from source, NOT YET added to destination
- **Available Actions**:
  - Complete Transfer (will add stock to destination)
- **Who Can Act**: User at destination with STOCK_TRANSFER_COMPLETE permission (NOT creator or sender)
- **Separation of Duties**: Completer CANNOT be creator or sender
- **Next Status**: completed (via complete)

### 8. **COMPLETED** ✅ **FINAL STATUS**
- **Description**: Transfer finalized, inventory updated
- **Stock Impact**: **Stock ADDED to destination location**
- **Available Actions**: None (immutable)
- **Result**:
  - Stock removed from source location (done in "in_transit")
  - Stock added to destination location (done here)
  - Serial numbers (if any) updated to destination location
  - Transfer is now permanent and cannot be modified
  - Audit trail complete

### 9. **CANCELLED** (Alternative End State)
- **Description**: Transfer rejected or cancelled
- **Stock Impact**:
  - If cancelled before "in_transit": No stock changes
  - If cancelled during "in_transit": Stock restored to source location
- **Who Can Cancel**:
  - Creator (during draft or pending_check)
  - Checker (via reject during pending_check)
  - Admin (during draft, pending_check, checked, or in_transit)
- **Result**:
  - Transfer marked as deleted
  - If stock was deducted, it's restored to source
  - Serial numbers (if any) restored to "in_stock" at source

---

## API Endpoints & Status Transitions

| Endpoint | Method | From Status | To Status | Stock Impact |
|----------|--------|-------------|-----------|--------------|
| `/api/transfers` | POST | N/A | draft | None |
| `/api/transfers/[id]/submit-for-check` | POST | draft | pending_check | None |
| `/api/transfers/[id]/check-approve` | POST | pending_check | checked | None |
| `/api/transfers/[id]/check-reject` | POST | pending_check | cancelled | None |
| `/api/transfers/[id]/send` | POST | checked | in_transit | **Deduct from source** |
| `/api/transfers/[id]/mark-arrived` | POST | in_transit | arrived | None |
| `/api/transfers/[id]/start-verification` | POST | arrived | verifying | None |
| `/api/transfers/[id]/verify-item` | POST | verifying | verifying → verified (when all done) | None |
| `/api/transfers/[id]/complete` | POST | verified | completed | **Add to destination** |
| `/api/transfers/[id]` | DELETE | draft, pending_check, checked, in_transit | cancelled | Restore if deducted |

---

## Permissions Required

| Permission | Description | Can Perform |
|------------|-------------|-------------|
| `STOCK_TRANSFER_CREATE` | Create and submit transfers | Create, Edit (draft), Submit for Check |
| `STOCK_TRANSFER_CHECK` | Approve/reject transfers | Approve, Reject |
| `STOCK_TRANSFER_SEND` | Send transfers (deduct stock) | Send Transfer |
| `STOCK_TRANSFER_RECEIVE` | Receive at destination | Mark as Arrived |
| `STOCK_TRANSFER_VERIFY` | Verify items | Start Verification, Verify Items |
| `STOCK_TRANSFER_COMPLETE` | Complete transfer (add stock) | Complete Transfer |
| `STOCK_TRANSFER_DELETE` | Cancel transfers | Cancel Transfer |
| `STOCK_TRANSFER_VIEW` | View transfers | View all transfer details |
| `ACCESS_ALL_LOCATIONS` | Override location restrictions | Access all locations |

---

## Separation of Duties Enforcement

### Why It Matters
Separation of duties prevents fraud and errors by ensuring that:
1. No single person can both create and approve a transfer
2. No single person can both send and receive a transfer
3. Physical receipt verification is independent of who marked it as arrived

### Enforced Rules

1. **Creator ≠ Checker**
   - The person who approves a transfer CANNOT be the person who created it
   - Enforced in: `check-approve` endpoint
   - Error: "Cannot approve your own transfer"

2. **Creator/Checker ≠ Sender**
   - The person who sends a transfer CANNOT be the creator or checker
   - Enforced in: `send` endpoint
   - Error: "Cannot send your own transfer" or "Cannot send a transfer you checked"

3. **Creator/Checker/Sender ≠ Receiver**
   - The person at destination who marks as arrived CANNOT be the creator, checker, or sender
   - Enforced in: `mark-arrived` endpoint
   - Error: "Cannot receive your own transfer" (etc.)

4. **Arrival Marker ≠ Verifier**
   - The person who verifies items CANNOT be the person who marked it as arrived
   - Enforced in: `start-verification` endpoint
   - Error: "Cannot verify a transfer you marked as arrived"

5. **Creator/Sender ≠ Completer**
   - The person who completes the transfer CANNOT be the creator or sender
   - Enforced in: `complete` endpoint
   - Error: "Cannot complete your own transfer"

---

## Workflow Example

**Scenario**: Warehouse A transfers 100 units to Store B

1. **John (Warehouse Staff)** creates transfer → Status: **draft**
2. **John** clicks "Submit for Checking" → Status: **pending_check**
3. **Mary (Supervisor)** reviews and clicks "Approve" → Status: **checked**
4. **Steve (Warehouse Manager)** clicks "Send Transfer" → Status: **in_transit**
   - Stock deducted from Warehouse A inventory
   - Transfer document printed and sent with goods
5. **Lisa (Store B Staff)** receives goods and clicks "Mark as Arrived" → Status: **arrived**
6. **Tom (Store B Manager)** clicks "Start Verification" → Status: **verifying**
7. **Tom** counts each item and enters received quantity, clicks "Verify" for each → Status: **verified** (when all items done)
8. **Mike (Store B Admin)** clicks "Complete Transfer" → Status: **completed**
   - Stock added to Store B inventory
   - Transfer is finalized

**Result**:
- 6 different people involved (separation of duties)
- Complete audit trail
- Stock accurately tracked from source to destination
- Fraud prevention through multiple checkpoints

---

## Best Practices

### For Businesses

1. **Assign Roles Properly**
   - Don't give all permissions to everyone
   - Branch staff should only have their location's permissions
   - Managers should have approval permissions

2. **Use All Workflow Stages**
   - Don't skip stages (e.g., going straight from draft to in_transit)
   - Each stage serves a purpose for control and verification

3. **Document Everything**
   - Use the "Notes" field for important information
   - Print the transfer document before sending goods
   - Keep physical signatures at each stage

4. **Train Staff**
   - Ensure staff understand the workflow
   - Explain why separation of duties matters
   - Train on verification procedures

### For Developers

1. **All Statuses Are Needed**
   - Each status represents a real-world checkpoint
   - Removing statuses weakens controls
   - **DO NOT** simplify the workflow

2. **Enforce Separation of Duties**
   - All user validation checks are critical
   - Do not remove or bypass these checks
   - They prevent fraud and errors

3. **Maintain Audit Trail**
   - Every action must be logged with user ID and timestamp
   - Store who performed each action (createdBy, checkedBy, sentBy, etc.)
   - Keep this data for compliance

4. **Stock Accuracy is Critical**
   - Stock is ONLY deducted in "send" action (in_transit status)
   - Stock is ONLY added in "complete" action (completed status)
   - Never modify stock at other stages

---

## FAQ

### Q: Why can't we simplify this to just "draft → sent → received → completed"?

**A**: The current workflow provides critical control points:
- **Checking stage**: Prevents errors before stock leaves
- **Arrival confirmation**: Proves goods physically arrived
- **Verification stage**: Ensures quantities are correct before finalizing
- **Separation of duties**: Prevents fraud by requiring multiple people

### Q: Why do we need both "arrived" and "verifying" statuses?

**A**:
- **Arrived**: Someone at destination confirms "yes, the truck arrived"
- **Verifying**: Someone DIFFERENT physically counts the items
- This separation prevents a single person from both receiving and confirming quantities

### Q: Can the "in_transit" status be updated automatically?

**A**:
- No. The "Mark as Arrived" button must be clicked by someone at the destination location
- This ensures physical receipt is confirmed by destination staff, not assumed
- It creates accountability and proper audit trail

### Q: What if goods are lost in transit?

**A**:
- If the transfer is in "in_transit" status and goods are lost:
  1. Cancel the transfer (will restore stock to source)
  2. File an incident report
  3. Create a new transfer when ready
- The system will restore the stock that was deducted

### Q: How do I see who did what?

**A**:
- Every transfer detail page shows the complete audit trail
- Look at the "Workflow Audit Trail" section on the right sidebar
- Shows username and timestamp for each action
- Also check the "Audit Logs" page for system-wide activity

---

## Summary

**All statuses are necessary** for:
1. ✅ **Proper control** - Multiple checkpoints prevent errors
2. ✅ **Fraud prevention** - Separation of duties
3. ✅ **Audit compliance** - Complete trail of who did what
4. ✅ **Stock accuracy** - Clear points where inventory changes
5. ✅ **Accountability** - Each person's role is documented

**DO NOT remove or skip statuses** - they represent real-world business processes and control requirements.
