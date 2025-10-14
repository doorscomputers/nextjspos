-- Add partial unique constraint on customer names (only for non-deleted)
-- This allows duplicate names only if they are soft-deleted

CREATE UNIQUE INDEX customers_business_id_name_unique
ON customers (business_id, name)
WHERE deleted_at IS NULL;
