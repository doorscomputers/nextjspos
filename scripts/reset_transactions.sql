TRUNCATE TABLE
  sale_items,
  sale_payments,
  sales,
  quotation_items,
  quotations,
  purchase_items,
  purchase_receipt_items,
  purchase_receipts,
  purchases,
  purchase_return_items,
  purchase_returns,
  stock_transactions,
  stock_transfer_items,
  stock_transfers,
  customer_return_items,
  customer_returns,
  supplier_return_items,
  supplier_returns,
  accounts_payable,
  payments,
  post_dated_cheques,
  bank_transactions,
  journal_entry_lines,
  journal_entries,
  account_balances,
  financial_snapshots,
  budget_allocations,
  expenses,
  expense_categories,
  product_history,
  product_serial_numbers,
  serial_number_movements,
  inventory_corrections,
  freebie_logs,
  product_unit_prices,
  product_unit_location_prices,
  product_variations,
  cashier_shift_readings,
  cashier_shifts,
  cash_in_out,
  cash_denominations,
  void_transactions,
  service_repair_payments,
  service_job_parts,
  service_job_orders,
  service_warranty_claims,
  warranty_claims,
  repair_job_order_parts,
  repair_job_orders,
  notifications,
  audit_logs,
  user_activity,
  sessions,
  idempotency_keys,
  announcements,
  saved_questions
RESTART IDENTITY CASCADE;

-- STEP 2 — Remove product-related records (products requested to be deleted)
-- Clear product-specific price/location tables first
DELETE FROM product_unit_location_prices;
ALTER SEQUENCE IF EXISTS product_unit_location_prices_id_seq RESTART WITH 1;

DELETE FROM product_unit_prices;
ALTER SEQUENCE IF EXISTS product_unit_prices_id_seq RESTART WITH 1;

-- Remove product variations then products
DELETE FROM product_variations;
ALTER SEQUENCE IF EXISTS product_variations_id_seq RESTART WITH 1;

DELETE FROM products;
ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1;

-- Reset product serials & history sequences
ALTER SEQUENCE IF EXISTS product_serial_numbers_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS serial_number_movements_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_history_id_seq RESTART WITH 1;