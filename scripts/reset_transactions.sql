-- Reset transactional data for UltimatePOS Modern (PostgreSQL)
-- Purpose: provide a clean environment for inventory and POS testing.
-- Usage:
--   psql "$DATABASE_URL" -f scripts/reset_transactions.sql

BEGIN;

-- ============================================
-- POS SALES, RETURNS, AND FRONTLINE FLOWS
-- ============================================
TRUNCATE TABLE
  sale_payments,
  sale_items,
  customer_return_items,
  customer_returns,
  warranty_claims,
  freebie_logs,
  void_transactions,
  quotation_items,
  quotations,
  cash_denominations,
  cash_in_out,
  cashier_shifts,
  sales
RESTART IDENTITY CASCADE;

-- ============================================
-- PROCUREMENT, RECEIPTS, AND SUPPLIER FLOWS
-- ============================================
TRUNCATE TABLE
  supplier_return_items,
  supplier_returns,
  purchase_return_items,
  purchase_returns,
  quality_control_check_items,
  quality_control_items,
  quality_control_inspections,
  purchase_receipt_items,
  purchase_receipts,
  purchase_amendments,
  purchase_items,
  purchases,
  debit_notes,
  accounts_payable,
  payments,
  post_dated_cheques,
  bank_transactions
RESTART IDENTITY CASCADE;

-- ============================================
-- INVENTORY MOVEMENTS AND AUDIT HISTORY
-- ============================================
TRUNCATE TABLE
  serial_number_movements,
  product_serial_numbers,
  stock_transfer_items,
  stock_transfers,
  stock_transactions,
  inventory_corrections,
  product_history
RESTART IDENTITY CASCADE;

-- ============================================
-- SYSTEM AUDIT TRAIL
-- ============================================
TRUNCATE TABLE
  audit_logs
RESTART IDENTITY CASCADE;

-- ============================================
-- RESET INVENTORY BALANCES PER LOCATION
-- ============================================
UPDATE variation_location_details
SET
  qty_available = 0,
  opening_stock_locked = FALSE,
  opening_stock_set_at = NULL,
  opening_stock_set_by = NULL,
  updated_at = NOW();

COMMIT;
