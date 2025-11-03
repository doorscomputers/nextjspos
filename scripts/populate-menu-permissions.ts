import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Define all menu items from Sidebar.tsx
// This should match exactly with your Sidebar component structure
const MENU_STRUCTURE = [
  // Dashboard
  {
    key: 'dashboard',
    name: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    order: 1,
    parentId: null
  },

  // Products
  {
    key: 'products',
    name: 'Products',
    href: null,
    icon: 'Package',
    order: 2,
    parentId: null
  },
  {
    key: 'products_list',
    name: 'List Products',
    href: '/dashboard/products',
    icon: 'List',
    order: 1,
    parentKey: 'products'
  },
  {
    key: 'products_add',
    name: 'Add Product',
    href: '/dashboard/products/create',
    icon: 'Plus',
    order: 2,
    parentKey: 'products'
  },
  {
    key: 'products_simple_price_editor',
    name: 'Simple Price Editor',
    href: '/dashboard/products/simple-price-editor',
    icon: 'DollarSign',
    order: 3,
    parentKey: 'products'
  },
  {
    key: 'products_print_labels',
    name: 'Print Labels',
    href: '/dashboard/products/print-labels',
    icon: 'Printer',
    order: 4,
    parentKey: 'products'
  },

  // Purchases
  {
    key: 'purchases',
    name: 'Purchases',
    href: null,
    icon: 'ShoppingCart',
    order: 3,
    parentId: null
  },
  {
    key: 'purchases_list',
    name: 'List Purchases',
    href: '/dashboard/purchases',
    icon: 'List',
    order: 1,
    parentKey: 'purchases'
  },
  {
    key: 'purchases_add',
    name: 'Add Purchase',
    href: '/dashboard/purchases/create',
    icon: 'Plus',
    order: 2,
    parentKey: 'purchases'
  },

  // Sales
  {
    key: 'sales',
    name: 'Sales',
    href: null,
    icon: 'ShoppingBag',
    order: 4,
    parentId: null
  },
  {
    key: 'sales_list',
    name: 'List Sales',
    href: '/dashboard/sales',
    icon: 'List',
    order: 1,
    parentKey: 'sales'
  },
  {
    key: 'sales_pos',
    name: 'POS',
    href: '/dashboard/pos',
    icon: 'CreditCard',
    order: 2,
    parentKey: 'sales'
  },

  // Stock Transfers
  {
    key: 'transfers',
    name: 'Stock Transfers',
    href: null,
    icon: 'Truck',
    order: 5,
    parentId: null
  },
  {
    key: 'transfers_list',
    name: 'List Transfers',
    href: '/dashboard/transfers',
    icon: 'List',
    order: 1,
    parentKey: 'transfers'
  },
  {
    key: 'transfers_create',
    name: 'Create Transfer',
    href: '/dashboard/transfers/create',
    icon: 'Plus',
    order: 2,
    parentKey: 'transfers'
  },

  // Reports
  {
    key: 'reports',
    name: 'Reports',
    href: null,
    icon: 'BarChart3',
    order: 6,
    parentId: null
  },
  {
    key: 'reports_stock_history',
    name: 'Stock History V2',
    href: '/dashboard/reports/stock-history-v2',
    icon: 'History',
    order: 1,
    parentKey: 'reports'
  },
  {
    key: 'reports_stock_pivot',
    name: 'Stock Pivot',
    href: '/dashboard/reports/stock-pivot',
    icon: 'Grid',
    order: 2,
    parentKey: 'reports'
  },
  {
    key: 'reports_purchase_items',
    name: 'Purchase Items Report',
    href: '/dashboard/reports/purchases-items',
    icon: 'FileText',
    order: 3,
    parentKey: 'reports'
  },
  {
    key: 'reports_transfer_export',
    name: 'Transfer Export',
    href: '/dashboard/reports/transfer-export',
    icon: 'Download',
    order: 4,
    parentKey: 'reports'
  },

  // Contacts
  {
    key: 'contacts',
    name: 'Contacts',
    href: null,
    icon: 'Users',
    order: 7,
    parentId: null
  },
  {
    key: 'contacts_suppliers',
    name: 'Suppliers',
    href: '/dashboard/contacts/suppliers',
    icon: 'Truck',
    order: 1,
    parentKey: 'contacts'
  },
  {
    key: 'contacts_customers',
    name: 'Customers',
    href: '/dashboard/contacts/customers',
    icon: 'User',
    order: 2,
    parentKey: 'contacts'
  },

  // Settings
  {
    key: 'settings',
    name: 'Settings',
    href: null,
    icon: 'Settings',
    order: 8,
    parentId: null
  },
  {
    key: 'settings_business',
    name: 'Business Settings',
    href: '/dashboard/settings/business',
    icon: 'Building',
    order: 1,
    parentKey: 'settings'
  },
  {
    key: 'settings_locations',
    name: 'Business Locations',
    href: '/dashboard/settings/locations',
    icon: 'MapPin',
    order: 2,
    parentKey: 'settings'
  },
  {
    key: 'settings_tax_rates',
    name: 'Tax Rates',
    href: '/dashboard/settings/tax-rates',
    icon: 'Percent',
    order: 3,
    parentKey: 'settings'
  },
  {
    key: 'settings_product',
    name: 'Product Settings',
    href: null,
    icon: 'Package',
    order: 4,
    parentKey: 'settings'
  },
  {
    key: 'settings_product_categories',
    name: 'Categories',
    href: '/dashboard/settings/product/categories',
    icon: 'FolderTree',
    order: 1,
    parentKey: 'settings_product'
  },
  {
    key: 'settings_product_brands',
    name: 'Brands',
    href: '/dashboard/settings/product/brands',
    icon: 'Tag',
    order: 2,
    parentKey: 'settings_product'
  },
  {
    key: 'settings_product_units',
    name: 'Units',
    href: '/dashboard/settings/product/units',
    icon: 'Ruler',
    order: 3,
    parentKey: 'settings_product'
  },
  {
    key: 'settings_user_management',
    name: 'User Management',
    href: null,
    icon: 'Users',
    order: 5,
    parentKey: 'settings'
  },
  {
    key: 'settings_users',
    name: 'Users',
    href: '/dashboard/settings/users',
    icon: 'User',
    order: 1,
    parentKey: 'settings_user_management'
  },
  {
    key: 'settings_roles',
    name: 'Roles',
    href: '/dashboard/settings/roles',
    icon: 'Shield',
    order: 2,
    parentKey: 'settings_user_management'
  },
  {
    key: 'settings_menu_permissions',
    name: 'Menu Permissions',
    href: '/dashboard/settings/menu-permissions',
    icon: 'Lock',
    order: 3,
    parentKey: 'settings_user_management'
  },

  // AI Assistant
  {
    key: 'ai_assistant',
    name: 'AI Assistant',
    href: '/dashboard/ai-assistant',
    icon: 'Bot',
    order: 9,
    parentId: null
  }
]

async function populateMenuPermissions() {
  console.log('🔧 Populating Menu Permissions...\n')

  try {
    // Build menu hierarchy map
    const menuMap = new Map<string, number>()

    // First pass: Create all top-level and parent menus
    console.log('📋 Step 1: Creating parent menus...\n')
    for (const menu of MENU_STRUCTURE) {
      if (menu.parentId === null && !menu.parentKey) {
        const existing = await prisma.menuPermission.findUnique({
          where: { key: menu.key }
        })

        if (existing) {
          console.log(`   ✓ ${menu.name} (exists)`)
          menuMap.set(menu.key, existing.id)
        } else {
          const created = await prisma.menuPermission.create({
            data: {
              key: menu.key,
              name: menu.name,
              href: menu.href,
              icon: menu.icon,
              order: menu.order,
              parentId: null
            }
          })
          console.log(`   ✅ ${menu.name} (created)`)
          menuMap.set(menu.key, created.id)
        }
      }
    }

    // Second pass: Create child menus
    console.log('\n📋 Step 2: Creating child menus...\n')
    for (const menu of MENU_STRUCTURE) {
      if (menu.parentKey) {
        const parentId = menuMap.get(menu.parentKey)

        if (!parentId) {
          console.log(`   ⚠️  Parent not found for ${menu.name} (parent: ${menu.parentKey})`)
          continue
        }

        const existing = await prisma.menuPermission.findUnique({
          where: { key: menu.key }
        })

        if (existing) {
          // Update parent if needed
          if (existing.parentId !== parentId) {
            await prisma.menuPermission.update({
              where: { id: existing.id },
              data: { parentId }
            })
            console.log(`   ✓ ${menu.name} (updated parent)`)
          } else {
            console.log(`   ✓ ${menu.name} (exists)`)
          }
          menuMap.set(menu.key, existing.id)
        } else {
          const created = await prisma.menuPermission.create({
            data: {
              key: menu.key,
              name: menu.name,
              href: menu.href,
              icon: menu.icon,
              order: menu.order,
              parentId
            }
          })
          console.log(`   ✅ ${menu.name} (created)`)
          menuMap.set(menu.key, created.id)
        }
      }
    }

    const totalMenus = await prisma.menuPermission.count()

    console.log('\n🎉 Menu permissions populated successfully!')
    console.log(`\n📊 Total menus in database: ${totalMenus}`)
    console.log('\n📝 Next steps:')
    console.log('1. Go to /dashboard/settings/menu-permissions')
    console.log('2. Select a role')
    console.log('3. You should now see all menu items')
    console.log('4. Check/uncheck menus to control visibility')
    console.log('5. Click Save Changes')
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

populateMenuPermissions()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
