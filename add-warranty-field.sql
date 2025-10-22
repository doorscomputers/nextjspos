-- Add warrantyId field to product_variations table
ALTER TABLE product_variations
ADD COLUMN IF NOT EXISTS warranty_id INTEGER;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'product_variations_warranty_id_fkey'
    ) THEN
        ALTER TABLE product_variations
        ADD CONSTRAINT product_variations_warranty_id_fkey
        FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS product_variations_warranty_id_idx
ON product_variations(warranty_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'product_variations'
AND column_name = 'warranty_id';
