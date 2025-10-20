# Complete Demo Accounts - All Workflows

This comprehensive guide covers ALL demo accounts for testing every workflow in the UltimatePOS Modern system across all business locations.

**Business**: PciNet Computer Trading and Services
**All Passwords**: `password`

---

## Table of Contents

1. [System Administrator Accounts](#system-administrator-accounts)
2. [Transfer Workflow Accounts](#transfer-workflow-accounts)
3. [Inventory Corrections Workflow Accounts](#inventory-corrections-workflow-accounts)
4. [Sales Workflow Accounts](#sales-workflow-accounts)
5. [Purchase Workflow Accounts](#purchase-workflow-accounts)
6. [Location Overview](#location-overview)
7. [Complete Testing Guide](#complete-testing-guide)

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

### Main Warehouse Sales Users

| Role | Username | Password | What They Do |
|------|----------|----------|--------------|
| Cashier | `mainwarehouse_cashier` | `password` | Creates sales transactions, processes payments |
| Sales Manager | `mainwarehouse_sales_mgr` | `password` | Manages sales, voids, refunds, discounts |

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

### Purchase Approvers
- **Username**: `jayvillalon`
- **Role**: Purchase Approver (+ many other approver roles)
- **Use**: Approves purchase orders and GRNs (Goods Receipt Notes)

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

## Quick Reference Table - All Users by Location

### Main Store
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `mainstore_clerk` | `mainstore_supervisor` (Check) → `store_manager` (Send) → `mainstore_receiver` (Receive) |
| Inventory Corrections | `mainstore_inv_creator` | `mainstore_inv_approver` |
| Sales | `mainstore_cashier` | `mainstore_sales_mgr` |

### Main Warehouse
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `warehouse_clerk` | `warehouse_supervisor` (Check) → `warehouse_manager` (Send) → `warehouse_receiver` (Receive) |
| Inventory Corrections | `mainwarehouse_inv_creator` | `mainwarehouse_inv_approver` |
| Sales | `mainwarehouse_cashier` | `mainwarehouse_sales_mgr` |

### Bambang
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `bambang_clerk` | `bambang_supervisor` (Check) → `bambang_manager` (Send) → `bambang_receiver` (Receive) |
| Inventory Corrections | `bambang_inv_creator` | `bambang_inv_approver` |
| Sales | `bambang_cashier` | `bambang_sales_mgr` |

### Tuguegarao
| Workflow | Creator/User | Approver/Manager |
|----------|--------------|------------------|
| Transfers | `tugue_clerk` | `tugue_supervisor` (Check) → `tugue_manager` (Send) → `tugue_receiver` (Receive) |
| Inventory Corrections | `tuguegarao_inv_creator` | `tuguegarao_inv_approver` |
| Sales | `tuguegarao_cashier` | `tuguegarao_sales_mgr` |

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

**Last Updated**: October 20, 2025
