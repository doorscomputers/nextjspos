import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testJheironMenuAPI() {
  console.log('🧪 Testing Menu Permissions API for Jheiron...\n')

  // Find Jheiron
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'Jheiron' },
        { username: '@Jheiron' },
        { firstName: 'Jheiron' },
      ]
    },
  })

  if (!user) {
    console.log('❌ User Jheiron not found')
    return
  }

  console.log(`✅ Found user: ${user.username} (ID: ${user.id})\n`)

  // Simulate what the API does
  const [userRoles, userMenuPermissions] = await Promise.all([
    // Get user's role IDs
    prisma.userRole.findMany({
      where: { userId: user.id },
      select: { roleId: true },
    }),
    // Get user's direct menu permissions
    prisma.userMenuPermission.findMany({
      where: { userId: user.id },
      include: {
        menuPermission: {
          select: { key: true },
        },
      },
    }),
  ])

  console.log('📋 User Roles:')
  for (const ur of userRoles) {
    const role = await prisma.role.findUnique({
      where: { id: ur.roleId },
    })
    console.log(`   - ${role?.name} (ID: ${role?.id})`)
  }
  console.log()

  // Extract role IDs
  const roleIds = userRoles.map((ur) => ur.roleId)

  // Get menu permissions for all roles in one query
  const roleMenuPermissions =
    roleIds.length > 0
      ? await prisma.roleMenuPermission.findMany({
          where: { roleId: { in: roleIds } },
          include: {
            menuPermission: {
              select: { key: true, name: true },
            },
          },
        })
      : []

  console.log(`📊 Role Menu Permissions Found: ${roleMenuPermissions.length}`)

  // Collect all menu keys from roles
  const roleMenuKeys = new Set<string>()
  roleMenuPermissions.forEach((rmp) => {
    if (rmp.menuPermission?.key) {
      roleMenuKeys.add(rmp.menuPermission.key)
    }
  })

  // Collect user-specific menu keys (overrides)
  const userMenuKeys = new Set<string>()
  userMenuPermissions.forEach((ump) => {
    if (ump.menuPermission?.key) {
      userMenuKeys.add(ump.menuPermission.key)
    }
  })

  // Combine
  const accessibleMenuKeys = Array.from(new Set([...roleMenuKeys, ...userMenuKeys]))

  console.log(`\n✅ Total Accessible Menu Keys: ${accessibleMenuKeys.length}`)
  console.log('\n📝 All Menu Keys:')
  accessibleMenuKeys.sort().forEach((key) => {
    console.log(`   - ${key}`)
  })

  // Check for returns-related menus specifically
  console.log('\n🔍 Returns-Related Menu Keys:')
  const returnsMenus = accessibleMenuKeys.filter((key) =>
    key.toLowerCase().includes('return')
  )

  if (returnsMenus.length > 0) {
    returnsMenus.forEach((key) => {
      console.log(`   ✅ ${key}`)
    })
  } else {
    console.log('   ❌ NO returns-related menu keys found!')
    console.log('\n   This is why the Returns Management menu is not visible!')
  }

  // Show what the API would return
  console.log('\n📤 API Response Preview:')
  console.log(
    JSON.stringify(
      {
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          accessibleMenuKeys,
        },
      },
      null,
      2
    )
  )

  // Check the actual menu permission records
  console.log('\n🔍 Checking Menu Permission Records in Database:')
  const returnsManagementMenu = await prisma.menuPermission.findFirst({
    where: { key: 'returns_management' },
  })

  if (returnsManagementMenu) {
    console.log(`   ✅ returns_management exists (ID: ${returnsManagementMenu.id})`)
    console.log(`      Name: ${returnsManagementMenu.name || '❌ NULL'}`)
    console.log(`      Href: ${returnsManagementMenu.href || 'N/A'}`)
    console.log(`      ParentId: ${returnsManagementMenu.parentId || 'N/A'}`)

    // Check if linked to Warehouse Manager role
    for (const ur of userRoles) {
      const link = await prisma.roleMenuPermission.findUnique({
        where: {
          roleId_menuPermissionId: {
            roleId: ur.roleId,
            menuPermissionId: returnsManagementMenu.id,
          },
        },
      })

      const role = await prisma.role.findUnique({ where: { id: ur.roleId } })
      if (link) {
        console.log(`      ✅ Linked to role: ${role?.name}`)
      } else {
        console.log(`      ❌ NOT linked to role: ${role?.name}`)
      }
    }
  } else {
    console.log('   ❌ returns_management menu does NOT exist!')
  }

  await prisma.$disconnect()
}

testJheironMenuAPI()
  .then(() => {
    console.log('\n✅ Test completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })
