-- Add location_id column to invoice_sequences with a default value
-- This migration handles existing data by assigning a default location_id

-- Step 1: Add location_id as nullable first
ALTER TABLE "invoice_sequences" ADD COLUMN "location_id" INTEGER;

-- Step 2: Set default location_id for existing records
-- Get the first location_id from business_locations for each business
UPDATE "invoice_sequences" AS seq
SET "location_id" = (
  SELECT id
  FROM "business_locations" AS loc
  WHERE loc.business_id = seq.business_id
  ORDER BY id ASC
  LIMIT 1
);

-- Step 3: Make location_id NOT NULL
ALTER TABLE "invoice_sequences" ALTER COLUMN "location_id" SET NOT NULL;

-- Step 4: Drop the old unique constraint
ALTER TABLE "invoice_sequences" DROP CONSTRAINT IF EXISTS "invoice_sequences_business_id_year_month_key";

-- Step 5: Create new unique constraint with location_id
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_business_id_location_id_year_month_key"
  UNIQUE ("business_id", "location_id", "year", "month");

-- Step 6: Create index on location_id
CREATE INDEX "invoice_sequences_location_id_idx" ON "invoice_sequences"("location_id");
