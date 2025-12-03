import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get Warehouse Manager role
  const role = await prisma.role.findFirst({
    where: { name: 'Warehouse Manager' }
  })

  if (!role) {
    console.log('Warehouse Manager role not found')
    return
  }

  console.log('Warehouse Manager role ID:', role.id)

  // Get current menu permissions
  const currentMenus = await prisma.roleMenuPermission.findMany({
    where: { roleId: role.id },
    include: { menuPermission: true }
  })

  console.log('\nCurrent menu permissions:', currentMenus.length)
  currentMenus.forEach(m => console.log(' -', m.menuPermission.key))

  // Menu keys we need to add
  const menuKeysToAdd = ['customers', 'all_customers', 'customer_opening_balance']

  for (const key of menuKeysToAdd) {
    // Find the menu permission
    let menuPerm = await prisma.menuPermission.findFirst({
      where: { key }
    })

    if (!menuPerm) {
      // Create it
      const parentId = key !== 'customers'
        ? (await prisma.menuPermission.findFirst({ where: { key: 'customers' } }))?.id
        : null

      menuPerm = await prisma.menuPermission.create({
        data: {
          key,
          name: key === 'customer_opening_balance' ? 'Opening Balance' :
                key === 'customers' ? 'Customers' : 'All Customers',
          href: key === 'customer_opening_balance' ? '/dashboard/customers/opening-balance' :
                '/dashboard/customers',
          parentId,
          order: key === 'customer_opening_balance' ? 2 : 0
        }
      })
      console.log(`Created MenuPermission: ${key}`)
    }

    // Check if already linked
    const existing = await prisma.roleMenuPermission.findFirst({
      where: { roleId: role.id, menuPermissionId: menuPerm.id }
    })

    if (!existing) {
      await prisma.roleMenuPermission.create({
        data: { roleId: role.id, menuPermissionId: menuPerm.id }
      })
      console.log(`Added ${key} to Warehouse Manager`)
    } else {
      console.log(`${key} already assigned`)
    }
  }

  console.log('\nDone! Log out and log back in.')
  await prisma.$disconnect()
}

main()
