import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  console.log('🔍 Checking users with Warehouse Manager role...\n')

  // Get Warehouse Manager role
  const warehouseRole = await prisma.role.findFirst({
    where: { name: 'Warehouse Manager' }
  })

  if (!warehouseRole) {
    console.log('❌ Warehouse Manager role not found')
    await prisma.$disconnect()
    return
  }

  console.log('Warehouse Manager Role ID:', warehouseRole.id)

  // Get all users with this role
  const usersWithRole = await prisma.userRole.findMany({
    where: { roleId: warehouseRole.id },
    include: {
      user: {
        select: { id: true, username: true, firstName: true, lastName: true }
      }
    }
  })

  console.log(`\n📋 Users with Warehouse Manager role (${usersWithRole.length}):`)
  usersWithRole.forEach(ur => {
    console.log(`  - ${ur.user.username} (ID: ${ur.user.id}) - ${ur.user.firstName} ${ur.user.lastName}`)
  })

  // For each user, check what menus they can access
  const packageMenu = await prisma.menuPermission.findUnique({
    where: { key: 'menu.package_templates' }
  })

  if (packageMenu && usersWithRole.length > 0) {
    console.log('\n🔍 Checking menu access for first user...')
    const firstUser = usersWithRole[0].user

    // Get all roles for this user
    const userRoles = await prisma.userRole.findMany({
      where: { userId: firstUser.id },
      include: { role: { select: { id: true, name: true } } }
    })
    console.log(`\nUser ${firstUser.username} has roles:`)
    userRoles.forEach(ur => console.log(`  - ${ur.role.name} (ID: ${ur.role.id})`))

    // Check if any of their roles have the package menu
    const roleIds = userRoles.map(ur => ur.roleId)
    const menuAccess = await prisma.roleMenuPermission.findFirst({
      where: {
        roleId: { in: roleIds },
        menuPermissionId: packageMenu.id
      }
    })
    console.log(`\nUser ${firstUser.username} has Package Templates menu access:`, menuAccess ? '✅ YES' : '❌ NO')
  }

  await prisma.$disconnect()
}

check().catch(console.error)
