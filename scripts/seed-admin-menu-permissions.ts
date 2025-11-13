/**
 * Seed Menu Permissions for Admin Roles
 *
 * This script ensures that Super Admin, Admin, All Branch Admin, and System Administrator
 * roles have access to ALL menu items in the system.
 *
 * Run with: npx tsx scripts/seed-admin-menu-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// All menu keys from Sidebar.tsx
const ALL_MENU_KEYS = [
  // Core Operations
  'dashboard',
  'analytics_dashboard_v1',
  'analytics_dashboard_v2',
  'analytics_dashboard_v3',
  'dashboard_v4',

  // Cashier Reports
  'cashier_reports_root',
  'cashier_sales_today',

  // POS & Sales
  'pos_sales',
  'point_of_sale',
  'begin_shift',
  'close_shift',
  'x_reading',
  'z_reading',
  'readings_history',
  'sales_list',

  // Products (Inventory Management)
  'inventory_management',
  'list_products',
  'list_products_v2',
  'add_product',
  'add_product_v2',
  'all_branch_stock',
  'branch_stock_pivot',
  'branch_stock_pivot_v2',
  'inventory_corrections',
  'physical_inventory',
  'print_labels',
  'import_products',
  'import_branch_stock',
  'csv_id_mapper',
  'categories',
  'import_categories',
  'brands',
  'import_brands',
  'units',
  'warranties',
  'bulk_reorder_settings',

  // Pricing Management
  'pricing_management',
  'simple_price_editor',
  'bulk_price_editor',
  'pricing_settings',
  'location_pricing',
  'my_location_pricing',
  'price_comparison',
  'cost_audit',

  // Purchases
  'purchases',
  'purchase_orders',
  'goods_received',
  'serial_number_lookup',
  'serial_number_import',
  'reorder_suggestions',
  'accounts_payable',
  'payments',
  'banks',
  'bank_transactions',
  'post_dated_cheques',

  // Stock Transfers
  'stock_transfers',
  'all_transfers',
  'create_transfer',
  'my_transfers_report',
  'my_received_transfers_report',

  // Returns Management
  'returns_management',
  'customer_returns',
  'purchase_returns',
  'supplier_returns',

  // Customers
  'customers',
  'all_customers',
  'import_customers',

  // Suppliers
  'suppliers',
  'all_suppliers',
  'import_suppliers',

  // Expenses
  'expenses',
  'all_expenses',
  'expense_categories',

  // Reports
  'reports',
  'all_reports_hub',

  // Sales Reports
  'sales_reports',
  'sales_today',
  'sales_history',
  'sales_report',
  'sales_journal',
  'sales_per_item',
  'sales_per_cashier',
  'hourly_sales_breakdown',
  'discount_analysis',
  'void_refund_analysis',

  // Cashier Reports (nested)
  'cashier_reports',
  'cashier_sales_today_report',
  'cashier_sales_history',
  'cashier_invoice_details',
  'cashier_sales_journal',
  'cashier_sales_per_item',

  // Purchase Reports
  'purchase_reports',
  'purchase_reports_hub',
  'purchase_analytics',
  'purchase_trends',
  'purchase_items_report',
  'products_suppliers_report',

  // Inventory Reports
  'inventory_reports',
  'stock_alert_report',
  'historical_inventory',
  'inventory_valuation',
  'inventory_valuation_history',
  'stock_history_v2',
  'stock_history_v3',
  'stock_reconciliation',

  // Transfer Reports
  'transfer_reports',
  'transfers_report',
  'transfer_trends',
  'transfers_per_item',

  // Financial Reports
  'financial_reports',
  'profit_loss_report',
  'purchase_sale_report',
  'profitability_cogs',
  'net_profit_report',
  'cash_in_out_report',
  'unpaid_invoices',
  'customer_payments',
  'payment_collections',
  'accounts_receivable',
  'receivable_payments',
  'product_purchase_history',
  'purchase_returns_report',
  'returns_analysis',
  'gl_journal_entries',

  // Expense Reports (nested under Financial)
  'expense_reports_parent',
  'expense_analytics',
  'all_expenses_report',

  // Compliance Reports
  'compliance_reports',
  'bir_daily_sales_summary',
  'tax_report',

  // Security & Audit
  'security_audit',
  'audit_trail_report',

  // HR Reports
  'hr_reports',
  'attendance_report',

  // HR & Attendance
  'hr_attendance',
  'clock_in_out',
  'employee_schedules',
  'attendance_records',
  'leave_requests',
  'location_change_requests',

  // Technical Services
  'technical_services',
  'technical_dashboard',
  'warranty_claims',
  'job_orders',
  'technical_serial_lookup',
  'technicians',
  'service_types',
  'service_payments',
  'technical_reports',
  'technician_performance',
  'service_analytics',
  'warranty_claims_report',

  // Accounting
  'accounting',
  'balance_sheet',
  'income_statement',
  'trial_balance',
  'general_ledger',

  // Administration
  'administration',
  'users',
  'roles_permissions',
  'business_locations',
  'announcements',
  'login_history',
  'active_users',
  'open_shifts',
  'fix_soft_deleted_variations',

  // Settings
  'settings',
  'business_settings',
  'printers',
  'invoice_settings',
  'barcode_settings',
  'schedule_login_security',
  'sod_rules',
  'inactivity_timeout',
  'tax_rates',
  'menu_permissions',
  'menu_management',

  // User Section (Bottom)
  'ai_assistant',
  'help_center',
  'notifications',
  'my_profile',
]

async function main() {
  console.log('🌱 Starting admin menu permissions seeding...')

  // Get all businesses
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true }
  })

  console.log(`Found ${businesses.length} business(es)`)

  for (const business of businesses) {
    console.log(`\n📦 Processing business: ${business.name} (ID: ${business.id})`)

    // Get admin roles for this business
    const adminRoles = await prisma.role.findMany({
      where: {
        businessId: business.id,
        name: {
          in: ['Super Admin', 'System Administrator', 'Admin', 'All Branch Admin']
        }
      },
      select: { id: true, name: true }
    })

    console.log(`  Found ${adminRoles.length} admin role(s)`)

    if (adminRoles.length === 0) {
      console.log(`  ⚠️  No admin roles found for business ${business.name}`)
      continue
    }

    // Ensure all menu keys exist in MenuPermission table
    console.log(`  Creating/verifying ${ALL_MENU_KEYS.length} menu permissions...`)

    let createdCount = 0
    let existingCount = 0

    for (const menuKey of ALL_MENU_KEYS) {
      const existing = await prisma.menuPermission.findUnique({
        where: { key: menuKey }
      })

      if (!existing) {
        await prisma.menuPermission.create({
          data: {
            key: menuKey,
            name: menuKey.split('_').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')
          }
        })
        createdCount++
      } else {
        existingCount++
      }
    }

    console.log(`  ✅ Menu permissions: ${createdCount} created, ${existingCount} already existed`)

    // Get all menu permission IDs
    const allMenuPermissions = await prisma.menuPermission.findMany({
      where: {
        key: { in: ALL_MENU_KEYS }
      },
      select: { id: true, key: true }
    })

    console.log(`  📋 Found ${allMenuPermissions.length} menu permissions in database`)

    // Assign all menu permissions to each admin role
    for (const role of adminRoles) {
      console.log(`  🔧 Processing role: ${role.name}`)

      // Delete existing menu permissions for this role (clean slate)
      const deleted = await prisma.roleMenuPermission.deleteMany({
        where: { roleId: role.id }
      })
      console.log(`    Removed ${deleted.count} existing menu permission(s)`)

      // Create new assignments
      const assignments = allMenuPermissions.map(mp => ({
        roleId: role.id,
        menuPermissionId: mp.id
      }))

      await prisma.roleMenuPermission.createMany({
        data: assignments,
        skipDuplicates: true
      })

      console.log(`    ✅ Assigned ${assignments.length} menu permissions to ${role.name}`)
    }
  }

  console.log('\n🎉 Admin menu permissions seeded successfully!')
  console.log('\n📝 Summary:')
  console.log(`  - Admin roles now have access to ALL ${ALL_MENU_KEYS.length} menu items`)
  console.log(`  - Roles updated: Super Admin, System Administrator, Admin, All Branch Admin`)
  console.log(`  - These roles will bypass menu permission checks in the UI`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding admin menu permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
