# User Permission Guide for Different Locations
## Complete Reference for Testing Transaction Workflows

> Last Updated: October 20, 2025
> Business: PciNet Computer Trading and Services
> Transfer Workflow Mode: FULL (Create → Check → Send → Receive → Verify → Complete)

---

## Quick Reference Table

| Username | Location | Role(s) | Primary Functions |
|----------|----------|---------|-------------------|
| **superadmin** | ALL | Super Admin | Full system access, all operations |
| **admin** | ALL | Admin | Full business management, all operations |
| **manager** | ALL | Manager | Operations management, approvals |
| **cashier** | ALL | Cashier | POS, basic sales operations |
| **mainstore_clerk** | Main Store | Transfer Creator | Create transfer requests |
| **mainstore_supervisor** | Main Store | Transfer Checker | Approve/check transfers |
| **mainstore_manager** | Main Store | Transfer Sender | Send transfers (stock deducted) |
| **mainstore_receiver** | Main Store | Transfer Receiver | Receive & verify incoming transfers |
| **bambang_clerk** | Bambang | Transfer Creator | Create transfer requests |
| **bambang_supervisor** | Bambang | Transfer Checker | Approve/check transfers |
| **bambang_manager** | Bambang | Transfer Sender + Receiver | Send & receive transfers |
| **bambang_receiver** | Bambang | Transfer Receiver | Receive & verify incoming transfers |
| **baguio_clerk** | Baguio | Transfer Creator | Create transfer requests |
| **baguio_supervisor** | Baguio | Transfer Checker | Approve/check transfers |
| **baguio_manager** | Baguio | Transfer Sender | Send transfers (stock deducted) |
| **baguio_receiver** | Baguio | Transfer Receiver | Receive & verify incoming transfers |

---

## Demo Accounts (Full System Access)

### Super Admin
```
Username: superadmin
Password: password
Business: PciNet Computer Trading and Services
Locations: ALL
```

**CAPABILITIES:**
- Platform-wide access (can manage multiple businesses)
- All permissions automatically granted
- User Management: Create, update, delete users
- Role Management: Create, modify, delete roles
- Business Settings: Full configuration access
- Transfer Operations: ALL (create, check, send, receive, verify, complete)
- Purchase Operations: ALL (create, receive, approve, return)
- Sales Operations: ALL (create, void, refund)
- Inventory Operations: ALL (corrections, adjustments, physical count)
- Reporting: ALL reports with full financial visibility
- Can see cost prices, profit margins, all branch stock
- Can override all approval workflows

**TESTING USE CASES:**
- System-wide configuration testing
- Multi-business scenario testing
- Emergency override situations
- Full workflow validation

---

### Admin
```
Username: admin
Password: password
Business: PciNet Computer Trading and Services
Locations: ALL
```

**CAPABILITIES:**
- Full business management (single business only)
- User Management: Create, update, delete users within business
- Role Management: Create, modify roles for business
- Transfer Operations: ALL (create, check, send, receive, verify, complete)
- Purchase Operations: ALL (create, receive, approve, return)
- Sales Operations: ALL (create, void, refund)
- Inventory Operations: ALL (corrections, adjustments, approvals)
- Reporting: ALL reports including profit/cost analysis
- Can approve inventory corrections
- Can approve purchase receipts (GRN)
- Can approve supplier returns
- Access to all locations within business

**TESTING USE CASES:**
- Business-level administration
- User and role configuration
- Approval workflows (corrections, purchases, returns)
- Cross-location operations

---

### Manager
```
Username: manager
Password: password
Business: PciNet Computer Trading and Services
Locations: ALL
```

**CAPABILITIES:**
- Operations management and oversight
- Transfer Operations: View, create, send, receive (limited approval)
- Purchase Operations: Create, receive (requires approval for completion)
- Sales Operations: Create, view, basic refunds
- Inventory Operations: View, create corrections (requires approval)
- Reporting: Most reports except detailed profit analysis
- Can view all locations
- Can manage daily operations
- Cannot delete users or modify roles
- Cannot approve high-value transactions

**TESTING USE CASES:**
- Daily operations workflows
- Multi-location inventory management
- Standard approval workflows
- Operational reporting

---

### Cashier
```
Username: cashier
Password: password
Business: PciNet Computer Trading and Services
Locations: ALL
```

**CAPABILITIES:**
- Point of Sale operations only
- Sales Operations: Create sales, process payments
- Shift Management: Open/close shifts
- Cash Operations: Cash in/out (within limits)
- Product Lookup: View products and stock
- Basic Reports: Sales today, shift summaries
- CANNOT: View cost prices or profit margins
- CANNOT: Access inventory corrections
- CANNOT: Create transfers or purchases
- CANNOT: View detailed financial reports
- CANNOT: Approve any transactions

**TESTING USE CASES:**
- POS transaction processing
- Shift opening/closing workflows
- Limited data visibility validation
- Field-level permission testing

---

## Location-Based Transfer Users

### Main Store (Location ID: 1)

#### mainstore_clerk
```
Username: mainstore_clerk
Password: password
Location: Main Store
Role: Transfer Creator
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.create - Create new transfer requests
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Creates transfer requests from Main Store to other branches
2. Selects products and quantities to transfer
3. Cannot approve or send transfers
4. First step in transfer workflow

**TESTING SCENARIOS:**
- Create transfer: Main Store → Bambang
- Create transfer: Main Store → Baguio
- Verify cannot access "Check" or "Send" buttons
- Confirm can view transfer status

---

#### mainstore_supervisor
```
Username: mainstore_supervisor
Password: password
Location: Main Store
Role: Transfer Checker
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.check - Approve/check transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Reviews transfer requests created by clerks
2. Verifies quantities and product selections
3. Approves transfers (changes status to CHECKED)
4. Second step in transfer workflow

**TESTING SCENARIOS:**
- Check pending transfers created by mainstore_clerk
- Approve/reject transfer requests
- Verify cannot access "Send" button
- Confirm proper status transitions (PENDING → CHECKED)

---

#### mainstore_manager
```
Username: mainstore_manager
Password: password
Location: Main Store
Role: Transfer Sender
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.send - Send checked transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Sends approved/checked transfers
2. Triggers stock deduction from Main Store
3. Changes transfer status to IN_TRANSIT
4. Third step in transfer workflow

**TESTING SCENARIOS:**
- Send transfers that are in CHECKED status
- Verify stock is deducted from Main Store
- Confirm transfer shows IN_TRANSIT status
- Verify cannot access "Receive" or "Complete" buttons
- Confirm stock transactions created with type "TRANSFER_OUT"

---

#### mainstore_receiver
```
Username: mainstore_receiver
Password: password
Location: Main Store
Role: Transfer Receiver
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.receive - Receive transfers
- stock_transfer.verify - Verify received items
- stock_transfer.complete - Complete verified transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Receives incoming transfers TO Main Store
2. Verifies each item (scan/manual verification)
3. Completes transfer after full verification
4. Final step in transfer workflow (when Main Store is destination)

**TESTING SCENARIOS:**
- Receive transfers sent TO Main Store (from Bambang/Baguio)
- Start verification process
- Verify individual items one by one
- Complete transfer after all items verified
- Verify stock is added to Main Store
- Confirm stock transactions created with type "TRANSFER_IN"

---

### Bambang Branch (Location ID: 3)

#### bambang_clerk
```
Username: bambang_clerk
Password: password
Location: Bambang
Role: Transfer Creator
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.create - Create new transfer requests
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Creates transfer requests from Bambang to other locations
2. Selects products and quantities to transfer
3. First step in transfer workflow for Bambang branch

**TESTING SCENARIOS:**
- Create transfer: Bambang → Main Store
- Create transfer: Bambang → Baguio
- Request stock replenishment from Main Store
- Verify proper location filtering

---

#### bambang_supervisor
```
Username: bambang_supervisor
Password: password
Location: Bambang
Role: Transfer Checker
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.check - Approve/check transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Reviews and approves Bambang transfer requests
2. Quality control check before sending
3. Second step in transfer workflow

**TESTING SCENARIOS:**
- Check transfers created by bambang_clerk
- Approve outgoing transfers from Bambang
- Verify quantity accuracy

---

#### bambang_manager
```
Username: bambang_manager
Password: password
Location: Bambang
Role: Transfer Sender + Transfer Receiver (DUAL ROLE)
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.send - Send checked transfers
- stock_transfer.receive - Receive incoming transfers
- stock_transfer.verify - Verify received items
- stock_transfer.complete - Complete verified transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. **As Sender:** Sends approved transfers FROM Bambang
2. **As Receiver:** Receives and verifies transfers TO Bambang
3. Dual-role user for branch management
4. Can handle both outbound and inbound transfers

**TESTING SCENARIOS:**
- **Sending:** Send transfers from Bambang to other locations
- **Receiving:** Receive transfers sent to Bambang
- **Verification:** Complete full verification workflow
- **Complete Transfer:** Finalize incoming shipments
- Test role switching between sender and receiver functions

---

#### bambang_receiver
```
Username: bambang_receiver
Password: password
Location: Bambang
Role: Transfer Receiver
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.receive - Receive transfers
- stock_transfer.verify - Verify received items
- stock_transfer.complete - Complete verified transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Receives incoming transfers TO Bambang
2. Performs item-by-item verification
3. Completes transfer after verification
4. Alternative receiver if manager unavailable

**TESTING SCENARIOS:**
- Receive transfers from Main Store to Bambang
- Verify received quantities match sent quantities
- Test discrepancy handling (received ≠ sent)
- Complete transfer and confirm stock added

---

### Baguio Branch (Location ID: 4)

#### baguio_clerk
```
Username: baguio_clerk
Password: password
Location: Baguio
Role: Transfer Creator
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.create - Create new transfer requests
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Creates transfer requests from Baguio branch
2. Initiates stock replenishment requests
3. First step in Baguio transfer workflow

**TESTING SCENARIOS:**
- Create transfer: Baguio → Main Store
- Create transfer: Baguio → Bambang
- Request stock from other locations

---

#### baguio_supervisor
```
Username: baguio_supervisor
Password: password
Location: Baguio
Role: Transfer Checker
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.check - Approve/check transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Reviews Baguio transfer requests
2. Approves outgoing transfers
3. Second step in transfer workflow

**TESTING SCENARIOS:**
- Check transfers created by baguio_clerk
- Approve transfers from Baguio
- Verify product selections and quantities

---

#### baguio_manager
```
Username: baguio_manager
Password: password
Location: Baguio
Role: Transfer Sender
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.send - Send checked transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Sends approved transfers FROM Baguio
2. Triggers stock deduction from Baguio
3. Third step in transfer workflow

**TESTING SCENARIOS:**
- Send transfers that passed supervisor check
- Verify stock deduction from Baguio
- Confirm IN_TRANSIT status
- Verify proper stock transaction records

---

#### baguio_receiver
```
Username: baguio_receiver
Password: password
Location: Baguio
Role: Transfer Receiver
```

**PERMISSIONS:**
- stock_transfer.view - View all transfers
- stock_transfer.receive - Receive transfers
- stock_transfer.verify - Verify received items
- stock_transfer.complete - Complete verified transfers
- product.view - View products and stock levels

**WORKFLOW RESPONSIBILITIES:**
1. Receives incoming transfers TO Baguio
2. Performs verification of received items
3. Completes transfer workflow
4. Final step for Baguio-bound transfers

**TESTING SCENARIOS:**
- Receive transfers from Main Store to Baguio
- Receive transfers from Bambang to Baguio
- Complete verification process
- Handle discrepancies and email alerts
- Finalize transfer and add stock to Baguio

---

## Complete Transfer Workflow Examples

### Example 1: Main Store → Bambang

```
STEP 1: CREATE (mainstore_clerk)
  - Login as: mainstore_clerk / password
  - Navigate to: Transfers > Create Transfer
  - Source: Main Store
  - Destination: Bambang
  - Add products and quantities
  - Submit transfer
  - Status: PENDING

STEP 2: CHECK (mainstore_supervisor)
  - Login as: mainstore_supervisor / password
  - Navigate to: Transfers > View Transfers
  - Find pending transfer
  - Review details
  - Click "Check" button
  - Status: CHECKED

STEP 3: SEND (mainstore_manager)
  - Login as: mainstore_manager / password
  - Navigate to: Transfers > View Transfers
  - Find checked transfer
  - Click "Send" button
  - Stock deducted from Main Store
  - Status: IN_TRANSIT

STEP 4: RECEIVE (bambang_manager OR bambang_receiver)
  - Login as: bambang_manager / password
  - Navigate to: Transfers > View Transfers
  - Find in-transit transfer
  - Click "Receive" button
  - Status: RECEIVED

STEP 5: VERIFY (bambang_manager OR bambang_receiver)
  - Click "Start Verification"
  - Scan or manually verify each item
  - System tracks verification progress
  - Status: VERIFYING

STEP 6: COMPLETE (bambang_manager OR bambang_receiver)
  - After all items verified
  - Click "Complete Transfer"
  - Stock added to Bambang
  - Status: COMPLETED
  - If discrepancies: Email sent to admin
```

### Example 2: Bambang → Baguio (Cross-Branch)

```
STEP 1: CREATE (bambang_clerk)
  - Login as: bambang_clerk / password
  - Source: Bambang
  - Destination: Baguio
  - Status: PENDING

STEP 2: CHECK (bambang_supervisor)
  - Login as: bambang_supervisor / password
  - Review and check transfer
  - Status: CHECKED

STEP 3: SEND (bambang_manager)
  - Login as: bambang_manager / password
  - Send transfer (stock leaves Bambang)
  - Status: IN_TRANSIT

STEP 4-6: RECEIVE & COMPLETE (baguio_receiver)
  - Login as: baguio_receiver / password
  - Receive → Verify → Complete
  - Stock added to Baguio
  - Status: COMPLETED
```

---

## Permission Matrix

### Transfer Operations Permission Breakdown

| Permission | Clerk | Supervisor | Manager (Sender) | Receiver | Admin | Super Admin |
|------------|-------|------------|------------------|----------|-------|-------------|
| `stock_transfer.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock_transfer.create` | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `stock_transfer.check` | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `stock_transfer.send` | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `stock_transfer.receive` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `stock_transfer.verify` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `stock_transfer.complete` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `product.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Purchase Operations

| Permission | Clerk | Manager | Admin | Super Admin |
|------------|-------|---------|-------|-------------|
| `purchase.view` | ❌ | ✅ | ✅ | ✅ |
| `purchase.create` | ❌ | ✅ | ✅ | ✅ |
| `purchase.receive` | ❌ | ✅ | ✅ | ✅ |
| `purchase.approve` | ❌ | ❌ | ✅ | ✅ |
| `purchase.receipt.create` | ❌ | ✅ | ✅ | ✅ |
| `purchase.receipt.approve` | ❌ | ❌ | ✅ | ✅ |
| `purchase.view_cost` | ❌ | ✅ | ✅ | ✅ |

### Sales Operations

| Permission | Cashier | Manager | Admin | Super Admin |
|------------|---------|---------|-------|-------------|
| `sell.view` | ✅ (own) | ✅ (all) | ✅ (all) | ✅ (all) |
| `sell.create` | ✅ | ✅ | ✅ | ✅ |
| `sell.view_cost` | ❌ | ✅ | ✅ | ✅ |
| `sell.view_profit` | ❌ | ✅ | ✅ | ✅ |
| `void.create` | ❌ | ✅ | ✅ | ✅ |
| `void.approve` | ❌ | ❌ | ✅ | ✅ |

### Inventory Operations

| Permission | Clerk | Manager | Admin | Super Admin |
|------------|-------|---------|-------|-------------|
| `inventory_correction.view` | ❌ | ✅ | ✅ | ✅ |
| `inventory_correction.create` | ❌ | ✅ | ✅ | ✅ |
| `inventory_correction.approve` | ❌ | ❌ | ✅ | ✅ |
| `physical_inventory.export` | ❌ | ✅ | ✅ | ✅ |
| `physical_inventory.import` | ❌ | ❌ | ✅ | ✅ |

---

## Location Information

### Main Store (ID: 1)
```
Name: Main Store
City: Tarlac City
State: Tarlac Province
Zip: 2300
Mobile: +63-912-555-0001
Email: mainstore@pcinetstore.com
Status: ACTIVE
```

**Users at this location:**
- mainstore_clerk (Creator)
- mainstore_supervisor (Checker)
- mainstore_manager (Sender)
- mainstore_receiver (Receiver)

---

### Bambang Branch (ID: 3)
```
Name: Bambang
City: Bambang
State: Region 2
Zip: 3702
Mobile: +63-912-555-0003
Email: bambang@pcinetstore.com
Status: ACTIVE
```

**Users at this location:**
- bambang_clerk (Creator)
- bambang_supervisor (Checker)
- bambang_manager (Sender + Receiver - DUAL ROLE)
- bambang_receiver (Receiver)

---

### Baguio Branch (ID: 4)
```
Name: Baguio
City: Baguio
State: Baguio
Zip: 2600
Mobile: +63-912-555-0004
Email: baguio@pcinetstore.com
Status: ACTIVE
```

**Users at this location:**
- baguio_clerk (Creator)
- baguio_supervisor (Checker)
- baguio_manager (Sender)
- baguio_receiver (Receiver)

---

## Testing Checklists

### Transfer Workflow Testing

#### Basic Transfer Flow
- [ ] Clerk creates transfer request
- [ ] Supervisor checks/approves transfer
- [ ] Manager sends transfer (stock deducted)
- [ ] Receiver receives transfer at destination
- [ ] Receiver verifies all items
- [ ] Transfer completes (stock added)
- [ ] Verify stock levels correct at both locations

#### Permission Enforcement
- [ ] Clerk CANNOT send transfers
- [ ] Supervisor CANNOT send transfers
- [ ] Manager CANNOT complete transfers at destination
- [ ] Receiver CANNOT send transfers
- [ ] Users can only see transfers for their assigned locations

#### Verification Workflow
- [ ] Start verification enforced before completion
- [ ] All items must be verified before completion
- [ ] Partial verification tracked correctly
- [ ] Discrepancy email sent if quantities don't match
- [ ] Cannot complete without 100% verification

#### Cross-Location Transfers
- [ ] Main Store → Bambang
- [ ] Main Store → Baguio
- [ ] Bambang → Main Store
- [ ] Bambang → Baguio
- [ ] Baguio → Main Store
- [ ] Baguio → Bambang

### Purchase Testing

#### Purchase Order Creation
- [ ] Manager creates purchase order
- [ ] Admin approves purchase order
- [ ] Stock not affected until receipt

#### Goods Receipt Note (GRN)
- [ ] Create GRN from approved PO
- [ ] Receive items (stock added)
- [ ] Admin approves GRN
- [ ] Verify stock levels updated

#### Purchase Returns
- [ ] Create supplier return
- [ ] Admin approves return
- [ ] Stock deducted correctly

### Sales Testing

#### POS Operations
- [ ] Cashier creates sale
- [ ] Cashier processes payment
- [ ] Stock deducted from correct location
- [ ] Cashier CANNOT see cost prices
- [ ] Cashier CANNOT see profit margins

#### Sales Management
- [ ] Manager views all sales
- [ ] Manager can see cost/profit
- [ ] Manager creates void request
- [ ] Admin approves void

### Inventory Corrections

#### Standard Corrections
- [ ] Manager creates correction
- [ ] Admin approves correction
- [ ] Stock adjusted correctly
- [ ] Audit trail recorded

#### Physical Inventory
- [ ] Manager exports count sheet
- [ ] Physical count performed
- [ ] Admin imports results
- [ ] Discrepancies reviewed
- [ ] Adjustments applied

---

## Common Testing Scenarios

### Scenario 1: Stock Replenishment
**Objective:** Test full transfer workflow from warehouse to branch

1. Login as **bambang_clerk**
2. Create transfer request: Main Store → Bambang (10 units of Product A)
3. Logout, login as **bambang_supervisor**
4. Check and approve the transfer
5. Logout, login as **mainstore_manager**
6. Send the transfer (verify Main Store stock decreases by 10)
7. Logout, login as **bambang_receiver**
8. Receive the transfer
9. Start verification
10. Verify all 10 units
11. Complete transfer (verify Bambang stock increases by 10)
12. Check stock history for both locations

**Expected Results:**
- Main Store: -10 units (TRANSFER_OUT)
- Bambang: +10 units (TRANSFER_IN)
- Transfer status: COMPLETED
- All workflow steps enforced

---

### Scenario 2: Transfer with Discrepancy
**Objective:** Test discrepancy handling and email alerts

1. Create transfer: Main Store → Baguio (20 units)
2. Check and send transfer (20 units deducted from Main Store)
3. Login as **baguio_receiver**
4. Receive transfer
5. Start verification
6. **Only verify 18 units** (simulate 2 missing)
7. Attempt to complete
8. System detects discrepancy (20 sent, 18 verified)
9. Email alert sent to admin with discrepancy details
10. Transfer still completes with actual received quantity (18 units)

**Expected Results:**
- Main Store: -20 units
- Baguio: +18 units (only verified amount added)
- Email sent to admin about 2-unit shortage
- Discrepancy logged in audit trail

---

### Scenario 3: Multi-Location Purchase
**Objective:** Test purchase receipt to specific location

1. Login as **admin**
2. Create purchase order (Supplier X, 50 units Product B, Location: Bambang)
3. Approve purchase order
4. Create GRN from PO
5. Receive 50 units at Bambang
6. Approve GRN
7. Verify stock added to Bambang (not Main Store)

**Expected Results:**
- Only Bambang stock increased by 50
- Stock transaction shows PURCHASE at Bambang location
- Other locations unaffected

---

### Scenario 4: Permission Boundary Testing
**Objective:** Verify role-based access control enforcement

1. Login as **cashier**
2. Attempt to access Transfers page → Should be blocked
3. Attempt to access Inventory Corrections → Should be blocked
4. Attempt to view Purchase Reports → Should be blocked
5. Navigate to POS → Should work
6. Try to view cost price in sales → Should be hidden
7. Logout, login as **bambang_clerk**
8. Navigate to Transfers → Should work
9. Create transfer → Should work
10. Try to click "Check" button → Should be disabled/hidden
11. Try to click "Send" button → Should be disabled/hidden

**Expected Results:**
- All unauthorized access attempts blocked
- Appropriate error messages shown
- Buttons/links hidden based on permissions
- No data leakage through API

---

## Emergency Override Procedures

### When Standard Workflow Fails

If a transfer gets stuck or needs manual intervention:

1. **Login as superadmin or admin**
2. Navigate to the problematic transfer
3. Admin users can perform any step in the workflow
4. Document the reason for override
5. Complete the workflow manually
6. Verify stock levels manually using reports

### Stock Discrepancy Resolution

If stock levels don't match after transfers:

1. **Run Inventory Reconciliation Report**
   - Login as admin
   - Navigate to: Reports > Inventory Reconciliation
   - Compare system stock vs. physical count

2. **Create Inventory Correction**
   - Login as manager
   - Navigate to: Inventory > Corrections
   - Create correction for discrepancy
   - Login as admin to approve

3. **Review Stock History**
   - Check C:\xampp\htdocs\ultimatepos-modern\src\app\dashboard\products\[id]\stock-history
   - Review all transactions for the product
   - Identify missing or duplicate entries

---

## API Endpoints Reference

### Transfer Operations
- `GET /api/transfers` - List transfers (filtered by user permissions)
- `POST /api/transfers` - Create transfer (requires stock_transfer.create)
- `POST /api/transfers/[id]/send` - Send transfer (requires stock_transfer.send)
- `POST /api/transfers/[id]/receive` - Receive transfer (requires stock_transfer.receive)
- `POST /api/transfers/[id]/start-verification` - Start verification
- `POST /api/transfers/[id]/verify-item` - Verify individual item
- `POST /api/transfers/[id]/complete` - Complete transfer (requires stock_transfer.complete)

### Purchase Operations
- `GET /api/purchases` - List purchase orders
- `POST /api/purchases` - Create PO
- `POST /api/purchases/[id]/receive` - Create GRN
- `POST /api/purchases/receipts` - List GRNs
- `POST /api/purchases/receipts/[id]/approve` - Approve GRN

### Inventory Operations
- `GET /api/inventory-corrections` - List corrections
- `POST /api/inventory-corrections` - Create correction
- `POST /api/inventory-corrections/[id]/approve` - Approve correction
- `GET /api/physical-inventory/export` - Export count sheet
- `POST /api/physical-inventory/import` - Import counted results

---

## Quick Login Reference

Copy-paste ready login credentials for rapid testing:

```
# DEMO ACCOUNTS
superadmin / password
admin / password
manager / password
cashier / password

# MAIN STORE
mainstore_clerk / password
mainstore_supervisor / password
mainstore_manager / password
mainstore_receiver / password

# BAMBANG BRANCH
bambang_clerk / password
bambang_supervisor / password
bambang_manager / password  # DUAL ROLE: Sender + Receiver
bambang_receiver / password

# BAGUIO BRANCH
baguio_clerk / password
baguio_supervisor / password
baguio_manager / password
baguio_receiver / password
```

---

## Troubleshooting Common Issues

### "Permission Denied" Error
**Cause:** User lacks required permission for action
**Solution:**
- Verify user role includes necessary permission
- Check RBAC configuration in database
- Login as admin to modify user roles

### Transfer Stuck in "Pending" Status
**Cause:** Supervisor hasn't checked the transfer
**Solution:**
- Login as supervisor (e.g., bambang_supervisor)
- Navigate to Transfers
- Find pending transfer and click "Check"

### Cannot Complete Transfer
**Cause:** Verification not started or incomplete
**Solution:**
- Ensure "Start Verification" was clicked
- Verify ALL items before attempting completion
- Check verification progress indicator

### Stock Not Updated After Transfer
**Cause:** Transfer not properly completed
**Solution:**
- Check transfer status (must be COMPLETED)
- Review stock transactions table
- Run stock reconciliation
- Check for errors in application logs

### Email Alerts Not Received
**Cause:** Email configuration issue
**Solution:**
- Verify SMTP settings in .env file
- Check email service is running
- Review application logs for email errors
- Test with admin email test page

---

## Database Quick Queries

Useful queries for debugging and verification:

```sql
-- Check user roles and permissions
SELECT u.username, r.name AS role, p.name AS permission
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.userId
LEFT JOIN roles r ON ur.roleId = r.id
LEFT JOIN role_permissions rp ON r.id = rp.roleId
LEFT JOIN permissions p ON rp.permissionId = p.id
WHERE u.username = 'bambang_manager';

-- Check user location assignments
SELECT u.username, l.name AS location
FROM users u
LEFT JOIN user_locations ul ON u.id = ul.userId
LEFT JOIN business_locations l ON ul.locationId = l.id
ORDER BY u.username;

-- View recent transfers
SELECT id, status, sourceLocationId, destinationLocationId, createdAt
FROM stock_transfers
ORDER BY createdAt DESC
LIMIT 10;

-- Check stock transactions for a product variation
SELECT st.*, l.name AS location_name
FROM stock_transactions st
LEFT JOIN business_locations l ON st.locationId = l.id
WHERE st.productVariationId = [VARIATION_ID]
ORDER BY st.createdAt DESC;

-- Verify stock levels
SELECT vld.*, l.name AS location_name
FROM variation_location_details vld
LEFT JOIN business_locations l ON vld.locationId = l.id
WHERE vld.productVariationId = [VARIATION_ID];
```

---

## Support and Documentation

### Related Documentation Files
- `C:\xampp\htdocs\ultimatepos-modern\TRANSFER_WORKFLOW_COMPLETE_GUIDE.md` - Detailed transfer workflow
- `C:\xampp\htdocs\ultimatepos-modern\APPROVAL_ROLES_GUIDE.md` - Role configuration guide
- `C:\xampp\htdocs\ultimatepos-modern\ROLE_PERMISSION_MATRIX.md` - Complete permission matrix
- `C:\xampp\htdocs\ultimatepos-modern\ADMIN_VS_SUPERADMIN_GUIDE.md` - Admin privilege comparison

### Code References
- Auth Configuration: `C:\xampp\htdocs\ultimatepos-modern\src\lib\auth.ts`
- RBAC Utilities: `C:\xampp\htdocs\ultimatepos-modern\src\lib\rbac.ts`
- Transfer API: `C:\xampp\htdocs\ultimatepos-modern\src\app\api\transfers\route.ts`
- Transfer Page: `C:\xampp\htdocs\ultimatepos-modern\src\app\dashboard\transfers\page.tsx`

---

**End of User Permission Guide by Location**
