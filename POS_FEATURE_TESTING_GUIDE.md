# UltimatePOS Modern - Comprehensive Feature Testing Guide

## Overview

This document provides comprehensive testing guidance for all major features in the UltimatePOS Modern system. Each feature includes manual testing steps, database verification queries, and automated test recommendations.

---

## Table of Contents

1. [Product Management](#1-product-management)
2. [Inventory Management](#2-inventory-management)
3. [Sales Transactions](#3-sales-transactions)
4. [Purchase Orders](#4-purchase-orders)
5. [Inventory Transfers](#5-inventory-transfers)
6. [Point of Sale (POS)](#6-point-of-sale-pos)
7. [Reports](#7-reports)
8. [User Management & RBAC](#8-user-management--rbac)
9. [Multi-Tenant Features](#9-multi-tenant-features)

---

## 1. Product Management

### Features to Test
- Create/Read/Update/Delete products
- Product variations (size, color, etc.)
- Multi-location stock tracking
- Opening stock management
- Product activation/deactivation
- Barcode generation
- Product import from CSV

### Manual Testing Steps

#### Create Product
1. Navigate to `/dashboard/products/add`
2. Fill in product details (name, SKU, category, brand, unit)
3. Set purchase and selling prices
4. Select locations for stock management
5. Click "Save"
6. ✅ Product should appear in product list
7. ✅ Toast notification should confirm success

#### Product Variations
1. Edit an existing product
2. Change type to "Variable"
3. Add variation attributes (e.g., Size: Small, Medium, Large)
4. Set prices for each variation
5. Save
6. ✅ Variations should be listed separately in stock grid

#### Database Verification
```sql
-- Check product creation
SELECT * FROM products WHERE sku = 'YOUR-TEST-SKU' AND deleted_at IS NULL;

-- Check variations
SELECT pv.*, p.name as product_name
FROM product_variations pv
JOIN products p ON pv.product_id = p.id
WHERE p.sku = 'YOUR-TEST-SKU';

-- Check stock records
SELECT vld.*, bl.name as location_name
FROM variation_location_details vld
JOIN business_locations bl ON vld.location_id = bl.id
WHERE vld.product_id = [PRODUCT_ID];
```

### Automated Test Coverage
- File: `e2e/product-stock.spec.ts`
- Tests: 25+ scenarios including CRUD, validation, multi-location

---

## 2. Inventory Management

### Features to Test
- Opening stock (initial stock setup)
- Stock adjustments/corrections
- Physical inventory import
- Inventory ledger (transaction history)
- Stock transfers between locations
- Reorder point calculations

### Manual Testing Steps

#### Opening Stock
1. Navigate to product details
2. Click "Set Opening Stock"
3. Enter quantities for each location
4. Save
5. ✅ Stock should appear in variation location details
6. ✅ Stock History should record opening stock transaction

#### Inventory Correction
1. Navigate to `/dashboard/inventory-corrections/new`
2. Select location
3. Scan or select products
4. Enter corrected quantities
5. Add reason
6. Submit for approval
7. ✅ Should require approval from authorized user
8. ✅ After approval, stock should update

#### Database Verification
```sql
-- Check opening stock
SELECT * FROM stock_history
WHERE transaction_type = 'opening_stock'
AND product_variation_id = [VARIATION_ID]
ORDER BY created_at DESC;

-- Check inventory corrections
SELECT ic.*, u.username as created_by_name
FROM inventory_corrections ic
JOIN users u ON ic.created_by = u.id
WHERE ic.status = 'pending'
ORDER BY ic.created_at DESC;

-- Check stock movements
SELECT sh.*, p.name, pv.name as variation
FROM stock_history sh
JOIN products p ON sh.product_id = p.id
JOIN product_variations pv ON sh.product_variation_id = pv.id
WHERE sh.location_id = [LOCATION_ID]
ORDER BY sh.created_at DESC
LIMIT 50;
```

### Automated Test Coverage
- File: `e2e/opening-stock.spec.ts`
- File: `e2e/inventory-corrections-barcode.spec.ts`
- File: `e2e/physical-inventory-import.spec.ts`

---

## 3. Sales Transactions

### Features to Test
- POS sales creation
- Invoice generation
- Payment methods (cash, card, credit)
- Sales returns/refunds
- Void transactions
- Inventory deduction on sale

### Manual Testing Steps

#### Create Sale
1. Navigate to `/dashboard/pos` or `/dashboard/sales/create`
2. Select customer
3. Add products to cart
4. Apply discount if needed
5. Select payment method
6. Complete sale
7. ✅ Invoice should print/display
8. ✅ Stock should decrease
9. ✅ Sale should appear in sales list

#### Sales Return
1. Navigate to sale details
2. Click "Return"
3. Select items to return
4. Enter reason
5. Submit return
6. ✅ Return should require approval
7. ✅ After approval, stock should increase
8. ✅ Customer credit or refund should process

#### Database Verification
```sql
-- Check sale record
SELECT s.*, c.name as customer_name, u.username as cashier
FROM sales s
JOIN customers c ON s.customer_id = c.id
JOIN users u ON s.created_by = u.id
WHERE s.invoice_number = 'INV-XXXX';

-- Check sale items
SELECT si.*, p.name, pv.name as variation
FROM sale_items si
JOIN products p ON si.product_id = p.id
JOIN product_variations pv ON si.product_variation_id = pv.id
WHERE si.sale_id = [SALE_ID];

-- Check stock reduction
SELECT * FROM stock_history
WHERE transaction_type = 'sale'
AND transaction_id = [SALE_ID]
ORDER BY created_at DESC;

-- Verify inventory deducted correctly
SELECT vld.qty_available, sh.quantity_out
FROM variation_location_details vld
LEFT JOIN stock_history sh ON vld.product_variation_id = sh.product_variation_id
WHERE sh.transaction_type = 'sale' AND sh.transaction_id = [SALE_ID];
```

### Automated Test Coverage
- File: `e2e/sales-comprehensive.spec.ts`
- File: `e2e/pos-workflow.spec.ts`

---

## 4. Purchase Orders

### Features to Test
- Purchase order creation
- Purchase receipts (GRN - Goods Receipt Note)
- Receipt approval workflow
- Purchase returns to supplier
- Inventory increase on receipt approval

### Manual Testing Steps

#### Create Purchase Order
1. Navigate to `/dashboard/purchases/create`
2. Select supplier
3. Select location
4. Add products with quantities
5. Set purchase prices
6. Save as draft or submit
7. ✅ PO should appear in purchases list

#### Receive Purchase (GRN)
1. Navigate to purchase order
2. Click "Receive"
3. Create receipt with received quantities
4. Add serial numbers if applicable
5. Submit receipt
6. ✅ Receipt should be pending approval
7. Approve receipt (if authorized)
8. ✅ Stock should increase
9. ✅ Stock History should record transaction

#### Purchase Return
1. Navigate to approved purchase receipt
2. Click "Return to Supplier"
3. Select items to return
4. Enter reason
5. Submit return
6. ✅ Return should require approval
7. ✅ After approval, stock should decrease

#### Database Verification
```sql
-- Check purchase order
SELECT po.*, s.name as supplier_name, bl.name as location_name
FROM purchases po
JOIN suppliers s ON po.supplier_id = s.id
JOIN business_locations bl ON po.location_id = bl.id
WHERE po.purchase_number = 'PO-XXXX';

-- Check purchase receipt
SELECT pr.*, po.purchase_number
FROM purchase_receipts pr
JOIN purchases po ON pr.purchase_id = po.id
WHERE pr.status = 'approved'
ORDER BY pr.created_at DESC;

-- Check stock increase
SELECT sh.*, p.name, pv.name as variation
FROM stock_history sh
JOIN products p ON sh.product_id = p.id
JOIN product_variations pv ON sh.product_variation_id = pv.id
WHERE sh.transaction_type = 'purchase_receipt'
AND sh.transaction_id = [RECEIPT_ID];

-- Verify inventory increased correctly
SELECT vld.qty_available, sh.quantity_in
FROM variation_location_details vld
JOIN stock_history sh ON vld.product_variation_id = sh.product_variation_id
WHERE sh.transaction_type = 'purchase_receipt'
AND sh.transaction_id = [RECEIPT_ID]
AND vld.location_id = sh.location_id;
```

### Automated Test Coverage
- File: `e2e/purchases-comprehensive.spec.ts`
- File: `e2e/purchases-critical.spec.ts`
- File: `e2e/direct-grn.spec.ts`

---

## 5. Inventory Transfers

### Features to Test
- Transfer creation
- Transfer send workflow
- Transfer receive workflow
- Two-step verification (sender + receiver)
- Stock movement between locations
- Transfer status tracking

### Manual Testing Steps

#### Create Transfer
1. Navigate to `/dashboard/transfers/create`
2. Select source location (from)
3. Select destination location (to)
4. Add products with transfer quantities
5. Save transfer
6. ✅ Transfer should be in "pending" status

#### Send Transfer
1. Navigate to transfer details
2. Click "Send Transfer"
3. Verify items
4. Confirm send
5. ✅ Transfer status should change to "in_transit"
6. ✅ Stock should decrease at source location

#### Receive Transfer
1. Login as user at destination location
2. Navigate to transfer details
3. Click "Receive Transfer"
4. Verify received quantities
5. Confirm receipt
6. ✅ Transfer status should change to "completed"
7. ✅ Stock should increase at destination location

#### Database Verification
```sql
-- Check transfer record
SELECT t.*,
       bl_from.name as from_location,
       bl_to.name as to_location,
       u_created.username as created_by_name,
       u_sent.username as sent_by_name,
       u_received.username as received_by_name
FROM transfers t
JOIN business_locations bl_from ON t.from_location_id = bl_from.id
JOIN business_locations bl_to ON t.to_location_id = bl_to.id
LEFT JOIN users u_created ON t.created_by = u_created.id
LEFT JOIN users u_sent ON t.sent_by = u_sent.id
LEFT JOIN users u_received ON t.received_by = u_received.id
WHERE t.transfer_number = 'TR-XXXX';

-- Check transfer items
SELECT ti.*, p.name, pv.name as variation
FROM transfer_items ti
JOIN products p ON ti.product_id = p.id
JOIN product_variations pv ON ti.product_variation_id = pv.id
WHERE ti.transfer_id = [TRANSFER_ID];

-- Check stock movements (OUT from source)
SELECT * FROM stock_history
WHERE transaction_type = 'transfer_out'
AND transaction_id = [TRANSFER_ID]
ORDER BY created_at DESC;

-- Check stock movements (IN to destination)
SELECT * FROM stock_history
WHERE transaction_type = 'transfer_in'
AND transaction_id = [TRANSFER_ID]
ORDER BY created_at DESC;

-- Verify stock balance at both locations
SELECT vld.location_id, bl.name, vld.qty_available
FROM variation_location_details vld
JOIN business_locations bl ON vld.location_id = bl.id
WHERE vld.product_variation_id = [VARIATION_ID]
AND vld.location_id IN ([SOURCE_LOC_ID], [DEST_LOC_ID]);
```

### Automated Test Coverage
- File: `e2e/transfers-comprehensive.spec.ts`
- File: `e2e/transfers-workflow.spec.ts`
- File: `e2e/transfer-auto-select.spec.ts`

---

## 6. Point of Sale (POS)

### Features to Test
- Product search and selection
- Barcode scanning
- Customer selection
- Discount application
- Multiple payment methods
- Split payments
- Cash drawer management
- Shift opening/closing
- Receipt printing

### Manual Testing Steps

#### Complete POS Sale
1. Navigate to `/dashboard/pos`
2. Open shift if required
3. Scan or search for products
4. Add to cart
5. Update quantities if needed
6. Select customer
7. Apply discount if applicable
8. Choose payment method
9. Enter payment amount
10. Complete sale
11. ✅ Receipt should display/print
12. ✅ Change should calculate correctly
13. ✅ Stock should decrease

#### Shift Management
1. Navigate to shift management
2. Open shift with opening balance
3. Record sales throughout shift
4. Close shift
5. ✅ Closing balance should match opening + sales
6. ✅ Cash count should reconcile

#### Database Verification
```sql
-- Check active shift
SELECT s.*, u.username as cashier_name, bl.name as location_name
FROM shifts s
JOIN users u ON s.user_id = u.id
JOIN business_locations bl ON s.location_id = bl.id
WHERE s.status = 'open'
ORDER BY s.opened_at DESC;

-- Check sales during shift
SELECT sales.*, customers.name as customer_name
FROM sales
JOIN customers ON sales.customer_id = customers.id
WHERE sales.shift_id = [SHIFT_ID]
ORDER BY sales.created_at;

-- Verify shift totals
SELECT
    s.opening_balance,
    s.closing_balance,
    SUM(sales.grand_total) as total_sales,
    s.opening_balance + SUM(sales.grand_total) as expected_closing
FROM shifts s
LEFT JOIN sales ON sales.shift_id = s.id
WHERE s.id = [SHIFT_ID]
GROUP BY s.id;
```

### Automated Test Coverage
- File: `e2e/pos-workflow.spec.ts`
- File: `e2e/comprehensive-pos-test.spec.ts`

---

## 7. Reports

### Key Reports to Test
1. **Sales Reports**
   - Sales Summary
   - Sales per Cashier
   - Sales per Item
   - Sales History
   - Sales Journal

2. **Purchase Reports**
   - Purchase Summary
   - Purchase Items
   - Purchase Returns

3. **Inventory Reports**
   - Inventory Ledger
   - Historical Inventory
   - Branch Stock Pivot
   - Stock Alerts
   - Inventory Corrections

4. **Financial Reports**
   - Profit Report
   - Profitability Analysis

5. **Audit Reports**
   - Audit Trail

### Manual Testing Steps

#### Sales Report
1. Navigate to `/dashboard/reports/sales-report`
2. Select date range
3. Filter by location, cashier, customer
4. Click "Generate Report"
5. ✅ Report should display accurate data
6. ✅ Totals should calculate correctly
7. ✅ Export to Excel/PDF should work

#### Inventory Ledger
1. Navigate to `/dashboard/reports/inventory-ledger`
2. Select product and date range
3. Select location
4. Generate report
5. ✅ Should show all IN/OUT transactions
6. ✅ Running balance should be accurate
7. ✅ Closing stock should match database

#### Database Verification
```sql
-- Verify Sales Report Totals
SELECT
    DATE(created_at) as sale_date,
    COUNT(*) as total_transactions,
    SUM(grand_total) as total_sales,
    SUM(tax_amount) as total_tax,
    SUM(discount_amount) as total_discount
FROM sales
WHERE created_at BETWEEN '2025-10-01' AND '2025-10-31'
AND business_id = 1
AND deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY sale_date;

-- Verify Inventory Ledger
SELECT
    sh.created_at,
    sh.transaction_type,
    sh.quantity_in,
    sh.quantity_out,
    sh.balance_after,
    p.name as product_name,
    pv.name as variation_name,
    bl.name as location_name
FROM stock_history sh
JOIN products p ON sh.product_id = p.id
JOIN product_variations pv ON sh.product_variation_id = pv.id
JOIN business_locations bl ON sh.location_id = bl.id
WHERE sh.product_variation_id = [VARIATION_ID]
AND sh.location_id = [LOCATION_ID]
AND sh.created_at BETWEEN '2025-10-01' AND '2025-10-31'
ORDER BY sh.created_at;
```

### Automated Test Coverage
- File: `e2e/purchase-reports-comprehensive.spec.ts`
- File: `e2e/inventory-ledger-comprehensive.spec.ts`
- File: `e2e/historical-inventory-report.spec.ts`

---

## 8. User Management & RBAC

### Features to Test
- User creation
- Role assignment
- Permission management
- Location assignment
- Password reset
- User activation/deactivation
- Permission checking in UI
- API authorization

### Manual Testing Steps

#### Create User
1. Navigate to `/dashboard/users/new`
2. Fill in user details
3. Select role
4. Assign locations
5. Set permissions
6. Save
7. ✅ User should be created
8. ✅ User can login with credentials

#### Test Permissions
1. Login as different role (Cashier, Manager, Admin)
2. Navigate to various pages
3. ✅ Menu items should be filtered by permissions
4. ✅ Unauthorized pages should redirect or show error
5. ✅ API calls should enforce permissions

#### Database Verification
```sql
-- Check user and role
SELECT u.*, r.name as role_name
FROM users u
LEFT JOIN roles r ON r.id = (
    SELECT role_id FROM user_roles WHERE user_id = u.id LIMIT 1
)
WHERE u.username = 'test_user';

-- Check user permissions
SELECT p.name as permission_name, p.description
FROM permissions p
JOIN user_permissions up ON p.id = up.permission_id
WHERE up.user_id = [USER_ID];

-- Check role permissions
SELECT p.name as permission_name
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
WHERE rp.role_id = [ROLE_ID];

-- Check user locations
SELECT bl.name as location_name
FROM business_locations bl
JOIN user_business_locations ubl ON bl.id = ubl.business_location_id
WHERE ubl.user_id = [USER_ID];
```

### Automated Test Coverage
- File: `e2e/auth-authorization-comprehensive.spec.ts`

---

## 9. Multi-Tenant Features

### Critical Multi-Tenant Security Tests

#### Data Isolation
1. Create test data for Business A
2. Login as user from Business B
3. ✅ Should NOT see Business A's data
4. ✅ API calls should only return own business data

#### Database Queries
```sql
-- Verify all products have businessId
SELECT COUNT(*) as products_without_business
FROM products
WHERE business_id IS NULL OR deleted_at IS NULL;
-- Should return 0

-- Verify data isolation
SELECT DISTINCT business_id, COUNT(*) as record_count
FROM products
WHERE deleted_at IS NULL
GROUP BY business_id;

-- Check for data leaks in joins
SELECT p.*, p.business_id as product_business,
       c.business_id as category_business
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.business_id != c.business_id
AND p.deleted_at IS NULL;
-- Should return 0 rows
```

### Automated Test Coverage
- File: `e2e/multi-tenant-inventory-comprehensive.spec.ts`

---

## Testing Best Practices

### Before Testing
1. ✅ Database is seeded with demo data
2. ✅ Development server is running
3. ✅ No pending migrations
4. ✅ Clear browser cache and localStorage

### During Testing
1. ✅ Test in incognito/private mode
2. ✅ Test with different user roles
3. ✅ Monitor browser console for errors
4. ✅ Check network tab for failed requests
5. ✅ Verify toast notifications appear

### After Each Test
1. ✅ Verify database state
2. ✅ Check stock levels are accurate
3. ✅ Confirm transactions are logged
4. ✅ Review audit trail entries

---

## Quick Database Queries for Verification

### Stock Verification
```sql
-- Current stock for all variations at all locations
SELECT
    p.name as product,
    pv.name as variation,
    bl.name as location,
    vld.qty_available
FROM variation_location_details vld
JOIN products p ON vld.product_id = p.id
JOIN product_variations pv ON vld.product_variation_id = pv.id
JOIN business_locations bl ON vld.location_id = bl.id
WHERE p.business_id = 1
ORDER BY p.name, pv.name, bl.name;
```

### Recent Transactions
```sql
-- Last 50 stock movements
SELECT
    sh.created_at,
    sh.transaction_type,
    p.name as product,
    pv.name as variation,
    bl.name as location,
    sh.quantity_in,
    sh.quantity_out,
    sh.balance_after,
    u.username as performed_by
FROM stock_history sh
JOIN products p ON sh.product_id = p.id
JOIN product_variations pv ON sh.product_variation_id = pv.id
JOIN business_locations bl ON sh.location_id = bl.id
LEFT JOIN users u ON sh.created_by = u.id
WHERE sh.business_id = 1
ORDER BY sh.created_at DESC
LIMIT 50;
```

### Pending Approvals
```sql
-- Pending purchase receipts
SELECT pr.*, po.purchase_number, s.name as supplier
FROM purchase_receipts pr
JOIN purchases po ON pr.purchase_id = po.id
JOIN suppliers s ON po.supplier_id = s.id
WHERE pr.status = 'pending'
ORDER BY pr.created_at DESC;

-- Pending inventory corrections
SELECT ic.*, bl.name as location, u.username as created_by
FROM inventory_corrections ic
JOIN business_locations bl ON ic.location_id = bl.id
JOIN users u ON ic.created_by = u.id
WHERE ic.status = 'pending'
ORDER BY ic.created_at DESC;

-- Pending transfers
SELECT t.*,
       bl_from.name as from_location,
       bl_to.name as to_location
FROM transfers t
JOIN business_locations bl_from ON t.from_location_id = bl_from.id
JOIN business_locations bl_to ON t.to_location_id = bl_to.id
WHERE t.status IN ('pending', 'in_transit')
ORDER BY t.created_at DESC;
```

---

## Conclusion

This comprehensive testing guide ensures thorough validation of all major POS features. Use this as a checklist for:
- ✅ Pre-deployment testing
- ✅ Regression testing after updates
- ✅ User acceptance testing (UAT)
- ✅ Training new QA team members

For automated testing, ensure the development server is running and execute:
```bash
npm run dev  # Start dev server
npx playwright test --reporter=html  # Run all tests
npx playwright show-report  # View results
```

**Remember:** Always verify database state after transactions to ensure data integrity!
