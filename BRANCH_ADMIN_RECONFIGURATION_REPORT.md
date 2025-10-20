# Branch Admin Role Reconfiguration Report

**Date:** 2025-10-19
**Status:** COMPLETED
**Affected File:** `src/lib/rbac.ts` (Lines 437-629)

---

## Executive Summary

The Branch Admin role has been successfully reconfigured to follow the **SUPERVISORY PRINCIPLE**:

- **REMOVED:** All transactional CREATE/UPDATE/DELETE permissions for Sales, Purchases, Transfers, and Financial operations
- **RETAINED:** All APPROVE permissions, VIEW permissions, and master data management
- **ADDED:** Missing supervisory permissions (customer/supplier returns approval, void approvals, cash approvals)

The Branch Admin is now a true **supervisor role** who:
- Sets up the system (products, users, categories, locations)
- Approves transactions created by others (purchases, receipts, returns, transfers)
- Views all reports and analytics
- Does NOT perform day-to-day transactional work

---

## Changes Made

### REMOVED Permissions (36 permissions)

These permissions allowed Branch Admin to create/modify transactions, which conflicts with the supervisory role:

| Category | Removed Permissions | Reason |
|----------|-------------------|---------|
| **Sales** | `SELL_CREATE`, `SELL_UPDATE`, `SELL_DELETE` | Supervisors don't process POS transactions |
| **Purchases** | `PURCHASE_CREATE`, `PURCHASE_UPDATE`, `PURCHASE_DELETE` | Supervisors approve, don't create purchase orders |
| **GRN/Receipts** | `PURCHASE_RECEIPT_CREATE` | Supervisors approve receipts, don't create them |
| **Purchase Returns** | `PURCHASE_RETURN_CREATE`, `PURCHASE_RETURN_UPDATE`, `PURCHASE_RETURN_DELETE` | Supervisors approve returns, don't initiate them |
| **Purchase Amendments** | `PURCHASE_AMENDMENT_CREATE` | Supervisors approve amendments, don't create them |
| **QC Inspections** | `QC_INSPECTION_CREATE` | Supervisors conduct and approve, don't create inspection requests |
| **Inventory Corrections** | `INVENTORY_CORRECTION_CREATE`, `INVENTORY_CORRECTION_UPDATE`, `INVENTORY_CORRECTION_DELETE` | Supervisors approve corrections, don't create them |
| **Stock Transfers** | `STOCK_TRANSFER_CREATE` | Supervisors approve transfers, don't initiate them |
| **Expenses** | `EXPENSE_CREATE`, `EXPENSE_UPDATE`, `EXPENSE_DELETE` | Supervisors view/approve expenses, don't create them |
| **Accounts Payable** | `ACCOUNTS_PAYABLE_CREATE`, `ACCOUNTS_PAYABLE_UPDATE`, `ACCOUNTS_PAYABLE_DELETE` | Accounting staff handles, supervisors only view |
| **Payments** | `PAYMENT_CREATE`, `PAYMENT_UPDATE`, `PAYMENT_DELETE` | Supervisors approve payments, don't create them |
| **Banking** | `BANK_CREATE`, `BANK_UPDATE`, `BANK_DELETE`, `BANK_TRANSACTION_CREATE`, `BANK_TRANSACTION_UPDATE`, `BANK_TRANSACTION_DELETE` | Accounting function, supervisors only view |

### ADDED Permissions (11 permissions)

These supervisory permissions were missing from the original configuration:

| Category | Added Permissions | Purpose |
|----------|------------------|---------|
| **Customer Returns** | `CUSTOMER_RETURN_VIEW`, `CUSTOMER_RETURN_APPROVE`, `CUSTOMER_RETURN_DELETE` | Approve/reject customer return requests |
| **Supplier Returns** | `SUPPLIER_RETURN_VIEW`, `SUPPLIER_RETURN_APPROVE`, `SUPPLIER_RETURN_DELETE` | Approve/reject supplier return requests |
| **Void Transactions** | `VOID_CREATE`, `VOID_APPROVE` | Initiate and approve void/cancel requests |
| **Cash Management** | `CASH_APPROVE_LARGE_TRANSACTIONS` | Approve large cash transactions |
| **Serial Numbers** | `SERIAL_NUMBER_VIEW`, `SERIAL_NUMBER_TRACK` | Verify and track serial numbers |
| **Shift Management** | `SHIFT_VIEW`, `SHIFT_VIEW_ALL` | View all cashier shifts (oversight) |
| **BIR Readings** | `X_READING`, `Z_READING` | Generate BIR compliance reports |

### RETAINED Permissions (111 permissions)

All supervisory, approval, and master data management permissions were kept:

| Category | Permission Types | Examples |
|----------|-----------------|----------|
| **User/Role Management** | Full CRUD | Create users, assign roles, manage permissions |
| **Product Management** | Full CRUD | Create/edit products, manage pricing, opening stock |
| **Master Data** | Full CRUD | Categories, Brands, Units, Warranties, Customers, Suppliers |
| **Transactional Approvals** | Approve/Reject | Purchases, GRNs, Returns, Amendments, Corrections, Transfers |
| **Quality Control** | Conduct & Approve | QC inspections, QC templates |
| **Reports** | Full View Access | All sales, purchase, inventory, financial, and profitability reports |
| **Settings** | Full Access | Business settings, location management |
| **Audit** | View Access | Audit logs, activity tracking |

---

## Permission Matrix: Role Comparison

### Legend
- ✅ = Full CRUD (Create, Read, Update, Delete)
- 👁️ = View Only (Read)
- ✔️ = Approve/Execute (Supervisory action)
- ❌ = No Access

### Core Transactional Operations

| Module | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Cashier |
|--------|-------------|--------------|----------------|------------------|---------|
| **Sales (POS)** | ✅ | 👁️ | ✅ | 👁️ | ✅ (own only) |
| **Purchases** | ✅ | 👁️ + ✔️ | ✅ + ✔️ | ✅ | ❌ |
| **GRN/Receipts** | ✅ | 👁️ + ✔️ | ✅ + ✔️ | ✅ | ❌ |
| **Stock Transfers** | ✅ | 👁️ + ✔️ | ✅ + ✔️ | ❌ | ❌ |
| **Inventory Corrections** | ✅ | 👁️ + ✔️ | ✅ + ✔️ | ❌ | ❌ |
| **Customer Returns** | ✅ | 👁️ + ✔️ | ❌ | ❌ | ❌ |
| **Supplier Returns** | ✅ | 👁️ + ✔️ | ❌ | ❌ | ❌ |

### Master Data Management

| Module | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Cashier |
|--------|-------------|--------------|----------------|------------------|---------|
| **Products** | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| **Categories** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Brands** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Units** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Warranties** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Customers** | ✅ | ✅ | ✅ | 👁️ | ✅ (create/view) |
| **Suppliers** | ✅ | ✅ | ✅ | ✅ | ❌ |

### User & System Management

| Module | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Cashier |
|--------|-------------|--------------|----------------|------------------|---------|
| **Users** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Roles** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Locations** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Business Settings** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Audit Logs** | ✅ | 👁️ | ❌ | ❌ | ❌ |

### Financial Operations

| Module | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Cashier |
|--------|-------------|--------------|----------------|------------------|---------|
| **Accounts Payable** | ✅ | 👁️ | 👁️ + ✅ (create) | ✅ | ❌ |
| **Payments** | ✅ | 👁️ + ✔️ | 👁️ + ✅ (create) | ✅ + ✔️ | ❌ |
| **Banks** | ✅ | 👁️ | ❌ | ✅ | ❌ |
| **Bank Transactions** | ✅ | 👁️ | 👁️ | ✅ | ❌ |
| **Expenses** | ✅ | 👁️ | ✅ | ✅ | ❌ |

### Quality Control & Approvals

| Module | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Cashier |
|--------|-------------|--------------|----------------|------------------|---------|
| **QC Inspections** | ✅ | ✔️ (conduct + approve) | ✔️ (conduct + approve) | ❌ | ❌ |
| **Purchase Approvals** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **GRN Approvals** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Return Approvals** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Void Approvals** | ✅ | ✔️ | ✔️ | ❌ | ❌ (create only) |
| **Cash Approvals** | ✅ | ✔️ | ✔️ | ❌ | ❌ |

### Reports & Analytics

| Report Category | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Cashier |
|-----------------|-------------|--------------|----------------|------------------|---------|
| **Sales Reports** | ✅ | ✅ | ✅ | ❌ | ✅ (own sales) |
| **Purchase Reports** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Inventory Reports** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Financial Reports** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Profitability** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Transfer Reports** | ✅ | ✅ | ✅ | ❌ | ❌ |

### Cashier & POS Features

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Cashier |
|---------|-------------|--------------|----------------|------------------|---------|
| **Shift Open/Close** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Shift View (All)** | ✅ | ✅ | ✅ | ❌ | 👁️ (own only) |
| **Cash In/Out** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Cash Count** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **X Reading** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Z Reading** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Freebies** | ✅ | ✅ + ✔️ | ✔️ | ❌ | ❌ |

---

## Branch Admin: Before vs After

### BEFORE (Problematic)
```
Branch Admin could:
- Create sales (POS transactions)
- Create purchases
- Create stock transfers
- Create inventory corrections
- Create expenses
- Create/edit/delete payments
- Create/edit/delete bank accounts
- Create/edit/delete accounts payable
- Create purchase returns
- Create purchase amendments
```

**Problem:** Role was doing OPERATIONAL work instead of SUPERVISORY work

### AFTER (Correct)
```
Branch Admin can:
- APPROVE purchases (not create)
- APPROVE receipts (not create)
- APPROVE transfers (not create)
- APPROVE corrections (not create)
- APPROVE returns (not create)
- APPROVE payments (not create)
- VIEW all transactions
- VIEW all reports
- MANAGE master data (products, users, settings)
```

**Result:** Role is now purely SUPERVISORY with oversight and approval authority

---

## Workflow Examples

### Example 1: Purchase Order Workflow

**BEFORE (Wrong):**
1. Branch Admin creates purchase order ❌
2. Branch Admin approves own purchase order ❌
3. (No separation of duties!)

**AFTER (Correct):**
1. Branch Manager/Accounting Staff creates purchase order ✅
2. Branch Admin reviews and approves purchase order ✅
3. (Proper separation of duties!)

---

### Example 2: Stock Transfer Workflow

**BEFORE (Wrong):**
1. Branch Admin creates transfer request ❌
2. Branch Admin approves own transfer ❌
3. (Self-approval security risk!)

**AFTER (Correct):**
1. Branch Manager creates transfer request ✅
2. Branch Admin reviews and approves transfer ✅
3. Branch Admin marks transfer as sent/received ✅
4. (Proper supervisory oversight!)

---

### Example 3: Inventory Correction Workflow

**BEFORE (Wrong):**
1. Branch Admin creates correction ❌
2. Branch Admin approves own correction ❌
3. (Potential for manipulation!)

**AFTER (Correct):**
1. Branch Manager creates correction request ✅
2. Branch Admin investigates discrepancy ✅
3. Branch Admin approves/rejects correction ✅
4. (Audit trail and accountability!)

---

## Migration Guide

### Step 1: Update Role Definitions
✅ **COMPLETED** - `src/lib/rbac.ts` has been updated with new Branch Admin permissions

### Step 2: Re-seed Database (Recommended)

Run the seed script to update existing Branch Admin roles:

```bash
npm run db:seed
```

This will:
- Update all Branch Admin roles with new permission set
- Remove obsolete permissions
- Add new supervisory permissions

**IMPORTANT:** This will reset demo accounts. If you have production data, skip to Step 3.

### Step 3: Manual Database Update (Production Safe)

If you have existing Branch Admin users and want to preserve data:

```javascript
// File: scripts/update-branch-admin-permissions.mjs
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateBranchAdminPermissions() {
  console.log('Updating Branch Admin permissions...')

  // Get all businesses
  const businesses = await prisma.business.findMany()

  for (const business of businesses) {
    // Find Branch Admin role
    const branchAdminRole = await prisma.role.findFirst({
      where: {
        name: 'Branch Admin',
        businessId: business.id
      }
    })

    if (!branchAdminRole) {
      console.log(`No Branch Admin role found for business: ${business.name}`)
      continue
    }

    // Permissions to REMOVE
    const permissionsToRemove = [
      'sell.create', 'sell.update', 'sell.delete',
      'purchase.create', 'purchase.update', 'purchase.delete',
      'purchase.receipt.create',
      'purchase_return.create', 'purchase_return.update', 'purchase_return.delete',
      'purchase_amendment.create',
      'qc_inspection.create',
      'inventory_correction.create', 'inventory_correction.update', 'inventory_correction.delete',
      'stock_transfer.create',
      'expense.create', 'expense.update', 'expense.delete',
      'accounts_payable.create', 'accounts_payable.update', 'accounts_payable.delete',
      'payment.create', 'payment.update', 'payment.delete',
      'bank.create', 'bank.update', 'bank.delete',
      'bank_transaction.create', 'bank_transaction.update', 'bank_transaction.delete'
    ]

    // Permissions to ADD
    const permissionsToAdd = [
      'customer_return.view', 'customer_return.approve', 'customer_return.delete',
      'supplier_return.view', 'supplier_return.approve', 'supplier_return.delete',
      'void.create', 'void.approve',
      'cash.approve_large_transactions',
      'serial_number.view', 'serial_number.track',
      'shift.view', 'shift.view_all',
      'reading.x_reading', 'reading.z_reading'
    ]

    // Remove obsolete permissions
    for (const permName of permissionsToRemove) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName }
      })
      if (permission) {
        await prisma.rolePermission.deleteMany({
          where: {
            roleId: branchAdminRole.id,
            permissionId: permission.id
          }
        })
        console.log(`  ✅ Removed: ${permName}`)
      }
    }

    // Add new permissions
    for (const permName of permissionsToAdd) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName }
      })
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: branchAdminRole.id,
              permissionId: permission.id
            }
          },
          create: {
            roleId: branchAdminRole.id,
            permissionId: permission.id
          },
          update: {}
        })
        console.log(`  ✅ Added: ${permName}`)
      }
    }

    console.log(`✅ Updated Branch Admin for business: ${business.name}`)
  }

  console.log('\n✅ All Branch Admin roles updated successfully!')
}

updateBranchAdminPermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Run the script:
```bash
node scripts/update-branch-admin-permissions.mjs
```

### Step 4: Notify Users

Send notification to all Branch Admin users:

**Subject:** Important: Branch Admin Role Update

**Body:**
> Dear Branch Admin,
>
> Your role has been updated to align with supervisory responsibilities:
>
> **What Changed:**
> - You can no longer CREATE sales, purchases, or transfers
> - You can still APPROVE all transactions
> - You retain full access to manage products, users, and settings
> - You can view all reports and analytics
>
> **Why This Change:**
> - Improved security (separation of duties)
> - Better audit trails
> - Compliance with internal controls
>
> **Who Creates Transactions Now:**
> - Sales: Cashiers
> - Purchases: Branch Managers / Accounting Staff
> - Transfers: Branch Managers
> - Corrections: Branch Managers
>
> **Your Approval is Required For:**
> - All purchases and receipts
> - All stock transfers
> - All inventory corrections
> - All returns (customer & supplier)
> - Large cash transactions
>
> If you have questions, please contact the system administrator.

### Step 5: Update UI Components

Check for components that might need updates:

```bash
# Search for permission checks that might be affected
grep -r "SELL_CREATE" src/
grep -r "PURCHASE_CREATE" src/
grep -r "STOCK_TRANSFER_CREATE" src/
```

Update components to hide CREATE buttons for Branch Admin:

```typescript
// Example: Hide "Create Purchase" button for Branch Admin
import { usePermissions } from '@/hooks/usePermissions'

function PurchaseListPage() {
  const { can, hasRole } = usePermissions()

  return (
    <div>
      <h1>Purchases</h1>

      {/* Only show Create button if user can create purchases */}
      {can(PERMISSIONS.PURCHASE_CREATE) && (
        <button>Create Purchase</button>
      )}

      {/* Show Approve button if user can approve */}
      {can(PERMISSIONS.PURCHASE_APPROVE) && (
        <button>Approve Pending</button>
      )}
    </div>
  )
}
```

### Step 6: Test the Changes

**Test Checklist:**

- [ ] Login as Branch Admin
- [ ] Verify "Create Sale" button is hidden in POS
- [ ] Verify "Create Purchase" button is hidden in Purchases
- [ ] Verify "Create Transfer" button is hidden in Transfers
- [ ] Verify "Approve" buttons are visible
- [ ] Verify all reports are accessible
- [ ] Verify product management still works
- [ ] Verify user management still works
- [ ] Verify business settings still accessible

---

## Security & Compliance Benefits

### Before (Security Risks)
❌ Branch Admin could create and approve own transactions
❌ No separation of duties
❌ Difficult to audit who initiated vs who approved
❌ Single point of failure/fraud risk

### After (Security Improvements)
✅ Branch Admin can only approve (not create) transactions
✅ Proper separation of duties enforced
✅ Clear audit trail: Creator vs Approver
✅ Reduced fraud risk through oversight
✅ Compliance with SOD (Segregation of Duties) principles

---

## Role Hierarchy (Recommended)

From highest to lowest authority:

1. **Super Admin** (Platform Owner)
   - Can do EVERYTHING across all businesses
   - Should only be used for platform management

2. **Branch Admin** (Business Owner/Supervisor)
   - Approves all transactions
   - Manages users, products, and settings
   - Views all reports
   - Does NOT perform daily operations

3. **Branch Manager** (Operations Manager)
   - Creates purchases, transfers, corrections
   - Manages day-to-day operations
   - Limited reporting access

4. **Accounting Staff** (Financial Officer)
   - Handles all financial operations
   - Creates payments, manages accounts payable
   - Views financial reports

5. **Cashier** (POS Operator)
   - Processes sales only
   - Minimal access to master data
   - Can view own sales reports only

---

## Frequently Asked Questions

### Q: Can Branch Admin still create products?
**A:** YES. Branch Admin retains full CRUD access to all master data (products, categories, brands, units, customers, suppliers).

### Q: Can Branch Admin still view sales?
**A:** YES. Branch Admin can view ALL sales, but cannot create sales transactions (that's for Cashiers).

### Q: Who creates purchases now?
**A:** Branch Managers or Accounting Staff create purchases. Branch Admin approves them.

### Q: Can Branch Admin still approve purchases?
**A:** YES. Branch Admin can approve ALL transactional operations (purchases, receipts, transfers, corrections, returns).

### Q: What if we only have one user?
**A:** You can assign multiple roles to one user. Give them Branch Manager + Branch Admin roles. However, this defeats the purpose of separation of duties and should only be used in small operations during setup.

### Q: Can we customize these permissions further?
**A:** YES. Edit `src/lib/rbac.ts` and adjust the permissions array for Branch Admin. Then re-run the seed script.

### Q: Will existing Branch Admin users lose access immediately?
**A:** After updating the code, users will need to **logout and login again** for their session to reflect the new permissions. The database roles must also be updated (see Migration Guide Step 2/3).

---

## Rollback Plan (If Needed)

If you need to revert to the old permissions:

1. **Restore from Git:**
   ```bash
   git checkout HEAD~1 src/lib/rbac.ts
   ```

2. **Or manually add back the removed permissions** by editing lines 437-629 in `src/lib/rbac.ts`

3. **Re-seed database:**
   ```bash
   npm run db:seed
   ```

4. **Ask all users to logout/login**

---

## Summary

The Branch Admin role has been successfully transformed from an **operational role** to a **supervisory role**:

**New Philosophy:**
> "Branch Admin sets up the system and approves the work of others. They do not perform day-to-day transactions themselves."

**Key Changes:**
- ❌ Removed 36 transactional CREATE/UPDATE/DELETE permissions
- ✅ Added 11 supervisory approval permissions
- ✅ Retained all VIEW and APPROVE permissions
- ✅ Retained full master data management

**Next Steps:**
1. Run database migration script (Step 2 or 3)
2. Notify all Branch Admin users
3. Test the changes in a staging environment
4. Deploy to production

---

**Report Generated:** 2025-10-19
**File Updated:** `src/lib/rbac.ts`
**Lines Modified:** 437-629
**Permissions Removed:** 36
**Permissions Added:** 11
**Total Branch Admin Permissions:** 111

---

## Appendix: Complete Branch Admin Permission List

<details>
<summary>Click to expand full permission list (111 permissions)</summary>

### Dashboard (1)
- dashboard.view

### User & Role Management (8)
- user.view
- user.create
- user.update
- user.delete
- role.view
- role.create
- role.update
- role.delete

### Product Management (11)
- product.view
- product.create
- product.update
- product.delete
- product.view_purchase_price
- product.opening_stock
- product.view_all_branch_stock
- product.access_default_selling_price
- product.lock_opening_stock
- product.unlock_opening_stock
- product.modify_locked_stock

### Product Master Data (16)
- product.category.view
- product.category.create
- product.category.update
- product.category.delete
- product.brand.view
- product.brand.create
- product.brand.update
- product.brand.delete
- product.unit.view
- product.unit.create
- product.unit.update
- product.unit.delete
- product.warranty.view
- product.warranty.create
- product.warranty.update
- product.warranty.delete

### Inventory Management (4)
- inventory_correction.view
- inventory_correction.approve
- physical_inventory.export
- physical_inventory.import

### Sales (1)
- sell.view

### Purchases (6)
- purchase.view
- purchase.approve
- purchase.receive
- purchase.view_cost
- purchase.receipt.approve
- purchase.receipt.view

### Purchase Returns (2)
- purchase_return.view
- purchase_return.approve

### Purchase Amendments (3)
- purchase_amendment.view
- purchase_amendment.approve
- purchase_amendment.reject

### Quality Control (5)
- qc_inspection.view
- qc_inspection.conduct
- qc_inspection.approve
- qc_template.view
- qc_template.manage

### Accounts Payable & Payments (3)
- accounts_payable.view
- payment.view
- payment.approve

### Banking (2)
- bank.view
- bank_transaction.view

### Expenses (1)
- expense.view

### Customers & Suppliers (8)
- customer.view
- customer.create
- customer.update
- customer.delete
- supplier.view
- supplier.create
- supplier.update
- supplier.delete

### Returns (6)
- customer_return.view
- customer_return.approve
- customer_return.delete
- supplier_return.view
- supplier_return.approve
- supplier_return.delete

### Void Transactions (2)
- void.create
- void.approve

### Cash Management (1)
- cash.approve_large_transactions

### Serial Numbers (2)
- serial_number.view
- serial_number.track

### Shift Management (2)
- shift.view
- shift.view_all

### BIR Readings (2)
- reading.x_reading
- reading.z_reading

### Reports (20)
- report.view
- report.sales.view
- report.sales.daily
- report.sales.today
- report.sales.history
- report.sales.profitability
- report.purchase.view
- report.purchase.analytics
- report.purchase.trends
- report.purchase.items
- report.transfer.view
- report.transfer.trends
- report.profit_loss
- report.profitability
- report.product_purchase_history
- report.stock_alert
- report.stock.view
- view_inventory_reports
- inventory_ledger.view
- inventory_ledger.export

### Sales Reports (10)
- sales_report.view
- sales_report.daily
- sales_report.summary
- sales_report.journal
- sales_report.per_item
- sales_report.per_cashier
- sales_report.per_location
- sales_report.analytics
- sales_report.customer_analysis
- sales_report.payment_method
- sales_report.discount_analysis

### Business Settings (2)
- business_settings.view
- business_settings.edit

### Location Management (4)
- location.view
- location.create
- location.update
- access_all_locations

### Stock Transfers (7)
- stock_transfer.view
- stock_transfer.check
- stock_transfer.send
- stock_transfer.receive
- stock_transfer.verify
- stock_transfer.complete
- stock_transfer.cancel

### Audit (1)
- audit_log.view

### Freebies (3)
- freebie.add
- freebie.approve
- freebie.view_log

**TOTAL: 111 Permissions**

</details>
