-- ============================================
-- Network Resilience Migration
-- Purpose: Add idempotency support, atomic number generation,
--          and prevent duplicate submissions on unreliable networks
-- Date: 2025-10-17
-- ============================================

-- Step 1: Create Idempotency Keys Table
-- Prevents duplicate submissions when network is slow
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(191) UNIQUE NOT NULL,
  business_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_body JSONB,
  response_status INTEGER NOT NULL,
  response_body JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_keys_business_id ON idempotency_keys(business_id);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_keys_endpoint ON idempotency_keys(endpoint);

-- Step 2: Create Invoice Sequence Table
-- Ensures atomic, race-condition-free invoice number generation
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER DEFAULT 0 NOT NULL,
  UNIQUE(business_id, year, month)
);

CREATE INDEX idx_invoice_sequences_business_id ON invoice_sequences(business_id);

-- Step 3: Create Receipt Sequence Table
CREATE TABLE IF NOT EXISTS receipt_sequences (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER DEFAULT 0 NOT NULL,
  UNIQUE(business_id, year, month)
);

CREATE INDEX idx_receipt_sequences_business_id ON receipt_sequences(business_id);

-- Step 4: Create Transfer Sequence Table
CREATE TABLE IF NOT EXISTS transfer_sequences (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER DEFAULT 0 NOT NULL,
  UNIQUE(business_id, year, month)
);

CREATE INDEX idx_transfer_sequences_business_id ON transfer_sequences(business_id);

-- Step 5: Create Return Sequence Table
CREATE TABLE IF NOT EXISTS return_sequences (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER DEFAULT 0 NOT NULL,
  UNIQUE(business_id, year, month)
);

CREATE INDEX idx_return_sequences_business_id ON return_sequences(business_id);

-- Step 6: Add Composite Unique Constraints
-- These prevent duplicate invoice/receipt/transfer numbers per business

-- Check if constraint already exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_business_id_invoice_number_unique'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_business_id_invoice_number_unique
      UNIQUE (business_id, invoice_number);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_receipts_business_id_receipt_number_unique'
  ) THEN
    ALTER TABLE purchase_receipts
      ADD CONSTRAINT purchase_receipts_business_id_receipt_number_unique
      UNIQUE (business_id, receipt_number);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_transfers_business_id_transfer_number_unique'
  ) THEN
    ALTER TABLE stock_transfers
      ADD CONSTRAINT stock_transfers_business_id_transfer_number_unique
      UNIQUE (business_id, transfer_number);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_returns_business_id_return_number_unique'
  ) THEN
    ALTER TABLE customer_returns
      ADD CONSTRAINT customer_returns_business_id_return_number_unique
      UNIQUE (business_id, return_number);
  END IF;
END$$;

-- Step 7: Create cleanup function for expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM idempotency_keys
  WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to cleanup expired keys daily
-- (Requires pg_cron extension - comment out if not available)
-- SELECT cron.schedule('cleanup-idempotency', '0 2 * * *', 'SELECT cleanup_expired_idempotency_keys()');

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================
-- DROP TABLE IF EXISTS idempotency_keys CASCADE;
-- DROP TABLE IF EXISTS invoice_sequences CASCADE;
-- DROP TABLE IF EXISTS receipt_sequences CASCADE;
-- DROP TABLE IF EXISTS transfer_sequences CASCADE;
-- DROP TABLE IF EXISTS return_sequences CASCADE;
-- ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_business_id_invoice_number_unique;
-- ALTER TABLE purchase_receipts DROP CONSTRAINT IF EXISTS purchase_receipts_business_id_receipt_number_unique;
-- ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_business_id_transfer_number_unique;
-- ALTER TABLE customer_returns DROP CONSTRAINT IF EXISTS customer_returns_business_id_return_number_unique;
-- DROP FUNCTION IF EXISTS cleanup_expired_idempotency_keys();
