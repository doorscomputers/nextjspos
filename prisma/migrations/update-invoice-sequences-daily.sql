-- Update invoice sequences to support DAILY resets per location
-- Format: Inv{LocationName}{MM_DD_YYYY}_####
-- This migration adds DAY column for daily sequence tracking

-- Drop the old primary key constraint
ALTER TABLE invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_pkey;

-- Add DAY column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_sequences' AND column_name = 'day') THEN
    ALTER TABLE invoice_sequences ADD COLUMN day INTEGER;
  END IF;
END $$;

-- Update existing rows to have day = 1 (default for migration)
UPDATE invoice_sequences SET day = 1 WHERE day IS NULL;

-- Make day column NOT NULL after populating it
ALTER TABLE invoice_sequences ALTER COLUMN day SET NOT NULL;

-- Create new primary key with daily granularity
ALTER TABLE invoice_sequences
  ADD CONSTRAINT invoice_sequences_pkey
  PRIMARY KEY (business_id, location_id, year, month, day);

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_invoice_sequences_business;
DROP INDEX IF EXISTS idx_invoice_sequences_location;

-- Create new optimized indexes
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_business_location
  ON invoice_sequences(business_id, location_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_date
  ON invoice_sequences(year, month, day);

-- Comment
COMMENT ON TABLE invoice_sequences IS 'Atomic invoice number sequences per business + location + DAY (resets daily)';
COMMENT ON COLUMN invoice_sequences.day IS 'Day of month (1-31) - sequences reset daily per location';
