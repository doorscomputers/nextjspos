import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Define all menu items with their hierarchy
const menuItems = [
  // Dashboard
  { key: 'dashboard', name: 'Dashboard', href: '/dashboard', parentKey: null, order: 1 },
  { key: 'analytics_dashboard_v1', name: 'Analytics Dashboard V1', href: '/dashboard/dashboard-v2', parentKey: null, order: 2 },
  { key: 'analytics_dashboard_v2', name: 'Analytics Dashboard V2', href: '/dashboard/analytics-devextreme', parentKey: null, order: 3 },
  { key: 'analytics_dashboard_v3', name: 'Analytics Dashboard V3', href: '/dashboard/dashboard-v3', parentKey: null, order: 4 },

  // POS & Sales
  { key: 'pos_sales', name: 'POS & Sales', href: '/dashboard/pos', parentKey: null, order: 5 },
  { key: 'point_of_sale', name: 'Point of Sale', href: '/dashboard/pos', parentKey: 'pos_sales', order: 1 },
  { key: 'begin_shift', name: 'Begin Shift', href: '/dashboard/shifts/begin', parentKey: 'pos_sales', order: 2 },
  { key: 'close_shift', name: 'Close Shift', href: '/dashboard/shifts/close', parentKey: 'pos_sales', order: 3 },
  { key: 'x_reading', name: 'X Reading', href: '/dashboard/readings/x-reading', parentKey: 'pos_sales', order: 4 },
  { key: 'z_reading', name: 'Z Reading', href: '/dashboard/readings/z-reading', parentKey: 'pos_sales', order: 5 },
  { key: 'readings_history', name: 'Readings History', href: '/dashboard/readings/history', parentKey: 'pos_sales', order: 6 },
  { key: 'sales_list', name: 'Sales List', href: '/dashboard/sales', parentKey: 'pos_sales', order: 7 },

  // Inventory Management
  { key: 'inventory_management', name: 'Inventory Management', href: '/dashboard/products', parentKey: null, order: 6 },
  { key: 'list_products', name: 'List Products', href: '/dashboard/products', parentKey: 'inventory_management', order: 1 },
  { key: 'list_products_v2', name: 'List Products V2', href: '/dashboard/products/list-v2', parentKey: 'inventory_management', order: 2 },
  { key: 'add_product', name: 'Add Product', href: '/dashboard/products/add', parentKey: 'inventory_management', order: 3 },
  { key: 'add_product_v2', name: 'Add Product V2', href: '/dashboard/products/add-v2', parentKey: 'inventory_management', order: 4 },
  { key: 'all_branch_stock', name: 'All Branch Stock', href: '/dashboard/products/stock', parentKey: 'inventory_management', order: 5 },
  { key: 'branch_stock_pivot', name: 'Branch Stock Pivot', href: '/dashboard/products/branch-stock-pivot', parentKey: 'inventory_management', order: 6 },
  { key: 'branch_stock_pivot_v2', name: 'Branch Stock Pivot V2', href: '/dashboard/products/branch-stock-pivot-v2', parentKey: 'inventory_management', order: 7 },
  { key: 'inventory_corrections', name: 'Inventory Corrections', href: '/dashboard/inventory-corrections', parentKey: 'inventory_management', order: 8 },
  { key: 'physical_inventory', name: 'Physical Inventory', href: '/dashboard/physical-inventory', parentKey: 'inventory_management', order: 9 },
  { key: 'print_labels', name: 'Print Labels', href: '/dashboard/products/print-labels', parentKey: 'inventory_management', order: 10 },
  { key: 'import_products', name: 'Import Products', href: '/dashboard/products/import', parentKey: 'inventory_management', order: 11 },
  { key: 'import_branch_stock', name: 'Import Branch Stock', href: '/dashboard/products/import-branch-stock', parentKey: 'inventory_management', order: 12 },
  { key: 'csv_id_mapper', name: 'CSV ID Mapper', href: '/dashboard/products/csv-id-mapper', parentKey: 'inventory_management', order: 13 },
  { key: 'categories', name: 'Categories', href: '/dashboard/products/categories', parentKey: 'inventory_management', order: 14 },
  { key: 'import_categories', name: 'Import Categories', href: '/dashboard/products/categories/import', parentKey: 'inventory_management', order: 15 },
  { key: 'brands', name: 'Brands', href: '/dashboard/products/brands', parentKey: 'inventory_management', order: 16 },
  { key: 'import_brands', name: 'Import Brands', href: '/dashboard/products/brands/import', parentKey: 'inventory_management', order: 17 },
  { key: 'units', name: 'Units', href: '/dashboard/products/units', parentKey: 'inventory_management', order: 18 },
  { key: 'warranties', name: 'Warranties', href: '/dashboard/products/warranties', parentKey: 'inventory_management', order: 19 },
  { key: 'bulk_reorder_settings', name: 'Bulk Reorder Settings', href: '/dashboard/products/bulk-reorder-update', parentKey: 'inventory_management', order: 20 },

  // Pricing Management
  { key: 'pricing_management', name: 'Pricing Management', href: '/dashboard/products/bulk-price-editor', parentKey: null, order: 7 },
  { key: 'bulk_price_editor', name: 'Bulk Price Editor', href: '/dashboard/products/bulk-price-editor', parentKey: 'pricing_management', order: 1 },
  { key: 'pricing_settings', name: 'Pricing Settings', href: '/dashboard/settings/pricing', parentKey: 'pricing_management', order: 2 },
  { key: 'price_comparison', name: 'Price Comparison', href: '/dashboard/reports/price-comparison', parentKey: 'pricing_management', order: 3 },
  { key: 'cost_audit', name: 'Cost Audit', href: '/dashboard/reports/cost-audit', parentKey: 'pricing_management', order: 4 },

  // Purchases
  { key: 'purchases', name: 'Purchases', href: '/dashboard/purchases', parentKey: null, order: 8 },
  { key: 'purchase_orders', name: 'Purchase Orders', href: '/dashboard/purchases', parentKey: 'purchases', order: 1 },
  { key: 'goods_received', name: 'Goods Received (GRN)', href: '/dashboard/purchases/receipts', parentKey: 'purchases', order: 2 },
  { key: 'serial_number_lookup', name: 'Serial Number Lookup', href: '/dashboard/serial-lookup', parentKey: 'purchases', order: 3 },
  { key: 'reorder_suggestions', name: 'Reorder Suggestions', href: '/dashboard/purchases/suggestions', parentKey: 'purchases', order: 4 },
  { key: 'accounts_payable', name: 'Accounts Payable', href: '/dashboard/accounts-payable', parentKey: 'purchases', order: 5 },
  { key: 'payments', name: 'Payments', href: '/dashboard/payments', parentKey: 'purchases', order: 6 },
  { key: 'banks', name: 'Banks', href: '/dashboard/banks', parentKey: 'purchases', order: 7 },
  { key: 'bank_transactions', name: 'Bank Transactions', href: '/dashboard/bank-transactions', parentKey: 'purchases', order: 8 },
  { key: 'post_dated_cheques', name: 'Post-Dated Cheques', href: '/dashboard/post-dated-cheques', parentKey: 'purchases', order: 9 },

  // Stock Transfers
  { key: 'stock_transfers', name: 'Stock Transfers', href: '/dashboard/transfers', parentKey: null, order: 9 },
  { key: 'all_transfers', name: 'All Transfers', href: '/dashboard/transfers', parentKey: 'stock_transfers', order: 1 },
  { key: 'create_transfer', name: 'Create Transfer', href: '/dashboard/transfers/create', parentKey: 'stock_transfers', order: 2 },

  // Returns Management
  { key: 'returns_management', name: 'Returns Management', href: '/dashboard/customer-returns', parentKey: null, order: 10 },
  { key: 'customer_returns', name: 'Customer Returns', href: '/dashboard/customer-returns', parentKey: 'returns_management', order: 1 },
  { key: 'purchase_returns', name: 'Purchase Returns', href: '/dashboard/purchases/returns', parentKey: 'returns_management', order: 2 },
  { key: 'supplier_returns', name: 'Supplier Returns', href: '/dashboard/supplier-returns', parentKey: 'returns_management', order: 3 },

  // Customers
  { key: 'customers', name: 'Customers', href: '/dashboard/customers', parentKey: null, order: 11 },
  { key: 'all_customers', name: 'All Customers', href: '/dashboard/customers', parentKey: 'customers', order: 1 },
  { key: 'import_customers', name: 'Import Customers', href: '/dashboard/customers/import', parentKey: 'customers', order: 2 },

  // Suppliers
  { key: 'suppliers', name: 'Suppliers', href: '/dashboard/suppliers', parentKey: null, order: 12 },
  { key: 'all_suppliers', name: 'All Suppliers', href: '/dashboard/suppliers', parentKey: 'suppliers', order: 1 },
  { key: 'import_suppliers', name: 'Import Suppliers', href: '/dashboard/suppliers/import', parentKey: 'suppliers', order: 2 },

  // Expenses
  { key: 'expenses', name: 'Expenses', href: '/dashboard/expenses', parentKey: null, order: 13 },
  { key: 'all_expenses', name: 'All Expenses', href: '/dashboard/expenses', parentKey: 'expenses', order: 1 },
  { key: 'expense_categories', name: 'Expense Categories', href: '/dashboard/expenses/categories', parentKey: 'expenses', order: 2 },

  // Reports (Complex hierarchy with 3 levels)
  { key: 'reports', name: 'Reports', href: '/dashboard/reports', parentKey: null, order: 14 },
  { key: 'all_reports_hub', name: 'All Reports Hub', href: '/dashboard/reports', parentKey: 'reports', order: 1 },

  // Sales Reports (2nd level parent)
  { key: 'sales_reports', name: 'Sales Reports', href: '#', parentKey: 'reports', order: 2 },
  { key: 'sales_today', name: 'Sales Today', href: '/dashboard/reports/sales-today', parentKey: 'sales_reports', order: 1 },
  { key: 'sales_history', name: 'Sales History', href: '/dashboard/reports/sales-history', parentKey: 'sales_reports', order: 2 },
  { key: 'sales_report', name: 'Sales Report', href: '/dashboard/reports/sales-report', parentKey: 'sales_reports', order: 3 },
  { key: 'sales_journal', name: 'Sales Journal', href: '/dashboard/reports/sales-journal', parentKey: 'sales_reports', order: 4 },
  { key: 'sales_per_item', name: 'Sales Per Item', href: '/dashboard/reports/sales-per-item', parentKey: 'sales_reports', order: 5 },
  { key: 'sales_per_cashier', name: 'Sales Per Cashier', href: '/dashboard/reports/sales-per-cashier', parentKey: 'sales_reports', order: 6 },
  { key: 'hourly_sales_breakdown', name: 'Hourly Sales Breakdown', href: '/dashboard/reports/sales-by-hour', parentKey: 'sales_reports', order: 7 },
  { key: 'discount_analysis', name: 'Discount Analysis', href: '/dashboard/reports/discount-analysis', parentKey: 'sales_reports', order: 8 },
  { key: 'void_refund_analysis', name: 'Void & Refund Analysis', href: '/dashboard/reports/void-refund-analysis', parentKey: 'sales_reports', order: 9 },

  // Cashier Reports (2nd level parent)
  { key: 'cashier_reports', name: 'Cashier Reports', href: '#', parentKey: 'reports', order: 10 },
  { key: 'cashier_sales_today_menu', name: 'Sales Today (Cashier)', href: '/dashboard/cashier-reports/sales-today', parentKey: 'cashier_reports', order: 1 },
  { key: 'cashier_sales_history_menu', name: 'Sales History (Cashier)', href: '/dashboard/cashier-reports/sales-history', parentKey: 'cashier_reports', order: 2 },
  { key: 'cashier_sales_report_menu', name: 'Sales Invoice Details (Cashier)', href: '/dashboard/cashier-reports/sales-report', parentKey: 'cashier_reports', order: 3 },
  { key: 'cashier_sales_journal_menu', name: 'Sales Journal (Cashier)', href: '/dashboard/cashier-reports/sales-journal', parentKey: 'cashier_reports', order: 4 },
  { key: 'cashier_sales_per_item_menu', name: 'Sales Per Item (Cashier)', href: '/dashboard/cashier-reports/sales-per-item', parentKey: 'cashier_reports', order: 5 },

  // Purchase Reports (2nd level parent)
  { key: 'purchase_reports', name: 'Purchase Reports', href: '/dashboard/reports/purchases', parentKey: 'reports', order: 3 },
  { key: 'purchase_analytics', name: 'Purchase Analytics', href: '/dashboard/reports/purchases/analytics', parentKey: 'purchase_reports', order: 1 },
  { key: 'purchase_trends', name: 'Purchase Trends', href: '/dashboard/reports/purchase-trends', parentKey: 'purchase_reports', order: 2 },
  { key: 'purchase_items_report', name: 'Purchase Items Report', href: '/dashboard/reports/purchases-items', parentKey: 'purchase_reports', order: 3 },
  { key: 'products_suppliers_report', name: 'Products-Suppliers Report', href: '/dashboard/reports/products-suppliers', parentKey: 'purchase_reports', order: 4 },

  // Inventory Reports (2nd level parent)
  { key: 'inventory_reports', name: 'Inventory Reports', href: '#', parentKey: 'reports', order: 4 },
  { key: 'stock_alert_report', name: 'Stock Alert Report', href: '/dashboard/reports/stock-alert', parentKey: 'inventory_reports', order: 1 },
  { key: 'historical_inventory', name: 'Historical Inventory', href: '/dashboard/reports/historical-inventory', parentKey: 'inventory_reports', order: 2 },
  { key: 'inventory_valuation', name: 'Inventory Valuation', href: '/dashboard/reports/inventory-valuation', parentKey: 'inventory_reports', order: 3 },
  { key: 'stock_history_v2', name: 'Stock History V2', href: '/dashboard/reports/stock-history-v2', parentKey: 'inventory_reports', order: 4 },
  { key: 'stock_reconciliation', name: 'Stock Reconciliation', href: '/dashboard/reports/reconciliation', parentKey: 'inventory_reports', order: 5 },

  // Transfer Reports (2nd level parent)
  { key: 'transfer_reports', name: 'Transfer Reports', href: '#', parentKey: 'reports', order: 5 },
  { key: 'transfers_report', name: 'Transfers Report', href: '/dashboard/reports/transfers-report', parentKey: 'transfer_reports', order: 1 },
  { key: 'transfer_trends', name: 'Transfer Trends', href: '/dashboard/reports/transfer-trends', parentKey: 'transfer_reports', order: 2 },
  { key: 'transfers_per_item', name: 'Transfers per Item', href: '/dashboard/reports/transfers-per-item', parentKey: 'transfer_reports', order: 3 },

  // Financial Reports (2nd level parent with nested Expense Reports)
  { key: 'financial_reports', name: 'Financial Reports', href: '#', parentKey: 'reports', order: 6 },
  { key: 'profit_loss_report', name: 'Profit / Loss Report', href: '/dashboard/reports/profit-loss', parentKey: 'financial_reports', order: 1 },
  { key: 'purchase_sale_report', name: 'Purchase & Sale Report', href: '/dashboard/reports/purchase-sale', parentKey: 'financial_reports', order: 2 },
  { key: 'profitability_cogs', name: 'Profitability & COGS', href: '/dashboard/reports/profitability', parentKey: 'financial_reports', order: 3 },
  { key: 'net_profit_report', name: 'Net Profit Report', href: '/dashboard/reports/profit', parentKey: 'financial_reports', order: 4 },
  { key: 'cash_in_out_report', name: 'Cash In/Out Report', href: '/dashboard/reports/cash-in-out', parentKey: 'financial_reports', order: 5 },
  { key: 'unpaid_invoices', name: 'Unpaid Invoices', href: '/dashboard/reports/unpaid-invoices', parentKey: 'financial_reports', order: 6 },
  { key: 'customer_payments', name: 'Customer Payments', href: '/dashboard/reports/customer-payments', parentKey: 'financial_reports', order: 7 },
  { key: 'product_purchase_history', name: 'Product Purchase History', href: '/dashboard/reports/product-purchase-history', parentKey: 'financial_reports', order: 8 },
  { key: 'purchase_returns_report', name: 'Purchase Returns Report', href: '/dashboard/reports/purchase-returns', parentKey: 'financial_reports', order: 9 },
  { key: 'returns_analysis', name: 'Returns Analysis', href: '/dashboard/reports/returns-analysis', parentKey: 'financial_reports', order: 10 },
  { key: 'expense_reports_parent', name: 'Expense Reports', href: '#', parentKey: 'financial_reports', order: 11 },
  { key: 'all_expenses_report', name: 'All Expenses Report', href: '/dashboard/reports/expenses', parentKey: 'expense_reports_parent', order: 1 },
  { key: 'gl_journal_entries', name: 'GL Journal Entries', href: '/dashboard/reports/gl-entries', parentKey: 'financial_reports', order: 12 },

  // Compliance Reports (2nd level parent)
  { key: 'compliance_reports', name: 'Compliance Reports', href: '#', parentKey: 'reports', order: 7 },
  { key: 'bir_daily_sales_summary', name: 'BIR Daily Sales Summary', href: '/dashboard/reports/bir/daily-sales-summary', parentKey: 'compliance_reports', order: 1 },
  { key: 'tax_report', name: 'Tax Report', href: '/dashboard/reports/tax', parentKey: 'compliance_reports', order: 2 },

  // Security & Audit (2nd level parent)
  { key: 'security_audit', name: 'Security & Audit', href: '#', parentKey: 'reports', order: 8 },
  { key: 'audit_trail_report', name: 'Audit Trail Report', href: '/dashboard/reports/audit-trail', parentKey: 'security_audit', order: 1 },

  // HR Reports (2nd level parent)
  { key: 'hr_reports', name: 'HR Reports', href: '#', parentKey: 'reports', order: 9 },
  { key: 'attendance_report', name: 'Attendance Report', href: '/dashboard/reports/attendance', parentKey: 'hr_reports', order: 1 },

  // HR & Attendance
  { key: 'hr_attendance', name: 'HR & Attendance', href: '/dashboard/schedules', parentKey: null, order: 15 },
  { key: 'clock_in_out', name: 'Clock In/Out', href: '/dashboard/clock', parentKey: 'hr_attendance', order: 1 },
  { key: 'employee_schedules', name: 'Employee Schedules', href: '/dashboard/schedules', parentKey: 'hr_attendance', order: 2 },
  { key: 'attendance_records', name: 'Attendance Records', href: '/dashboard/attendance', parentKey: 'hr_attendance', order: 3 },
  { key: 'leave_requests', name: 'Leave Requests', href: '/dashboard/leave-requests', parentKey: 'hr_attendance', order: 4 },
  { key: 'location_change_requests', name: 'Location Change Requests', href: '/dashboard/location-changes', parentKey: 'hr_attendance', order: 5 },

  // Technical Services
  { key: 'technical_services', name: 'Technical Services', href: '/dashboard/technical', parentKey: null, order: 16 },
  { key: 'technical_dashboard', name: 'Dashboard', href: '/dashboard/technical', parentKey: 'technical_services', order: 1 },
  { key: 'warranty_claims', name: 'Warranty Claims', href: '/dashboard/technical/warranty-claims', parentKey: 'technical_services', order: 2 },
  { key: 'job_orders', name: 'Job Orders', href: '/dashboard/technical/job-orders', parentKey: 'technical_services', order: 3 },
  { key: 'technical_serial_lookup', name: 'Serial Number Lookup', href: '/dashboard/technical/serial-lookup', parentKey: 'technical_services', order: 4 },
  { key: 'technicians', name: 'Technicians', href: '/dashboard/technical/technicians', parentKey: 'technical_services', order: 5 },
  { key: 'service_types', name: 'Service Types', href: '/dashboard/technical/service-types', parentKey: 'technical_services', order: 6 },
  { key: 'service_payments', name: 'Service Payments', href: '/dashboard/technical/payments', parentKey: 'technical_services', order: 7 },
  { key: 'technical_reports', name: 'Reports', href: '#', parentKey: 'technical_services', order: 8 },
  { key: 'technician_performance', name: 'Technician Performance', href: '/dashboard/technical/reports/technician-performance', parentKey: 'technical_reports', order: 1 },
  { key: 'service_analytics', name: 'Service Analytics', href: '/dashboard/technical/reports/analytics', parentKey: 'technical_reports', order: 2 },
  { key: 'warranty_claims_report', name: 'Warranty Claims Report', href: '/dashboard/technical/reports/warranty-claims', parentKey: 'technical_reports', order: 3 },

  // Accounting
  { key: 'accounting', name: 'Accounting', href: '/dashboard/accounting/balance-sheet', parentKey: null, order: 17 },
  { key: 'balance_sheet', name: 'Balance Sheet', href: '/dashboard/accounting/balance-sheet', parentKey: 'accounting', order: 1 },
  { key: 'income_statement', name: 'Income Statement', href: '/dashboard/accounting/income-statement', parentKey: 'accounting', order: 2 },
  { key: 'trial_balance', name: 'Trial Balance', href: '/dashboard/accounting/trial-balance', parentKey: 'accounting', order: 3 },
  { key: 'general_ledger', name: 'General Ledger', href: '/dashboard/accounting/general-ledger', parentKey: 'accounting', order: 4 },

  // Administration
  { key: 'administration', name: 'Administration', href: '/dashboard/users', parentKey: null, order: 18 },
  { key: 'users', name: 'Users', href: '/dashboard/users', parentKey: 'administration', order: 1 },
  { key: 'roles_permissions', name: 'Roles & Permissions', href: '/dashboard/roles', parentKey: 'administration', order: 2 },
  { key: 'business_locations', name: 'Business Locations', href: '/dashboard/locations', parentKey: 'administration', order: 3 },
  { key: 'announcements', name: 'Announcements', href: '/dashboard/announcements', parentKey: 'administration', order: 4 },

  // Settings
  { key: 'settings', name: 'Settings', href: '/dashboard/settings', parentKey: null, order: 19 },
  { key: 'business_settings', name: 'Business Settings', href: '/dashboard/business-settings', parentKey: 'settings', order: 1 },
  { key: 'printers', name: 'Printers', href: '/dashboard/printers', parentKey: 'settings', order: 2 },
  { key: 'invoice_settings', name: 'Invoice Settings', href: '/dashboard/settings/invoice-settings', parentKey: 'settings', order: 3 },
  { key: 'barcode_settings', name: 'Barcode Settings', href: '/dashboard/settings/barcode-settings', parentKey: 'settings', order: 4 },
  { key: 'schedule_login_security', name: 'Schedule Login Security', href: '/dashboard/settings/schedule-login', parentKey: 'settings', order: 5 },
  { key: 'sod_rules', name: 'SOD Rules (Separation of Duties)', href: '/dashboard/settings/sod-rules', parentKey: 'settings', order: 6 },
  { key: 'inactivity_timeout', name: 'Inactivity Timeout', href: '/dashboard/settings/inactivity', parentKey: 'settings', order: 7 },
  { key: 'tax_rates', name: 'Tax Rates', href: '/dashboard/settings/tax-rates', parentKey: 'settings', order: 8 },
  { key: 'menu_permissions', name: 'Menu Permissions', href: '/dashboard/settings/menu-permissions', parentKey: 'settings', order: 9 },
  { key: 'menu_management', name: 'Menu Management', href: '/dashboard/settings/menu-management', parentKey: 'settings', order: 10 },

  // User Section
  { key: 'help_center', name: 'Help Center', href: '/dashboard/help', parentKey: null, order: 20 },
  { key: 'notifications', name: 'Notifications', href: '/dashboard/notifications', parentKey: null, order: 21 },
  { key: 'my_profile', name: 'My Profile', href: '/dashboard/profile', parentKey: null, order: 22 },
]

async function main() {
  console.log('🗑️  Clearing all menu permissions...')

  // Delete all role menu permissions
  await prisma.roleMenuPermission.deleteMany({})
  console.log('   Deleted all role menu permissions')

  // Delete all user menu permissions
  await prisma.userMenuPermission.deleteMany({})
  console.log('   Deleted all user menu permissions')

  // Delete all menu permissions
  await prisma.menuPermission.deleteMany({})
  console.log('   Deleted all menu permissions')

  console.log('\n🌱 Reseeding menu permissions...')

  // Create a map to store menu IDs by key
  const menuIdMap: Record<string, number> = {}

  // First pass: Create all parent menus
  for (const item of menuItems.filter(m => m.parentKey === null)) {
    const menu = await prisma.menuPermission.create({
      data: {
        key: item.key,
        name: item.name,
        href: item.href,
        parentId: null,
        order: item.order
      }
    })
    menuIdMap[item.key] = menu.id
    console.log(`✅ Created parent menu: ${item.name}`)
  }

  // Second pass: Create all child menus
  for (const item of menuItems.filter(m => m.parentKey !== null)) {
    const parentId = item.parentKey ? menuIdMap[item.parentKey] : null

    const menu = await prisma.menuPermission.create({
      data: {
        key: item.key,
        name: item.name,
        href: item.href,
        parentId,
        order: item.order
      }
    })
    menuIdMap[item.key] = menu.id
    console.log(`✅ Created child menu: ${item.name} (parent: ${item.parentKey})`)
  }

  console.log(`\n✨ Successfully seeded ${menuItems.length} menu permissions!`)
  console.log('\n📝 Next steps:')
  console.log('1. Go to Settings > Menu Permissions in your dashboard')
  console.log('2. Select a role to configure menu access')
  console.log('3. Check/uncheck menu items as needed')
  console.log('4. Save changes')
}

main()
  .catch((e) => {
    console.error('❌ Error clearing and reseeding menu permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
