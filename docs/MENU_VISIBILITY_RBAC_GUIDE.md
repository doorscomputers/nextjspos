# Menu Visibility Control Using RBAC Permissions

## Overview

This guide explains how to control which menu items are visible to users based on their assigned roles and permissions using the existing **Role-Based Access Control (RBAC)** system.

## How It Works

Every menu item in the Sidebar can have a `permission` property. The sidebar automatically filters menu items based on the user's permissions:

- If a menu item has a `permission` property, it will **only be visible** if the user has that permission
- If a menu item does **not** have a `permission` property, it will be **visible to everyone**
- This applies to both parent menu items and child menu items

## Step-by-Step Guide to Hide/Show Menu Items

### Step 1: Identify the Menu Item

Open `src/components/Sidebar.tsx` and locate the menu item you want to control. For example:

```typescript
{
  name: "Inventory Corrections",
  href: "/dashboard/inventory-corrections",
  icon: ClipboardDocumentListIcon,
  permission: PERMISSIONS.INVENTORY_CORRECTION_VIEW,
},
```

### Step 2: Check the Permission

Each menu item should have a `permission` property that references a permission from `src/lib/rbac.ts`. For example:

- `PERMISSIONS.INVENTORY_CORRECTION_VIEW`
- `PERMISSIONS.PHYSICAL_INVENTORY_EXPORT`
- `PERMISSIONS.PRODUCT_CREATE`

### Step 3: Configure Role Permissions

To control which users can see the menu item, you need to assign or remove the permission from roles:

#### Option A: Using the UI (Recommended)

1. Login as a Super Admin or Admin user
2. Navigate to **Administration > Roles & Permissions** (`/dashboard/roles`)
3. Click **Edit** on the role you want to modify
4. **Check** or **Uncheck** the permission you identified in Step 2
5. Click **Save Changes**

#### Option B: Using the Database

You can also modify permissions directly in the database by updating the `RolePermission` table.

## Practical Examples

### Example 1: Hide "Inventory Corrections" from Cashiers

**Goal**: Prevent cashiers from seeing the "Inventory Corrections" menu item.

**Solution**:
1. Go to **Administration > Roles & Permissions**
2. Edit the "Cashier" role
3. **Uncheck** the permission: `inventory.correction.view`
4. Save changes

**Result**: Cashiers will no longer see "Inventory Corrections" in the sidebar.

---

### Example 2: Hide "Physical Inventory" from Managers

**Goal**: Prevent managers from accessing the Physical Inventory export feature.

**Menu Item** (in `Sidebar.tsx` around line 320):
```typescript
{
  name: "Physical Inventory",
  href: "/dashboard/physical-inventory",
  icon: ClipboardDocumentListIcon,
  permission: PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
},
```

**Solution**:
1. Go to **Administration > Roles & Permissions**
2. Edit the "Manager" role
3. **Uncheck** the permission: `inventory.physical.export`
4. Save changes

**Result**: Managers will no longer see "Physical Inventory" in the sidebar.

---

### Example 3: Hide "Print Labels" from All Roles Except Admin

**Goal**: Only allow Super Admins to see the Print Labels menu.

**Menu Item** (in `Sidebar.tsx` around line 326):
```typescript
{
  name: "Print Labels",
  href: "/dashboard/products/print-labels",
  icon: CubeIcon,
  permission: PERMISSIONS.PRODUCT_VIEW,
},
```

**Problem**: This menu uses `PERMISSIONS.PRODUCT_VIEW` which is too broad.

**Solution**:
1. **Create a new permission** in `src/lib/rbac.ts`:
   ```typescript
   PRODUCT_PRINT_LABELS: 'product.print_labels',
   ```

2. **Update the menu item** in `Sidebar.tsx`:
   ```typescript
   {
     name: "Print Labels",
     href: "/dashboard/products/print-labels",
     icon: CubeIcon,
     permission: PERMISSIONS.PRODUCT_PRINT_LABELS,  // Changed
   },
   ```

3. **Add the permission to roles** that should see it:
   - Go to **Administration > Roles & Permissions**
   - Edit "Super Admin" role
   - Add the new permission `product.print_labels`

**Result**: Only Super Admins will see "Print Labels" in the sidebar.

---

## Common Menu Items and Their Permissions

| Menu Item | Permission | Location in Code |
|-----------|-----------|------------------|
| Dashboard | `PERMISSIONS.DASHBOARD_VIEW` | Line 193 |
| Point of Sale | `PERMISSIONS.SELL_CREATE` | Line 220 |
| List Products | `PERMISSIONS.PRODUCT_VIEW` | Line 275 |
| Add Product | `PERMISSIONS.PRODUCT_CREATE` | Line 287 |
| Inventory Corrections | `PERMISSIONS.INVENTORY_CORRECTION_VIEW` | Line 317 |
| Physical Inventory | `PERMISSIONS.PHYSICAL_INVENTORY_EXPORT` | Line 323 |
| Print Labels | `PERMISSIONS.PRODUCT_VIEW` | Line 329 |
| Purchase Orders | `PERMISSIONS.PURCHASE_VIEW` | Line 439 |
| Stock Transfers | `PERMISSIONS.STOCK_TRANSFER_VIEW` | Line 501 |
| Users | `PERMISSIONS.USER_VIEW` | Line 1077 |
| Roles & Permissions | `PERMISSIONS.ROLE_VIEW` | Line 1083 |
| Business Locations | `PERMISSIONS.LOCATION_VIEW` | Line 1089 |

## Creating Custom Permissions

If you need more granular control over menu visibility, you can create custom permissions:

### Step 1: Define the Permission

Edit `src/lib/rbac.ts` and add your new permission to the `PERMISSIONS` object:

```typescript
export const PERMISSIONS = {
  // ... existing permissions ...

  // Custom permissions for menu visibility
  MENU_ANALYTICS_DASHBOARD: 'menu.analytics_dashboard',
  MENU_ADVANCED_REPORTS: 'menu.advanced_reports',
  MENU_ADMIN_TOOLS: 'menu.admin_tools',
} as const
```

### Step 2: Update the Menu Item

Edit `src/components/Sidebar.tsx` and add the permission to your menu item:

```typescript
{
  name: "Analytics Dashboard V2",
  href: "/dashboard/analytics-devextreme",
  icon: SparklesIcon,
  permission: PERMISSIONS.MENU_ANALYTICS_DASHBOARD,  // Use new permission
},
```

### Step 3: Add Permission to Roles

1. Go to **Administration > Roles & Permissions**
2. Edit each role that should see this menu item
3. Add the new permission (e.g., `menu.analytics_dashboard`)
4. Save changes

## Nested Menus (Parent + Children)

For menu items with children, both the parent and children can have separate permissions:

```typescript
{
  name: "Reports",  // Parent menu
  href: "/dashboard/reports",
  icon: ChartBarIcon,
  permission: PERMISSIONS.REPORT_VIEW,  // Parent permission
  children: [
    {
      name: "Sales Reports",  // Child menu
      href: "#",
      icon: ShoppingCartIcon,
      permission: PERMISSIONS.SALES_REPORT_VIEW,  // Child permission
      children: [
        {
          name: "Sales Today",  // Grandchild menu
          href: "/dashboard/reports/sales-today",
          icon: ChartBarIcon,
          permission: PERMISSIONS.REPORT_SALES_TODAY,  // Grandchild permission
        },
      ]
    }
  ]
}
```

**Behavior**:
- If user lacks `PERMISSIONS.REPORT_VIEW` → Entire "Reports" menu is hidden
- If user has `PERMISSIONS.REPORT_VIEW` but lacks `PERMISSIONS.SALES_REPORT_VIEW` → "Reports" shows, but "Sales Reports" is hidden
- If user has both parent and child permissions → All items are visible

## Testing Your Changes

After modifying permissions:

1. **Save your changes** in the Roles & Permissions page
2. **Log out** of the current session
3. **Log back in** as a user with the modified role
4. **Check the sidebar** - menu items should now be hidden/shown based on permissions

**Note**: Permissions are cached in the JWT session. Users must log out and log back in for permission changes to take effect.

## Troubleshooting

### Menu item is still visible after removing permission

**Solution**:
- Check if the menu item has the `permission` property set
- Verify the permission was removed from ALL roles the user has
- Make sure the user logged out and logged back in
- Clear browser cache

### Menu item is hidden even though user has permission

**Solution**:
- Verify the permission name in `Sidebar.tsx` matches exactly with `rbac.ts`
- Check that the role has the permission in the database (`RolePermission` table)
- Verify the user has the role in the database (`UserRole` table)

### Want to hide a menu item from everyone

**Solution**:
1. Remove the permission from all roles
2. Or, set a permission that doesn't exist in any role:
   ```typescript
   permission: "disabled.feature"
   ```

### Want to show a menu item to everyone

**Solution**:
Remove or comment out the `permission` property:
```typescript
{
  name: "Help Center",
  href: "/dashboard/help",
  icon: QuestionMarkCircleIcon,
  // No permission check - all users can access help
},
```

## Best Practices

1. **Use existing permissions** when possible instead of creating new ones
2. **Group related permissions** (e.g., all product-related permissions start with `PRODUCT_`)
3. **Document custom permissions** you create for future reference
4. **Test with different roles** before deploying to production
5. **Keep menu visibility aligned with API access** - if a menu is visible, the corresponding API endpoints should be accessible

## Security Note

**Important**: Menu visibility is a **UI convenience**, not a security feature. You must **always enforce permissions at the API level** in your route handlers:

```typescript
// Example: src/app/api/inventory-corrections/route.ts
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  // Always check permissions server-side
  if (!session?.user?.permissions.includes(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // ... proceed with request
}
```

Hiding a menu item does NOT prevent direct URL access. API-level permission checks are required for true security.

---

## Summary

To hide or show menu items:

1. Find the menu item in `src/components/Sidebar.tsx`
2. Identify its `permission` property
3. Go to **Administration > Roles & Permissions** in the UI
4. Edit the role you want to modify
5. Check/uncheck the permission
6. Save changes
7. Users must log out and log back in to see changes

**No separate "Menu Permissions" feature is needed** - the existing RBAC system handles everything.
