import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkJheironReturnsAccess() {
  console.log('🔍 Checking Jheiron Returns Access...\n')

  // Find Jheiron
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'Jheiron' },
        { username: '@Jheiron' },
        { firstName: 'Jheiron' },
      ]
    },
    include: {
      permissions: {
        include: {
          permission: true
        }
      },
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              },
              menuPermissions: {
                include: {
                  menuPermission: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user) {
    console.log('❌ User Jheiron not found')
    return
  }

  console.log(`✅ Found user: ${user.username} (${user.firstName} ${user.lastName})`)
  console.log(`   Business ID: ${user.businessId}`)
  console.log(`   User ID: ${user.id}\n`)

  // Get all RBAC permissions
  const allPermissions = [
    ...user.permissions.map(up => up.permission.name),
    ...user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
  ]

  console.log('🔑 RBAC Permissions Check:')
  const returnPermissions = [
    'purchase_return.view',
    'purchase_return.create',
    'purchase_return.approve',
    'supplier_return.view',
    'supplier_return.create',
    'supplier_return.approve',
  ]

  for (const perm of returnPermissions) {
    const has = allPermissions.includes(perm)
    console.log(`   ${perm}: ${has ? '✅ YES' : '❌ NO'}`)
  }

  console.log('\n📋 Menu Permissions Check:')

  // Get menu permissions for user's roles
  const menuPermissions: string[] = []
  for (const userRole of user.roles) {
    for (const roleMenu of userRole.role.menuPermissions) {
      menuPermissions.push(roleMenu.menuPermission.key)
    }
  }

  const returnMenus = [
    'returns_management',
    'customer_returns',
    'purchase_returns',
    'supplier_returns'
  ]

  for (const menu of returnMenus) {
    const has = menuPermissions.includes(menu)
    console.log(`   ${menu}: ${has ? '✅ YES' : '❌ NO'}`)
  }

  console.log('\n🔍 Checking Menu Permission Records:')

  const returnsManagementMenu = await prisma.menuPermission.findFirst({
    where: { key: 'returns_management' }
  })

  if (returnsManagementMenu) {
    console.log(`   ✅ returns_management menu exists (ID: ${returnsManagementMenu.id})`)

    // Check if linked to role
    for (const userRole of user.roles) {
      const roleMenuLink = await prisma.roleMenuPermission.findUnique({
        where: {
          roleId_menuPermissionId: {
            roleId: userRole.roleId,
            menuPermissionId: returnsManagementMenu.id
          }
        }
      })

      if (roleMenuLink) {
        console.log(`   ✅ Linked to role: ${userRole.role.name}`)
      } else {
        console.log(`   ❌ NOT linked to role: ${userRole.role.name}`)
      }
    }
  } else {
    console.log('   ❌ returns_management menu does NOT exist in database')
  }

  const purchaseReturnsMenu = await prisma.menuPermission.findFirst({
    where: { key: 'purchase_returns' }
  })

  if (purchaseReturnsMenu) {
    console.log(`   ✅ purchase_returns menu exists (ID: ${purchaseReturnsMenu.id})`)

    for (const userRole of user.roles) {
      const roleMenuLink = await prisma.roleMenuPermission.findUnique({
        where: {
          roleId_menuPermissionId: {
            roleId: userRole.roleId,
            menuPermissionId: purchaseReturnsMenu.id
          }
        }
      })

      if (roleMenuLink) {
        console.log(`   ✅ Linked to role: ${userRole.role.name}`)
      } else {
        console.log(`   ❌ NOT linked to role: ${userRole.role.name}`)
      }
    }
  } else {
    console.log('   ❌ purchase_returns menu does NOT exist in database')
  }

  const supplierReturnsMenu = await prisma.menuPermission.findFirst({
    where: { key: 'supplier_returns' }
  })

  if (supplierReturnsMenu) {
    console.log(`   ✅ supplier_returns menu exists (ID: ${supplierReturnsMenu.id})`)

    for (const userRole of user.roles) {
      const roleMenuLink = await prisma.roleMenuPermission.findUnique({
        where: {
          roleId_menuPermissionId: {
            roleId: userRole.roleId,
            menuPermissionId: supplierReturnsMenu.id
          }
        }
      })

      if (roleMenuLink) {
        console.log(`   ✅ Linked to role: ${userRole.role.name}`)
      } else {
        console.log(`   ❌ NOT linked to role: ${userRole.role.name}`)
      }
    }
  } else {
    console.log('   ❌ supplier_returns menu does NOT exist in database')
  }

  console.log('\n📊 Summary:')
  console.log('   To see Returns Management menu, you need:')
  console.log('   1. ✅ Menu permissions enabled (you did this in UI)')
  console.log('   2. ⏳ Menu permission records in database')
  console.log('   3. ⏳ Menu permissions linked to role')
  console.log('   4. ⏳ User logout/login to refresh session\n')

  await prisma.$disconnect()
}

checkJheironReturnsAccess().catch(console.error)
