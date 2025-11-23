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

-- Sales and related
ALTER SEQUENCE IF EXISTS sale_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sale_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sales_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS quotation_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS quotations_id_seq RESTART WITH 1;

-- Purchases and receipts/returns
ALTER SEQUENCE IF EXISTS purchase_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS purchase_receipt_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS purchase_receipts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS purchases_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS purchase_return_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS purchase_returns_id_seq RESTART WITH 1;

-- Stock and transfers
ALTER SEQUENCE IF EXISTS stock_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS stock_transfer_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS stock_transfers_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS inventory_corrections_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS freebie_logs_id_seq RESTART WITH 1;

-- Returns
ALTER SEQUENCE IF EXISTS customer_return_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS customer_returns_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS supplier_return_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS supplier_returns_id_seq RESTART WITH 1;

-- Accounting and finance
ALTER SEQUENCE IF EXISTS accounts_payable_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS post_dated_cheques_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bank_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS journal_entry_lines_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS journal_entries_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS account_balances_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS financial_snapshots_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS budget_allocations_id_seq RESTART WITH 1;

-- Expenses
ALTER SEQUENCE IF EXISTS expenses_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS expense_categories_id_seq RESTART WITH 1;

-- Products and related (some already included in your script)
ALTER SEQUENCE IF EXISTS product_history_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_serial_numbers_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS serial_number_movements_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_unit_prices_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_unit_location_prices_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_variations_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1;

-- Pricing and misc product config
ALTER SEQUENCE IF EXISTS product_unit_location_prices_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_unit_prices_id_seq RESTART WITH 1;

-- Cashier/pos
ALTER SEQUENCE IF EXISTS cashier_shift_readings_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS cashier_shifts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS cash_in_out_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS cash_denominations_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS void_transactions_id_seq RESTART WITH 1;

-- Service and repairs
ALTER SEQUENCE IF EXISTS service_repair_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS service_job_parts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS service_job_orders_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS service_warranty_claims_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS warranty_claims_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS repair_job_order_parts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS repair_job_orders_id_seq RESTART WITH 1;

-- System/ops
ALTER SEQUENCE IF EXISTS notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS audit_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS user_activity_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS idempotency_keys_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS saved_questions_id_seq RESTART WITH 1;