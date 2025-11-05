import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addReturnsMenuPermissions() {
  console.log('🔧 Adding Returns Management Menu Permissions to Production...\n')

  try {
    // Find the Warehouse Manager role
    const warehouseManagerRole = await prisma.role.findFirst({
      where: {
        name: 'Warehouse Manager',
      },
    })

    if (!warehouseManagerRole) {
      console.log('❌ Warehouse Manager role not found!')
      console.log('   Please check if the role exists in your database.\n')
      return
    }

    console.log(`✅ Found Warehouse Manager role (ID: ${warehouseManagerRole.id})\n`)

    // Define menu permissions to add
    const menuPermissionsToAdd = [
      {
        key: 'returns_management',
        name: 'Returns Management',
        icon: 'Package',
        href: null,
        parentId: null,
        order: 11,
      },
      {
        key: 'purchase_returns',
        name: 'Purchase Returns',
        icon: 'PackageMinus',
        href: '/dashboard/purchases/returns',
        parentKey: 'returns_management',
        order: 1,
      },
      {
        key: 'supplier_returns',
        name: 'Supplier Returns',
        icon: 'PackageX',
        href: '/dashboard/supplier-returns',
        parentKey: 'returns_management',
        order: 2,
      },
    ]

    console.log('📋 Menu Permissions to Add:\n')

    for (const menuPerm of menuPermissionsToAdd) {
      // Check if menu permission already exists
      let menuPermission = await prisma.menuPermission.findFirst({
        where: { key: menuPerm.key },
      })

      if (menuPermission) {
        console.log(`   ⏭️  ${menuPerm.key} already exists (ID: ${menuPermission.id})`)
      } else {
        // For child menus, we need to find parent first
        let parentId: number | null = null
        if (menuPerm.parentKey) {
          const parentMenu = await prisma.menuPermission.findFirst({
            where: { key: menuPerm.parentKey },
          })
          parentId = parentMenu?.id || null
        }

        // Create menu permission
        menuPermission = await prisma.menuPermission.create({
          data: {
            key: menuPerm.key,
            name: menuPerm.name,
            icon: menuPerm.icon,
            href: menuPerm.href,
            parentId: parentId,
            order: menuPerm.order,
          },
        })
        console.log(`   ✅ Created ${menuPerm.key} (ID: ${menuPermission.id})`)
      }

      // Check if already linked to Warehouse Manager role
      const existingLink = await prisma.roleMenuPermission.findUnique({
        where: {
          roleId_menuPermissionId: {
            roleId: warehouseManagerRole.id,
            menuPermissionId: menuPermission.id,
          },
        },
      })

      if (existingLink) {
        console.log(`      ⏭️  Already linked to Warehouse Manager role`)
      } else {
        // Link to Warehouse Manager role
        await prisma.roleMenuPermission.create({
          data: {
            roleId: warehouseManagerRole.id,
            menuPermissionId: menuPermission.id,
          },
        })
        console.log(`      ✅ Linked to Warehouse Manager role`)
      }
    }

    console.log('\n✅ All menu permissions added and linked successfully!\n')

    // Verify the setup
    console.log('🔍 Verifying Setup...\n')

    const roleWithMenus = await prisma.role.findUnique({
      where: { id: warehouseManagerRole.id },
      include: {
        menuPermissions: {
          include: {
            menuPermission: true,
          },
        },
      },
    })

    const returnsMenus = roleWithMenus?.menuPermissions.filter((rm) =>
      ['returns_management', 'purchase_returns', 'supplier_returns'].includes(
        rm.menuPermission.key
      )
    )

    console.log(`📊 Warehouse Manager now has ${returnsMenus?.length || 0} returns-related menu permissions:`)
    for (const rm of returnsMenus || []) {
      console.log(`   ✅ ${rm.menuPermission.key} - ${rm.menuPermission.name}`)
    }

    console.log('\n📝 Next Steps:')
    console.log('   1. ✅ Menu permissions are now in the database')
    console.log('   2. ⏳ User "Jheiron" must LOGOUT and LOGIN again')
    console.log('   3. ⏳ After login, the Returns Management menu should appear')
    console.log('   4. ⏳ Test by navigating to the menu as Jheiron\n')

    console.log('⚠️  IMPORTANT: Session must be refreshed (logout/login) for changes to take effect!\n')
  } catch (error) {
    console.error('❌ Error adding menu permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addReturnsMenuPermissions()
  .then(() => {
    console.log('✅ Script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
