# 🚨 POS Access Restriction - Branch Manager Update

## ⚠️ Critical Change: POS Menu Restricted to Cashiers Only

### What Changed?

**Branch Manager** role permissions have been updated to remove POS access.

**File Modified**: `src/lib/rbac.ts` (lines 653-727)

---

## 📋 Permissions REMOVED from Branch Manager:

### Sales Operations (Lines 653-656):
- ❌ `SELL_CREATE` - Can NO longer create sales
- ❌ `SELL_UPDATE` - Can NO longer update sales
- ❌ `SELL_DELETE` - Can NO longer delete sales
- ✅ `SELL_VIEW` - Can STILL view all sales (kept)

### Shift Management (Lines 712-715):
- ❌ `SHIFT_OPEN` - Can NO longer open shifts
- ❌ `SHIFT_CLOSE` - Can NO longer close shifts
- ✅ `SHIFT_VIEW` - Can STILL view shifts (kept)
- ✅ `SHIFT_VIEW_ALL` - Can STILL view all shifts (kept)

### Cash Management (Lines 717-719):
- ❌ `CASH_IN_OUT` - Can NO longer do cash in/out
- ❌ `CASH_COUNT` - Can NO longer count cash
- ✅ `CASH_APPROVE_LARGE_TRANSACTIONS` - Can STILL approve large transactions (kept)

### Voids (Lines 721-723):
- ❌ `VOID_CREATE` - Can NO longer create voids
- ✅ `VOID_APPROVE` - Can STILL approve voids (kept)

### Readings (Lines 725-727):
- ❌ `X_READING` - Can NO longer do X readings
- ✅ `Z_READING` - Can STILL do Z readings (kept)

---

## ✅ Result: Sidebar Menu Changes

### Branch Manager will NO LONGER SEE:
- ❌ "POS & Sales" menu (requires `SELL_CREATE`)
- ❌ "Point of Sale" submenu
- ❌ "Begin Shift" submenu
- ❌ "Close Shift" submenu
- ❌ "X Reading" submenu

### Branch Manager will STILL SEE:
- ✅ "Sales List" (has `SELL_VIEW`)
- ✅ All sales reports
- ✅ All inventory management
- ✅ All purchase management
- ✅ All transfer management

---

## 👥 Who CAN Use POS Now?

Only these roles have `SELL_CREATE` permission:

| Role | POS Access | Reason |
|------|-----------|---------|
| **Regular Cashier** | ✅ Full Access | Primary POS users |
| **Sales Clerk** (NEW) | ✅ Full Access | Front-line sales staff |
| **Super Admin** | ✅ Full Access | System administrator |

---

## 👥 Who CANNOT Use POS?

| Role | POS Access | What They CAN Do |
|------|-----------|------------------|
| **Branch Manager** | ❌ No Access | View sales, approve voids, Z reading, manage inventory/purchases |
| **Branch Admin** | ❌ No Access | System administration, view sales reports |
| **Inventory Controller** | ❌ No Access | Inventory corrections, physical counts |
| **Warehouse Staff** | ❌ No Access | Receive goods, view stock |
| **Transfer Roles** | ❌ No Access | Create/approve/send/receive transfers |

---

## 🔍 Business Logic

### Why Branch Managers Should NOT Use POS:

**Separation of Duties**:
- Managers oversee operations, they don't perform front-line transactions
- Cashiers handle customer transactions
- Managers review, approve, and analyze sales

**Proper Hierarchy**:
```
Branch Manager
    ↓ supervises
Cashiers/Sales Clerks
    ↓ use
POS System
```

**What Managers SHOULD Do**:
- ✅ Review sales reports
- ✅ Approve voids and returns
- ✅ Close day with Z reading
- ✅ Manage inventory and purchases
- ✅ Supervise cashiers
- ❌ NOT operate the cash register

---

## 🎯 Impact on Existing Users

### Users Currently Affected:
Based on database analysis, these users have "Main Branch Manager" or "Branch Manager" roles:
- `cebu_mgr`
- `mainmgr`
- `makati_mgr`
- `pasig_mgr`

### What Happens to Them:

**After Re-seeding Database** (`npm run db:seed`):
1. Their "Branch Manager" role will be updated with new permissions
2. They will NO LONGER see "POS & Sales" menu
3. They will STILL see "Sales List" for viewing sales
4. They will STILL have all other management permissions

**If They Need POS Access**:
- Assign them an additional "Regular Cashier" or "Sales Clerk" role
- OR create a custom role with both management + POS permissions

---

## 🛠️ How to Apply Changes

### Option 1: Re-seed Database (Recommended)
```bash
npm run db:seed
```
This will update the "Branch Manager" role with new permissions.

### Option 2: Update Existing Roles Manually
Via Admin Panel:
1. Login as Super Admin
2. Navigate to: Dashboard → User Management → Roles & Permissions
3. Edit "Branch Manager" role
4. Remove these permissions:
   - `sell.create`
   - `sell.update`
   - `sell.delete`
   - `shift.open`
   - `shift.close`
   - `cash.in_out`
   - `cash.count`
   - `void.create`
   - `reading.x_reading`
5. Save changes

### Option 3: Database Script
```sql
-- Remove POS-related permissions from Branch Manager role
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name = 'Branch Manager')
  AND permission_id IN (
    SELECT id FROM permissions WHERE name IN (
      'sell.create', 'sell.update', 'sell.delete',
      'shift.open', 'shift.close',
      'cash.in_out', 'cash.count',
      'void.create', 'reading.x_reading'
    )
  );
```

---

## ✅ Testing Checklist

### Test as Branch Manager:
1. Login as a user with "Branch Manager" role
2. ❌ Should NOT see "POS & Sales" menu in sidebar
3. ❌ Should NOT see "Begin Shift" menu
4. ❌ Should NOT see "Close Shift" menu
5. ❌ Should NOT see "X Reading" menu
6. ✅ Should STILL see "Sales List"
7. ✅ Should STILL see all reports
8. ✅ Should STILL see inventory management
9. Try accessing `/dashboard/pos` directly → Should get "Access Denied"

### Test as Regular Cashier:
1. Login as a user with "Regular Cashier" role
2. ✅ Should see "POS & Sales" menu
3. ✅ Should see "Point of Sale"
4. ✅ Should see "Begin Shift"
5. ✅ Should see "Close Shift"
6. ✅ Should see "X Reading"
7. ✅ Can access `/dashboard/pos` and use POS

---

## 🔒 Security Verification

### API Route Protection

All POS API routes are protected by permission checks:

**Example**: `src/app/api/sales/route.ts`
```typescript
// POST /api/sales (Create Sale)
const session = await getServerSession(authOptions)
if (!can(session.user, 'sell.create')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

**Result**: Even if someone bypasses the UI, they CANNOT create sales via API without `sell.create` permission.

---

## 📊 Role Comparison

| Feature | Branch Manager (NEW) | Regular Cashier | Sales Clerk |
|---------|---------------------|----------------|-------------|
| **POS Access** | ❌ No | ✅ Yes | ✅ Yes |
| **View Sales** | ✅ Yes | ⚠️ Own only | ✅ Yes |
| **Create Sales** | ❌ No | ✅ Yes | ✅ Yes |
| **Open/Close Shift** | ❌ No | ✅ Yes | ✅ Yes |
| **X Reading** | ❌ No | ✅ Yes | ✅ Yes |
| **Z Reading** | ✅ Yes | ❌ No | ❌ No |
| **Approve Voids** | ✅ Yes | ❌ No | ❌ No |
| **Manage Inventory** | ✅ Yes | ❌ No | ❌ No |
| **Manage Purchases** | ✅ Yes | ❌ No | ❌ No |
| **View Reports** | ✅ All Reports | ⚠️ Sales only | ⚠️ Basic only |

---

## 💡 Recommendations

### For Small Business:
- **Owner**: Assign "Super Admin" role (has everything)
- **Staff**: Assign "Regular Cashier" or "Sales Clerk" roles

### For Medium/Large Business:
- **General Manager**: Assign "Branch Manager" role
- **Store Supervisors**: Assign custom role with limited management permissions
- **Cashiers**: Assign "Regular Cashier" role
- **Sales Floor Staff**: Assign "Sales Clerk" role
- **Inventory Staff**: Assign "Inventory Controller" role
- **Warehouse Staff**: Assign "Warehouse Staff" role

### If Manager Needs Occasional POS Access:
Create a separate cashier account:
- Manager Login: `john_manager` → Branch Manager role (management)
- Cashier Login: `john_cashier` → Regular Cashier role (POS)

**Benefit**: Maintains audit trail separation between management and cashier activities.

---

## 📝 Summary

### Before This Update:
- ❌ Branch Managers could use POS
- ❌ Managers could create sales
- ❌ Managers could open/close shifts
- ❌ Violation of separation of duties

### After This Update:
- ✅ Only cashiers/sales clerks can use POS
- ✅ Managers supervise sales (view, approve, report)
- ✅ Clear separation between management and cashier roles
- ✅ Proper business hierarchy

---

**Created**: October 20, 2025
**File Modified**: `src/lib/rbac.ts`
**Impact**: Medium - affects all Branch Manager users
**Breaking Change**: Yes - existing Branch Managers lose POS access
**Recommended Action**: Re-seed database or manually update roles
