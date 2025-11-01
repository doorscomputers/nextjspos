/**
 * COMPREHENSIVE FIX: Sync Menu Permissions with RBAC Permissions for ALL Roles
 *
 * This script ensures that for EVERY role in the system:
 * - If a role has menu permission for a menu item
 * - They also have the required RBAC permission for that menu
 *
 * This fixes the dual-permission check issue across the entire application.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Complete mapping of menu keys to their required RBAC permissions
// Extracted from Sidebar.tsx
const MENU_TO_RBAC_MAP: Record<string, string | null> = {
  // Core
  'dashboard': 'dashboard.view',
  'analytics_dashboard_v1': 'dashboard.view',
  'analytics_dashboard_v2': 'dashboard.view',
  'analytics_dashboard_v3': 'dashboard.view',

  // POS & Sales
  'pos_sales': 'sell.create',
  'point_of_sale': 'sell.create',
  'begin_shift': 'shift.open',
  'close_shift': 'shift.close',
  'x_reading': 'x_reading',
  'z_reading': 'z_reading',
  'readings_history': 'x_reading',
  'sales_list': 'sell.view_own',

  // Inventory Management
  'inventory_management': 'product.view',
  'list_products': 'product.view',
  'list_products_v2': 'product.view',
  'add_product': 'product.create',
  'add_product_v2': 'product.create',
  'all_branch_stock': 'product.view',
  'branch_stock_pivot': 'product.view',
  'branch_stock_pivot_v2': 'product.view',
  'inventory_corrections': 'inventory_correction.view',
  'physical_inventory': 'physical_inventory.export',
  'print_labels': 'product.view',
  'import_products': 'product.create',
  'import_branch_stock': 'superadmin.all',
  'csv_id_mapper': 'superadmin.all',
  'categories': 'product.category.view',
  'import_categories': 'superadmin.all',
  'brands': 'product.brand.view',
  'import_brands': 'superadmin.all',
  'units': 'product.unit.view',
  'warranties': 'product.warranty.view',
  'bulk_reorder_settings': 'product.update',

  // Pricing Management
  'pricing_management': 'product.price.edit',
  'bulk_price_editor': 'product.price.bulk_edit',
  'pricing_settings': 'pricing.settings.view',
  'price_comparison': 'product.price_comparison.view',
  'cost_audit': 'product.cost_audit.view',

  // Purchases
  'purchases': 'purchase.view',
  'purchase_orders': 'purchase.view',
  'goods_received': 'purchase.receipt.view',
  'serial_number_lookup': 'purchase.receipt.view',
  'reorder_suggestions': 'purchase.view',
  'accounts_payable': 'accounts_payable.view',
  'payments': 'payment.view',
  'banks': 'bank.view',
  'bank_transactions': 'bank.transaction.view',
  'post_dated_cheques': 'payment.view',

  // Stock Transfers
  'stock_transfers': 'stock_transfer.view',
  'all_transfers': 'stock_transfer.view',
  'create_transfer': 'stock_transfer.create',
  'my_transfers_report': 'stock_transfer.view',
  'my_received_transfers_report': 'stock_transfer.view',

  // Returns
  'returns_management': 'customer_return.view',
  'customer_returns': 'customer_return.view',
  'purchase_returns': 'purchase.return.view',
  'supplier_returns': 'purchase.return.view',

  // Contacts
  'customers': 'customer.view',
  'all_customers': 'customer.view',
  'import_customers': 'superadmin.all',
  'suppliers': 'supplier.view',
  'all_suppliers': 'supplier.view',
  'import_suppliers': 'superadmin.all',

  // Expenses
  'expenses': 'expense.view',
  'all_expenses': 'expense.view',
  'expense_categories': 'expense.view',

  // Reports
  'reports': 'report.view',
  'all_reports_hub': 'report.view',
  'sales_reports': 'sales_report.view',
  'sales_today': 'report.sales_today',
  'sales_history': 'report.sales_history',
  'sales_report': 'report.sales_view',
  'sales_journal': 'sales_report.journal',
  'sales_per_item': 'sales_report.per_item',
  'sales_per_cashier': 'sales_report.per_cashier',
  'hourly_sales_breakdown': 'report.sales_by_hour',
  'discount_analysis': 'sales_report.discount_analysis',
  'void_refund_analysis': 'report.void_refund_analysis',
  'purchase_reports': 'report.purchase_view',
  'purchase_analytics': 'report.purchase_analytics',
  'purchase_trends': 'report.purchase_trends',
  'purchase_items_report': 'report.purchase_items',
  'products_suppliers_report': 'report.purchase_view',
  'inventory_reports': 'report.view',
  'stock_alert_report': 'report.stock_alert',
  'historical_inventory': 'view_inventory_reports',
  'inventory_valuation': 'product.view',
  'stock_history_v2': 'product.view',
  'stock_reconciliation': 'report.view',
  'transfer_reports': 'report.transfer_view',
  'transfers_report': 'report.transfer_view',
  'transfer_trends': 'report.transfer_view',
  'transfers_per_item': 'stock_transfer.view',
  'financial_reports': 'report.view',
  'profit_loss_report': 'report.profit_loss',
  'purchase_sale_report': 'report.view',
  'profitability_cogs': 'report.profitability',
  'net_profit_report': 'report.profit_loss',
  'cash_in_out_report': 'report.cash_in_out',
  'unpaid_invoices': 'report.unpaid_invoices',
  'customer_payments': 'report.customer_payments',
  'product_purchase_history': 'report.product_purchase_history',
  'purchase_returns_report': 'purchase.return.view',
  'returns_analysis': 'purchase.return.view',
  'expense_reports_parent': 'expense.view',
  'all_expenses_report': 'expense.view',
  'gl_journal_entries': 'report.view',
  'compliance_reports': 'report.view',
  'bir_daily_sales_summary': 'report.view',
  'tax_report': 'report.view',
  'security_audit': 'audit_log.view',
  'audit_trail_report': 'audit_log.view',
  'hr_reports': 'attendance.report',
  'attendance_report': 'attendance.report',

  // HR & Attendance
  'hr_attendance': 'schedule.view',
  'clock_in_out': 'attendance.clock_in',
  'employee_schedules': 'schedule.view',
  'attendance_records': 'attendance.view',
  'leave_requests': 'leave_request.view_own',
  'location_change_requests': 'location_change_request.view',

  // Technical Services
  'technical_services': 'warranty_claim.view',
  'technical_dashboard': 'warranty_claim.view',
  'warranty_claims': 'warranty_claim.view',
  'job_orders': 'job_order.view',
  'technical_serial_lookup': 'serial_number.view',
  'technicians': 'technician.view',
  'service_types': 'warranty_claim.view',
  'service_payments': 'warranty_claim.view',
  'technical_reports': 'warranty_claim.view',
  'technician_performance': 'technician_performance.view',
  'service_analytics': 'warranty_claim.view',
  'warranty_claims_report': 'warranty_claim.view',

  // Accounting
  'accounting': 'accounting.access',
  'balance_sheet': 'accounting.balance_sheet.view',
  'income_statement': 'accounting.income_statement.view',
  'trial_balance': 'accounting.trial_balance.view',
  'general_ledger': 'accounting.general_ledger.view',

  // Administration
  'administration': 'user.view',
  'users': 'user.view',
  'roles_permissions': 'role.view',
  'business_locations': 'location.view',
  'announcements': 'announcement.view',

  // Settings
  'settings': 'business_settings.view',
  'business_settings': 'business_settings.view',
  'printers': 'printer.view',
  'invoice_settings': 'business_settings.view',
  'barcode_settings': 'business_settings.view',
  'schedule_login_security': 'business_settings.view',
  'sod_rules': 'business_settings.view',
  'inactivity_timeout': 'business_settings.view',
  'tax_rates': 'business_settings.view',
  'menu_permissions': 'role.view',
  'menu_management': 'role.update',

  // User Section
  'help_center': null, // No permission check
  'notifications': 'leave_request.approve',
  'my_profile': null, // No permission check
}

async function syncAllRolePermissions() {
  console.log('\n🔧 COMPREHENSIVE FIX: Syncing Menu & RBAC Permissions for ALL Roles\n')
  console.log('='.repeat(100))

  // Get ALL roles
  const allRoles = await prisma.role.findMany({
    include: {
      menuPermissions: {
        include: {
          menuPermission: true
        }
      },
      permissions: {
        include: {
          permission: true
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log(`\n📊 Found ${allRoles.length} roles in the system\n`)

  let totalRolesProcessed = 0
  let totalPermissionsAdded = 0
  const roleResults: Array<{
    roleName: string
    menusChecked: number
    permissionsAdded: number
    permissionsSkipped: number
    missingPermissions: string[]
  }> = []

  for (const role of allRoles) {
    console.log(`\n${'─'.repeat(100)}`)
    console.log(`\n🔍 Processing: ${role.name} (ID: ${role.id})`)
    console.log(`   Menu Permissions: ${role.menuPermissions.length}`)
    console.log(`   RBAC Permissions: ${role.permissions.length}`)

    // Get existing RBAC permission names for this role
    const existingRBACPermissions = new Set(
      role.permissions.map(rp => rp.permission.name)
    )

    const missingPermissions: string[] = []
    let permissionsAdded = 0
    let permissionsSkipped = 0

    // For each menu permission this role has, check if they have the RBAC permission
    for (const roleMenuPerm of role.menuPermissions) {
      const menuKey = roleMenuPerm.menuPermission.key
      const requiredRBACPerm = MENU_TO_RBAC_MAP[menuKey]

      // Skip if no RBAC permission required (like Help Center, My Profile)
      if (!requiredRBACPerm) {
        continue
      }

      // Check if role already has this RBAC permission
      if (existingRBACPermissions.has(requiredRBACPerm)) {
        permissionsSkipped++
        continue
      }

      // Missing! Need to add it
      console.log(`   ⚠️  Menu "${roleMenuPerm.menuPermission.name}" (${menuKey}) requires RBAC: ${requiredRBACPerm} - MISSING`)
      missingPermissions.push(requiredRBACPerm)

      // Find the RBAC permission in database
      const rbacPermission = await prisma.permission.findFirst({
        where: { name: requiredRBACPerm }
      })

      if (!rbacPermission) {
        console.log(`      ❌ RBAC permission "${requiredRBACPerm}" not found in database! Skipping...`)
        continue
      }

      // Add the RBAC permission to this role
      try {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: rbacPermission.id
          }
        })
        console.log(`      ✅ ADDED: ${requiredRBACPerm}`)
        permissionsAdded++
        totalPermissionsAdded++
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Already exists (shouldn't happen but just in case)
          console.log(`      ✓ Already exists: ${requiredRBACPerm}`)
          permissionsSkipped++
        } else {
          console.error(`      ❌ Error adding ${requiredRBACPerm}:`, error.message)
        }
      }
    }

    roleResults.push({
      roleName: role.name,
      menusChecked: role.menuPermissions.length,
      permissionsAdded,
      permissionsSkipped,
      missingPermissions
    })

    totalRolesProcessed++

    if (permissionsAdded > 0) {
      console.log(`\n   ✅ ${role.name}: Added ${permissionsAdded} RBAC permission(s), ${permissionsSkipped} already existed`)
    } else {
      console.log(`\n   ✓ ${role.name}: All RBAC permissions already in sync (${permissionsSkipped} checked)`)
    }
  }

  // Summary Report
  console.log('\n' + '='.repeat(100))
  console.log('\n📊 FINAL SUMMARY REPORT\n')
  console.log('='.repeat(100))

  console.log(`\n✅ Roles Processed: ${totalRolesProcessed}`)
  console.log(`✅ Total RBAC Permissions Added: ${totalPermissionsAdded}`)

  const rolesWithChanges = roleResults.filter(r => r.permissionsAdded > 0)
  const rolesWithoutChanges = roleResults.filter(r => r.permissionsAdded === 0)

  if (rolesWithChanges.length > 0) {
    console.log(`\n🔧 Roles with Changes (${rolesWithChanges.length}):`)
    rolesWithChanges.forEach(result => {
      console.log(`\n   ${result.roleName}:`)
      console.log(`      Menus Checked: ${result.menusChecked}`)
      console.log(`      Permissions Added: ${result.permissionsAdded}`)
      console.log(`      Permissions Skipped: ${result.permissionsSkipped}`)
      if (result.missingPermissions.length > 0) {
        console.log(`      Missing Permissions Added:`)
        result.missingPermissions.forEach(perm => {
          console.log(`         • ${perm}`)
        })
      }
    })
  }

  if (rolesWithoutChanges.length > 0) {
    console.log(`\n✅ Roles Already in Sync (${rolesWithoutChanges.length}):`)
    rolesWithoutChanges.forEach(result => {
      console.log(`   • ${result.roleName} (${result.menusChecked} menus checked)`)
    })
  }

  console.log('\n' + '='.repeat(100))

  if (totalPermissionsAdded > 0) {
    console.log('\n🎉 SUCCESS! Menu and RBAC permissions are now synchronized across ALL roles!')
    console.log('\n📝 IMPORTANT NEXT STEPS:')
    console.log('   1. All users with affected roles should LOG OUT')
    console.log('   2. Log back in to refresh their session')
    console.log('   3. All menu items should now appear correctly in the sidebar')
    console.log('   4. The dual-permission check issue is now FIXED system-wide!\n')
  } else {
    console.log('\n✅ System already in perfect sync! No changes needed.\n')
  }
}

syncAllRolePermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
