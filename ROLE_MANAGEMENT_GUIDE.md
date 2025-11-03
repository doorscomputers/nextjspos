# Role Management Guide

## Overview

This guide explains the comprehensive role management system created for UltimatePOS Modern. The system provides predefined roles with specific permissions and easy-to-use scripts for managing users and roles.

---

## User Accounts Created

### 1. **pcinetadmin**
- **Username**: `pcinetadmin`
- **Password**: `111111`
- **Role**: Super Admin
- **Location**: NULL (not location-specific)
- **Purpose**: Full administrative access without being tied to a specific location

**Capabilities:**
- ✅ View all reports across all locations
- ✅ Create/Edit/Delete Products, Categories, Brands, Units, Suppliers
- ✅ Manage Users and Permissions
- ✅ Configure System Settings
- ❌ Should not process location-based transactions (Sales, Purchases, Transfers)

### 2. **jayvillalon**
- **Username**: `jayvillalon`
- **Password**: `111111`
- **Role**: Reports Admin
- **Location**: NULL (not location-specific)
- **Purpose**: View-only access to all reports and data

**Capabilities:**
- ✅ View all reports (all locations)
- ✅ View products, customers, suppliers, sales, purchases, transfers
- ✅ View inventory levels and dashboards
- ❌ Cannot create, edit, or delete anything
- ❌ Cannot process transactions

### 3. **jheiron** (Updated)
- **Username**: `Jheiron`
- **Password**: `111111`
- **Role**: Warehouse Manager
- **Location**: Assigned to specific warehouse location
- **Purpose**: Full warehouse and inventory management

**Capabilities:**
- ✅ View/Create/Edit/Delete Products
- ✅ View/Create/Edit/Delete Categories, Brands, Units, Suppliers
- ✅ View/Create/Approve/Edit Purchases
- ✅ View/Create/Approve/Send/Receive Transfers
- ✅ Edit Product Prices
- ✅ View Stock Levels and Reports
- ❌ Cannot process sales

---

## Available Roles

### 1. **Super Admin**
- **Permissions**: 345 (all permissions)
- **Location Required**: No
- **Description**: Full system access

### 2. **System Administrator**
- **Permissions**: 345 (all permissions)
- **Location Required**: No
- **Description**: Same as Super Admin

### 3. **Reports Admin**
- **Permissions**: 13 view/report permissions
- **Location Required**: No
- **Description**: View all reports and data - no modifications

### 4. **Warehouse Manager** ⭐
- **Permissions**: 42
- **Location Required**: Yes
- **Description**: Full warehouse operations

**Specific Capabilities:**
- Product Management (CRUD)
- Category/Brand/Unit Management (CRUD)
- Supplier Management (CRUD)
- Purchase Operations (Create, Approve, View Reports)
- Transfer Operations (Create, Approve, Send, Receive)
- Price Management
- Stock Viewing
- Purchase & Transfer Reports

### 5. **Sales Cashier** ⭐
- **Permissions**: 9
- **Location Required**: Yes
- **Description**: POS operations only

**Specific Capabilities:**
- View Products (retail price only, no cost)
- Process Sales
- View Own Sales Reports
- Add Walk-in Customers
- **Note**: Cannot see product costs or wholesale prices

### 6. **Price Manager**
- **Permissions**: 11
- **Location Required**: No
- **Description**: Manage product pricing

**Specific Capabilities:**
- View Products
- Edit Prices (single and bulk)
- View Product Costs
- Cannot create/delete products

### 7. **Transfer Creator**
- **Permissions**: 6
- **Location Required**: Yes
- **Description**: Create stock transfer requests

### 8. **Transfer Approver**
- **Permissions**: 5
- **Location Required**: Yes
- **Description**: Approve stock transfer requests

### 9. **Transfer Sender**
- **Permissions**: 5
- **Location Required**: Yes
- **Description**: Mark transfers as sent

### 10. **Transfer Receiver**
- **Permissions**: 5
- **Location Required**: Yes
- **Description**: Receive incoming transfers

### 11. **Transfer Manager**
- **Permissions**: 11
- **Location Required**: Yes
- **Description**: Full transfer operations

### 12. **Inventory Auditor**
- **Permissions**: 7
- **Location Required**: No
- **Description**: View and audit inventory - read-only

---

## How to Create/Update Roles

### Method 1: Using Predefined Role Definitions

1. **View Available Roles**:
```bash
npx tsx scripts/create-role-from-definition.ts
```

2. **Create a Specific Role**:
```bash
npx tsx scripts/create-role-from-definition.ts WAREHOUSE_MANAGER
npx tsx scripts/create-role-from-definition.ts SALES_CASHIER
npx tsx scripts/create-role-from-definition.ts PRICE_MANAGER
```

3. **Update Existing Role**:
Same command - script will update if role already exists

### Method 2: Using Direct Scripts

**Update Warehouse Manager**:
```bash
npx tsx scripts/update-warehouse-manager-role.ts
```

**Create Custom User**:
```bash
npx tsx scripts/create-jay-villalon.ts
npx tsx scripts/create-pcinetadmin.ts
```

---

## Role Definitions File

All roles are defined in: `scripts/role-definitions.ts`

**To Add a New Role**:

```typescript
MY_CUSTOM_ROLE: {
  name: 'My Custom Role',
  description: 'Description of what this role does',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    // ... add more permissions
  ],
  isDefault: false,
  locationRequired: true  // or false
}
```

**Then create it**:
```bash
npx tsx scripts/create-role-from-definition.ts MY_CUSTOM_ROLE
```

---

## Permission Categories

### Product Permissions
- `product.view` - View products
- `product.create` - Create products
- `product.update` - Edit products
- `product.delete` - Delete products
- `product.price.view` - View prices
- `product.price.edit` - Edit prices
- `product.cost.view` - View costs

### Sales Permissions
- `sale.view` - View sales
- `sale.create` - Create sales
- `sale.update` - Edit sales
- `sale.delete` - Delete sales

### Purchase Permissions
- `purchase.view` - View purchases
- `purchase.create` - Create purchases
- `purchase.approve` - Approve purchases
- `purchase.update` - Edit purchases
- `purchase.delete` - Delete purchases

### Transfer Permissions
- `transfer.view` - View transfers
- `transfer.create` - Create transfers
- `transfer.approve` - Approve transfers
- `transfer.send` - Send transfers
- `transfer.receive` - Receive transfers

### Report Permissions
- `report.view` - View reports
- `report.purchase.items` - Purchase reports

---

## Best Practices

### 1. **Location-Based Roles**
- Assign users to roles that require a location (Cashier, Warehouse Manager)
- Users must have `locationId` set in their user record

### 2. **Admin Roles Without Location**
- Use for administrators who need to view all locations
- Set `locationId` to NULL
- Cannot process transactions (Sales, Purchases, Transfers)

### 3. **Sales Cashier Cost Hiding**
- Sales Cashier role is configured to NOT see product costs
- Only sees retail prices
- Implement UI-level hiding in addition to permission checks

### 4. **Own Sales Only**
- Sales Cashier should only see their own sales
- Implement additional filtering in sales reports API

### 5. **Menu Visibility**
- Use menu permissions to hide irrelevant menus
- Example: Hide "Purchases" menu from Sales Cashiers

---

## User Management Scripts

### Diagnostic Tools

**Check All User Permissions**:
```bash
npx tsx scripts/fix-user-permissions.ts
```

**Sync User Permissions with Roles**:
```bash
npx tsx scripts/sync-user-role-permissions.ts
```

**Fix Super Admin Permissions**:
```bash
npx tsx scripts/fix-super-admin-permissions.ts
```

**Create Missing Permissions**:
```bash
npx tsx scripts/create-missing-permissions.ts
```

---

## Troubleshooting

### User Cannot Access Features

1. **Check User Permissions**:
```bash
npx tsx scripts/fix-user-permissions.ts
```

2. **Sync Permissions with Role**:
```bash
npx tsx scripts/sync-user-role-permissions.ts
```

3. **Verify Role Has Permissions**:
- Check `role_permission` table
- Run role creation script again

### Role Missing Permissions

1. **Update Role from Definition**:
```bash
npx tsx scripts/create-role-from-definition.ts ROLE_NAME
```

2. **Or Create Custom Update Script**:
- Copy `update-warehouse-manager-role.ts`
- Modify for your role

---

## Summary

### Quick Reference

| User | Username | Password | Role | Location | Purpose |
|------|----------|----------|------|----------|---------|
| PciNet Admin | `pcinetadmin` | `111111` | Super Admin | NULL | Full admin, no transactions |
| Jay Villalon | `jayvillalon` | `111111` | Reports Admin | NULL | View-only all reports |
| Jheiron | `Jheiron` | `111111` | Warehouse Manager | Assigned | Full warehouse ops |

### Most Common Operations

```bash
# Create new role
npx tsx scripts/create-role-from-definition.ts WAREHOUSE_MANAGER

# Check all user permissions
npx tsx scripts/fix-user-permissions.ts

# Sync user with role permissions
npx tsx scripts/sync-user-role-permissions.ts

# Fix admin permissions
npx tsx scripts/fix-super-admin-permissions.ts
```

---

## Notes

- All passwords are `111111` for demo/testing
- Users should logout and login after permission changes
- Location-based transactions require `locationId` in user record
- Some permissions like "view own sales only" require additional API filtering
- Cost hiding for cashiers requires both permission and UI-level implementation

---

*Last Updated: 2025-03-11*
