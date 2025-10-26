/**
 * Seed Menu Permissions
 *
 * This script seeds the menu_permissions table with the menu structure
 * from the Sidebar component. Run this once after creating the tables.
 *
 * Usage: npx tsx scripts/seed-menu-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MenuItemDef {
  key: string
  name: string
  href: string | null
  icon: string | null
  order: number
  children?: MenuItemDef[]
}

// Menu structure extracted from Sidebar.tsx
const menuStructure: MenuItemDef[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    href: '/dashboard',
    icon: 'HomeIcon',
    order: 1,
  },
  {
    key: 'analytics_dashboard',
    name: 'Analytics Dashboard',
    href: '/dashboard/dashboard-v2',
    icon: 'ChartBarIcon',
    order: 2,
  },
  {
    key: 'pos_and_sales',
    name: 'POS & Sales',
    href: null,
    icon: 'ShoppingCartIcon',
    order: 3,
    children: [
      {
        key: 'pos_and_sales_pos',
        name: 'Point of Sale',
        href: '/dashboard/pos',
        icon: 'ShoppingCartIcon',
        order: 1,
      },
      {
        key: 'pos_and_sales_begin_shift',
        name: 'Begin Shift',
        href: '/dashboard/shifts/begin',
        icon: 'ShoppingCartIcon',
        order: 2,
      },
      {
        key: 'pos_and_sales_close_shift',
        name: 'Close Shift',
        href: '/dashboard/shifts/close',
        icon: 'ShoppingCartIcon',
        order: 3,
      },
      {
        key: 'pos_and_sales_x_reading',
        name: 'X Reading',
        href: '/dashboard/readings/x-reading',
        icon: 'DocumentTextIcon',
        order: 4,
      },
      {
        key: 'pos_and_sales_z_reading',
        name: 'Z Reading',
        href: '/dashboard/readings/z-reading',
        icon: 'DocumentTextIcon',
        order: 5,
      },
      {
        key: 'pos_and_sales_readings_history',
        name: 'Readings History',
        href: '/dashboard/readings/history',
        icon: 'ClockIcon',
        order: 6,
      },
      {
        key: 'pos_and_sales_sales_list',
        name: 'Sales List',
        href: '/dashboard/sales',
        icon: 'ShoppingCartIcon',
        order: 7,
      },
    ],
  },
  {
    key: 'inventory_management',
    name: 'Inventory Management',
    href: null,
    icon: 'CubeIcon',
    order: 4,
    children: [
      {
        key: 'inventory_list_products',
        name: 'List Products',
        href: '/dashboard/products',
        icon: 'CubeIcon',
        order: 1,
      },
      {
        key: 'inventory_list_products_v2',
        name: 'List Products V2',
        href: '/dashboard/products/list-v2',
        icon: 'ChartBarIcon',
        order: 2,
      },
      {
        key: 'inventory_add_product',
        name: 'Add Product',
        href: '/dashboard/products/add',
        icon: 'CubeIcon',
        order: 3,
      },
      {
        key: 'inventory_add_product_v2',
        name: 'Add Product V2',
        href: '/dashboard/products/add-v2',
        icon: 'SparklesIcon',
        order: 4,
      },
      {
        key: 'inventory_all_branch_stock',
        name: 'All Branch Stock',
        href: '/dashboard/products/stock',
        icon: 'CubeIcon',
        order: 5,
      },
      {
        key: 'inventory_branch_stock_pivot',
        name: 'Branch Stock Pivot',
        href: '/dashboard/products/branch-stock-pivot',
        icon: 'CubeIcon',
        order: 6,
      },
      {
        key: 'inventory_branch_stock_pivot_v2',
        name: 'Branch Stock Pivot V2',
        href: '/dashboard/products/branch-stock-pivot-v2',
        icon: 'ChartBarIcon',
        order: 7,
      },
      {
        key: 'inventory_corrections',
        name: 'Inventory Corrections',
        href: '/dashboard/inventory-corrections',
        icon: 'ClipboardDocumentListIcon',
        order: 8,
      },
      {
        key: 'inventory_physical_inventory',
        name: 'Physical Inventory',
        href: '/dashboard/physical-inventory',
        icon: 'ClipboardDocumentListIcon',
        order: 9,
      },
      {
        key: 'inventory_print_labels',
        name: 'Print Labels',
        href: '/dashboard/products/print-labels',
        icon: 'CubeIcon',
        order: 10,
      },
      {
        key: 'inventory_import_products',
        name: 'Import Products',
        href: '/dashboard/products/import',
        icon: 'CubeIcon',
        order: 11,
      },
      {
        key: 'inventory_import_branch_stock',
        name: 'Import Branch Stock',
        href: '/dashboard/products/import-branch-stock',
        icon: 'CubeIcon',
        order: 12,
      },
      {
        key: 'inventory_csv_id_mapper',
        name: 'CSV ID Mapper',
        href: '/dashboard/products/csv-id-mapper',
        icon: 'CubeIcon',
        order: 13,
      },
      {
        key: 'inventory_categories',
        name: 'Categories',
        href: '/dashboard/products/categories',
        icon: 'CubeIcon',
        order: 14,
      },
      {
        key: 'inventory_import_categories',
        name: 'Import Categories',
        href: '/dashboard/products/categories/import',
        icon: 'CubeIcon',
        order: 15,
      },
      {
        key: 'inventory_brands',
        name: 'Brands',
        href: '/dashboard/products/brands',
        icon: 'CubeIcon',
        order: 16,
      },
      {
        key: 'inventory_import_brands',
        name: 'Import Brands',
        href: '/dashboard/products/brands/import',
        icon: 'CubeIcon',
        order: 17,
      },
      {
        key: 'inventory_units',
        name: 'Units',
        href: '/dashboard/products/units',
        icon: 'CubeIcon',
        order: 18,
      },
      {
        key: 'inventory_warranties',
        name: 'Warranties',
        href: '/dashboard/products/warranties',
        icon: 'CubeIcon',
        order: 19,
      },
      {
        key: 'inventory_bulk_reorder_settings',
        name: 'Bulk Reorder Settings',
        href: '/dashboard/products/bulk-reorder-update',
        icon: 'CubeIcon',
        order: 20,
      },
    ],
  },
  {
    key: 'purchases',
    name: 'Purchases',
    href: null,
    icon: 'TruckIcon',
    order: 5,
    children: [
      {
        key: 'purchases_purchase_orders',
        name: 'Purchase Orders',
        href: '/dashboard/purchases',
        icon: 'TruckIcon',
        order: 1,
      },
      {
        key: 'purchases_goods_received',
        name: 'Goods Received (GRN)',
        href: '/dashboard/purchases/receipts',
        icon: 'ClipboardDocumentListIcon',
        order: 2,
      },
      {
        key: 'purchases_serial_number_lookup',
        name: 'Serial Number Lookup',
        href: '/dashboard/serial-lookup',
        icon: 'DocumentTextIcon',
        order: 3,
      },
      {
        key: 'purchases_reorder_suggestions',
        name: 'Reorder Suggestions',
        href: '/dashboard/purchases/suggestions',
        icon: 'ExclamationTriangleIcon',
        order: 4,
      },
      {
        key: 'purchases_accounts_payable',
        name: 'Accounts Payable',
        href: '/dashboard/accounts-payable',
        icon: 'DocumentTextIcon',
        order: 5,
      },
      {
        key: 'purchases_payments',
        name: 'Payments',
        href: '/dashboard/payments',
        icon: 'CurrencyDollarIcon',
        order: 6,
      },
      {
        key: 'purchases_banks',
        name: 'Banks',
        href: '/dashboard/banks',
        icon: 'CurrencyDollarIcon',
        order: 7,
      },
      {
        key: 'purchases_bank_transactions',
        name: 'Bank Transactions',
        href: '/dashboard/bank-transactions',
        icon: 'CurrencyDollarIcon',
        order: 8,
      },
      {
        key: 'purchases_post_dated_cheques',
        name: 'Post-Dated Cheques',
        href: '/dashboard/post-dated-cheques',
        icon: 'DocumentTextIcon',
        order: 9,
      },
    ],
  },
  {
    key: 'stock_transfers',
    name: 'Stock Transfers',
    href: null,
    icon: 'TruckIcon',
    order: 6,
    children: [
      {
        key: 'stock_transfers_all_transfers',
        name: 'All Transfers',
        href: '/dashboard/transfers',
        icon: 'TruckIcon',
        order: 1,
      },
      {
        key: 'stock_transfers_create_transfer',
        name: 'Create Transfer',
        href: '/dashboard/transfers/create',
        icon: 'TruckIcon',
        order: 2,
      },
    ],
  },
  {
    key: 'returns_management',
    name: 'Returns Management',
    href: null,
    icon: 'ArrowUturnLeftIcon',
    order: 7,
    children: [
      {
        key: 'returns_customer_returns',
        name: 'Customer Returns',
        href: '/dashboard/customer-returns',
        icon: 'ArrowUturnLeftIcon',
        order: 1,
      },
      {
        key: 'returns_purchase_returns',
        name: 'Purchase Returns',
        href: '/dashboard/purchases/returns',
        icon: 'ArrowUturnLeftIcon',
        order: 2,
      },
      {
        key: 'returns_supplier_returns',
        name: 'Supplier Returns',
        href: '/dashboard/supplier-returns',
        icon: 'ArrowUturnLeftIcon',
        order: 3,
      },
    ],
  },
  {
    key: 'customers',
    name: 'Customers',
    href: '/dashboard/customers',
    icon: 'UserGroupIcon',
    order: 8,
  },
  {
    key: 'suppliers',
    name: 'Suppliers',
    href: null,
    icon: 'BuildingStorefrontIcon',
    order: 9,
    children: [
      {
        key: 'suppliers_all_suppliers',
        name: 'All Suppliers',
        href: '/dashboard/suppliers',
        icon: 'BuildingStorefrontIcon',
        order: 1,
      },
      {
        key: 'suppliers_import_suppliers',
        name: 'Import Suppliers',
        href: '/dashboard/suppliers/import',
        icon: 'BuildingStorefrontIcon',
        order: 2,
      },
    ],
  },
  {
    key: 'expenses',
    name: 'Expenses',
    href: '/dashboard/expenses',
    icon: 'CreditCardIcon',
    order: 10,
  },
  {
    key: 'reports',
    name: 'Reports',
    href: null,
    icon: 'ChartBarIcon',
    order: 11,
    children: [
      {
        key: 'reports_all_reports_hub',
        name: 'All Reports Hub',
        href: '/dashboard/reports',
        icon: 'ChartBarIcon',
        order: 1,
      },
      // Sales Reports submenu
      {
        key: 'reports_sales',
        name: 'Sales Reports',
        href: null,
        icon: 'ShoppingCartIcon',
        order: 2,
      },
      // Purchase Reports submenu
      {
        key: 'reports_purchase',
        name: 'Purchase Reports',
        href: null,
        icon: 'TruckIcon',
        order: 3,
      },
      // Inventory Reports submenu
      {
        key: 'reports_inventory',
        name: 'Inventory Reports',
        href: null,
        icon: 'CubeIcon',
        order: 4,
      },
      // Transfer Reports submenu
      {
        key: 'reports_transfer',
        name: 'Transfer Reports',
        href: null,
        icon: 'TruckIcon',
        order: 5,
      },
      // Financial Reports submenu
      {
        key: 'reports_financial',
        name: 'Financial Reports',
        href: null,
        icon: 'CurrencyDollarIcon',
        order: 6,
      },
      // Compliance Reports submenu
      {
        key: 'reports_compliance',
        name: 'Compliance Reports',
        href: null,
        icon: 'DocumentTextIcon',
        order: 7,
      },
      // Security & Audit submenu
      {
        key: 'reports_security_audit',
        name: 'Security & Audit',
        href: null,
        icon: 'ShieldCheckIcon',
        order: 8,
      },
      // HR Reports submenu
      {
        key: 'reports_hr',
        name: 'HR Reports',
        href: null,
        icon: 'ClockIcon',
        order: 9,
      },
    ],
  },
  {
    key: 'hr_and_attendance',
    name: 'HR & Attendance',
    href: null,
    icon: 'CalendarIcon',
    order: 12,
    children: [
      {
        key: 'hr_clock_in_out',
        name: 'Clock In/Out',
        href: '/dashboard/clock',
        icon: 'ClockIcon',
        order: 1,
      },
      {
        key: 'hr_employee_schedules',
        name: 'Employee Schedules',
        href: '/dashboard/schedules',
        icon: 'CalendarIcon',
        order: 2,
      },
      {
        key: 'hr_attendance_records',
        name: 'Attendance Records',
        href: '/dashboard/attendance',
        icon: 'ClockIcon',
        order: 3,
      },
      {
        key: 'hr_leave_requests',
        name: 'Leave Requests',
        href: '/dashboard/leave-requests',
        icon: 'CalendarIcon',
        order: 4,
      },
      {
        key: 'hr_location_change_requests',
        name: 'Location Change Requests',
        href: '/dashboard/location-changes',
        icon: 'TruckIcon',
        order: 5,
      },
    ],
  },
  {
    key: 'administration',
    name: 'Administration',
    href: null,
    icon: 'UsersIcon',
    order: 13,
    children: [
      {
        key: 'administration_users',
        name: 'Users',
        href: '/dashboard/users',
        icon: 'UsersIcon',
        order: 1,
      },
      {
        key: 'administration_roles_permissions',
        name: 'Roles & Permissions',
        href: '/dashboard/roles',
        icon: 'UsersIcon',
        order: 2,
      },
      {
        key: 'administration_business_locations',
        name: 'Business Locations',
        href: '/dashboard/locations',
        icon: 'BuildingStorefrontIcon',
        order: 3,
      },
      {
        key: 'administration_announcements',
        name: 'Announcements',
        href: '/dashboard/announcements',
        icon: 'SpeakerWaveIcon',
        order: 4,
      },
    ],
  },
  {
    key: 'settings',
    name: 'Settings',
    href: null,
    icon: 'CogIcon',
    order: 14,
    children: [
      {
        key: 'settings_business_settings',
        name: 'Business Settings',
        href: '/dashboard/business-settings',
        icon: 'CogIcon',
        order: 1,
      },
      {
        key: 'settings_printers',
        name: 'Printers',
        href: '/dashboard/printers',
        icon: 'PrinterIcon',
        order: 2,
      },
      {
        key: 'settings_invoice_settings',
        name: 'Invoice Settings',
        href: '/dashboard/settings/invoice-settings',
        icon: 'CogIcon',
        order: 3,
      },
      {
        key: 'settings_barcode_settings',
        name: 'Barcode Settings',
        href: '/dashboard/settings/barcode-settings',
        icon: 'CogIcon',
        order: 4,
      },
      {
        key: 'settings_schedule_login_security',
        name: 'Schedule Login Security',
        href: '/dashboard/settings/schedule-login',
        icon: 'CogIcon',
        order: 5,
      },
      {
        key: 'settings_sod_rules',
        name: 'SOD Rules (Separation of Duties)',
        href: '/dashboard/settings/sod-rules',
        icon: 'ShieldCheckIcon',
        order: 6,
      },
      {
        key: 'settings_inactivity_timeout',
        name: 'Inactivity Timeout',
        href: '/dashboard/settings/inactivity',
        icon: 'ClockIcon',
        order: 7,
      },
      {
        key: 'settings_tax_rates',
        name: 'Tax Rates',
        href: '/dashboard/settings/tax-rates',
        icon: 'CogIcon',
        order: 8,
      },
      {
        key: 'settings_menu_permissions',
        name: 'Menu Permissions',
        href: '/dashboard/settings/menu-permissions',
        icon: 'ShieldCheckIcon',
        order: 9,
      },
    ],
  },
  {
    key: 'notifications',
    name: 'Notifications',
    href: '/dashboard/notifications',
    icon: 'BellAlertIcon',
    order: 15,
  },
  {
    key: 'my_profile',
    name: 'My Profile',
    href: '/dashboard/profile',
    icon: 'UserCircleIcon',
    order: 16,
  },
]

async function seedMenuPermissions() {
  console.log('🌱 Starting menu permissions seed...')

  try {
    // Clear existing menu permissions
    console.log('🗑️  Clearing existing menu permissions...')
    await prisma.userMenuPermission.deleteMany()
    await prisma.roleMenuPermission.deleteMany()
    await prisma.menuPermission.deleteMany()

    // Recursive function to insert menu items
    async function insertMenuItem(
      item: MenuItemDef,
      parentId: number | null = null
    ): Promise<void> {
      const menuItem = await prisma.menuPermission.create({
        data: {
          key: item.key,
          name: item.name,
          href: item.href,
          icon: item.icon,
          order: item.order,
          parentId,
        },
      })

      console.log(`  ✅ Created: ${item.name} (key: ${item.key})`)

      // Recursively insert children
      if (item.children && item.children.length > 0) {
        for (const child of item.children) {
          await insertMenuItem(child, menuItem.id)
        }
      }
    }

    // Insert all top-level items
    for (const item of menuStructure) {
      await insertMenuItem(item)
    }

    console.log('\n✨ Menu permissions seed completed successfully!')
    console.log(`📊 Total menu items created: ${await prisma.menuPermission.count()}`)
  } catch (error) {
    console.error('❌ Error seeding menu permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seed
seedMenuPermissions()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
