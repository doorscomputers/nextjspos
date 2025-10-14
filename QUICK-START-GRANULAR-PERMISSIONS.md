# Quick Start: Granular Permissions System

## What Changed?

### Product Master Data 🏷️
**Before**: Cashiers could edit Categories, Brands, Units, Warranties (used `PRODUCT_VIEW`)
**After**: Only Branch Admins can edit. Branch Managers can view only. Cashiers have NO access.

### Reports 📊
**Before**: Anyone with `REPORT_VIEW` could see ALL reports
**After**: Granular control:
- **Cashiers**: NO reports
- **Regular Staff**: Sales reports only
- **Branch Managers**: Sales + Transfer reports
- **Accounting Staff**: Purchase + Financial reports
- **Branch Admins**: All reports

---

## Quick Migration (3 Steps)

### Step 1: Run Migration Script
```bash
node scripts/add-granular-permissions.js
```

### Step 2: Test with Different Roles
Login as each role and verify:
- ✅ Cashiers CANNOT see Categories/Brands/Units/Warranties
- ✅ Cashiers CANNOT see any Reports
- ✅ Branch Managers can VIEW master data but not edit
- ✅ Accounting sees Purchase reports, NOT Sales reports
- ✅ Sales staff sees Sales reports, NOT Purchase reports

### Step 3: Done! 🎉

---

## Permission Summary by Role

| Role | Product Master Data | Reports Access |
|------|-------------------|----------------|
| 💵 **Cashier** | ❌ None | ❌ None |
| 👤 **Regular Staff** | ❌ None | Sales only |
| 📊 **Branch Manager** | 👁️ View Only | Sales + Transfer |
| 💰 **Accounting** | ❌ None | Purchase + Financial |
| 🏢 **Branch Admin** | ✅ Full CRUD | All Reports |
| 👑 **Super Admin** | ✅ Full CRUD | All Reports |

---

## Best Practice Recommendation ⭐

### For Warehouse/Inventory Management:
Assign **Branch Admin** role to warehouse supervisors so they can:
- ✅ Manage Categories, Brands, Units, Warranties (centralized)
- ✅ Create and manage products
- ✅ View all reports for inventory decisions

### For Cashiers:
Keep **Regular Cashier** role - they should:
- ✅ Process sales transactions
- ✅ Manage cash and shifts
- ❌ NOT modify master data
- ❌ NOT view reports (no need for their job)

---

## Files Modified

1. ✅ `src/lib/rbac.ts` - Added 30 new permissions
2. ✅ `src/components/Sidebar.tsx` - Updated menu permissions
3. ✅ `scripts/add-granular-permissions.js` - Migration script
4. ✅ `GRANULAR-PERMISSIONS-GUIDE.md` - Full documentation

---

## Troubleshooting

**Q: Sidebar menu items disappeared after migration?**
A: Run migration script: `node scripts/add-granular-permissions.js`

**Q: Super Admin lost access?**
A: Verify role name is exactly "Super Admin" (capital S, capital A)

**Q: Want custom permissions for a role?**
A: Update `src/lib/rbac.ts` DEFAULT_ROLES, then re-run migration script

---

## Result

✅ **Centralized master data management** - Only admins modify Categories/Brands/Units/Warranties
✅ **Department-specific reports** - Sales team sees sales, accounting sees finances
✅ **Secure cashier access** - Focused on transactions, no configuration access
✅ **Enterprise-grade RBAC** - Proper segregation of duties

**Your system is now production-ready with best-practice access control!** 🚀
