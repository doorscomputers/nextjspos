import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Define all menu items with their hierarchy
// This should match your Sidebar.tsx menu structure
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

  // Administration
  { key: 'administration', name: 'Administration', href: '/dashboard/users', parentKey: null, order: 7 },
  { key: 'users', name: 'Users', href: '/dashboard/users', parentKey: 'administration', order: 1 },
  { key: 'roles_permissions', name: 'Roles & Permissions', href: '/dashboard/roles', parentKey: 'administration', order: 2 },
  { key: 'business_locations', name: 'Business Locations', href: '/dashboard/locations', parentKey: 'administration', order: 3 },
  { key: 'announcements', name: 'Announcements', href: '/dashboard/announcements', parentKey: 'administration', order: 4 },

  // Settings
  { key: 'settings', name: 'Settings', href: '/dashboard/settings', parentKey: null, order: 8 },
  { key: 'business_settings', name: 'Business Settings', href: '/dashboard/business-settings', parentKey: 'settings', order: 1 },
  { key: 'printers', name: 'Printers', href: '/dashboard/printers', parentKey: 'settings', order: 2 },
  { key: 'invoice_settings', name: 'Invoice Settings', href: '/dashboard/settings/invoice-settings', parentKey: 'settings', order: 3 },
  { key: 'barcode_settings', name: 'Barcode Settings', href: '/dashboard/settings/barcode-settings', parentKey: 'settings', order: 4 },
  { key: 'schedule_login_security', name: 'Schedule Login Security', href: '/dashboard/settings/schedule-login', parentKey: 'settings', order: 5 },
  { key: 'sod_rules', name: 'SOD Rules (Separation of Duties)', href: '/dashboard/settings/sod-rules', parentKey: 'settings', order: 6 },
  { key: 'inactivity_timeout', name: 'Inactivity Timeout', href: '/dashboard/settings/inactivity', parentKey: 'settings', order: 7 },
  { key: 'tax_rates', name: 'Tax Rates', href: '/dashboard/settings/tax-rates', parentKey: 'settings', order: 8 },
  { key: 'menu_permissions', name: 'Menu Permissions', href: '/dashboard/settings/menu-permissions', parentKey: 'settings', order: 9 },

  // User Section
  { key: 'help_center', name: 'Help Center', href: '/dashboard/help', parentKey: null, order: 9 },
  { key: 'notifications', name: 'Notifications', href: '/dashboard/notifications', parentKey: null, order: 10 },
  { key: 'my_profile', name: 'My Profile', href: '/dashboard/profile', parentKey: null, order: 11 },
]

async function main() {
  console.log('🌱 Seeding menu permissions...')

  // Create a map to store menu IDs by key
  const menuIdMap: Record<string, number> = {}

  // First pass: Create all parent menus
  for (const item of menuItems.filter(m => m.parentKey === null)) {
    const menu = await prisma.menuPermission.upsert({
      where: { key: item.key },
      update: {
        name: item.name,
        href: item.href,
        order: item.order
      },
      create: {
        key: item.key,
        name: item.name,
        href: item.href,
        parentId: null,
        order: item.order
      }
    })
    menuIdMap[item.key] = menu.id
    console.log(`✅ Created/Updated parent menu: ${item.name}`)
  }

  // Second pass: Create all child menus
  for (const item of menuItems.filter(m => m.parentKey !== null)) {
    const parentId = item.parentKey ? menuIdMap[item.parentKey] : null

    const menu = await prisma.menuPermission.upsert({
      where: { key: item.key },
      update: {
        name: item.name,
        href: item.href,
        parentId,
        order: item.order
      },
      create: {
        key: item.key,
        name: item.name,
        href: item.href,
        parentId,
        order: item.order
      }
    })
    menuIdMap[item.key] = menu.id
    console.log(`✅ Created/Updated child menu: ${item.name} (parent: ${item.parentKey})`)
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
    console.error('❌ Error seeding menu permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
