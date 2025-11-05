import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Extract all menu keys from Sidebar.tsx
const SIDEBAR_MENUS = [
  // Core
  { key: 'dashboard', name: 'Dashboard', href: '/dashboard', parent: null },

  // Cashier Reports Root
  { key: 'cashier_reports_root', name: 'Cashier Reports', href: '/dashboard/cashier-reports', parent: null },
  { key: 'cashier_sales_today', name: 'Sales Today', href: '/dashboard/cashier-reports/sales-today', parent: 'cashier_reports_root' },

  // Analytics Dashboards
  { key: 'analytics_dashboard_v1', name: 'Analytics Dashboard V1', href: '/dashboard/dashboard-v2', parent: null },
  { key: 'analytics_dashboard_v2', name: 'Analytics Dashboard V2', href: '/dashboard/analytics-devextreme', parent: null },
  { key: 'analytics_dashboard_v3', name: 'Analytics Dashboard V3', href: '/dashboard/dashboard-v3', parent: null },
  { key: 'dashboard_v4', name: 'Dashboard V4', href: '/dashboard/dashboard-v4', parent: null },

  // POS & Sales
  { key: 'pos_sales', name: 'POS & Sales', href: '/dashboard/pos', parent: null },
  { key: 'point_of_sale', name: 'Point of Sale', href: '/dashboard/pos', parent: 'pos_sales' },
  { key: 'begin_shift', name: 'Begin Shift', href: '/dashboard/shifts/begin', parent: 'pos_sales' },
  { key: 'close_shift', name: 'Close Shift', href: '/dashboard/shifts/close', parent: 'pos_sales' },
  { key: 'x_reading', name: 'X Reading', href: '/dashboard/readings/x-reading', parent: 'pos_sales' },
  { key: 'z_reading', name: 'Z Reading', href: '/dashboard/readings/z-reading', parent: 'pos_sales' },
  { key: 'readings_history', name: 'Readings History', href: '/dashboard/readings/history', parent: 'pos_sales' },
  { key: 'sales_list', name: 'Sales List', href: '/dashboard/sales', parent: 'pos_sales' },

  // Inventory Management
  { key: 'inventory_management', name: 'Inventory Management', href: '/dashboard/products', parent: null },
  { key: 'list_products', name: 'List Products', href: '/dashboard/products', parent: 'inventory_management' },
  { key: 'list_products_v2', name: 'List Products V2', href: '/dashboard/products/list-v2', parent: 'inventory_management' },
  { key: 'add_product', name: 'Add Product', href: '/dashboard/products/add', parent: 'inventory_management' },
  { key: 'add_product_v2', name: 'Add Product V2', href: '/dashboard/products/add-v2', parent: 'inventory_management' },
  { key: 'all_branch_stock', name: 'All Branch Stock', href: '/dashboard/products/stock', parent: 'inventory_management' },
  { key: 'branch_stock_pivot', name: 'Branch Stock Pivot', href: '/dashboard/products/branch-stock-pivot', parent: 'inventory_management' },
  { key: 'branch_stock_pivot_v2', name: 'Branch Stock Pivot V2', href: '/dashboard/products/branch-stock-pivot-v2', parent: 'inventory_management' },
  { key: 'inventory_corrections', name: 'Inventory Corrections', href: '/dashboard/inventory-corrections', parent: 'inventory_management' },
  { key: 'physical_inventory', name: 'Physical Inventory', href: '/dashboard/physical-inventory', parent: 'inventory_management' },
  { key: 'print_labels', name: 'Print Labels', href: '/dashboard/products/print-labels', parent: 'inventory_management' },
  { key: 'import_products', name: 'Import Products', href: '/dashboard/products/import', parent: 'inventory_management' },
  { key: 'import_branch_stock', name: 'Import Branch Stock', href: '/dashboard/products/import-branch-stock', parent: 'inventory_management' },
  { key: 'csv_id_mapper', name: 'CSV ID Mapper', href: '/dashboard/products/csv-id-mapper', parent: 'inventory_management' },
  { key: 'categories', name: 'Categories', href: '/dashboard/products/categories', parent: 'inventory_management' },
  { key: 'import_categories', name: 'Import Categories', href: '/dashboard/products/categories/import', parent: 'inventory_management' },
  { key: 'brands', name: 'Brands', href: '/dashboard/products/brands', parent: 'inventory_management' },
  { key: 'import_brands', name: 'Import Brands', href: '/dashboard/products/brands/import', parent: 'inventory_management' },
  { key: 'units', name: 'Units', href: '/dashboard/products/units', parent: 'inventory_management' },
  { key: 'warranties', name: 'Warranties', href: '/dashboard/products/warranties', parent: 'inventory_management' },
  { key: 'bulk_reorder_settings', name: 'Bulk Reorder Settings', href: '/dashboard/products/bulk-reorder-update', parent: 'inventory_management' },

  // Pricing Management
  { key: 'pricing_management', name: 'Price Editor', href: '/dashboard/products/simple-price-editor', parent: null },
  { key: 'simple_price_editor', name: 'Price Editor', href: '/dashboard/products/simple-price-editor', parent: 'pricing_management' },
  { key: 'bulk_price_editor', name: 'Legacy Bulk Editor', href: '/dashboard/products/bulk-price-editor', parent: 'pricing_management' },
  { key: 'pricing_settings', name: 'Pricing Settings', href: '/dashboard/settings/pricing', parent: 'pricing_management' },
  { key: 'price_comparison', name: 'Price Comparison', href: '/dashboard/reports/price-comparison', parent: 'pricing_management' },
  { key: 'cost_audit', name: 'Cost Audit', href: '/dashboard/reports/cost-audit', parent: 'pricing_management' },

  // Purchases
  { key: 'purchases', name: 'Purchases', href: '/dashboard/purchases', parent: null },
  { key: 'purchase_orders', name: 'Purchase Orders', href: '/dashboard/purchases', parent: 'purchases' },
  { key: 'goods_received', name: 'Goods Received (GRN)', href: '/dashboard/purchases/receipts', parent: 'purchases' },
  { key: 'serial_number_lookup', name: 'Serial Number Lookup', href: '/dashboard/serial-lookup', parent: 'purchases' },
  { key: 'reorder_suggestions', name: 'Reorder Suggestions', href: '/dashboard/purchases/suggestions', parent: 'purchases' },
  { key: 'accounts_payable', name: 'Accounts Payable', href: '/dashboard/accounts-payable', parent: 'purchases' },
  { key: 'payments', name: 'Payments', href: '/dashboard/payments', parent: 'purchases' },
  { key: 'banks', name: 'Banks', href: '/dashboard/banks', parent: 'purchases' },
  { key: 'bank_transactions', name: 'Bank Transactions', href: '/dashboard/bank-transactions', parent: 'purchases' },
  { key: 'post_dated_cheques', name: 'Post-Dated Cheques', href: '/dashboard/post-dated-cheques', parent: 'purchases' },

  // Stock Transfers
  { key: 'stock_transfers', name: 'Stock Transfers', href: '/dashboard/transfers', parent: null },
  { key: 'all_transfers', name: 'All Transfers', href: '/dashboard/transfers', parent: 'stock_transfers' },
  { key: 'create_transfer', name: 'Create Transfer', href: '/dashboard/transfers/create', parent: 'stock_transfers' },
  { key: 'my_transfers_report', name: 'My Transfers', href: '/dashboard/reports/my-transfers', parent: 'stock_transfers' },
  { key: 'my_received_transfers_report', name: 'My Received Transfers', href: '/dashboard/reports/my-received-transfers', parent: 'stock_transfers' },

  // Returns Management
  { key: 'returns_management', name: 'Returns Management', href: '/dashboard/customer-returns', parent: null },
  { key: 'customer_returns', name: 'Customer Returns', href: '/dashboard/customer-returns', parent: 'returns_management' },
  { key: 'purchase_returns', name: 'Purchase Returns', href: '/dashboard/purchases/returns', parent: 'returns_management' },
  { key: 'supplier_returns', name: 'Supplier Returns', href: '/dashboard/supplier-returns', parent: 'returns_management' },

  // Customers
  { key: 'customers', name: 'Customers', href: '/dashboard/customers', parent: null },
  { key: 'all_customers', name: 'All Customers', href: '/dashboard/customers', parent: 'customers' },
  { key: 'import_customers', name: 'Import Customers', href: '/dashboard/customers/import', parent: 'customers' },

  // Suppliers
  { key: 'suppliers', name: 'Suppliers', href: '/dashboard/suppliers', parent: null },
  { key: 'all_suppliers', name: 'All Suppliers', href: '/dashboard/suppliers', parent: 'suppliers' },
  { key: 'import_suppliers', name: 'Import Suppliers', href: '/dashboard/suppliers/import', parent: 'suppliers' },

  // Expenses
  { key: 'expenses', name: 'Expenses', href: '/dashboard/expenses', parent: null },
  { key: 'all_expenses', name: 'All Expenses', href: '/dashboard/expenses', parent: 'expenses' },
  { key: 'expense_categories', name: 'Expense Categories', href: '/dashboard/expenses/categories', parent: 'expenses' },

  // Reports (Main)
  { key: 'reports', name: 'Reports', href: '/dashboard/reports', parent: null },
  { key: 'all_reports_hub', name: 'All Reports Hub', href: '/dashboard/reports', parent: 'reports' },

  // Sales Reports
  { key: 'sales_reports', name: 'Sales Reports', href: '#', parent: 'reports' },
  { key: 'sales_today', name: 'Sales Today', href: '/dashboard/reports/sales-today', parent: 'sales_reports' },
  { key: 'sales_history', name: 'Sales History', href: '/dashboard/reports/sales-history', parent: 'sales_reports' },
  { key: 'sales_report', name: 'Sales Invoice Details', href: '/dashboard/reports/sales-report', parent: 'sales_reports' },
  { key: 'sales_journal', name: 'Sales Journal', href: '/dashboard/reports/sales-journal', parent: 'sales_reports' },
  { key: 'sales_per_item', name: 'Sales Per Item', href: '/dashboard/reports/sales-per-item', parent: 'sales_reports' },
  { key: 'sales_per_cashier', name: 'Sales Per Cashier', href: '/dashboard/reports/sales-per-cashier', parent: 'sales_reports' },
  { key: 'hourly_sales_breakdown', name: 'Hourly Sales Breakdown', href: '/dashboard/reports/sales-by-hour', parent: 'sales_reports' },
  { key: 'discount_analysis', name: 'Discount Analysis', href: '/dashboard/reports/discount-analysis', parent: 'sales_reports' },
  { key: 'void_refund_analysis', name: 'Void & Refund Analysis', href: '/dashboard/reports/void-refund-analysis', parent: 'sales_reports' },

  // Cashier Reports (under Reports)
  { key: 'cashier_reports', name: 'Cashier Reports', href: '#', parent: 'reports' },
  { key: 'cashier_sales_today_menu', name: 'Sales Today (Cashier)', href: '/dashboard/cashier-reports/sales-today', parent: 'cashier_reports' },
  { key: 'cashier_sales_history_menu', name: 'Sales History (Cashier)', href: '/dashboard/cashier-reports/sales-history', parent: 'cashier_reports' },
  { key: 'cashier_sales_report_menu', name: 'Sales Invoice Details (Cashier)', href: '/dashboard/cashier-reports/sales-report', parent: 'cashier_reports' },
  { key: 'cashier_sales_journal_menu', name: 'Sales Journal (Cashier)', href: '/dashboard/cashier-reports/sales-journal', parent: 'cashier_reports' },
  { key: 'cashier_sales_per_item_menu', name: 'Sales Per Item (Cashier)', href: '/dashboard/cashier-reports/sales-per-item', parent: 'cashier_reports' },

  // Purchase Reports
  { key: 'purchase_reports', name: 'Purchase Reports', href: '#', parent: 'reports' },
  { key: 'purchase_reports_hub', name: 'Purchase Reports Hub', href: '/dashboard/reports/purchases', parent: 'purchase_reports' },
  { key: 'purchase_analytics', name: 'Purchase Analytics', href: '/dashboard/reports/purchases/analytics', parent: 'purchase_reports' },
  { key: 'purchase_trends', name: 'Purchase Trends', href: '/dashboard/reports/purchase-trends', parent: 'purchase_reports' },
  { key: 'purchase_items_report', name: 'Purchase Items Report', href: '/dashboard/reports/purchases-items', parent: 'purchase_reports' },
  { key: 'products_suppliers_report', name: 'Products-Suppliers Report', href: '/dashboard/reports/products-suppliers', parent: 'purchase_reports' },

  // Inventory Reports
  { key: 'inventory_reports', name: 'Inventory Reports', href: '#', parent: 'reports' },
  { key: 'stock_alert_report', name: 'Stock Alert Report', href: '/dashboard/reports/stock-alert', parent: 'inventory_reports' },
  { key: 'historical_inventory', name: 'Historical Inventory', href: '/dashboard/reports/historical-inventory', parent: 'inventory_reports' },
  { key: 'inventory_valuation', name: 'Inventory Valuation', href: '/dashboard/reports/inventory-valuation', parent: 'inventory_reports' },
  { key: 'inventory_valuation_history', name: 'Inventory Valuation History', href: '/dashboard/reports/inventory-valuation-history', parent: 'inventory_reports' },
  { key: 'stock_history_v2', name: 'Stock History V2', href: '/dashboard/reports/stock-history-v2', parent: 'inventory_reports' },
  { key: 'stock_history_v3', name: 'Stock History V3 (Admin)', href: '/dashboard/reports/stock-history-v3', parent: 'inventory_reports' },
  { key: 'stock_reconciliation', name: 'Stock Reconciliation', href: '/dashboard/reports/reconciliation', parent: 'inventory_reports' },

  // Transfer Reports
  { key: 'transfer_reports', name: 'Transfer Reports', href: '#', parent: 'reports' },
  { key: 'transfers_report', name: 'Transfers Report', href: '/dashboard/reports/transfers-report', parent: 'transfer_reports' },
  { key: 'transfer_trends', name: 'Transfer Trends', href: '/dashboard/reports/transfer-trends', parent: 'transfer_reports' },
  { key: 'transfers_per_item', name: 'Transfers per Item', href: '/dashboard/reports/transfers-per-item', parent: 'transfer_reports' },

  // Financial Reports
  { key: 'financial_reports', name: 'Financial Reports', href: '#', parent: 'reports' },
  { key: 'profit_loss_report', name: 'Profit / Loss Report', href: '/dashboard/reports/profit-loss', parent: 'financial_reports' },
  { key: 'purchase_sale_report', name: 'Purchase & Sale Report', href: '/dashboard/reports/purchase-sale', parent: 'financial_reports' },
  { key: 'profitability_cogs', name: 'Profitability & COGS', href: '/dashboard/reports/profitability', parent: 'financial_reports' },
  { key: 'net_profit_report', name: 'Net Profit Report', href: '/dashboard/reports/profit', parent: 'financial_reports' },
  { key: 'cash_in_out_report', name: 'Cash In/Out Report', href: '/dashboard/reports/cash-in-out', parent: 'financial_reports' },
  { key: 'unpaid_invoices', name: 'Unpaid Invoices', href: '/dashboard/reports/unpaid-invoices', parent: 'financial_reports' },
  { key: 'customer_payments', name: 'Customer Payments', href: '/dashboard/reports/customer-payments', parent: 'financial_reports' },
  { key: 'product_purchase_history', name: 'Product Purchase History', href: '/dashboard/reports/product-purchase-history', parent: 'financial_reports' },
  { key: 'purchase_returns_report', name: 'Purchase Returns Report', href: '/dashboard/reports/purchase-returns', parent: 'financial_reports' },
  { key: 'returns_analysis', name: 'Returns Analysis', href: '/dashboard/reports/returns-analysis', parent: 'financial_reports' },

  // Expense Reports (nested under Financial Reports)
  { key: 'expense_reports_parent', name: 'Expense Reports', href: '#', parent: 'financial_reports' },
  { key: 'expense_analytics', name: 'Expense Analytics', href: '/dashboard/reports/expenses-analytics', parent: 'expense_reports_parent' },
  { key: 'all_expenses_report', name: 'All Expenses Report', href: '/dashboard/reports/expenses', parent: 'expense_reports_parent' },

  { key: 'gl_journal_entries', name: 'GL Journal Entries', href: '/dashboard/reports/gl-entries', parent: 'financial_reports' },

  // Compliance Reports
  { key: 'compliance_reports', name: 'Compliance Reports', href: '#', parent: 'reports' },
  { key: 'bir_daily_sales_summary', name: 'BIR Daily Sales Summary', href: '/dashboard/reports/bir/daily-sales-summary', parent: 'compliance_reports' },
  { key: 'tax_report', name: 'Tax Report', href: '/dashboard/reports/tax', parent: 'compliance_reports' },

  // Security & Audit
  { key: 'security_audit', name: 'Security & Audit', href: '#', parent: 'reports' },
  { key: 'audit_trail_report', name: 'Audit Trail Report', href: '/dashboard/reports/audit-trail', parent: 'security_audit' },

  // HR Reports
  { key: 'hr_reports', name: 'HR Reports', href: '#', parent: 'reports' },
  { key: 'attendance_report', name: 'Attendance Report', href: '/dashboard/reports/attendance', parent: 'hr_reports' },

  // HR & Attendance
  { key: 'hr_attendance', name: 'HR & Attendance', href: '/dashboard/schedules', parent: null },
  { key: 'clock_in_out', name: 'Clock In/Out', href: '/dashboard/clock', parent: 'hr_attendance' },
  { key: 'employee_schedules', name: 'Employee Schedules', href: '/dashboard/schedules', parent: 'hr_attendance' },
  { key: 'attendance_records', name: 'Attendance Records', href: '/dashboard/attendance', parent: 'hr_attendance' },
  { key: 'leave_requests', name: 'Leave Requests', href: '/dashboard/leave-requests', parent: 'hr_attendance' },
  { key: 'location_change_requests', name: 'Location Change Requests', href: '/dashboard/location-changes', parent: 'hr_attendance' },

  // Technical Services
  { key: 'technical_services', name: 'Technical Services', href: '/dashboard/technical', parent: null },
  { key: 'technical_dashboard', name: 'Dashboard', href: '/dashboard/technical', parent: 'technical_services' },
  { key: 'warranty_claims', name: 'Warranty Claims', href: '/dashboard/technical/warranty-claims', parent: 'technical_services' },
  { key: 'job_orders', name: 'Job Orders', href: '/dashboard/technical/job-orders', parent: 'technical_services' },
  { key: 'technical_serial_lookup', name: 'Serial Number Lookup', href: '/dashboard/technical/serial-lookup', parent: 'technical_services' },
  { key: 'technicians', name: 'Technicians', href: '/dashboard/technical/technicians', parent: 'technical_services' },
  { key: 'service_types', name: 'Service Types', href: '/dashboard/technical/service-types', parent: 'technical_services' },
  { key: 'service_payments', name: 'Service Payments', href: '/dashboard/technical/payments', parent: 'technical_services' },

  // Technical Reports (nested)
  { key: 'technical_reports', name: 'Reports', href: '#', parent: 'technical_services' },
  { key: 'technician_performance', name: 'Technician Performance', href: '/dashboard/technical/reports/technician-performance', parent: 'technical_reports' },
  { key: 'service_analytics', name: 'Service Analytics', href: '/dashboard/technical/reports/analytics', parent: 'technical_reports' },
  { key: 'warranty_claims_report', name: 'Warranty Claims Report', href: '/dashboard/technical/reports/warranty-claims', parent: 'technical_reports' },

  // Accounting
  { key: 'accounting', name: 'Accounting', href: '/dashboard/accounting/balance-sheet', parent: null },
  { key: 'balance_sheet', name: 'Balance Sheet', href: '/dashboard/accounting/balance-sheet', parent: 'accounting' },
  { key: 'income_statement', name: 'Income Statement', href: '/dashboard/accounting/income-statement', parent: 'accounting' },
  { key: 'trial_balance', name: 'Trial Balance', href: '/dashboard/accounting/trial-balance', parent: 'accounting' },
  { key: 'general_ledger', name: 'General Ledger', href: '/dashboard/accounting/general-ledger', parent: 'accounting' },

  // Administration
  { key: 'administration', name: 'Administration', href: '/dashboard/users', parent: null },
  { key: 'users', name: 'Users', href: '/dashboard/users', parent: 'administration' },
  { key: 'roles_permissions', name: 'Roles & Permissions', href: '/dashboard/roles', parent: 'administration' },
  { key: 'business_locations', name: 'Business Locations', href: '/dashboard/locations', parent: 'administration' },
  { key: 'announcements', name: 'Announcements', href: '/dashboard/announcements', parent: 'administration' },
  { key: 'login_history', name: 'Login History', href: '/dashboard/admin/login-history', parent: 'administration' },

  // Settings
  { key: 'settings', name: 'Settings', href: '/dashboard/settings', parent: null },
  { key: 'business_settings', name: 'Business Settings', href: '/dashboard/business-settings', parent: 'settings' },
  { key: 'printers', name: 'Printers', href: '/dashboard/printers', parent: 'settings' },
  { key: 'invoice_settings', name: 'Invoice Settings', href: '/dashboard/settings/invoice-settings', parent: 'settings' },
  { key: 'barcode_settings', name: 'Barcode Settings', href: '/dashboard/settings/barcode-settings', parent: 'settings' },
  { key: 'schedule_login_security', name: 'Schedule Login Security', href: '/dashboard/settings/schedule-login', parent: 'settings' },
  { key: 'sod_rules', name: 'SOD Rules (Separation of Duties)', href: '/dashboard/settings/sod-rules', parent: 'settings' },
  { key: 'inactivity_timeout', name: 'Inactivity Timeout', href: '/dashboard/settings/inactivity', parent: 'settings' },
  { key: 'tax_rates', name: 'Tax Rates', href: '/dashboard/settings/tax-rates', parent: 'settings' },
  { key: 'menu_permissions', name: 'Menu Permissions', href: '/dashboard/settings/menu-permissions', parent: 'settings' },
  { key: 'menu_management', name: 'Menu Management', href: '/dashboard/settings/menu-management', parent: 'settings' },

  // Bottom menus (no parent)
  { key: 'ai_assistant', name: 'AI Assistant', href: '/dashboard/ai-assistant', parent: null },
  { key: 'help_center', name: 'Help Center', href: '/dashboard/help', parent: null },
  { key: 'notifications', name: 'Notifications', href: '/dashboard/notifications', parent: null },
  { key: 'my_profile', name: 'My Profile', href: '/dashboard/profile', parent: null },
]

async function auditAllMenuPermissions() {
  console.log('🔍 COMPREHENSIVE MENU PERMISSIONS AUDIT\n')
  console.log('=' .repeat(80))
  console.log()

  try {
    // Get all roles
    const allRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['Super Admin', 'Admin', 'All Branch Admin', 'Warehouse Manager', 'Manager', 'Cashier']
        }
      },
      orderBy: { name: 'asc' }
    })

    console.log(`📊 Found ${allRoles.length} roles to audit:\n`)
    allRoles.forEach(role => {
      console.log(`   - ${role.name} (ID: ${role.id})`)
    })
    console.log()
    console.log('=' .repeat(80))
    console.log()

    // Get all existing menu permissions
    const existingMenuPerms = await prisma.menuPermission.findMany()
    const existingKeys = new Set(existingMenuPerms.map(mp => mp.key))

    // Get all role-menu permission links
    const roleMenuLinks = await prisma.roleMenuPermission.findMany({
      include: {
        menuPermission: true,
        role: true
      }
    })

    // Organize by menu key and role
    const linksByMenuKey: Record<string, Set<string>> = {}
    for (const link of roleMenuLinks) {
      if (!linksByMenuKey[link.menuPermission.key]) {
        linksByMenuKey[link.menuPermission.key] = new Set()
      }
      linksByMenuKey[link.menuPermission.key].add(link.role.name)
    }

    // AUDIT RESULTS
    const missingMenuRecords: typeof SIDEBAR_MENUS = []
    const partiallyLinkedMenus: Array<{ menu: typeof SIDEBAR_MENUS[0], missingRoles: string[] }> = []
    const fullyConfiguredMenus: typeof SIDEBAR_MENUS = []

    console.log('🔍 AUDIT RESULTS:\n')
    console.log('=' .repeat(80))
    console.log()

    for (const menu of SIDEBAR_MENUS) {
      if (!existingKeys.has(menu.key)) {
        missingMenuRecords.push(menu)
      } else {
        const linkedRoles = linksByMenuKey[menu.key] || new Set()
        const missingRoles = allRoles
          .map(r => r.name)
          .filter(roleName => !linkedRoles.has(roleName))

        if (missingRoles.length > 0) {
          partiallyLinkedMenus.push({ menu, missingRoles })
        } else {
          fullyConfiguredMenus.push(menu)
        }
      }
    }

    // Print missing menu records
    if (missingMenuRecords.length > 0) {
      console.log(`❌ MISSING MENU RECORDS (${missingMenuRecords.length}):\n`)
      console.log('These menus exist in Sidebar.tsx but have NO database record:\n')
      missingMenuRecords.forEach(menu => {
        console.log(`   ❌ ${menu.key}`)
        console.log(`      Name: ${menu.name}`)
        console.log(`      Href: ${menu.href}`)
        console.log(`      Parent: ${menu.parent || 'ROOT'}`)
        console.log()
      })
      console.log('=' .repeat(80))
      console.log()
    }

    // Print partially linked menus
    if (partiallyLinkedMenus.length > 0) {
      console.log(`⚠️  PARTIALLY CONFIGURED MENUS (${partiallyLinkedMenus.length}):\n`)
      console.log('These menus exist but are NOT linked to all roles:\n')
      partiallyLinkedMenus.forEach(({ menu, missingRoles }) => {
        console.log(`   ⚠️  ${menu.key} - ${menu.name}`)
        console.log(`      Missing roles: ${missingRoles.join(', ')}`)
        console.log()
      })
      console.log('=' .repeat(80))
      console.log()
    }

    // Print summary
    console.log('📊 SUMMARY:\n')
    console.log(`   ✅ Fully Configured: ${fullyConfiguredMenus.length} menus`)
    console.log(`   ⚠️  Partially Configured: ${partiallyLinkedMenus.length} menus`)
    console.log(`   ❌ Missing Records: ${missingMenuRecords.length} menus`)
    console.log(`   📋 Total Menus in Sidebar: ${SIDEBAR_MENUS.length}`)
    console.log()

    if (missingMenuRecords.length > 0 || partiallyLinkedMenus.length > 0) {
      console.log('💡 RECOMMENDATION:\n')
      console.log('   Run the comprehensive fix script to resolve all issues at once!')
      console.log('   Script: scripts/fix-all-menu-permissions.ts')
      console.log()
    } else {
      console.log('✅ ALL MENUS ARE PROPERLY CONFIGURED!\n')
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Audit failed:', error)
    throw error
  }
}

auditAllMenuPermissions()
  .then(() => {
    console.log('✅ Audit completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Audit failed:', error)
    process.exit(1)
  })
