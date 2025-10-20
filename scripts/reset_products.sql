-- ============================================
-- RESET ALL PRODUCTS AND RELATED DATA
-- WARNING: This will permanently delete ALL products, variations, stock history, and audit trail
-- ============================================

BEGIN;

-- Disable triggers temporarily to speed up deletion (optional)
SET session_replication_role = 'replica';

-- Delete product-related data in correct order (from child to parent)
-- Most of these will cascade automatically due to foreign key constraints,
-- but we're being explicit for safety

-- 1. Delete product serial numbers
DELETE FROM product_serial_numbers;

-- 2. Delete product history (audit trail)
DELETE FROM product_history;

-- 3. Delete stock transactions (audit trail)
DELETE FROM stock_transactions;

-- 4. Delete variation location details (stock per location)
DELETE FROM variation_location_details;

-- 5. Delete freebie logs related to products
DELETE FROM freebie_logs;

-- 6. Delete quotation items
DELETE FROM quotation_items WHERE product_id IS NOT NULL;

-- 7. Delete product variations
DELETE FROM product_variations;

-- 8. Delete combo products
DELETE FROM combo_products;

-- 9. Delete inventory corrections
DELETE FROM inventory_corrections;

-- 10. Delete purchase items (if you want to reset purchases too)
-- Uncomment if you want to delete purchase history as well
-- DELETE FROM purchase_items;

-- 11. Finally, delete all products
DELETE FROM products;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Reset auto-increment sequences to 1
ALTER SEQUENCE products_id_seq RESTART WITH 1;
ALTER SEQUENCE product_variations_id_seq RESTART WITH 1;
ALTER SEQUENCE variation_location_details_id_seq RESTART WITH 1;
ALTER SEQUENCE stock_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE product_history_id_seq RESTART WITH 1;
ALTER SEQUENCE product_serial_numbers_id_seq RESTART WITH 1;
ALTER SEQUENCE inventory_corrections_id_seq RESTART WITH 1;
ALTER SEQUENCE combo_products_id_seq RESTART WITH 1;
ALTER SEQUENCE freebie_logs_id_seq RESTART WITH 1;

-- Verify deletion
SELECT
    'products' as table_name,
    COUNT(*) as remaining_records
FROM products
UNION ALL
SELECT
    'product_variations',
    COUNT(*)
FROM product_variations
UNION ALL
SELECT
    'variation_location_details',
    COUNT(*)
FROM variation_location_details
UNION ALL
SELECT
    'stock_transactions',
    COUNT(*)
FROM stock_transactions
UNION ALL
SELECT
    'product_history',
    COUNT(*)
FROM product_history;

COMMIT;

-- Show success message
SELECT 'All products and related data have been deleted successfully!' as message;
