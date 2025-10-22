# Complete Demo Accounts - All Workflows

This comprehensive guide covers ALL demo accounts for testing every workflow in the UltimatePOS Modern system across all business locations.

**Business**: PCInet Computer Store
**All Passwords**: `password`

---

## QUICK ANSWERS - Most Common Workflows

### Purchase Workflow Users (Main Warehouse ONLY)
- **ENCODING**: `warehouse_clerk` / `password`
- **APPROVE & RECEIVE GRN**: `warehouse_manager` / `password`

### Transfer Workflow Users (All Locations)
**From Main Warehouse to Any Branch:**
- **CREATE**: `warehouse_clerk` / `password`
- **CHECK**: `warehouse_supervisor` / `password`
- **SEND**: `warehouse_manager` / `password`
- **RECEIVE**: `[destination]_receiver` / `password` (e.g., `mainstore_receiver`, `bambang_receiver`)

**From Main Store to Any Location:**
- **CREATE**: `mainstore_clerk` / `password`
- **CHECK**: `mainstore_supervisor` / `password`
- **SEND**: `store_manager` / `password`
- **RECEIVE**: `[destination]_receiver` / `password`

### Sales Workflow Users (Retail Locations ONLY - NOT Warehouse)
- **Main Store**: `mainstore_cashier` / `password`
- **Bambang**: `bambang_cashier` / `password`
- **Tuguegarao**: `tuguegarao_cashier` / `password`

---

## IMPORTANT BUSINESS RULES

1. **PURCHASES**: Only Main Warehouse can enter purchases from suppliers
2. **SALES**: Only retail locations (Main Store, Bambang, Tuguegarao) can process sales - NO sales at Main Warehouse
3. **TRANSFERS**: All locations can transfer stock to each other
4. **INVENTORY CORRECTIONS**: All locations can perform inventory corrections

---

## Table of Contents

1. [System Administrator Accounts](#system-administrator-accounts)
2. [Transfer Workflow Accounts](#transfer-workflow-accounts)
3. [Inventory Corrections Workflow Accounts](#inventory-corrections-workflow-accounts)
4. [Sales Workflow Accounts](#sales-workflow-accounts)
5. [Purchase Workflow Accounts](#purchase-workflow-accounts)
6. [Supplier Returns Workflow Accounts](#supplier-returns-workflow-accounts) ✅
7. [Customer Returns Workflow Accounts](#customer-returns-workflow-accounts)
8. [Location Overview](#location-overview)
9. [Complete Testing Guide](#complete-testing-guide)

---

## System Administrator Accounts

### Super Admin
- **Username**: `superadmin`
- **Password**: `password`
- **Location**: All (No specific assignment)
- **Role**: Super Admin
- **Access**: Complete system access across all locations and all functions

### Multi-Location Admins
- **Username**: `jayvillalon`
- **Password**: `password`
- **Roles**: Purchase Approver, Transfer Approver, Return Approver, Inventory Correction Approver, Main Store Transfer Verifier, GRN Approver, All Branch Admin
- **Use Case**: Can approve across all workflows and locations

- **Username**: `Gemski`
- **Password**: `password`
- **Role**: All Branch Admin
- **Use Case**: Branch management across all locations

---

## Transfer Workflow Accounts

The transfer workflow has 4 steps: **Create → Check → Send → Receive**

### Main Store Transfer Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `mainstore_clerk` | `password` | Creates transfer requests |
| Checker | `mainstore_supervisor` | `password` | Reviews and validates transfer requests |
| Sender | `store_manager` | `password` | Sends transfer (deducts stock from Main Store) |
| Receiver | `mainstore_receiver` | `password` | Receives transfer (adds stock to destination) |

### Main Warehouse Transfer Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `warehouse_clerk` | `password` | Creates transfer requests |
| Checker | `warehouse_supervisor` | `password` | Reviews and validates transfer requests |
| Sender | `warehouse_manager` | `password` | Sends transfer (deducts stock from Main Warehouse) |
| Receiver | `warehouse_receiver` | `password` | Receives transfer (adds stock to destination) |

**Alternative Warehouse Senders**:
- `warehousesender` - Warehouse Transfer Sender role
- `Jheirone` - Warehouse Manager role

### Bambang Transfer Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `bambang_clerk` | `password` | Creates transfer requests |
| Checker | `bambang_supervisor` | `password` | Reviews and validates transfer requests |
| Sender | `bambang_manager` | `password` | Sends transfer (deducts stock from Bambang) |
| Receiver | `bambang_receiver` | `password` | Receives transfer (adds stock to destination) |

### Tuguegarao Transfer Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `tugue_clerk` | `password` | Creates transfer requests |
| Checker | `tugue_supervisor` | `password` | Reviews and validates transfer requests |
| Sender | `tugue_manager` | `password` | Sends transfer (deducts stock from Tuguegarao) |
| Receiver | `tugue_receiver` | `password` | Receives transfer (adds stock to destination) |

### Special Transfer Roles
- **Username**: `MainStoreApprove`
- **Role**: Transfer Approver
- **Use**: Can approve transfers across locations

- **Username**: `mainverifier`
- **Role**: Main Store Transfer Verifier
- **Use**: Verifies transfers at Main Store

---

## Inventory Corrections Workflow Accounts

The inventory corrections workflow has 2 steps: **Create → Approve**

### Main Store Inventory Correction Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `mainstore_inv_creator` | `password` | Creates inventory correction requests (physical count adjustments) |
| Approver | `mainstore_inv_approver` | `password` | Approves/rejects corrections to adjust stock |

### Main Warehouse Inventory Correction Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `mainwarehouse_inv_creator` | `password` | Creates inventory correction requests |
| Approver | `mainwarehouse_inv_approver` | `password` | Approves/rejects corrections to adjust stock |

### Bambang Inventory Correction Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `bambang_inv_creator` | `password` | Creates inventory correction requests |
| Approver | `bambang_inv_approver` | `password` | Approves/rejects corrections to adjust stock |

### Tuguegarao Inventory Correction Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `tuguegarao_inv_creator` | `password` | Creates inventory correction requests |
| Approver | `tuguegarao_inv_approver` | `password` | Approves/rejects corrections to adjust stock |

---

## Sales Workflow Accounts

The sales workflow: **Create Sale → Process Payment → (Optional: Void/Refund)**

### Main Store Sales Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Cashier | `mainstore_cashier` | `password` | Creates sales transactions, processes payments |
| Sales Manager | `mainstore_sales_mgr` | `password` | Manages sales, voids, refunds, discounts |

**Alternative Main Store Manager**: `mainmgr` - Main Store Branch Manager

### ~~Main Warehouse Sales Users~~ ❌ REMOVED

**BUSINESS RULE**: Main Warehouse does NOT have sales users. The warehouse is for inventory management and purchasing only. Sales operations occur at retail locations (Main Store, Bambang, Tuguegarao).

### Bambang Sales Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Cashier | `bambang_cashier` | `password` | Creates sales transactions, processes payments |
| Sales Manager | `bambang_sales_mgr` | `password` | Manages sales, voids, refunds, discounts |

### Tuguegarao Sales Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Cashier | `tuguegarao_cashier` | `password` | Creates sales transactions, processes payments |
| Sales Manager | `tuguegarao_sales_mgr` | `password` | Manages sales, voids, refunds, discounts |

### Legacy Cashier Account
- **Username**: `cashiermain`
- **Password**: `password`
- **Role**: Regular Cashier Main
- **Location**: No specific assignment (may need location assignment)

---

## Purchase Workflow Accounts

The purchase workflow has 3 steps: **Create Purchase Order → Approve Purchase Order → Receive Goods (GRN)**

**BUSINESS RULE**: Only Main Warehouse is allowed to enter purchases. Branch locations (Main Store, Bambang, Tuguegarao) receive inventory through stock transfers from the warehouse, NOT direct purchases.

### ~~Main Store Purchase Users~~ ❌ REMOVED
**Not allowed** - Main Store receives stock via transfers from Main Warehouse

### Main Warehouse Purchase Users ✅ ONLY LOCATION FOR PURCHASES

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `warehouse_clerk` | `password` | Creates purchase orders from suppliers |
| Approver | `warehouse_manager` | `password` | Approves/rejects purchase orders AND receives goods (GRN) |

**Note**: In the current system, `warehouse_manager` handles both approval and GRN receiving. The purchase workflow is:
1. `warehouse_clerk` encodes the purchase order
2. `warehouse_manager` approves and receives the GRN

### ~~Bambang Purchase Users~~ ❌ REMOVED
**Not allowed** - Bambang receives stock via transfers from Main Warehouse

### ~~Tuguegarao Purchase Users~~ ❌ REMOVED
**Not allowed** - Tuguegarao receives stock via transfers from Main Warehouse

### Global Purchase Approvers
- **Username**: `jayvillalon`
- **Role**: Purchase Approver, GRN Approver (+ many other approver roles)
- **Use**: Can approve purchase orders and GRNs across all locations

---

## Supplier Returns Workflow Accounts ✅ IMPLEMENTED

The supplier returns workflow has 2 steps: **Create Return → Approve Return**

**BUSINESS RULE**: Supplier returns can ONLY be processed at Main Warehouse (where purchases are made). Branches cannot process supplier returns directly.

### Two Methods to Create Supplier Returns

#### **Method 1: Serial Number Lookup** (For items WITH serial numbers)
```
1. Go to Serial Number Lookup page
2. Search for the defective serial number
3. Click "Create Supplier Return" button
4. Form pre-filled with all data (supplier, product, cost)
5. Submit return request
```

#### **Method 2: Manual Creation** (For items WITHOUT serial numbers)
```
1. Go to Supplier Returns page
2. Click "Create Return (Manual)" button
3. Select: Supplier, Product, Variation
4. Enter: Quantity, Unit Cost (auto-filled from last purchase)
5. Select: Condition (defective/damaged/warranty)
6. Submit return request
```

**Use Cases for Manual Creation**:
- Bulk items (cables, adapters, accessories)
- Consumables (thermal paper, ink cartridges)
- Items without serial number tracking
- Multiple units of the same defective item

### Main Warehouse Supplier Return Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Creator | `warehouse_clerk` | `password` | Creates supplier return requests via Serial Lookup OR Manual form |
| Approver | `warehouse_manager` | `password` | Approves/rejects supplier return requests |

### Global Supplier Return Approvers
- **Username**: `jayvillalon`
- **Role**: Return Approver (+ many other approver roles)
- **Use**: Can create and approve supplier returns

**Permissions**:
- `purchase_return.view` - View supplier return records
- `purchase_return.create` - Create supplier return requests
- `purchase_return.update` - Update return requests before approval
- `purchase_return.approve` - Approve/reject return requests
- `purchase_return.delete` - Delete return requests

---

## Customer Returns Workflow Accounts ✅ IMPLEMENTED

The customer returns workflow allows retail locations to process returns from customers. Returns are approved by managers and stock is added back for resellable items.

**BUSINESS RULES**:
- Customer returns are processed at retail locations (Main Store, Bambang, Tuguegarao)
- **Resellable items**: Stock is ADDED back to location inventory
- **Damaged/Defective items**: Stock is NOT added (marked for supplier return)
- **7-Day Replacement Policy**: Defective items within 7 days get immediate replacement
- **After 7 Days**: Customer waits for supplier repair/replacement (no refund)

### Customer Return Permissions

**Required Permissions**:
- `customer_return.view` - View customer return records
- `customer_return.create` - Create customer return requests
- `customer_return.approve` - Approve/reject customer returns (adds stock back)

**Users Who Can Process Customer Returns**:
- Branch managers (have customer_return permissions)
- Sales clerks (can create, managers approve)
- Cashiers at retail locations

---

## Location Overview

### Active Locations
1. **Main Store** (ID: 1)
2. **Main Warehouse** (ID: 2)
3. **Bambang** (ID: 3)
4. **Tuguegarao** (ID: 4)
5. **Baguio** (ID: 6) - Has transfer users but no location assignments
6. **Santiago** (ID: 5) - Has transfer users but no location assignments

### Inactive/Future Locations
- Future Location 2 (ID: 100)
- FutureLocation1 (ID: 103)
- FutureLocation3 (ID: 102)
- FutureLocation4 (ID: 101)

---

## Complete Testing Guide

### Test 1: End-to-End Transfer Workflow
**Scenario**: Transfer 10 units of a product from Main Warehouse to Bambang

**Steps**:
1. Login as `warehouse_clerk` / `password`
2. Navigate to Transfers → Create Transfer
3. Fill in:
   - From Location: Main Warehouse
   - To Location: Bambang
   - Product: Select any product
   - Quantity: 10
4. Submit transfer request
5. Logout

6. Login as `warehouse_supervisor` / `password`
7. Navigate to Transfers
8. Find the pending transfer
9. Review and check/validate the transfer
10. Logout

11. Login as `warehouse_manager` / `password`
12. Navigate to Transfers
13. Find the checked transfer
14. Click "Send" to dispatch (stock deducted from Main Warehouse)
15. Logout

16. Login as `bambang_receiver` / `password`
17. Navigate to Transfers
18. Find the transfer "In Transit"
19. Click "Receive" to accept (stock added to Bambang)
20. Verify stock levels at both locations

**Verification**:
- Main Warehouse stock decreased by 10
- Bambang stock increased by 10
- Stock transaction history shows transfer-out and transfer-in

---

### Test 2: Inventory Correction Workflow
**Scenario**: Physical count at Main Store shows 5 units less than system

**Steps**:
1. Login as `mainstore_inv_creator` / `password`
2. Navigate to Inventory Corrections
3. Click "Create New Correction"
4. Select a product
5. Current Quantity: 50 (system shows)
6. New Quantity: 45 (physical count)
7. Reason: "5 units damaged and discarded"
8. Submit correction
9. Logout

10. Login as `mainstore_inv_approver` / `password`
11. Navigate to Inventory Corrections
12. Find pending correction
13. Review details
14. Approve correction
15. Verify stock adjusted to 45 units
16. Check stock transaction history

**Verification**:
- Stock reduced from 50 to 45
- Stock transaction created with type "Inventory Correction"
- Audit log shows creator and approver

---

### Test 3: Sales Workflow
**Scenario**: Process a sale at Bambang branch

**Steps**:
1. Login as `bambang_cashier` / `password`
2. Navigate to POS or Sales → Create Sale
3. Add products to cart
4. Apply any discounts (if authorized)
5. Process payment (Cash/Card/etc.)
6. Print receipt
7. Verify stock deducted

**Verification**:
- Sale created with correct total
- Stock reduced for sold items
- Payment recorded
- Stock transaction shows "Sale"

**Void/Refund Test**:
1. Login as `bambang_sales_mgr` / `password`
2. Navigate to Sales
3. Find the sale
4. Initiate void or refund
5. Verify stock restored
6. Verify payment reversed

---

### Test 4: Multi-Location Access Control
**Scenario**: Verify users can only access their assigned locations

**Steps**:
1. Login as `mainstore_inv_creator` / `password`
2. Navigate to Inventory Corrections
3. Try to create correction for Bambang (should fail or not show)
4. Verify only Main Store products/stock visible
5. Logout

6. Login as `bambang_inv_creator` / `password`
7. Navigate to Inventory Corrections
8. Verify only Bambang products/stock visible
9. Cannot see Main Store data

10. Login as `superadmin` / `password`
11. Navigate to any module
12. Verify can see ALL locations

**Verification**:
- Multi-tenant isolation working
- Users restricted to assigned locations
- Super Admin has global access

---

### Test 5: Cross-Workflow Integration
**Scenario**: Test how workflows interact

**Steps**:
1. Create a transfer from Main Warehouse to Main Store
2. Before receiving, create an inventory correction at Main Store
3. Receive the transfer
4. Process a sale at Main Store
5. Create another inventory correction
6. Transfer remaining stock to Bambang
7. Login as `superadmin` and review:
   - Stock Transaction History
   - Inventory Ledger Report
   - Stock levels at all locations

**Verification**:
- All transactions recorded correctly
- Stock levels accurate across all locations
- Reports show complete audit trail
- No stock discrepancies

---

### Test 6: Approval Hierarchies
**Scenario**: Test multi-level approvals

**Steps**:
1. Create inventory correction as `mainstore_inv_creator`
2. Approve as `mainstore_inv_approver`
3. Create transfer as `warehouse_clerk`
4. Check as `warehouse_supervisor`
5. Approve as `MainStoreApprove` (transfer approver)
6. Send as `warehouse_manager`
7. Login as `jayvillalon` (has all approver roles)
8. Verify can approve everything

**Verification**:
- Approval workflow enforced
- Cannot skip approval steps
- Audit trail shows all approvers
- `jayvillalon` has cross-functional approval rights

---

### Test 7: Complete Purchase Workflow
**Scenario**: Purchase 50 units of a product from a supplier at Main Warehouse

**Steps**:
1. Login as `warehouse_clerk` / `password`
2. Navigate to Purchases → Create Purchase Order
3. Fill in:
   - Supplier: Select a supplier
   - Location: Main Warehouse
   - Product: Select a product
   - Quantity: 50
   - Unit Cost: 100.00
   - Total: 5,000.00
4. Submit purchase order
5. Logout

6. Login as `warehouse_manager` / `password`
7. Navigate to Purchases → Purchase Orders
8. Find the pending purchase order
9. Review details (supplier, items, quantities, cost)
10. Approve purchase order
11. Receive GRN (Goods Receipt Note):
    - Verify quantities received
    - Note any discrepancies (short delivery, damaged items)
    - Received Quantity: 50 (or actual received)
12. Submit GRN
13. Verify stock added to Main Warehouse inventory

**Verification**:
- Purchase order created with status "Pending"
- After approval, status changed to "Approved"
- After GRN, status changed to "Received"
- Stock increased by 50 units at Main Warehouse
- Stock transaction shows "Purchase Receipt"
- Audit trail shows creator and approver/receiver

**Alternative Test - Global Approver**:
1. Create PO as `warehouse_clerk`
2. Approve and receive as `jayvillalon` (global purchase approver)
3. Verify cross-user approval works

---

### Test 8: Supplier Returns Workflow ✅ IMPLEMENTED
**Scenario**: Return 5 defective units to a supplier from Main Warehouse

**Steps**:
1. Login as `warehouse_clerk` / `password`
2. Navigate to Purchases → Supplier Returns
3. Click "Create Supplier Return"
4. Fill in:
   - Supplier: Select the supplier
   - Location: Main Warehouse
   - Reference Purchase: Select the original purchase order
   - Product: Select product(s) to return
   - Quantity: 5
   - Reason: "Defective units - hardware malfunction"
   - Return Type: Credit Note / Replacement / Refund
5. Submit supplier return request
6. Logout

7. Login as `warehouse_manager` / `password`
8. Navigate to Purchases → Supplier Returns
9. Find the pending return request
10. Review details (items, quantities, reason)
11. Approve the return
12. Verify stock deducted from Main Warehouse inventory
13. Check that accounts payable/credit note is recorded

**Verification**:
- Supplier return created with status "Pending"
- After approval, status changed to "Approved"
- Stock decreased by 5 units at Main Warehouse
- Stock transaction shows "Supplier Return"
- Audit trail shows creator (warehouse_clerk) and approver (warehouse_manager)
- Credit note or refund recorded in accounts payable

**Alternative Test - Global Approver**:
1. Create supplier return as `warehouse_clerk`
2. Approve as `jayvillalon` (global return approver)
3. Verify cross-user approval works

**Important Notes**:
- Supplier returns can ONLY be created at Main Warehouse
- Users at branch locations (Main Store, Bambang, Tuguegarao) CANNOT create supplier returns
- Returns must reference an existing purchase order
- Approved returns automatically adjust inventory and accounts payable

---

### ~~Test 9: Customer Returns Workflow~~ ❌ NOT AVAILABLE
**STATUS**: Customer returns workflow not yet implemented. Feature planned for future release.

---

### Test 10: Integrated End-to-End Multi-Workflow Test
**Scenario**: Complete business cycle from purchase to sale with transfers

**Steps**:
1. **Purchase at Main Warehouse**:
   - `warehouse_clerk` creates PO for 100 units
   - `warehouse_manager` approves and receives goods (Warehouse: +100)

2. **Transfer to Branches**:
   - `warehouse_clerk` creates transfer of 30 units to Main Store
   - `warehouse_supervisor` checks transfer
   - `warehouse_manager` sends transfer (Warehouse: -30)
   - `mainstore_receiver` receives transfer (Main Store: +30)
   - Repeat for Bambang (30 units)

3. **Sales at Retail Locations**:
   - `mainstore_cashier` sells 20 units (Main Store: -20)
   - `bambang_cashier` sells 10 units (Bambang: -10)

4. **Inventory Corrections**:
   - `mainstore_inv_creator` finds 3 damaged units
   - `mainstore_inv_approver` approves correction (Main Store: -3)

5. **Final Verification** as `superadmin`:
   - Main Warehouse: 100 - 30 - 30 = **40 units**
   - Main Store: 30 - 20 - 3 = **7 units**
   - Bambang: 30 - 10 = **20 units**
   - Total System: **67 units**
   - Review complete stock transaction history
   - Verify all transactions recorded correctly
   - Check all audit trails
   - Review all reports (Inventory Ledger, Stock Movement, etc.)

**Verification**:
- All stock levels match calculations
- Every transaction has audit trail
- Stock transaction history is complete
- Reports show accurate data
- Multi-tenant isolation maintained
- All approvals recorded
- No orphaned transactions

---

## Quick Reference Table - All Users by Location

### Main Store
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `mainstore_clerk` | `mainstore_supervisor` (Check) → `store_manager` (Send) → `mainstore_receiver` (Receive) |
| Inventory Corrections | `mainstore_inv_creator` | `mainstore_inv_approver` |
| Sales | `mainstore_cashier` | `mainstore_sales_mgr` |
| Purchases | ❌ NOT ALLOWED | Main Store receives stock via transfers |

### Main Warehouse
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `warehouse_clerk` | `warehouse_supervisor` (Check) → `warehouse_manager` (Send) → `warehouse_receiver` (Receive) |
| Inventory Corrections | `mainwarehouse_inv_creator` | `mainwarehouse_inv_approver` |
| Sales | ❌ NOT ALLOWED | Warehouse is for inventory/purchasing only |
| Purchases | `warehouse_clerk` | `warehouse_manager` (Approve & Receive GRN) |
| Supplier Returns | `warehouse_clerk` | `warehouse_manager` (Approve) |

### Bambang
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `bambang_clerk` | `bambang_supervisor` (Check) → `bambang_manager` (Send) → `bambang_receiver` (Receive) |
| Inventory Corrections | `bambang_inv_creator` | `bambang_inv_approver` |
| Sales | `bambang_cashier` | `bambang_sales_mgr` |
| Purchases | ❌ NOT ALLOWED | Bambang receives stock via transfers |

### Tuguegarao
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `tugue_clerk` | `tugue_supervisor` (Check) → `tugue_manager` (Send) → `tugue_receiver` (Receive) |
| Inventory Corrections | `tuguegarao_inv_creator` | `tuguegarao_inv_approver` |
| Sales | `tuguegarao_cashier` | `tuguegarao_sales_mgr` |
| Purchases | ❌ NOT ALLOWED | Tuguegarao receives stock via transfers |

### Global Approvers (All Locations)
| User | Roles | Can Approve |
|------|-------|-------------|
| `jayvillalon` | Purchase Approver, Transfer Approver, Return Approver, Inventory Correction Approver, GRN Approver, Main Store Transfer Verifier, All Branch Admin | All workflows across all locations (Purchases, Transfers, Supplier Returns, Inventory Corrections) |
| `Gemski` | All Branch Admin | Branch operations across all locations |
| `superadmin` | Super Admin | Everything system-wide |

**All passwords**: `password`

---

## Important Security Notes

1. **Multi-Tenant Isolation**: All users are restricted to their assigned business locations
2. **Role-Based Access Control (RBAC)**: Each role has specific permissions
3. **Approval Workflows**: Critical operations require approval (transfers, inventory corrections, purchases)
4. **Audit Trail**: All actions logged with user, timestamp, and reason
5. **Super Admin Override**: `superadmin` can access everything across all locations
6. **Password Policy**: Demo accounts use simple password for testing; production should enforce strong passwords

---

## Troubleshooting

### Cannot Create Transaction
- Verify user has the appropriate permission
- Check location assignment
- Ensure stock exists at the location
- Verify product is active

### Cannot Approve Request
- Verify user has approval permission
- Check that request is in correct status (Pending)
- Ensure user is assigned to the same location
- Cannot approve own requests

### Cannot See Data
- Verify location assignment in database
- Check role permissions
- Ensure filtering by correct location
- May need to refresh session after role/location changes

### Stock Discrepancy
- Check Stock Transaction History
- Review Inventory Ledger Report
- Verify all transfers were received
- Check for unapproved inventory corrections

---

## Developer Notes

### Adding New Users
Run script: `C:\xampp\htdocs\ultimatepos-modern\scripts\create-comprehensive-demo-accounts.mjs`

### Checking User Setup
Run script: `C:\xampp\htdocs\ultimatepos-modern\scripts\check-existing-setup.mjs`

### Database Schema
- Users table: `C:\xampp\htdocs\ultimatepos-modern\prisma\schema.prisma`
- User-Location junction: `UserLocation` table
- User-Role junction: `UserRole` table
- Role-Permission junction: `RolePermission` table

### Permission Definitions
Location: `C:\xampp\htdocs\ultimatepos-modern\src\lib\rbac.ts`

---

## Support

For issues with demo accounts or workflows:
1. Check this documentation first
2. Verify database schema is up to date: `npm run db:push`
3. Run `npm run db:seed` to reset demo data (WARNING: This will reset all data)
4. Check server logs for errors
5. Verify environment variables in `.env` file

**Last Updated**: January 21, 2025

---

## Changelog

### January 21, 2025 - URGENT PERMISSION FIX
- ✅ **FIXED Supplier Returns Permissions**
  - Added `purchase_return.*` permissions to jayvillalon, warehouse_clerk, warehouse_manager
  - Users can now create and approve supplier returns at Main Warehouse
  - Permissions assigned via `fix-supplier-return-permissions.mjs` script

- ✅ **IMPLEMENTED Supplier Returns Workflow**
  - Status changed from "NOT IMPLEMENTED" to "IMPLEMENTED"
  - Added supplier return users documentation
  - Added Test 8: Supplier Returns Workflow
  - Updated Main Warehouse workflow table
  - Business rule: Supplier returns ONLY at Main Warehouse

- 📊 **Permission Assignments**:
  - `jayvillalon`: 5 supplier return permissions (full access)
  - `warehouse_clerk`: 2 permissions (view, create)
  - `warehouse_manager`: 5 permissions (full access including approve)

### January 21, 2025 - MAJOR CORRECTION
- ❌ **REMOVED Sales Users from Main Warehouse**
  - Deleted `mainwarehouse_cashier` and `mainwarehouse_sales_mgr`
  - Business rule: Main Warehouse is for inventory/purchasing only, NO sales

- ❌ **REMOVED Purchase Users from Branch Locations**
  - Removed all purchase users from Main Store, Bambang, Tuguegarao documentation
  - Business rule: Only Main Warehouse can enter purchases
  - Branches receive stock via transfers from warehouse

- ❌ **REMOVED Supplier Returns Workflow** - Not Yet Implemented
  - Users not created in database
  - Feature planned for future release

- ❌ **REMOVED Customer Returns Workflow** - Not Yet Implemented
  - Users not created in database
  - Feature planned for future release

- 🗑️ **REMOVED Undocumented Users from Database**
  - Deleted Baguio location users (baguio_clerk, baguio_supervisor, baguio_manager, baguio_receiver)
  - Deleted Santiago location users (santiago_clerk, santiago_supervisor, santiago_manager, santiago_receiver)
  - Deleted unused managers (makati_mgr, pasig_mgr, cebu_mgr)
  - Total users removed: 13

- ✅ **CORRECTED Purchase Workflow**
  - Main Warehouse ONLY: `warehouse_clerk` (encoder) → `warehouse_manager` (approve & receive GRN)

- ✅ **ADDED Quick Answers Section**
  - Clear summary of most common workflow users
  - Important business rules highlighted

- 📊 **Database Status After Cleanup**
  - Total users in database: 39
  - All documented users exist in database
  - No undocumented users remaining

---

## 🔄 COMPLETE SUPPLIER RETURN WORKFLOWS

This section documents the complete end-to-end workflows for handling defective items and supplier returns, including all audit trail requirements.

###  Scenario 1: Defective Item Found at Branch (Before Sale)

**When**: Branch discovers defective item during pre-sale testing
**Locations**: Any retail location → Main Warehouse → Supplier

**Complete Workflow**:

```
STEP 1: BRANCH CREATES TRANSFER TO WAREHOUSE
├─ User: branch_clerk (e.g., mainstore_clerk, bambang_clerk)
├─ Location: Source branch (Main Store, Bambang, Tuguegarao)
├─ Action: Create transfer request to Main Warehouse
├─ Notes: "Defective item - for supplier return"
└─ Status: Pending → Checked → In Transit

STEP 2: TRANSFER APPROVED & SENT
├─ Checker: branch_checker
├─ Sender: branch_sender
├─ **STOCK DEDUCTED** from source branch
├─ Serial status: in_stock → in_transit
└─ **AUDIT TRAIL CREATED**:
    ├─ StockTransaction: type=transfer_out, qty=-1
    ├─ ProductHistory: quantityChange=-1
    └─ SerialNumberMovement: movementType=transfer_out

STEP 3: WAREHOUSE RECEIVES TRANSFER
├─ User: warehouse_receiver
├─ **STOCK ADDED** to Main Warehouse
├─ Serial status: in_transit → in_stock
└─ **AUDIT TRAIL CREATED**:
    ├─ StockTransaction: type=transfer_in, qty=+1
    ├─ ProductHistory: quantityChange=+1
    └─ SerialNumberMovement: movementType=transfer_in

STEP 4: WAREHOUSE CREATES SUPPLIER RETURN
├─ User: warehouse_clerk
├─ Location: Main Warehouse
├─ Action: Create supplier return request
├─ Condition: defective / damaged / warranty_claim
└─ Status: Pending

STEP 5: WAREHOUSE APPROVES RETURN
├─ User: warehouse_manager (or jayvillalon)
├─ **STOCK DEDUCTED** from Main Warehouse
├─ Serial status: in_stock → supplier_return
├─ Serial location: warehouse → null (out of circulation)
└─ **AUDIT TRAIL CREATED**:
    ├─ StockTransaction: type=supplier_return, qty=-1
    ├─ ProductHistory: quantityChange=-1
    ├─ SerialNumberMovement: movementType=supplier_return
    └─ AuditLog: action=supplier_return_approve
```

**Net Result**:
- Branch stock: -1 (transfer out)
- Warehouse stock: +1 (transfer in), then -1 (supplier return)
- Total system stock: -1 ✅ (correct - one defective item removed from system)

**✅ WORKFLOW IS CORRECT**: The transfer properly tracks the physical movement of the item from branch to warehouse, then the supplier return removes it from the system entirely.

---

### Scenario 2: Customer Returns Defective Item (7-Day Replacement Policy)

**When**: Customer bought item, returns within 7 days as defective
**Policy**: Immediate replacement - customer gets new item right away

**Complete Workflow**:

```
STEP 1: CUSTOMER RETURN (IMMEDIATE REPLACEMENT)
├─ User: branch_cashier (e.g., mainstore_cashier)
├─ Location: Point of sale (Main Store, Bambang, Tuguegarao)
├─ Action 1: Accept customer return
│   ├─ **STOCK ADDED** back to branch (+1)
│   ├─ Condition: defective
│   ├─ Serial status: sold → customer_return
│   └─ **AUDIT TRAIL**:
│       ├─ CustomerReturn record created
│       ├─ StockTransaction: type=customer_return, qty=+1
│       └─ ProductHistory: quantityChange=+1
├─ Action 2: Give replacement to customer
│   ├─ **STOCK DEDUCTED** from branch (-1)
│   ├─ Serial status: in_stock → sold
│   └─ **AUDIT TRAIL**: Regular sale transaction
└─ Net Effect: Stock same, but defective item now in stock

STEP 2: BRANCH CREATES TRANSFER TO WAREHOUSE
├─ User: branch_clerk
├─ Purpose: Send defective item for supplier return
├─ Notes: "Customer return - warranty claim"
└─ Follow Scenario 1 steps 2-5

STEP 3: CUSTOMER RECEIVES REPLACEMENT IMMEDIATELY
└─ Customer leaves with working product
```

**Net Stock Movement**:
- Customer return: +1 (defective item back)
- Replacement sale: -1 (new item given)
- Transfer out: -1 (defective sent to warehouse)
- Warehouse receive: +1 (warehouse gets defective)
- Supplier return: -1 (warehouse returns to supplier)
- **Total**: -1 (correct - one defective item out of system)

---

### Scenario 3: Customer Returns After 7 Days

**When**: Customer returns defective item after 7-day window
**Policy**: No immediate replacement - customer waits for supplier repair/replacement

**Workflow**:
1. Customer return processed (stock +1, condition: defective)
2. Transfer to warehouse (following Scenario 1)
3. Warehouse returns to supplier
4. **IF supplier repairs**: Receive back → transfer to branch → give to customer
5. **IF supplier replaces**: Receive new item → transfer to branch → give to customer
6. **IF supplier rejects**: Item written off, customer informed

---

## 🔒 AUDIT TRAIL & FRAUD PREVENTION

### Every Stock Movement Creates:

**1. Stock Transaction Record**
```typescript
{
  businessId: number
  productVariationId: number
  locationId: number
  type: 'transfer_in' | 'transfer_out' | 'customer_return' | 'supplier_return'
  quantity: number (+ for IN, - for OUT)
  balanceQty: number (running balance)
  referenceType: 'transfer' | 'customer_return' | 'supplier_return'
  referenceId: number (links to source document)
  createdBy: userId
  notes: string
  createdAt: timestamp
}
```

**2. Product History Record**
```typescript
{
  businessId: number
  productVariationId: number
  locationId: number
  transactionType: string
  quantityChange: number
  balanceQuantity: number (snapshot)
  referenceType: string
  referenceId: number
  createdBy: userId
  createdByName: string
  reason: string
  transactionDate: timestamp
}
```

**3. Serial Number Movement**
```typescript
{
  serialNumberId: number
  movementType: 'transfer_out' | 'transfer_in' | 'customer_return' | 'supplier_return'
  fromLocationId: number | null
  toLocationId: number | null
  referenceType: string
  referenceId: number
  movedBy: userId
  notes: string
  createdAt: timestamp
}
```

**4. Audit Log**
```typescript
{
  businessId: number
  userId: number
  username: string
  action: 'transfer_send' | 'transfer_receive' | 'customer_return_approve' | 'supplier_return_approve'
  entityType: 'TRANSFER' | 'SALE' | 'PURCHASE'
  entityIds: number[]
  description: string
  metadata: JSON (contains full details)
  ipAddress: string
  userAgent: string
  timestamp: timestamp
}
```

### Fraud Prevention Features:

✅ **Stock Consistency Validation**
- After every operation, system verifies: `physicalStock === ledgerBalance`
- Throws error if mismatch detected

✅ **Ledger Verification**
- Transfer receive checks that transfer_out entry exists before adding stock
- Prevents ghost inventory additions

✅ **Separation of Duties**
- Creator cannot approve own transfer
- Checker cannot send own transfer
- Sender cannot receive own transfer

✅ **Immutable Records**
- Once approved, records cannot be edited
- All changes create new history entries

✅ **Multi-Tenant Isolation**
- All queries filtered by businessId
- Prevents cross-business data access

---

## 📊 QUICK REFERENCE: WHO DOES WHAT

| Scenario | Location | Create | Approve/Process | Stock Effect |
|----------|----------|--------|----------------|--------------|
| **Defective before sale** | Branch | branch_clerk | branch_checker → branch_sender | -1 at branch |
| | Warehouse | warehouse_receiver | - | +1 at warehouse |
| | Warehouse | warehouse_clerk | warehouse_manager | -1 at warehouse |
| **Customer return (7-day)** | Branch | branch_cashier | branch_manager | +1 then -1 (replacement) |
| | Branch | branch_clerk (transfer) | branch_checker → branch_sender | -1 at branch |
| | Warehouse | warehouse_receiver | - | +1 at warehouse |
| | Warehouse | warehouse_clerk | warehouse_manager | -1 at warehouse |
| **Customer return (after 7)** | Branch | branch_cashier | branch_manager | +1 at branch |
| | (Same as above) | - | - | - |

---

### October 21, 2025
- ✅ **CORRECTED Customer Returns Status** - Feature IS implemented
- ✅ **ADDED Complete Supplier Return Workflows**
  - Scenario 1: Defective before sale
  - Scenario 2: Customer 7-day replacement policy
  - Scenario 3: Customer return after 7 days
- ✅ **ADDED Comprehensive Audit Trail Documentation**
  - StockTransaction records
  - ProductHistory records
  - SerialNumberMovement records
  - AuditLog records
  - Fraud prevention features
- ✅ **ADDED Quick Reference Table**
- 🔧 **FIXED Supplier Return Detail Page** - Added currency formatting
- ✅ **VERIFIED Defective Transfer Workflow** - Confirmed stock movements are correct
- 🆕 **ADDED Manual Supplier Return Creation**
  - New page: `/dashboard/supplier-returns/create-manual`
  - For items without serial numbers (bulk, accessories, consumables)
  - Auto-fills unit cost from last purchase
  - Supports multi-unit returns
  - New API: GET `/api/products/[id]/last-purchase-cost`

### October 20, 2024
- Initial comprehensive documentation
- Transfer, inventory corrections, and sales workflows
- Multi-location user accounts
