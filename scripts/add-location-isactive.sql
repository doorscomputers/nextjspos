-- Add isActive column to business_locations table
ALTER TABLE business_locations
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Update all existing locations to be active
UPDATE business_locations
SET is_active = true
WHERE is_active IS NULL;
