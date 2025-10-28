import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Assigning ALL menus to ALL roles...\n')

  // Get all menu permissions
  const allMenus = await prisma.menuPermission.findMany()
  console.log(`Found ${allMenus.length} menu items\n`)

  // Get all roles
  const roles = await prisma.role.findMany()
  console.log(`Found ${roles.length} roles\n`)

  // Clear existing role menu permissions
  console.log('Clearing existing role menu permissions...')
  await prisma.roleMenuPermission.deleteMany({})
  console.log('Cleared all role menu permissions\n')

  // ASSIGN ALL MENUS TO ALL ROLES
  console.log('Assigning ALL menus to ALL roles...\n')

  let totalAssignments = 0

  for (const role of roles) {
    const roleMenus = allMenus.map(menu => ({
      roleId: role.id,
      menuPermissionId: menu.id
    }))

    await prisma.roleMenuPermission.createMany({
      data: roleMenus
    })

    totalAssignments += roleMenus.length
    console.log(`   - ${role.name.padEnd(35)} ${roleMenus.length} menus`)
  }

  // Summary
  console.log('\n=========================================')
  console.log('Summary:')
  console.log('=========================================')
  console.log(`Total roles: ${roles.length}`)
  console.log(`Total menus per role: ${allMenus.length}`)
  console.log(`Total assignments: ${totalAssignments}`)
  console.log('=========================================\n')

  console.log('Next Steps:')
  console.log('1. Log in as Super Admin')
  console.log('2. Go to Settings > Menu Permissions')
  console.log('3. Select each role')
  console.log('4. ALL menus will be CHECKED by default')
  console.log('5. UNCHECK menus you want to hide')
  console.log('   - Untested features')
  console.log('   - Work-in-progress functionality')
  console.log('   - Super admin-only settings')
  console.log('6. Click "Save Changes" for each role')
  console.log('7. Test with different user accounts\n')
}

main()
  .catch((e) => {
    console.error('Error assigning menu permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
