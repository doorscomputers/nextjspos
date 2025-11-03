# Menu Management Guide

## Overview

This guide explains the menu management system for controlling sidebar visibility through roles and user-level overrides.

---

## System Architecture

### Two Types of Menu Control:

1. **Role-Based Menu Permissions** (`/dashboard/settings/menu-permissions`)
   - Assign which menus each role can see
   - Example: Sales Cashier role can only see Dashboard, POS, and Sales menus

2. **User-Level Menu Overrides** (Future: `/dashboard/settings/user-menu-permissions`)
   - Override role-based menus for specific users
   - Example: Give specific cashier access to Reports menu even though their role doesn't have it

---

## Current Status ✅

### Menus Populated:
- ✅ 36 menus created in database
- ✅ Hierarchical structure (3 levels):
  - **Level 1**: Dashboard, Products, Purchases, Sales, Transfers, Reports, Contacts, Settings, AI Assistant
  - **Level 2**: Sub-menus (e.g., Products → List Products, Add Product)
  - **Level 3**: Nested sub-menus (e.g., Settings → Product Settings → Categories)

### Pages Available:
1. **Menu Permissions** (`/dashboard/settings/menu-permissions`)
   - Select a role
   - Check/uncheck menus to control visibility
   - Save changes
   - **Status**: Now working with 36 menus

2. **Menu Management** (`/dashboard/settings/menu-management`)
   - Add/Edit/Delete menu items
   - Sync all menus from Sidebar automatically
   - **Status**: Fully functional

---

## How to Use

### 1. Assign Menus to Roles

**Steps:**
1. Go to `/dashboard/settings/menu-permissions`
2. Select a role from the left panel (e.g., "Sales Cashier")
3. You'll see all 36 menus in a hierarchical tree
4. Check/uncheck menus to control visibility for that role
5. Click "Save Changes"
6. Users with that role will only see checked menus in sidebar

**Example Configuration:**

**Sales Cashier Role** (should see only):
- ✅ Dashboard
- ✅ Products (view only)
  - ✅ List Products
- ✅ Sales
  - ✅ POS
  - ✅ List Sales
- ✅ Contacts
  - ✅ Customers
- ❌ Purchases (hidden)
- ❌ Settings (hidden)
- ❌ Reports (hidden)

**Warehouse Manager Role** (should see):
- ✅ Dashboard
- ✅ Products (full access)
  - ✅ List Products
  - ✅ Add Product
  - ✅ Simple Price Editor
  - ✅ Print Labels
- ✅ Purchases
  - ✅ List Purchases
  - ✅ Add Purchase
- ✅ Transfers
  - ✅ List Transfers
  - ✅ Create Transfer
- ✅ Reports
  - ✅ Purchase Items Report
  - ✅ Transfer Export
- ✅ Contacts (Suppliers)
- ❌ Sales (hidden - warehouse doesn't sell)
- ❌ Settings → User Management (hidden)

**Super Admin / Reports Admin** (see everything):
- ✅ All 36 menus checked

---

### 2. Add New Menus When Sidebar Changes

**Option A: Automatic Sync** (Recommended)
1. Go to `/dashboard/settings/menu-management`
2. Click "Sync All from Sidebar" button
3. System will automatically detect and add any new menus from your Sidebar.tsx
4. Shows: "Synced X menus successfully!"

**Option B: Manual Add**
1. Go to `/dashboard/settings/menu-management`
2. Click "+" button to add a new menu
3. Fill in:
   - **Key**: lowercase with underscores (e.g., `reports_daily_sales`)
   - **Name**: Display name (e.g., "Daily Sales Report")
   - **URL Path**: Route (e.g., `/dashboard/reports/daily-sales`)
   - **Parent Menu**: Select parent (e.g., "Reports") or leave empty for top-level
   - **Order**: Display order (1, 2, 3, etc.)
4. Click Save
5. New menu will appear in Menu Permissions page

---

### 3. Workflow for Adding New Features

**Example: Adding "Daily Sales Report"**

1. **Create the page**: `src/app/dashboard/reports/daily-sales/page.tsx`

2. **Add to Sidebar.tsx**:
```tsx
{
  key: 'reports_daily_sales',
  name: 'Daily Sales Report',
  href: '/dashboard/reports/daily-sales',
  icon: Calendar,
  permissionRequired: PERMISSIONS.REPORT_VIEW
}
```

3. **Sync menus**:
   - Go to `/dashboard/settings/menu-management`
   - Click "Sync All from Sidebar"
   - New menu automatically added to database

4. **Assign to roles**:
   - Go to `/dashboard/settings/menu-permissions`
   - Select each role (e.g., "Reports Admin", "Super Admin")
   - Check "Daily Sales Report"
   - Save

5. **Test**:
   - Login as user with that role
   - Verify menu appears in sidebar

---

## Menu Structure Reference

### Current Sidebar Menus (36 total):

```
📊 Dashboard
📦 Products
   ├─ List Products
   ├─ Add Product
   ├─ Simple Price Editor
   └─ Print Labels
🛒 Purchases
   ├─ List Purchases
   └─ Add Purchase
🛍️ Sales
   ├─ List Sales
   └─ POS
🚚 Stock Transfers
   ├─ List Transfers
   └─ Create Transfer
📈 Reports
   ├─ Stock History V2
   ├─ Stock Pivot
   ├─ Purchase Items Report
   └─ Transfer Export
👥 Contacts
   ├─ Suppliers
   └─ Customers
⚙️ Settings
   ├─ Business Settings
   ├─ Business Locations
   ├─ Tax Rates
   ├─ Product Settings
   │  ├─ Categories
   │  ├─ Brands
   │  └─ Units
   └─ User Management
      ├─ Users
      ├─ Roles
      └─ Menu Permissions
🤖 AI Assistant
```

---

## Technical Details

### Database Tables:

1. **menu_permission** - All available menus
   - id, key, name, href, icon, parentId, order

2. **role_menu_permission** - Which menus each role can access
   - roleId, menuPermissionId

3. **user_menu_permission** - User-level overrides (optional)
   - userId, menuPermissionId, isEnabled

### How Sidebar Filtering Works:

```typescript
// 1. Load user's role menu permissions
const roleMenus = await getRoleMenuPermissions(user.roleId)

// 2. Check user-level overrides (if exists)
const userOverrides = await getUserMenuOverrides(user.id)

// 3. Merge: User overrides take precedence
const allowedMenuKeys = mergeMenuPermissions(roleMenus, userOverrides)

// 4. Filter sidebar to show only allowed menus
const visibleMenus = allMenus.filter(menu =>
  allowedMenuKeys.includes(menu.key)
)
```

---

## Best Practices

### 1. **Role-Based First**
- Always configure menus at role level first
- Use user-level overrides sparingly (only for exceptions)

### 2. **Keep Menus in Sync**
- When adding new Sidebar items, immediately sync menus
- Run "Sync All from Sidebar" button after major Sidebar changes

### 3. **Test Each Role**
- After configuring menus, test with actual user accounts
- Verify each role sees only intended menus

### 4. **Menu Naming Convention**
- Use descriptive keys: `reports_daily_sales` not `report1`
- Use hierarchy: `settings_product_categories` for nested menus
- Format: `parent_child_grandchild`

### 5. **Parent Menu Logic**
- If parent menu is unchecked, ALL children are hidden
- Example: Uncheck "Settings" → hides all Settings sub-menus
- Check individual children only if parent is checked

---

## Common Use Cases

### Use Case 1: Hide Cost/Pricing from Cashiers

**Menu Permissions**:
- ❌ Products → Simple Price Editor
- ✅ Products → List Products (but RBAC hides cost column)

**RBAC Permissions**:
- ❌ `product.price.edit`
- ❌ `product.cost.view`
- ✅ `product.view`
- ✅ `product.price.view` (retail only)

### Use Case 2: Location Manager Sees Only Their Branch Reports

**Menu Permissions**:
- ✅ Reports
  - ✅ Stock History V2
  - ✅ Transfer Export
  - ❌ Purchase Items Report (warehouse only)

**RBAC + API Filtering**:
- User locationId filters all queries
- Reports API automatically filters by `user.locationId`

### Use Case 3: Admin Can View Everything But Not Transact

**Menu Permissions**:
- ✅ All menus visible

**RBAC Permissions**:
- ✅ All view permissions
- ❌ `purchase.create`, `sale.create`, `transfer.create`
- ❌ All inventory transaction permissions

**Result**: Admin sees all menus but gets "Forbidden" error when trying to create transactions

---

## Troubleshooting

### Problem: Menus not showing after configuration

**Solution**:
1. Check role has menus assigned in `/dashboard/settings/menu-permissions`
2. Verify user has correct role: `/dashboard/settings/users`
3. User must **logout and login** after menu changes
4. Check browser console for errors

### Problem: New sidebar item not appearing in Menu Permissions

**Solution**:
1. Go to `/dashboard/settings/menu-management`
2. Click "Sync All from Sidebar"
3. Check "Synced X menus" message
4. Refresh Menu Permissions page

### Problem: User sees menus they shouldn't

**Solution**:
1. Check user's role: `/dashboard/settings/users`
2. Check role's menu assignments: `/dashboard/settings/menu-permissions`
3. Check for user-level overrides (if implemented)
4. User must logout and login for changes to take effect

---

## Future Enhancements

### Planned Features:

1. **User-Level Menu Overrides Page**
   - Select a user
   - Override their role's menu permissions
   - Add/remove specific menus for that user only

2. **Menu Permission Templates**
   - Save common menu configurations as templates
   - Apply template to multiple roles at once

3. **Menu Permission Import/Export**
   - Export role menu config as JSON
   - Import to another business/environment

4. **Menu Analytics**
   - Track which menus are used most
   - Identify unused menus for cleanup

---

## Scripts Reference

### Populate Menu Permissions:
```bash
npx tsx scripts/populate-menu-permissions.ts
```
**Use when**: Database menu_permission table is empty or needs refresh

### View All Menus in DB:
```sql
SELECT key, name, href, parentId, order
FROM menu_permission
ORDER BY "order", parentId;
```

### View Role Menu Assignments:
```sql
SELECT r.name as role, mp.name as menu
FROM role_menu_permission rmp
JOIN role r ON r.id = rmp."roleId"
JOIN menu_permission mp ON mp.id = rmp."menuPermissionId"
WHERE r.name = 'Sales Cashier'
ORDER BY mp."order";
```

---

## Summary

### Quick Reference:

| Task | Page | URL |
|------|------|-----|
| Assign menus to roles | Menu Permissions | `/dashboard/settings/menu-permissions` |
| Add new menus | Menu Management | `/dashboard/settings/menu-management` |
| Sync menus automatically | Menu Management | Click "Sync All from Sidebar" |
| View/Edit users | Users | `/dashboard/settings/users` |
| View/Edit roles | Roles | `/dashboard/settings/roles` |

### Workflow Summary:

1. **Add Feature** → Update Sidebar.tsx
2. **Sync Menus** → Menu Management → "Sync All from Sidebar"
3. **Assign to Roles** → Menu Permissions → Check menus → Save
4. **Test** → Login as role user → Verify sidebar

---

*Last Updated: 2025-03-11*
