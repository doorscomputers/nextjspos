# Inventory Corrections Demo Accounts

This document lists all demo accounts specifically for testing the **Inventory Corrections** workflow across all business locations.

## Overview

The Inventory Corrections workflow has TWO key roles:

1. **Creator** - Creates inventory correction requests when physical count differs from system count
2. **Approver** - Reviews and approves/rejects inventory corrections to adjust stock levels

All accounts use password: `password`

---

## Main Store

### Creator Account
- **Username**: `mainstore_inv_creator`
- **Password**: `password`
- **Location**: Main Store
- **Role**: Inventory Correction Creator
- **Permissions**:
  - Create inventory correction requests
  - View inventory corrections
  - View products and stock levels
  - Access dashboard

**What they can do**:
1. Navigate to Inventory Corrections page
2. Create new correction request when physical count differs from system
3. Specify product, location, current quantity, and new quantity
4. Add notes explaining the discrepancy
5. Submit for approval
6. View status of submitted corrections

### Approver Account
- **Username**: `mainstore_inv_approver`
- **Password**: `password`
- **Location**: Main Store
- **Role**: Inventory Correction Approver
- **Permissions**:
  - View inventory corrections
  - Approve/reject corrections
  - View products and stock levels
  - Access dashboard

**What they can do**:
1. Navigate to Inventory Corrections page
2. Review pending correction requests
3. Verify the correction details and reason
4. Approve corrections (stock gets adjusted)
5. Reject corrections with reason (stock remains unchanged)
6. View history of all corrections

---

## Main Warehouse

### Creator Account
- **Username**: `mainwarehouse_inv_creator`
- **Password**: `password`
- **Location**: Main Warehouse
- **Role**: Inventory Correction Creator
- **Permissions**: Same as Main Store Creator

**What they can do**: Same as Main Store Creator, but for Main Warehouse

### Approver Account
- **Username**: `mainwarehouse_inv_approver`
- **Password**: `password`
- **Location**: Main Warehouse
- **Role**: Inventory Correction Approver
- **Permissions**: Same as Main Store Approver

**What they can do**: Same as Main Store Approver, but for Main Warehouse

---

## Bambang

### Creator Account
- **Username**: `bambang_inv_creator`
- **Password**: `password`
- **Location**: Bambang
- **Role**: Inventory Correction Creator
- **Permissions**: Same as Main Store Creator

**What they can do**: Same as Main Store Creator, but for Bambang

### Approver Account
- **Username**: `bambang_inv_approver`
- **Password**: `password`
- **Location**: Bambang
- **Role**: Inventory Correction Approver
- **Permissions**: Same as Main Store Approver

**What they can do**: Same as Main Store Approver, but for Bambang

---

## Tuguegarao

### Creator Account
- **Username**: `tuguegarao_inv_creator`
- **Password**: `password`
- **Location**: Tuguegarao
- **Role**: Inventory Correction Creator
- **Permissions**: Same as Main Store Creator

**What they can do**: Same as Main Store Creator, but for Tuguegarao

### Approver Account
- **Username**: `tuguegarao_inv_approver`
- **Password**: `password`
- **Location**: Tuguegarao
- **Role**: Inventory Correction Approver
- **Permissions**: Same as Main Store Approver

**What they can do**: Same as Main Store Approver, but for Tuguegarao

---

## Testing Scenarios

### Scenario 1: Stock Count Discrepancy (Overage)
**Purpose**: Physical count shows MORE stock than system

1. Login as `mainstore_inv_creator` / `password`
2. Navigate to Inventory Corrections
3. Click "Create New Correction"
4. Select a product
5. Set Current Quantity: 50
6. Set New Quantity: 60
7. Reason: "Found 10 units during physical count"
8. Submit
9. Logout
10. Login as `mainstore_inv_approver` / `password`
11. Navigate to Inventory Corrections
12. Review the pending correction
13. Approve it
14. Verify stock increased by 10 units

### Scenario 2: Stock Count Discrepancy (Shortage)
**Purpose**: Physical count shows LESS stock than system

1. Login as `bambang_inv_creator` / `password`
2. Navigate to Inventory Corrections
3. Click "Create New Correction"
4. Select a product
5. Set Current Quantity: 100
6. Set New Quantity: 95
7. Reason: "5 units missing during physical count"
8. Submit
9. Logout
10. Login as `bambang_inv_approver` / `password`
11. Navigate to Inventory Corrections
12. Review the pending correction
13. Approve it
14. Verify stock decreased by 5 units

### Scenario 3: Rejected Correction
**Purpose**: Approver rejects a correction request

1. Login as `tuguegarao_inv_creator` / `password`
2. Create inventory correction with significant discrepancy
3. Submit
4. Logout
5. Login as `tuguegarao_inv_approver` / `password`
6. Navigate to pending corrections
7. Review the correction
8. Reject with reason: "Please recount and resubmit"
9. Verify stock remains unchanged
10. Logout
11. Login back as creator
12. See the rejected correction with approver's comment

### Scenario 4: Multi-Location Testing
**Purpose**: Test corrections across different locations

1. Create corrections at all 4 locations using their respective creators
2. Ensure each creator can only see their location's data
3. Approve corrections at each location using respective approvers
4. Verify location-based access control is working
5. Login as `superadmin` to view all corrections across all locations

---

## Important Notes

1. **Multi-Tenant Isolation**: Each user can only see and manage corrections for their assigned location
2. **Approval Workflow**: Corrections must be approved before stock is adjusted
3. **Audit Trail**: All corrections are logged with creator, approver, timestamp, and reason
4. **Stock History**: Approved corrections create stock transaction records
5. **Permissions**: Creators cannot approve their own corrections
6. **Super Admin**: Can view and manage all corrections across all locations

---

## Troubleshooting

**Problem**: Cannot create correction
- Verify user has `inventory_correction.create` permission
- Check that user is assigned to the location
- Ensure product exists and has stock at that location

**Problem**: Cannot approve correction
- Verify user has `inventory_correction.approve` permission
- Check that correction is in "Pending" status
- Ensure user is assigned to the same location as the correction

**Problem**: Cannot see corrections
- Verify user has `inventory_correction.view` permission
- Check location assignment
- Ensure filtering by correct location

---

## Quick Reference Table

| Location | Creator Username | Approver Username |
|----------|------------------|-------------------|
| Main Store | `mainstore_inv_creator` | `mainstore_inv_approver` |
| Main Warehouse | `mainwarehouse_inv_creator` | `mainwarehouse_inv_approver` |
| Bambang | `bambang_inv_creator` | `bambang_inv_approver` |
| Tuguegarao | `tuguegarao_inv_creator` | `tuguegarao_inv_approver` |

**All passwords**: `password`
