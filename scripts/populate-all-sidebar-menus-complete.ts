import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Complete menu structure from your Sidebar.tsx
const COMPLETE_MENU_STRUCTURE = [
  // ========== LEVEL 0: TOP-LEVEL PARENT MENUS ==========
  { key: 'dashboard', name: 'Dashboard', href: '/dashboard', order: 1, parentKey: null },
  { key: 'cashier_reports_root', name: 'Cashier Reports', href: '/dashboard/cashier-reports', order: 2, parentKey: null },
  { key: 'analytics_dashboard_v1', name: 'Analytics Dashboard V1', href: '/dashboard/dashboard-v2', order: 3, parentKey: null },
  { key: 'analytics_dashboard_v2', name: 'Analytics Dashboard V2', href: '/dashboard/analytics-devextreme', order: 4, parentKey: null },
  { key: 'analytics_dashboard_v3', name: 'Analytics Dashboard V3', href: '/dashboard/dashboard-v3', order: 5, parentKey: null },
  { key: 'dashboard_v4', name: 'Dashboard V4', href: '/dashboard/dashboard-v4', order: 6, parentKey: null },
  { key: 'pos_sales', name: 'POS & Sales', href: '/dashboard/pos', order: 7, parentKey: null },
  { key: 'inventory_management', name: 'Inventory Management', href: '/dashboard/products', order: 8, parentKey: null },
  { key: 'pricing_management', name: 'Price Editor', href: '/dashboard/products/simple-price-editor', order: 9, parentKey: null },
  { key: 'purchases', name: 'Purchases', href: '/dashboard/purchases', order: 10, parentKey: null },
  { key: 'stock_transfers', name: 'Stock Transfers', href: '/dashboard/transfers', order: 11, parentKey: null },
  { key: 'returns_management', name: 'Returns Management', href: '/dashboard/customer-returns', order: 12, parentKey: null },
  { key: 'customers', name: 'Customers', href: '/dashboard/customers', order: 13, parentKey: null },
  { key: 'suppliers', name: 'Suppliers', href: '/dashboard/suppliers', order: 14, parentKey: null },
  { key: 'expenses', name: 'Expenses', href: '/dashboard/expenses', order: 15, parentKey: null },
  { key: 'reports', name: 'Reports', href: '/dashboard/reports', order: 16, parentKey: null },
  { key: 'hr_attendance', name: 'HR & Attendance', href: '/dashboard/hr', order: 17, parentKey: null },
  { key: 'technical_services', name: 'Technical Services', href: '/dashboard/technical', order: 18, parentKey: null },
  { key: 'accounting', name: 'Accounting', href: '/dashboard/accounting', order: 19, parentKey: null },
  { key: 'administration', name: 'Administration', href: '/dashboard/admin', order: 20, parentKey: null },
  { key: 'settings', name: 'Settings', href: '/dashboard/settings', order: 21, parentKey: null },
  { key: 'ai_assistant', name: 'AI Assistant', href: '/dashboard/ai-assistant', order: 22, parentKey: null },
  { key: 'help_center', name: 'Help Center', href: '/dashboard/help', order: 23, parentKey: null },
  { key: 'notifications', name: 'Notifications', href: '/dashboard/notifications', order: 24, parentKey: null },
  { key: 'my_profile', name: 'My Profile', href: '/dashboard/profile', order: 25, parentKey: null },

  // ========== LEVEL 1: CHILDREN OF PARENT MENUS ==========

  // Cashier Reports Children
  { key: 'cashier_sales_today', name: 'Sales Today', href: '/dashboard/cashier-reports/sales-today', order: 1, parentKey: 'cashier_reports_root' },

  // POS & Sales Children
  { key: 'point_of_sale', name: 'Point of Sale', href: '/dashboard/pos', order: 1, parentKey: 'pos_sales' },
  { key: 'begin_shift', name: 'Begin Shift', href: '/dashboard/shifts/begin', order: 2, parentKey: 'pos_sales' },
  { key: 'close_shift', name: 'Close Shift', href: '/dashboard/shifts/close', order: 3, parentKey: 'pos_sales' },
  { key: 'x_reading', name: 'X Reading', href: '/dashboard/readings/x-reading', order: 4, parentKey: 'pos_sales' },
  { key: 'z_reading', name: 'Z Reading', href: '/dashboard/readings/z-reading', order: 5, parentKey: 'pos_sales' },
  { key: 'readings_history', name: 'Readings History', href: '/dashboard/readings/history', order: 6, parentKey: 'pos_sales' },
  { key: 'sales_list', name: 'Sales List', href: '/dashboard/sales', order: 7, parentKey: 'pos_sales' },

  // Inventory Management Children
  { key: 'list_products', name: 'List Products', href: '/dashboard/products', order: 1, parentKey: 'inventory_management' },
  { key: 'list_products_v2', name: 'List Products V2', href: '/dashboard/products/list-v2', order: 2, parentKey: 'inventory_management' },
  { key: 'add_product', name: 'Add Product', href: '/dashboard/products/add', order: 3, parentKey: 'inventory_management' },
  { key: 'add_product_v2', name: 'Add Product V2', href: '/dashboard/products/add-v2', order: 4, parentKey: 'inventory_management' },
  { key: 'all_branch_stock', name: 'All Branch Stock', href: '/dashboard/products/stock', order: 5, parentKey: 'inventory_management' },
  { key: 'branch_stock_pivot', name: 'Branch Stock Pivot', href: '/dashboard/products/branch-stock-pivot', order: 6, parentKey: 'inventory_management' },
  { key: 'branch_stock_pivot_v2', name: 'Branch Stock Pivot V2', href: '/dashboard/products/branch-stock-pivot-v2', order: 7, parentKey: 'inventory_management' },
  { key: 'inventory_corrections', name: 'Inventory Corrections', href: '/dashboard/inventory-corrections', order: 8, parentKey: 'inventory_management' },
  { key: 'physical_inventory', name: 'Physical Inventory', href: '/dashboard/physical-inventory', order: 9, parentKey: 'inventory_management' },
  { key: 'print_labels', name: 'Print Labels', href: '/dashboard/products/print-labels', order: 10, parentKey: 'inventory_management' },
  { key: 'import_products', name: 'Import Products', href: '/dashboard/products/import', order: 11, parentKey: 'inventory_management' },
  { key: 'import_branch_stock', name: 'Import Branch Stock', href: '/dashboard/products/import-branch-stock', order: 12, parentKey: 'inventory_management' },
  { key: 'csv_id_mapper', name: 'CSV ID Mapper', href: '/dashboard/products/csv-id-mapper', order: 13, parentKey: 'inventory_management' },
  { key: 'categories', name: 'Categories', href: '/dashboard/products/categories', order: 14, parentKey: 'inventory_management' },
  { key: 'import_categories', name: 'Import Categories', href: '/dashboard/products/categories/import', order: 15, parentKey: 'inventory_management' },
  { key: 'brands', name: 'Brands', href: '/dashboard/products/brands', order: 16, parentKey: 'inventory_management' },
  { key: 'import_brands', name: 'Import Brands', href: '/dashboard/products/brands/import', order: 17, parentKey: 'inventory_management' },
  { key: 'units', name: 'Units', href: '/dashboard/products/units', order: 18, parentKey: 'inventory_management' },
  { key: 'warranties', name: 'Warranties', href: '/dashboard/products/warranties', order: 19, parentKey: 'inventory_management' },
  { key: 'bulk_reorder_settings', name: 'Bulk Reorder Settings', href: '/dashboard/products/bulk-reorder-update', order: 20, parentKey: 'inventory_management' },

  // Pricing Management Children
  { key: 'simple_price_editor', name: 'Price Editor', href: '/dashboard/products/simple-price-editor', order: 1, parentKey: 'pricing_management' },
  { key: 'bulk_price_editor', name: 'Legacy Bulk Editor', href: '/dashboard/products/bulk-price-editor', order: 2, parentKey: 'pricing_management' },
  { key: 'pricing_settings', name: 'Pricing Settings', href: '/dashboard/settings/pricing', order: 3, parentKey: 'pricing_management' },
  { key: 'price_comparison', name: 'Price Comparison', href: '/dashboard/reports/price-comparison', order: 4, parentKey: 'pricing_management' },
  { key: 'cost_audit', name: 'Cost Audit', href: '/dashboard/reports/cost-audit', order: 5, parentKey: 'pricing_management' },

  // Purchases Children
  { key: 'purchase_orders', name: 'Purchase Orders', href: '/dashboard/purchases', order: 1, parentKey: 'purchases' },
  { key: 'goods_received', name: 'Goods Received (GRN)', href: '/dashboard/purchases/receipts', order: 2, parentKey: 'purchases' },
  { key: 'serial_number_lookup', name: 'Serial Number Lookup', href: '/dashboard/serial-lookup', order: 3, parentKey: 'purchases' },
  { key: 'reorder_suggestions', name: 'Reorder Suggestions', href: '/dashboard/purchases/suggestions', order: 4, parentKey: 'purchases' },
  { key: 'accounts_payable', name: 'Accounts Payable', href: '/dashboard/accounts-payable', order: 5, parentKey: 'purchases' },
  { key: 'payments', name: 'Payments', href: '/dashboard/payments', order: 6, parentKey: 'purchases' },
  { key: 'banks', name: 'Banks', href: '/dashboard/banks', order: 7, parentKey: 'purchases' },
  { key: 'bank_transactions', name: 'Bank Transactions', href: '/dashboard/bank-transactions', order: 8, parentKey: 'purchases' },
  { key: 'post_dated_cheques', name: 'Post-Dated Cheques', href: '/dashboard/post-dated-cheques', order: 9, parentKey: 'purchases' },

  // Stock Transfers Children
  { key: 'all_transfers', name: 'All Transfers', href: '/dashboard/transfers', order: 1, parentKey: 'stock_transfers' },
  { key: 'create_transfer', name: 'Create Transfer', href: '/dashboard/transfers/create', order: 2, parentKey: 'stock_transfers' },
  { key: 'my_transfers_report', name: 'My Transfers', href: '/dashboard/reports/my-transfers', order: 3, parentKey: 'stock_transfers' },
  { key: 'my_received_transfers_report', name: 'My Received Transfers', href: '/dashboard/reports/my-received-transfers', order: 4, parentKey: 'stock_transfers' },

  // Returns Management Children
  { key: 'customer_returns', name: 'Customer Returns', href: '/dashboard/customer-returns', order: 1, parentKey: 'returns_management' },
  { key: 'purchase_returns', name: 'Purchase Returns', href: '/dashboard/purchases/returns', order: 2, parentKey: 'returns_management' },
  { key: 'supplier_returns', name: 'Supplier Returns', href: '/dashboard/supplier-returns', order: 3, parentKey: 'returns_management' },

  // Customers Children
  { key: 'all_customers', name: 'All Customers', href: '/dashboard/customers', order: 1, parentKey: 'customers' },
  { key: 'import_customers', name: 'Import Customers', href: '/dashboard/customers/import', order: 2, parentKey: 'customers' },

  // Suppliers Children
  { key: 'all_suppliers', name: 'All Suppliers', href: '/dashboard/suppliers', order: 1, parentKey: 'suppliers' },
  { key: 'import_suppliers', name: 'Import Suppliers', href: '/dashboard/suppliers/import', order: 2, parentKey: 'suppliers' },

  // Expenses Children
  { key: 'all_expenses', name: 'All Expenses', href: '/dashboard/expenses', order: 1, parentKey: 'expenses' },
  { key: 'expense_categories', name: 'Expense Categories', href: '/dashboard/expenses/categories', order: 2, parentKey: 'expenses' },

  // Reports Children - Parent Categories
  { key: 'all_reports_hub', name: 'All Reports Hub', href: '/dashboard/reports', order: 1, parentKey: 'reports' },
  { key: 'sales_reports', name: 'Sales Reports', href: null, order: 2, parentKey: 'reports' },
  { key: 'cashier_reports', name: 'Cashier Reports', href: null, order: 3, parentKey: 'reports' },
  { key: 'purchase_reports', name: 'Purchase Reports', href: null, order: 4, parentKey: 'reports' },
  { key: 'inventory_reports', name: 'Inventory Reports', href: null, order: 5, parentKey: 'reports' },
  { key: 'transfer_reports', name: 'Transfer Reports', href: null, order: 6, parentKey: 'reports' },
  { key: 'financial_reports', name: 'Financial Reports', href: null, order: 7, parentKey: 'reports' },
  { key: 'compliance_reports', name: 'Compliance Reports', href: null, order: 8, parentKey: 'reports' },
  { key: 'security_audit', name: 'Security & Audit', href: null, order: 9, parentKey: 'reports' },
  { key: 'hr_reports', name: 'HR Reports', href: null, order: 10, parentKey: 'reports' },

  // HR & Attendance Children
  { key: 'clock_in_out', name: 'Clock In/Out', href: '/dashboard/hr/attendance', order: 1, parentKey: 'hr_attendance' },
  { key: 'employee_schedules', name: 'Employee Schedules', href: '/dashboard/hr/schedules', order: 2, parentKey: 'hr_attendance' },
  { key: 'attendance_records', name: 'Attendance Records', href: '/dashboard/hr/records', order: 3, parentKey: 'hr_attendance' },
  { key: 'leave_requests', name: 'Leave Requests', href: '/dashboard/hr/leave', order: 4, parentKey: 'hr_attendance' },
  { key: 'location_change_requests', name: 'Location Change Requests', href: '/dashboard/hr/location-changes', order: 5, parentKey: 'hr_attendance' },

  // Technical Services Children
  { key: 'technical_dashboard', name: 'Dashboard', href: '/dashboard/technical', order: 1, parentKey: 'technical_services' },
  { key: 'warranty_claims', name: 'Warranty Claims', href: '/dashboard/technical/warranty-claims', order: 2, parentKey: 'technical_services' },
  { key: 'job_orders', name: 'Job Orders', href: '/dashboard/technical/job-orders', order: 3, parentKey: 'technical_services' },
  { key: 'technical_serial_lookup', name: 'Serial Number Lookup', href: '/dashboard/technical/serial-lookup', order: 4, parentKey: 'technical_services' },
  { key: 'technicians', name: 'Technicians', href: '/dashboard/technical/technicians', order: 5, parentKey: 'technical_services' },
  { key: 'service_types', name: 'Service Types', href: '/dashboard/technical/service-types', order: 6, parentKey: 'technical_services' },
  { key: 'service_payments', name: 'Service Payments', href: '/dashboard/technical/payments', order: 7, parentKey: 'technical_services' },
  { key: 'technical_reports', name: 'Reports', href: null, order: 8, parentKey: 'technical_services' },

  // Accounting Children
  { key: 'balance_sheet', name: 'Balance Sheet', href: '/dashboard/accounting/balance-sheet', order: 1, parentKey: 'accounting' },
  { key: 'income_statement', name: 'Income Statement', href: '/dashboard/accounting/income-statement', order: 2, parentKey: 'accounting' },
  { key: 'trial_balance', name: 'Trial Balance', href: '/dashboard/accounting/trial-balance', order: 3, parentKey: 'accounting' },
  { key: 'general_ledger', name: 'General Ledger', href: '/dashboard/accounting/general-ledger', order: 4, parentKey: 'accounting' },

  // Administration Children
  { key: 'users', name: 'Users', href: '/dashboard/settings/users', order: 1, parentKey: 'administration' },
  { key: 'roles_permissions', name: 'Roles & Permissions', href: '/dashboard/settings/roles', order: 2, parentKey: 'administration' },
  { key: 'business_locations', name: 'Business Locations', href: '/dashboard/settings/locations', order: 3, parentKey: 'administration' },
  { key: 'announcements', name: 'Announcements', href: '/dashboard/settings/announcements', order: 4, parentKey: 'administration' },
  { key: 'login_history', name: 'Login History', href: '/dashboard/settings/login-history', order: 5, parentKey: 'administration' },
  { key: 'active_users', name: 'Active Users Monitor', href: '/dashboard/admin/active-users', order: 6, parentKey: 'administration' },

  // Settings Children
  { key: 'business_settings', name: 'Business Settings', href: '/dashboard/settings/business', order: 1, parentKey: 'settings' },
  { key: 'printers', name: 'Printers', href: '/dashboard/settings/printers', order: 2, parentKey: 'settings' },
  { key: 'invoice_settings', name: 'Invoice Settings', href: '/dashboard/settings/invoice', order: 3, parentKey: 'settings' },
  { key: 'barcode_settings', name: 'Barcode Settings', href: '/dashboard/settings/barcode', order: 4, parentKey: 'settings' },
  { key: 'schedule_login_security', name: 'Schedule Login Security', href: '/dashboard/settings/schedule-login', order: 5, parentKey: 'settings' },
  { key: 'sod_rules', name: 'SOD Rules (Separation of Duties)', href: '/dashboard/settings/sod', order: 6, parentKey: 'settings' },
  { key: 'inactivity_timeout', name: 'Inactivity Timeout', href: '/dashboard/settings/inactivity', order: 7, parentKey: 'settings' },
  { key: 'tax_rates', name: 'Tax Rates', href: '/dashboard/settings/tax-rates', order: 8, parentKey: 'settings' },
  { key: 'menu_permissions', name: 'Menu Permissions', href: '/dashboard/settings/menu-permissions', order: 9, parentKey: 'settings' },
  { key: 'menu_management', name: 'Menu Management', href: '/dashboard/settings/menu-management', order: 10, parentKey: 'settings' },

  // ========== LEVEL 2: GRANDCHILDREN (Sub-sub-menus) ==========

  // Sales Reports Grandchildren
  { key: 'sales_today_report', name: 'Sales Today', href: '/dashboard/reports/sales/today', order: 1, parentKey: 'sales_reports' },
  { key: 'sales_history', name: 'Sales History', href: '/dashboard/reports/sales/history', order: 2, parentKey: 'sales_reports' },
  { key: 'sales_invoice_details', name: 'Sales Invoice Details', href: '/dashboard/reports/sales/invoice-details', order: 3, parentKey: 'sales_reports' },
  { key: 'sales_journal', name: 'Sales Journal', href: '/dashboard/reports/sales/journal', order: 4, parentKey: 'sales_reports' },
  { key: 'sales_per_item', name: 'Sales Per Item', href: '/dashboard/reports/sales/per-item', order: 5, parentKey: 'sales_reports' },
  { key: 'sales_per_cashier', name: 'Sales Per Cashier', href: '/dashboard/reports/sales/per-cashier', order: 6, parentKey: 'sales_reports' },
  { key: 'hourly_sales_breakdown', name: 'Hourly Sales Breakdown', href: '/dashboard/reports/sales/hourly', order: 7, parentKey: 'sales_reports' },
  { key: 'discount_analysis', name: 'Discount Analysis', href: '/dashboard/reports/sales/discounts', order: 8, parentKey: 'sales_reports' },
  { key: 'void_refund_analysis', name: 'Void & Refund Analysis', href: '/dashboard/reports/sales/voids-refunds', order: 9, parentKey: 'sales_reports' },

  // Cashier Reports Grandchildren
  { key: 'cashier_sales_today_report', name: 'Sales Today (Cashier)', href: '/dashboard/reports/cashier/sales-today', order: 1, parentKey: 'cashier_reports' },
  { key: 'cashier_sales_history', name: 'Sales History (Cashier)', href: '/dashboard/reports/cashier/history', order: 2, parentKey: 'cashier_reports' },
  { key: 'cashier_invoice_details', name: 'Sales Invoice Details (Cashier)', href: '/dashboard/reports/cashier/invoice-details', order: 3, parentKey: 'cashier_reports' },
  { key: 'cashier_sales_journal', name: 'Sales Journal (Cashier)', href: '/dashboard/reports/cashier/journal', order: 4, parentKey: 'cashier_reports' },
  { key: 'cashier_sales_per_item', name: 'Sales Per Item (Cashier)', href: '/dashboard/reports/cashier/per-item', order: 5, parentKey: 'cashier_reports' },

  // Purchase Reports Grandchildren
  { key: 'purchase_analytics', name: 'Purchase Analytics', href: '/dashboard/reports/purchases/analytics', order: 1, parentKey: 'purchase_reports' },
  { key: 'purchase_trends', name: 'Purchase Trends', href: '/dashboard/reports/purchases/trends', order: 2, parentKey: 'purchase_reports' },
  { key: 'purchase_items_report', name: 'Purchase Items Report', href: '/dashboard/reports/purchases-items', order: 3, parentKey: 'purchase_reports' },
  { key: 'products_suppliers_report', name: 'Products-Suppliers Report', href: '/dashboard/reports/purchases/products-suppliers', order: 4, parentKey: 'purchase_reports' },

  // Inventory Reports Grandchildren
  { key: 'stock_alert_report', name: 'Stock Alert Report', href: '/dashboard/reports/inventory/stock-alert', order: 1, parentKey: 'inventory_reports' },
  { key: 'historical_inventory', name: 'Historical Inventory', href: '/dashboard/reports/inventory/historical', order: 2, parentKey: 'inventory_reports' },
  { key: 'inventory_valuation', name: 'Inventory Valuation', href: '/dashboard/reports/inventory/valuation', order: 3, parentKey: 'inventory_reports' },
  { key: 'inventory_valuation_history', name: 'Inventory Valuation History', href: '/dashboard/reports/inventory/valuation-history', order: 4, parentKey: 'inventory_reports' },
  { key: 'stock_history_v2', name: 'Stock History V2', href: '/dashboard/reports/stock-history-v2', order: 5, parentKey: 'inventory_reports' },
  { key: 'stock_history_v3_admin', name: 'Stock History V3 (Admin)', href: '/dashboard/reports/stock-history-v3', order: 6, parentKey: 'inventory_reports' },
  { key: 'stock_reconciliation', name: 'Stock Reconciliation', href: '/dashboard/reports/inventory/reconciliation', order: 7, parentKey: 'inventory_reports' },

  // Transfer Reports Grandchildren
  { key: 'transfers_report', name: 'Transfers Report', href: '/dashboard/reports/transfers', order: 1, parentKey: 'transfer_reports' },
  { key: 'transfer_trends', name: 'Transfer Trends', href: '/dashboard/reports/transfers/trends', order: 2, parentKey: 'transfer_reports' },
  { key: 'transfers_per_item', name: 'Transfers per Item', href: '/dashboard/reports/transfers/per-item', order: 3, parentKey: 'transfer_reports' },

  // Financial Reports Grandchildren
  { key: 'profit_loss_report', name: 'Profit / Loss Report', href: '/dashboard/reports/financial/profit-loss', order: 1, parentKey: 'financial_reports' },
  { key: 'purchase_sale_report', name: 'Purchase & Sale Report', href: '/dashboard/reports/financial/purchase-sale', order: 2, parentKey: 'financial_reports' },
  { key: 'profitability_cogs', name: 'Profitability & COGS', href: '/dashboard/reports/financial/profitability', order: 3, parentKey: 'financial_reports' },
  { key: 'net_profit_report', name: 'Net Profit Report', href: '/dashboard/reports/financial/net-profit', order: 4, parentKey: 'financial_reports' },
  { key: 'cash_in_out_report', name: 'Cash In/Out Report', href: '/dashboard/reports/financial/cash-in-out', order: 5, parentKey: 'financial_reports' },
  { key: 'unpaid_invoices', name: 'Unpaid Invoices', href: '/dashboard/reports/financial/unpaid-invoices', order: 6, parentKey: 'financial_reports' },
  { key: 'customer_payments', name: 'Customer Payments', href: '/dashboard/reports/financial/customer-payments', order: 7, parentKey: 'financial_reports' },
  { key: 'product_purchase_history', name: 'Product Purchase History', href: '/dashboard/reports/financial/product-purchase-history', order: 8, parentKey: 'financial_reports' },
  { key: 'purchase_returns_report', name: 'Purchase Returns Report', href: '/dashboard/reports/financial/purchase-returns', order: 9, parentKey: 'financial_reports' },
  { key: 'returns_analysis', name: 'Returns Analysis', href: '/dashboard/reports/financial/returns-analysis', order: 10, parentKey: 'financial_reports' },
  { key: 'expense_reports_parent', name: 'Expense Reports', href: null, order: 11, parentKey: 'financial_reports' },
  { key: 'gl_journal_entries', name: 'GL Journal Entries', href: '/dashboard/reports/financial/gl-journal', order: 12, parentKey: 'financial_reports' },

  // Compliance Reports Grandchildren
  { key: 'bir_daily_sales_summary', name: 'BIR Daily Sales Summary', href: '/dashboard/reports/compliance/bir-daily', order: 1, parentKey: 'compliance_reports' },
  { key: 'tax_report', name: 'Tax Report', href: '/dashboard/reports/compliance/tax', order: 2, parentKey: 'compliance_reports' },

  // Security & Audit Grandchildren
  { key: 'audit_trail_report', name: 'Audit Trail Report', href: '/dashboard/reports/audit/trail', order: 1, parentKey: 'security_audit' },

  // HR Reports Grandchildren
  { key: 'attendance_report', name: 'Attendance Report', href: '/dashboard/reports/hr/attendance', order: 1, parentKey: 'hr_reports' },

  // Technical Reports Grandchildren
  { key: 'technician_performance', name: 'Technician Performance', href: '/dashboard/reports/technical/performance', order: 1, parentKey: 'technical_reports' },
  { key: 'service_analytics', name: 'Service Analytics', href: '/dashboard/reports/technical/analytics', order: 2, parentKey: 'technical_reports' },
  { key: 'warranty_claims_report', name: 'Warranty Claims Report', href: '/dashboard/reports/technical/warranty-claims', order: 3, parentKey: 'technical_reports' },

  // Expense Reports (under Financial Reports)
  { key: 'expense_analytics', name: 'Expense Analytics', href: '/dashboard/reports/expenses/analytics', order: 1, parentKey: 'expense_reports_parent' },
  { key: 'all_expenses_report', name: 'All Expenses Report', href: '/dashboard/reports/expenses/all', order: 2, parentKey: 'expense_reports_parent' },
]

async function populateAllMenus() {
  console.log('🔧 Populating ALL Sidebar Menus Comprehensively...\\n')

  try {
    const menuMap = new Map<string, number>()
    let createdCount = 0
    let updatedCount = 0

    console.log(`📊 Total menus to process: ${COMPLETE_MENU_STRUCTURE.length}\\n`)

    // Process in 3 passes to ensure hierarchy is correct
    for (let level = 0; level <= 2; level++) {
      console.log(`\\n📋 Pass ${level + 1}: Processing level ${level} menus...\\n`)

      const menusAtLevel = COMPLETE_MENU_STRUCTURE.filter(m => {
        if (level === 0) return m.parentKey === null
        if (level === 1) {
          // Level 1 = has parent, and parent is level 0
          if (!m.parentKey) return false
          const parent = COMPLETE_MENU_STRUCTURE.find(p => p.key === m.parentKey)
          return parent && parent.parentKey === null
        }
        if (level === 2) {
          // Level 2 = has parent, and parent is level 1
          if (!m.parentKey) return false
          const parent = COMPLETE_MENU_STRUCTURE.find(p => p.key === m.parentKey)
          if (!parent || !parent.parentKey) return false
          const grandparent = COMPLETE_MENU_STRUCTURE.find(p => p.key === parent.parentKey)
          return grandparent && grandparent.parentKey === null
        }
        return false
      })

      for (const menu of menusAtLevel) {
        let parentId: number | null = null

        if (menu.parentKey) {
          parentId = menuMap.get(menu.parentKey) || null
          if (!parentId) {
            console.log(`   ⚠️  Parent '${menu.parentKey}' not found for '${menu.name}' - will retry`)
            continue
          }
        }

        const existing = await prisma.menuPermission.findUnique({
          where: { key: menu.key }
        })

        if (existing) {
          await prisma.menuPermission.update({
            where: { id: existing.id },
            data: {
              name: menu.name,
              href: menu.href,
              parentId,
              order: menu.order
            }
          })
          menuMap.set(menu.key, existing.id)
          updatedCount++
          console.log(`   ✓ ${menu.name}`)
        } else {
          const created = await prisma.menuPermission.create({
            data: {
              key: menu.key,
              name: menu.name,
              href: menu.href,
              icon: 'Menu',
              parentId,
              order: menu.order
            }
          })
          menuMap.set(menu.key, created.id)
          createdCount++
          console.log(`   ✅ ${menu.name}`)
        }
      }
    }

    const totalMenus = await prisma.menuPermission.count()

    console.log('\\n🎉 All menus populated successfully!')
    console.log(`\\n📊 Summary:`)
    console.log(`   - Created: ${createdCount}`)
    console.log(`   - Updated: ${updatedCount}`)
    console.log(`   - Total in database: ${totalMenus}`)
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

populateAllMenus()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
