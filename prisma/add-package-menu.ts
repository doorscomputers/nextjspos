import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addPackageTemplateMenu() {
  console.log('🚀 Adding Package Templates menu to MenuPermission table...\n')

  try {
    // 1. Check if menu already exists
    const existingMenu = await prisma.menuPermission.findUnique({
      where: { key: 'menu.package_templates' }
    })

    if (existingMenu) {
      console.log('✅ Menu already exists:', existingMenu.name)
    } else {
      // 2. Get the highest order number to place the menu at the end (or after specific section)
      const maxOrder = await prisma.menuPermission.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true }
      })

      // 3. Create the menu permission
      const newMenu = await prisma.menuPermission.create({
        data: {
          key: 'menu.package_templates',
          name: 'Package Templates',
          href: '/dashboard/package-templates',
          icon: 'CubeIcon',
          order: (maxOrder?.order || 0) + 1,
          parentId: null  // Root level menu
        }
      })

      console.log('✅ Created menu:', newMenu.name, '(ID:', newMenu.id, ')')
    }

    // 4. Get the menu ID
    const menu = await prisma.menuPermission.findUnique({
      where: { key: 'menu.package_templates' }
    })

    if (!menu) {
      console.error('❌ Failed to get menu')
      return
    }

    // 5. Get roles that should have this menu
    const rolesToUpdate = await prisma.role.findMany({
      where: {
        name: {
          in: [
            'Super Admin',
            'System Administrator',
            'Admin',
            'All Branch Admin',
            'Warehouse Manager',
            'Cross-Location Approver',
            'Sales Supervisor',
            'Sales Cashier',
            'Manager',
            'Branch Manager'
          ]
        }
      }
    })

    console.log('\n📋 Found roles to assign menu:', rolesToUpdate.map(r => r.name).join(', '))

    // 6. Assign menu to each role
    for (const role of rolesToUpdate) {
      try {
        await prisma.roleMenuPermission.upsert({
          where: {
            roleId_menuPermissionId: {
              roleId: role.id,
              menuPermissionId: menu.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            menuPermissionId: menu.id
          }
        })
        console.log(`✅ Assigned menu to ${role.name}`)
      } catch (e: any) {
        // Ignore if already exists
      }
    }

    console.log('\n🎉 Done! Package Templates menu added.')
    console.log('\n⚠️  Users need to LOG OUT and LOG BACK IN to see the new menu!')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addPackageTemplateMenu()
