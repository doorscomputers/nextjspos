import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addMenuPermissionForRole(roleId: number, menuKey: string) {
  // First, find or create the MenuPermission record
  let menuPermission = await prisma.menuPermission.findFirst({
    where: { key: menuKey }
  })

  if (!menuPermission) {
    // Create the menu permission if it doesn't exist
    // Find parent for customers submenu items
    let parentId = null
    if (menuKey === 'customer_opening_balance' || menuKey === 'all_customers') {
      const customersParent = await prisma.menuPermission.findFirst({
        where: { key: 'customers' }
      })
      parentId = customersParent?.id || null
    }

    menuPermission = await prisma.menuPermission.create({
      data: {
        key: menuKey,
        name: menuKey === 'customer_opening_balance' ? 'Opening Balance' :
              menuKey === 'customers' ? 'Customers' :
              menuKey === 'all_customers' ? 'All Customers' : menuKey,
        href: menuKey === 'customer_opening_balance' ? '/dashboard/customers/opening-balance' :
              menuKey === 'customers' ? '/dashboard/customers' :
              menuKey === 'all_customers' ? '/dashboard/customers' : null,
        parentId: parentId,
        order: menuKey === 'customer_opening_balance' ? 2 : 0
      }
    })
    console.log(`Created MenuPermission: ${menuKey} (ID: ${menuPermission.id})`)
  }

  // Check if role already has this menu permission
  const existing = await prisma.roleMenuPermission.findFirst({
    where: {
      roleId: roleId,
      menuPermissionId: menuPermission.id
    }
  })

  if (existing) {
    console.log(`Role already has menu permission: ${menuKey}`)
    return
  }

  // Add the role-menu-permission link
  await prisma.roleMenuPermission.create({
    data: {
      roleId: roleId,
      menuPermissionId: menuPermission.id
    }
  })

  console.log(`SUCCESS: Added ${menuKey} menu permission to role ID ${roleId}`)
}

async function main() {
  try {
    // Find Warehouse Manager role
    const warehouseManagerRole = await prisma.role.findFirst({
      where: { name: 'Warehouse Manager' }
    })

    if (!warehouseManagerRole) {
      console.log('Warehouse Manager role not found')
      return
    }

    console.log('Found Warehouse Manager role ID:', warehouseManagerRole.id)

    // Add menu permissions
    await addMenuPermissionForRole(warehouseManagerRole.id, 'customers')
    await addMenuPermissionForRole(warehouseManagerRole.id, 'all_customers')
    await addMenuPermissionForRole(warehouseManagerRole.id, 'customer_opening_balance')

    console.log('\nDone! Please log out and log back in as Warehouse Manager to see the menu.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
