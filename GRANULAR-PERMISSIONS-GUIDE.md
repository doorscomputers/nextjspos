# Granular Permissions System - Implementation Guide

## Overview

This guide documents the implementation of granular permission controls for **Product Master Data** and **Reports** to ensure proper role-based access control and data centralization.

## Problem Statement

### Before Implementation:
1. **Product Master Data Issue**: Categories, Brands, Units, and Warranties all used `PERMISSIONS.PRODUCT_VIEW`, allowing cashiers who could view products to also modify master data.
2. **Reports Issue**: All reports used a single `PERMISSIONS.REPORT_VIEW`, giving users access to all reports without granular control.

### After Implementation:
✅ Separate permissions for each product master data type
✅ Granular permissions for different report categories
✅ Role-based restrictions ensuring proper access control

---

## New Permissions Added

### Product Master Data Permissions (16 total)

#### Categories
- `product.category.view` - View product categories
- `product.category.create` - Create product categories
- `product.category.update` - Update product categories
- `product.category.delete` - Delete product categories

#### Brands
- `product.brand.view` - View product brands
- `product.brand.create` - Create product brands
- `product.brand.update` - Update product brands
- `product.brand.delete` - Delete product brands

#### Units
- `product.unit.view` - View product units
- `product.unit.create` - Create product units
- `product.unit.update` - Update product units
- `product.unit.delete` - Delete product units

#### Warranties
- `product.warranty.view` - View product warranties
- `product.warranty.create` - Create product warranties
- `product.warranty.update` - Update product warranties
- `product.warranty.delete` - Delete product warranties

### Report Permissions (14 total)

#### Sales Reports
- `report.sales.view` - View sales reports
- `report.sales.daily` - View daily sales reports
- `report.sales.profitability` - View sales profitability reports

#### Purchase Reports
- `report.purchase.view` - View purchase reports
- `report.purchase.analytics` - View purchase analytics
- `report.purchase.trends` - View purchase trend reports
- `report.purchase.items` - View purchase items report

#### Transfer Reports
- `report.transfer.view` - View transfer reports
- `report.transfer.trends` - View transfer trend reports

#### Financial Reports
- `report.profitability` - View profitability & COGS reports
- `report.product_purchase_history` - View product purchase history

#### Stock Reports
- `report.stock_alert` - View stock alert reports
- `report.stock.view` - View stock reports (legacy)

---

## Role Permissions Matrix

| Permission Type | Super Admin | Branch Admin | Branch Manager | Accounting Staff | Regular Staff | Regular Cashier |
|----------------|-------------|--------------|----------------|------------------|---------------|-----------------|
| **Product Master Data** |
| Categories (CRUD) | ✅ All | ✅ All | 👁️ View Only | ❌ None | ❌ None | ❌ None |
| Brands (CRUD) | ✅ All | ✅ All | 👁️ View Only | ❌ None | ❌ None | ❌ None |
| Units (CRUD) | ✅ All | ✅ All | 👁️ View Only | ❌ None | ❌ None | ❌ None |
| Warranties (CRUD) | ✅ All | ✅ All | 👁️ View Only | ❌ None | ❌ None | ❌ None |
| **Reports** |
| Sales Reports | ✅ All | ✅ All | ✅ Yes | ❌ None | ✅ Yes | ❌ None |
| Purchase Reports | ✅ All | ✅ All | ❌ None | ✅ Yes | ❌ None | ❌ None |
| Transfer Reports | ✅ All | ✅ All | ✅ Yes | ❌ None | ❌ None | ❌ None |
| Financial Reports | ✅ All | ✅ All | ❌ None | ✅ Yes | ❌ None | ❌ None |
| Stock Reports | ✅ All | ✅ All | ✅ Yes | ✅ Yes | ✅ Yes | ❌ None |

---

## Role Descriptions

### 👑 Super Admin
- **Access**: ALL permissions automatically
- **Purpose**: Platform owner with unrestricted access
- **Master Data**: Full CRUD access
- **Reports**: Access to all reports

### 🏢 Branch Admin
- **Access**: Full business management
- **Purpose**: Complete control over business operations
- **Master Data**: Full CRUD access to centralize data management
- **Reports**: Access to all report types

### 📊 Branch Manager
- **Access**: Operations and sales focused
- **Purpose**: Manage daily operations and monitor performance
- **Master Data**: View-only (cannot modify master data)
- **Reports**: Sales, Stock, and Transfer reports only (no financial/purchase reports)

### 💰 Accounting Staff
- **Access**: Financial operations focused
- **Purpose**: Handle accounting, payments, and financial analysis
- **Master Data**: No access (doesn't need to modify master data)
- **Reports**: Purchase and Financial reports only (no sales reports)

### 👤 Regular Staff
- **Access**: Basic sales operations
- **Purpose**: Process sales and serve customers
- **Master Data**: No access
- **Reports**: Basic sales and stock alert reports only

### 💵 Regular Cashier
- **Access**: POS operations only
- **Purpose**: Process transactions, manage shifts, handle cash
- **Master Data**: **NO ACCESS** (intentionally restricted)
- **Reports**: **NO ACCESS** (intentionally restricted)
- **Rationale**: Cashiers should focus on transactions, not data analysis or master data changes

---

## Implementation Files Changed

### 1. `src/lib/rbac.ts`
- Added 30 new permission constants
- Updated `DEFAULT_ROLES` with granular permissions
- Added detailed role permission assignments

### 2. `src/components/Sidebar.tsx`
- Updated Product submenu permissions:
  - Categories: `PERMISSIONS.PRODUCT_CATEGORY_VIEW`
  - Brands: `PERMISSIONS.PRODUCT_BRAND_VIEW`
  - Units: `PERMISSIONS.PRODUCT_UNIT_VIEW`
  - Warranties: `PERMISSIONS.PRODUCT_WARRANTY_VIEW`
- Updated Report submenu permissions:
  - Each report now uses specific permission
  - Examples: `PERMISSIONS.REPORT_SALES_VIEW`, `PERMISSIONS.REPORT_PURCHASE_VIEW`

### 3. `scripts/add-granular-permissions.js`
- Migration script to add new permissions to database
- Automatically assigns permissions to existing roles
- Idempotent (safe to run multiple times)

---

## Installation & Migration

### Step 1: Run the Migration Script

```bash
node scripts/add-granular-permissions.js
```

This will:
1. ✅ Add 30 new permissions to the `Permission` table
2. ✅ Assign permissions to existing roles based on role names
3. ✅ Skip permissions that already exist (idempotent)
4. ✅ Provide detailed migration summary

### Step 2: Verify Changes

1. **Login as different roles** to test sidebar visibility
2. **Check Product Menu**:
   - Cashiers should NOT see Categories, Brands, Units, Warranties
   - Branch Managers should see them but may need separate edit permissions
   - Branch Admins should see all
3. **Check Reports Menu**:
   - Cashiers should NOT see any reports
   - Branch Managers should see Sales and Transfer reports only
   - Accounting Staff should see Purchase and Financial reports only
   - Branch Admins should see all reports

### Step 3: Test Access Control

```javascript
// Test as Regular Cashier
// Expected: NO access to /dashboard/products/categories
// Expected: NO access to /dashboard/reports/*

// Test as Branch Manager
// Expected: Can VIEW /dashboard/products/categories but cannot edit
// Expected: Can access /dashboard/reports/sales-report
// Expected: CANNOT access /dashboard/reports/purchases-report

// Test as Accounting Staff
// Expected: NO access to /dashboard/products/categories
// Expected: CANNOT access /dashboard/reports/sales-report
// Expected: Can access /dashboard/reports/purchases-report
```

---

## Best Practices

### ✅ DO:
1. **Centralize Master Data Management** - Only Branch Admin and Warehouse users should modify Categories, Brands, Units, Warranties
2. **Separate Report Access by Department** - Sales staff see sales reports, accounting sees financial reports
3. **Use Least Privilege Principle** - Only grant permissions necessary for the role
4. **Test After Changes** - Always test with different role accounts after permission changes

### ❌ DON'T:
1. **Give Cashiers Master Data Access** - They should focus on transactions, not configuration
2. **Mix Report Permissions** - Sales staff don't need to see purchase costs
3. **Grant `REPORT_VIEW` to All** - Use specific report permissions instead
4. **Skip Migration Testing** - Always verify permissions work as expected

---

## Troubleshooting

### Issue: Sidebar menu items not showing up
**Solution**:
1. Check user's role permissions in database
2. Verify permission names match exactly (case-sensitive)
3. Clear browser cache and re-login
4. Check `src/components/Sidebar.tsx` permission mappings

### Issue: Migration script fails
**Solution**:
1. Ensure database connection is active
2. Check Prisma schema is up to date: `npx prisma generate`
3. Verify no duplicate permissions in database
4. Run script again (it's idempotent)

### Issue: Existing users lost access
**Solution**:
1. Re-run migration script: `node scripts/add-granular-permissions.js`
2. Check role assignments: Users may have been assigned wrong role
3. Verify role-permission mappings in `RolePermission` table

### Issue: Super Admin doesn't have access
**Solution**:
Super Admin should have access to everything automatically via `isSuperAdmin()` check. If not:
1. Verify user has role name "Super Admin" (exact match)
2. Check `src/lib/rbac.ts` `hasPermission()` function includes Super Admin bypass
3. Verify session includes correct role information

---

## Future Enhancements

### Possible Extensions:
1. **Field-Level Permissions** - Control access to specific form fields (e.g., cost price)
2. **Time-Based Permissions** - Restrict certain operations to business hours
3. **Approval Workflows** - Require manager approval for sensitive operations
4. **Audit Logging** - Track who accessed what and when
5. **Custom Roles** - Allow businesses to create their own roles with custom permissions

---

## Summary

This implementation provides **best-practice role-based access control** with:
- ✅ **30 new granular permissions**
- ✅ **Centralized master data management** (only admins can edit)
- ✅ **Department-specific report access** (sales, accounting, management)
- ✅ **Secure cashier access** (POS only, no master data or reports)
- ✅ **Easy migration** (one script to update everything)
- ✅ **Scalable architecture** (easy to add more permissions)

**Result**: Your POS system now has enterprise-grade access control with proper segregation of duties! 🎉

---

## Questions?

If you encounter issues or need clarification:
1. Review this guide
2. Check the migration script output
3. Verify role assignments in database
4. Test with different user accounts
5. Consult `src/lib/rbac.ts` for permission definitions

**Remember**: Always test permission changes in a development environment first! 🚀
