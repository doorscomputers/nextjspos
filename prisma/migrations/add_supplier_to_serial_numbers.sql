-- Migration: Add supplier tracking to ProductSerialNumber
-- Date: 2025-10-11
-- Purpose: Track which supplier provided each serial numbered item for warranty claims

-- Step 1: Add supplier column to product_serial_numbers
ALTER TABLE product_serial_numbers
ADD COLUMN supplier_id INTEGER;

-- Step 2: Add foreign key constraint
ALTER TABLE product_serial_numbers
ADD CONSTRAINT product_serial_numbers_supplier_id_fkey
FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- Step 3: Add index for performance
CREATE INDEX product_serial_numbers_supplier_id_idx ON product_serial_numbers(supplier_id);

-- Step 4: Backfill existing data (link serial numbers to suppliers via purchase receipts)
UPDATE product_serial_numbers psn
SET supplier_id = pr.supplier_id
FROM purchase_receipts pr
WHERE psn.purchase_receipt_id = pr.id
AND psn.supplier_id IS NULL;

-- Step 5: Add comment for documentation
COMMENT ON COLUMN product_serial_numbers.supplier_id IS 'Links serial number to supplier for warranty returns and quality tracking';

-- Verification query (run after migration)
-- SELECT
--   psn.serial_number,
--   p.name as product_name,
--   s.name as supplier_name,
--   pr.receipt_number,
--   psn.warranty_end_date
-- FROM product_serial_numbers psn
-- LEFT JOIN suppliers s ON psn.supplier_id = s.id
-- LEFT JOIN products p ON psn.product_id = p.id
-- LEFT JOIN purchase_receipts pr ON psn.purchase_receipt_id = pr.id
-- WHERE psn.status = 'sold'
-- ORDER BY psn.created_at DESC
-- LIMIT 10;
