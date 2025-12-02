import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  console.log('🔍 Checking Package Templates menu assignment...\n')

  // 1. Get the menu permission for package templates
  const menu = await prisma.menuPermission.findUnique({
    where: { key: 'menu.package_templates' }
  })
  console.log('Menu Permission:', menu ? `ID ${menu.id} - ${menu.name}` : 'NOT FOUND')

  if (!menu) {
    console.log('\n❌ Menu permission does not exist! Run add-package-menu.ts first.')
    await prisma.$disconnect()
    return
  }

  // 2. Get Warehouse Manager role
  const role = await prisma.role.findFirst({
    where: { name: 'Warehouse Manager' }
  })
  console.log('\nWarehouse Manager Role:', role ? `ID ${role.id}` : 'NOT FOUND')

  // 3. Check if the role has this menu assigned
  if (menu && role) {
    const assignment = await prisma.roleMenuPermission.findFirst({
      where: {
        roleId: role.id,
        menuPermissionId: menu.id
      }
    })
    console.log('Menu assigned to Warehouse Manager:', assignment ? '✅ YES' : '❌ NO')

    // If not assigned, assign it now
    if (!assignment) {
      console.log('\n🔧 Assigning menu to Warehouse Manager...')
      await prisma.roleMenuPermission.create({
        data: {
          roleId: role.id,
          menuPermissionId: menu.id
        }
      })
      console.log('✅ Done!')
    }
  }

  // 4. List all roles that have this menu
  const rolesWithMenu = await prisma.roleMenuPermission.findMany({
    where: { menuPermissionId: menu.id },
    include: { role: { select: { id: true, name: true } } }
  })
  console.log('\n📋 Roles with Package Templates menu:')
  rolesWithMenu.forEach(r => console.log(`  - ${r.role.name} (ID: ${r.role.id})`))

  await prisma.$disconnect()
}

check().catch(console.error)
