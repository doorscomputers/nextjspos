# 📋 Inventory Corrections & Physical Inventory - Permission Guide

## 🔐 Who Can Access These Features?

### ✅ Roles with FULL Inventory Access:

| Role | Inventory Corrections | Physical Inventory | POS Access | Reason |
|------|---------------------|-------------------|-----------|---------|
| **Super Admin** | ✅ Full Access | ✅ Full Access | ✅ Yes | Has all permissions in the system |
| **Branch Admin** | ✅ View & Approve Only | ✅ Export & Import | ❌ No | System administrators, oversight role |
| **Branch Manager** | ✅ Full CRUD + Approve | ✅ Export & Import | ❌ No | Manages branch operations & stock accuracy, **supervises cashiers** |
| **Inventory Controller** (NEW) | ✅ Full CRUD + Approve | ✅ Export & Import | ❌ No | Dedicated inventory management role |

### ⚠️ Roles with LIMITED Inventory Access:

| Role | Access Level |
|------|-------------|
| **Warehouse Manager** | ✅ Physical Inventory only (Export & Import) |
| **Warehouse Staff** (NEW) | ❌ NO inventory corrections or counts |

### ❌ Roles with NO Inventory Access:

| Role | Why No Access? |
|------|---------------|
| **Regular Cashier** | POS operations only, no inventory management |
| **Sales Clerk** (NEW) | Sales operations only, no inventory management |
| **Transfer Creator** | Creates transfers only, cannot adjust stock |
| **Transfer Checker** | Approves transfers only |
| **Transfer Sender** | Sends transfers only |
| **Transfer Receiver** | Receives transfers only |

---

## 📊 Current Users with Inventory Access

Based on database analysis:

| Username | Role | Inventory Corrections | Physical Inventory |
|----------|------|---------------------|-------------------|
| `superadmin` | Super Admin | ✅ | ✅ |
| `cebu_mgr` | Main Branch Manager | ✅ | ✅ |
| `mainmgr` | Main Branch Manager | ✅ | ✅ |
| `makati_mgr` | Main Branch Manager | ✅ | ✅ |
| `pasig_mgr` | Main Branch Manager | ✅ | ✅ |
| `jayvillalon` | All Branch Admin + Multiple Roles | ✅ | ✅ |
| `Jheirone` | Warehouse Manager | ❌ | ✅ |

---

## 🆕 New Roles Added

### 1. Sales Clerk
**Purpose**: Front-line sales staff with NO inventory management

**Permissions**:
- ✅ POS operations (create/update/delete sales)
- ✅ Customer management
- ✅ Shift management (open/close, cash count, X Reading)
- ✅ Quotations
- ✅ Basic sales reports
- ❌ NO inventory corrections
- ❌ NO physical inventory
- ❌ NO product creation/editing
- ❌ NO purchase operations
- ❌ NO financial reports

**Use Case**: Assign to sales floor staff, retail clerks, cashiers who should NOT adjust inventory

---

### 2. Warehouse Staff
**Purpose**: Basic warehouse operations with NO correction authority

**Permissions**:
- ✅ View products
- ✅ Receive transfers
- ✅ Receive purchases (GRN)
- ✅ View suppliers
- ✅ Stock alerts & reports
- ❌ NO inventory corrections
- ❌ NO physical inventory counts
- ❌ NO transfer creation/sending
- ❌ NO purchase creation/approval
- ❌ NO sales operations

**Use Case**: Assign to warehouse helpers, receiving staff who process incoming goods but cannot adjust stock levels

---

### 3. Inventory Controller (NEW)
**Purpose**: Dedicated inventory management role with FULL correction & count authority

**Permissions**:
- ✅ **FULL Inventory Corrections** (View, Create, Update, Approve)
- ✅ **FULL Physical Inventory** (Export templates, Import counts)
- ✅ View all branch stock
- ✅ Set opening stock
- ✅ Verify transfers
- ✅ Create customer/supplier returns
- ✅ View purchases & receipts
- ✅ Inventory reports (ledger, historical, stock alerts)
- ❌ NO sales operations
- ❌ NO purchase creation/approval
- ❌ NO financial reports (profit/loss)
- ❌ NO user management
- ❌ NO system settings

**Use Case**: Assign to dedicated inventory managers, stock controllers, or audit staff responsible for stock accuracy

---

## 🎯 Recommended Role Assignments

### For Small Business (1-3 locations):
- **Owner/Manager** → Branch Manager or Super Admin
- **Sales Staff** → Sales Clerk
- **Inventory Person** → Inventory Controller

### For Medium Business (4-10 locations):
- **Head Office** → Super Admin (owner), Branch Admin (operations manager)
- **Branch Managers** → Branch Manager (keeps inventory permissions ✅)
- **Warehouse Manager** → Warehouse Manager (physical inventory only)
- **Warehouse Staff** → Warehouse Staff (no corrections)
- **Inventory Controller** → Inventory Controller (dedicated stock accuracy role)
- **Sales Clerks** → Sales Clerk (no inventory access)
- **Cashiers** → Regular Cashier (basic POS only)

### For Large Business (10+ locations):
- **Head Office**: Super Admin, Branch Admin, Inventory Controller (head office)
- **Regional Managers**: Branch Manager (with inventory access)
- **Branch Managers**: Branch Manager or Main Branch Manager
- **Inventory Controllers**: Inventory Controller (one per region/branch)
- **Warehouse Managers**: Warehouse Manager (physical counts only)
- **Warehouse Staff**: Warehouse Staff (receiving only)
- **Sales Staff**: Sales Clerk (no inventory)
- **Cashiers**: Regular Cashier (basic POS)

---

## ⚙️ How to Assign Roles

### Option 1: Via Admin Panel (UI)
1. Login as Super Admin or user with `user.create` permission
2. Navigate to: **Dashboard → User Management → Users**
3. Click "Edit" on the user
4. Select the appropriate role from dropdown
5. Save changes

### Option 2: Via Database Script
Create a script to bulk assign roles:

```javascript
// scripts/assign-roles.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function assignRole(username, roleName) {
  const user = await prisma.user.findUnique({ where: { username } })
  const role = await prisma.role.findFirst({
    where: { name: roleName, businessId: user.businessId }
  })

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id
    }
  })

  console.log(`✅ Assigned ${roleName} to ${username}`)
}

// Example assignments
await assignRole('sales_staff_1', 'Sales Clerk')
await assignRole('warehouse_helper_1', 'Warehouse Staff')
await assignRole('inventory_manager_1', 'Inventory Controller')

await prisma.$disconnect()
```

Run with: `node scripts/assign-roles.mjs`

---

## 🔍 How to Check Current Permissions

### Check a specific user:
```bash
node scripts/check-user-permissions.mjs
```

This will show:
- All active users
- Their assigned roles
- Total permission count
- Whether they have inventory access

---

## ✅ Sidebar Menu Behavior

The sidebar menu items are already properly protected:

**File**: `src/components/Sidebar.tsx`

```typescript
// Lines 307-317
{
  name: "Inventory Corrections",
  href: "/dashboard/inventory-corrections",
  icon: ClipboardDocumentListIcon,
  permission: PERMISSIONS.INVENTORY_CORRECTION_VIEW,  // ✅ Protected
},
{
  name: "Physical Inventory",
  href: "/dashboard/physical-inventory",
  icon: ClipboardDocumentListIcon,
  permission: PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,  // ✅ Protected
},
```

**Result**: Only users with these permissions will see these menu items in the sidebar.

---

## 🚨 Security Verification

### Test Steps:

1. **Create a test Sales Clerk user**:
   - Assign "Sales Clerk" role
   - Login as this user
   - ✅ Should see: POS, Sales, Customers
   - ❌ Should NOT see: Inventory Corrections, Physical Inventory

2. **Create a test Warehouse Staff user**:
   - Assign "Warehouse Staff" role
   - Login as this user
   - ✅ Should see: Products (view only), Transfers (receive only)
   - ❌ Should NOT see: Inventory Corrections, Physical Inventory

3. **Create a test Inventory Controller user**:
   - Assign "Inventory Controller" role
   - Login as this user
   - ✅ Should see: Inventory Corrections, Physical Inventory
   - ❌ Should NOT see: Sales, Purchases (create)

---

## 📝 Summary

### ✅ What's Correct:
- Branch Managers SHOULD have inventory access (they manage their branches)
- Warehouse Managers SHOULD have physical inventory access (they conduct counts)
- Super Admin SHOULD have everything
- The sidebar menu is properly protected with permission checks

### 🆕 What's New:
- **Sales Clerk** role for sales staff with NO inventory access
- **Warehouse Staff** role for basic warehouse operations with NO corrections
- **Inventory Controller** role for dedicated inventory management

### ⚙️ Next Steps:
1. Run database seed to create new roles: `npm run db:seed`
2. Assign appropriate roles to existing users
3. Test each role to verify permissions
4. Update user training documentation

---

## 🚨 IMPORTANT: POS Access Restriction

### Branch Managers NO LONGER Have POS Access

**What Changed**: Branch Managers can no longer:
- ❌ Access Point of Sale (POS) screen
- ❌ Create sales transactions
- ❌ Open/Close shifts
- ❌ Count cash
- ❌ Do X readings

**What They CAN Still Do**:
- ✅ View all sales (via Sales List)
- ✅ View all sales reports
- ✅ Approve voids
- ✅ Do Z readings (end of day)
- ✅ Manage inventory
- ✅ Manage purchases
- ✅ Supervise cashiers

**Why This Change**:
- **Separation of Duties**: Managers supervise, cashiers transact
- **Proper Business Hierarchy**: Managers don't operate cash registers
- **Better Audit Trail**: Clear distinction between management and cashier activities

**Who CAN Use POS Now**:
- ✅ Super Admin
- ✅ Regular Cashier
- ✅ Sales Clerk (NEW role)

**For More Details**: See `POS_ACCESS_RESTRICTION_UPDATE.md`

---

**Created**: October 20, 2025
**Updated**: October 20, 2025 (Added POS access restrictions)
**File**: `src/lib/rbac.ts` (lines 653-727, 840-973)
**Database Roles**: Will be created on next seed run
