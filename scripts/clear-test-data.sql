-- =====================================================
-- Clear Test Data - Keep Users and Business Structure
-- =====================================================
-- Use this to reset data for fresh testing
-- Preserves: Users, Roles, Permissions, Business, Locations

-- IMPORTANT: Run this in order (respects foreign key constraints)

-- 1. Clear Stock Transactions (references products, variations, locations)
DELETE FROM stock_transactions;

-- 2. Clear Inventory Corrections (references products, variations, locations)
DELETE FROM inventory_corrections;

-- 3. Clear Variation Location Details (stock records)
DELETE FROM variation_location_details;

-- 4. Clear Product Variations
DELETE FROM product_variations;

-- 5. Clear Products
DELETE FROM products;

-- 6. Clear Product Categories
DELETE FROM categories;

-- 7. Clear Brands
DELETE FROM brands;

-- 8. Clear Units
DELETE FROM units;

-- 9. Clear Warranties
DELETE FROM warranties;

-- 10. Clear Sales/Purchases/Transfers (if any)
DELETE FROM sells;
DELETE FROM purchases;
DELETE FROM stock_transfers;

-- 11. Clear Audit Logs (optional - keeps full history if commented out)
DELETE FROM audit_logs;

-- 12. Reset Auto-Increment IDs (optional)
-- ALTER TABLE products AUTO_INCREMENT = 1;
-- ALTER TABLE product_variations AUTO_INCREMENT = 1;
-- ALTER TABLE variation_location_details AUTO_INCREMENT = 1;
-- ALTER TABLE stock_transactions AUTO_INCREMENT = 1;
-- ALTER TABLE inventory_corrections AUTO_INCREMENT = 1;
-- ALTER TABLE categories AUTO_INCREMENT = 1;
-- ALTER TABLE brands AUTO_INCREMENT = 1;
-- ALTER TABLE units AUTO_INCREMENT = 1;

-- =====================================================
-- What This Preserves:
-- =====================================================
-- ✅ Users (superadmin, branchadmin, branchmanager, etc.)
-- ✅ Roles and Permissions
-- ✅ Business structure
-- ✅ Business Locations (branches)
-- ✅ User-Location assignments
-- ✅ Currency settings

-- =====================================================
-- What This Deletes:
-- =====================================================
-- ❌ All products
-- ❌ All stock records
-- ❌ All transactions
-- ❌ All corrections
-- ❌ All sales/purchases
-- ❌ All audit logs (optional)

-- =====================================================
-- How to Use:
-- =====================================================
-- 1. Connect to your database
-- 2. Run this script
-- 3. Start testing from scratch with clean data
-- 4. Login with existing users (superadmin/password, etc.)
-- 5. Add products, set opening stock, create corrections

SELECT 'Test data cleared successfully!' as message;
