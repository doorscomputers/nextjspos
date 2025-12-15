import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

/**
 * Sync all menus from the populate script's MENU_STRUCTURE
 * This endpoint creates/updates all menus based on the definitive menu structure
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // This is the same structure from populate-menu-permissions.ts
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
      },

      // Package Templates
      {
        key: 'menu.package_templates',
        name: 'Package Templates',
        href: '/dashboard/package-templates',
        icon: 'CubeIcon',
        order: 10,
        parentId: null
      },
      {
        key: 'menu.package_templates_2',
        name: 'Package Template 2',
        href: '/dashboard/package-templates-2',
        icon: 'CubeIcon',
        order: 11,
        parentId: null
      }
    ]

    // Build menu hierarchy map
    const menuMap = new Map<string, number>()
    let addedCount = 0
    let updatedCount = 0

    // First pass: Create all top-level and parent menus
    for (const menu of MENU_STRUCTURE) {
      if (menu.parentId === null && !('parentKey' in menu)) {
        const existing = await prisma.menuPermission.findUnique({
          where: { key: menu.key }
        })

        if (existing) {
          // Update if needed
          await prisma.menuPermission.update({
            where: { id: existing.id },
            data: {
              name: menu.name,
              href: menu.href,
              icon: menu.icon,
              order: menu.order
            }
          })
          updatedCount++
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
          addedCount++
          menuMap.set(menu.key, created.id)
        }
      }
    }

    // Second pass: Create child menus
    for (const menu of MENU_STRUCTURE) {
      if ('parentKey' in menu && menu.parentKey) {
        const parentId = menuMap.get(menu.parentKey)

        if (!parentId) {
          console.warn(`Parent not found for ${menu.name} (parent: ${menu.parentKey})`)
          continue
        }

        const existing = await prisma.menuPermission.findUnique({
          where: { key: menu.key }
        })

        if (existing) {
          // Update if needed
          await prisma.menuPermission.update({
            where: { id: existing.id },
            data: {
              name: menu.name,
              href: menu.href,
              icon: menu.icon,
              order: menu.order,
              parentId
            }
          })
          updatedCount++
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
          addedCount++
          menuMap.set(menu.key, created.id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        added: addedCount,
        updated: updatedCount,
        total: await prisma.menuPermission.count()
      }
    })

  } catch (error) {
    console.error('Error syncing menus:', error)
    return NextResponse.json(
      { error: 'Failed to sync menus' },
      { status: 500 }
    )
  }
}
