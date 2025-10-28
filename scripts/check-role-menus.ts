import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkRoleMenus() {
  const problematicMenus = ['Analytics Dashboard V2', 'Analytics Dashboard V3', 'Help Center']

  console.log('\n🔍 Checking which roles have the problematic menus:\n')
  console.log('='.repeat(80))

  for (const menuName of problematicMenus) {
    const menu = await prisma.menuPermission.findFirst({
      where: { name: menuName },
      include: {
        roleMenuPermissions: {
          include: {
            role: true
          }
        }
      }
    })

    if (!menu) {
      console.log(`\n❌ Menu "${menuName}" not found in database`)
      continue
    }

    console.log(`\n📋 Menu: "${menuName}" (ID: ${menu.id}, Key: ${menu.key})`)

    if (menu.roleMenuPermissions.length === 0) {
      console.log('   ✅ Not assigned to any roles')
    } else {
      console.log(`   ⚠️  Assigned to ${menu.roleMenuPermissions.length} role(s):`)
      menu.roleMenuPermissions.forEach(rmp => {
        console.log(`      - ${rmp.role.name} (Role ID: ${rmp.role.id})`)
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 Summary of all roles and their menu counts:\n')

  const allRoles = await prisma.role.findMany({
    include: {
      menuPermissions: {
        include: {
          menuPermission: true
        }
      },
      users: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  allRoles.forEach(role => {
    const problematicCount = role.menuPermissions.filter(rmp =>
      problematicMenus.includes(rmp.menuPermission.name)
    ).length

    if (problematicCount > 0) {
      console.log(`⚠️  ${role.name} (${role.users.length} users) - ${role.menuPermissions.length} total menus, ${problematicCount} problematic`)
      role.menuPermissions.forEach(rmp => {
        if (problematicMenus.includes(rmp.menuPermission.name)) {
          console.log(`     - ${rmp.menuPermission.name}`)
        }
      })
      console.log('')
    }
  })
}

checkRoleMenus().finally(() => prisma.$disconnect())
