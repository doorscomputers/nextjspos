import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkMenuPermissions() {
  try {
    console.log('🔍 Checking menu permissions for user: jayvillalon\n')

    // Get user
    const user = await prisma.user.findUnique({
      where: { username: 'jayvillalon' },
      select: {
        id: true,
        username: true,
        businessId: true,
      },
    })

    if (!user) {
      console.error('❌ User "jayvillalon" not found!')
      return
    }

    console.log(`✅ User: ${user.username} (ID: ${user.id})`)
    console.log('')

    // Get user's roles
    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    console.log('👤 USER ROLES:')
    console.log('=====================================')
    if (userRoles.length === 0) {
      console.log('⚠️  No roles assigned')
    } else {
      userRoles.forEach((ur) => {
        console.log(`- ${ur.role.name} (Role ID: ${ur.roleId})`)
      })
    }
    console.log('')

    // Get menu permissions from roles
    const roleIds = userRoles.map((ur) => ur.roleId)
    let roleMenuPermissions: any[] = []
    if (roleIds.length > 0) {
      roleMenuPermissions = await prisma.roleMenuPermission.findMany({
        where: { roleId: { in: roleIds } },
        include: {
          role: {
            select: {
              name: true,
            },
          },
          menuPermission: {
            select: {
              key: true,
              name: true,
            },
          },
        },
      })
    }

    console.log('📋 MENU PERMISSIONS FROM ROLES:')
    console.log('=====================================')
    if (roleMenuPermissions.length === 0) {
      console.log('❌ NO MENU PERMISSIONS assigned to user\'s roles!')
      console.log('   This is why the sidebar menus are not visible.')
    } else {
      const groupedByRole: Record<string, any[]> = {}
      roleMenuPermissions.forEach((rmp) => {
        const roleName = rmp.role.name
        if (!groupedByRole[roleName]) {
          groupedByRole[roleName] = []
        }
        groupedByRole[roleName].push(rmp)
      })

      Object.entries(groupedByRole).forEach(([roleName, perms]) => {
        console.log(`\nRole: ${roleName}`)
        perms.forEach((p) => {
          console.log(`  - ${p.menuPermission.key} (${p.menuPermission.name})`)
        })
      })
    }
    console.log('')

    // Get direct user menu permissions
    const userMenuPermissions = await prisma.userMenuPermission.findMany({
      where: { userId: user.id },
      include: {
        menuPermission: {
          select: {
            key: true,
            name: true,
          },
        },
      },
    })

    console.log('👤 DIRECT USER MENU PERMISSIONS:')
    console.log('=====================================')
    if (userMenuPermissions.length === 0) {
      console.log('⚠️  No direct menu permissions assigned to user')
    } else {
      userMenuPermissions.forEach((ump) => {
        console.log(`- ${ump.menuPermission.key} (${ump.menuPermission.name})`)
      })
    }
    console.log('')

    // Total count
    const roleMenuKeys = new Set(roleMenuPermissions.map((rmp) => rmp.menuPermission.key))
    const userMenuKeys = new Set(userMenuPermissions.map((ump) => ump.menuPermission.key))
    const totalUniqueMenuKeys = new Set([...roleMenuKeys, ...userMenuKeys])

    console.log('📊 SUMMARY:')
    console.log('=====================================')
    console.log(`Menu permissions from roles: ${roleMenuKeys.size}`)
    console.log(`Direct user menu permissions: ${userMenuKeys.size}`)
    console.log(`Total unique menu keys: ${totalUniqueMenuKeys.size}`)
    console.log('')

    // Diagnosis
    console.log('🩺 DIAGNOSIS:')
    console.log('=====================================')
    if (totalUniqueMenuKeys.size === 0) {
      console.log('❌ PROBLEM IDENTIFIED:')
      console.log('   User has NO menu permissions assigned!')
      console.log('')
      console.log('   REASON: The "Cross-Location Approver" role does not have')
      console.log('           any menu permissions configured in the database.')
      console.log('')
      console.log('   SOLUTION OPTIONS:')
      console.log('   1. Assign menu permissions to the "Cross-Location Approver" role')
      console.log('   2. OR assign menu permissions directly to this user')
      console.log('   3. OR add another role that has menu permissions')
      console.log('')
      console.log('   To fix, go to: Settings → Menu Permissions → Configure Role Menus')
    } else {
      console.log('✅ User has menu permissions configured')
      console.log(`   Accessible menu items: ${totalUniqueMenuKeys.size}`)
    }

    // Check if Cross-Location Approver role exists and show its ID
    if (userRoles.length > 0) {
      console.log('')
      console.log('📝 ROLE DETAILS:')
      console.log('=====================================')
      for (const ur of userRoles) {
        console.log(`Role Name: ${ur.role.name}`)
        console.log(`Role ID: ${ur.roleId}`)
        console.log(`Menu Permissions Count: ${roleMenuPermissions.filter(rmp => rmp.roleId === ur.roleId).length}`)
        console.log('')
      }
    }
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkMenuPermissions()
