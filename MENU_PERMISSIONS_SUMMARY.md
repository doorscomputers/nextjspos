# Menu Permissions System - Quick Reference

## ✅ What Was Fixed

1. **Jay's Missing Menus** - Assigned 33 menu permissions to "Cross-Location Approver" role
2. **UI Menu Manager** - Created user-friendly interface at `/dashboard/settings/user-menu-manager`
3. **Route Protection** - Added `RouteProtection` component to prevent unauthorized URL access
4. **API Endpoints** - Created PUT endpoints for easy menu assignment via API

---

## 🚀 Quick Actions

### Assign Menus to a User (UI Method)

1. Go to: **Settings → User Menu Manager** (`/dashboard/settings/user-menu-manager`)
2. Click "By User" tab
3. Select user from dropdown
4. Check the menus they should see
5. Click "Save User Menus"
6. **User must log out and log back in**

### Assign Menus to a Role (UI Method)

1. Go to: **Settings → User Menu Manager** (`/dashboard/settings/user-menu-manager`)
2. Click "By Role" tab
3. Select role from dropdown
4. Check the menus that role should see
5. Click "Save Role Menus"
6. **All users with that role must log out and log back in**

### Assign Menus via Script (Advanced)

```bash
# Check a user's current menu permissions
npx tsx scripts/check-menu-permissions-jayvillalon.ts

# Fix a specific role's menus
npx tsx scripts/fix-cross-location-approver-menus.ts
```

---

## 🛡️ Protect New Routes

### Option 1: Wrap Page Content (Recommended)

```tsx
import { RouteProtection } from "@/components/RouteProtection"

export default function MyNewPage() {
  return (
    <RouteProtection requiredMenuKey="purchases">
      <div className="p-6">
        Your page content here
      </div>
    </RouteProtection>
  )
}
```

### Option 2: Higher-Order Component

```tsx
import { withRouteProtection } from "@/components/RouteProtection"

function MyNewPage() {
  return <div>Your page content</div>
}

export default withRouteProtection(MyNewPage, 'purchases')
```

---

## 📋 Available Menu Keys

Here are the main menu keys you can use in `requiredMenuKey`:

| Menu Key | Description |
|----------|-------------|
| `dashboard` | Dashboard home |
| `products` | Products menu |
| `purchases` | Purchases parent menu |
| `purchases_list` | List Purchases submenu |
| `purchases_add` | Add Purchase submenu |
| `goods_received` | Goods Received (GRN) |
| `pos_sales` | POS & Sales parent menu |
| `point_of_sale` | Point of Sale |
| `z_reading` | Z Reading |
| `stock_transfers` | Stock Transfers parent |
| `all_transfers` | All Transfers list |
| `create_transfer` | Create Transfer |
| `reports` | Reports parent menu |
| `sales_reports` | Sales Reports section |
| `purchase_reports` | Purchase Reports section |
| `inventory_reports` | Inventory Reports section |

**Full list:** Check database table `MenuPermission` or use the UI menu manager to see all available menus.

---

## 🔧 Troubleshooting

### Problem: User can't see sidebar menus

**Solution:**
1. Go to User Menu Manager
2. Assign menus to user's role or directly to user
3. User must log out and log back in

### Problem: User sees menu but can't access page

**Solution:**
- Page needs `RouteProtection` wrapper
- Check `requiredMenuKey` matches menu's key in database

### Problem: User can access page by typing URL

**Solution:**
- Add `RouteProtection` component to the page
- See examples above

### Problem: API returns 403 even with menu access

**Solution:**
- User has menu permission but lacks RBAC permission
- Assign both menu AND RBAC permissions

---

## 📊 Database Tables

### MenuPermission
- Stores all available menu items
- Fields: `id`, `key`, `name`, `href`, `parentId`, `order`

### RoleMenuPermission
- Links roles to menus
- Fields: `roleId`, `menuPermissionId`

### UserMenuPermission
- Links users to menus (overrides role)
- Fields: `userId`, `menuPermissionId`

---

## 🎯 Important Notes

1. **Two Permission Systems:**
   - **Menu Permissions** = Controls sidebar visibility
   - **RBAC Permissions** = Controls API access
   - Both are required for full access

2. **Changes Require Re-login:**
   - Menu permissions are cached in session
   - Users must log out and log back in to see changes

3. **Parent + Child Menus:**
   - Assigning parent menu does NOT automatically assign children
   - Use "Select All" button in UI to assign all at once

4. **Never Run Seed Commands:**
   - Seeding resets ALL menu assignments
   - Use UI or targeted scripts only
   - If you must seed, backup `RoleMenuPermission` and `UserMenuPermission` tables first

---

## 📚 Full Documentation

See `docs/MENU_PERMISSIONS_GUIDE.md` for complete documentation including:
- System architecture
- API endpoint details
- Database schema
- Migration guides
- Best practices

---

## 🎉 What's Now Possible

1. ✅ **Easy Menu Management:** Use UI to assign menus without code
2. ✅ **Route Protection:** Users can't access routes by typing URL
3. ✅ **Role-Based Menus:** Configure once per role, applies to all users
4. ✅ **User Overrides:** Give specific users extra menus
5. ✅ **No More Lost Config:** UI-based changes won't be lost to seed scripts

---

## 🔮 Future Enhancements (Optional)

- [ ] Real-time menu refresh (no logout required)
- [ ] Menu permission history/audit log
- [ ] Bulk user menu assignment
- [ ] Export/import menu configurations
- [ ] API-level route protection (currently page-level only)
