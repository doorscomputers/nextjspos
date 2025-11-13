-- Create atomic sequence tables for invoice, receipt, transfer, and return numbering
-- These tables ensure race-condition-free number generation per location

-- Invoice sequences (per business + location + month)
CREATE TABLE IF NOT EXISTS invoice_sequences (
  business_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, location_id, year, month)
);

-- Receipt sequences (per business + month)
CREATE TABLE IF NOT EXISTS receipt_sequences (
  business_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, year, month)
);

-- Transfer sequences (per business + month)
CREATE TABLE IF NOT EXISTS transfer_sequences (
  business_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, year, month)
);

-- Return sequences (per business + month)
CREATE TABLE IF NOT EXISTS return_sequences (
  business_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, year, month)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_business ON invoice_sequences(business_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_location ON invoice_sequences(location_id);
CREATE INDEX IF NOT EXISTS idx_receipt_sequences_business ON receipt_sequences(business_id);
CREATE INDEX IF NOT EXISTS idx_transfer_sequences_business ON transfer_sequences(business_id);
CREATE INDEX IF NOT EXISTS idx_return_sequences_business ON return_sequences(business_id);

-- Comments
COMMENT ON TABLE invoice_sequences IS 'Atomic invoice number sequences per business + location + month';
COMMENT ON TABLE receipt_sequences IS 'Atomic receipt number sequences per business + month';
COMMENT ON TABLE transfer_sequences IS 'Atomic transfer number sequences per business + month';
COMMENT ON TABLE return_sequences IS 'Atomic return number sequences per business + month';
