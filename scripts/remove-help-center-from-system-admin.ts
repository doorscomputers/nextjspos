/**
 * Remove "Help Center" from System Administrator role
 * Keep it ONLY in Super Admin role
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeHelpCenterFromSystemAdmin() {
  console.log('\n🔧 REMOVING HELP CENTER FROM SYSTEM ADMINISTRATOR')
  console.log('='.repeat(80))

  // Get Help Center menu
  const helpCenterMenu = await prisma.menuPermission.findFirst({
    where: { name: 'Help Center' }
  })

  if (!helpCenterMenu) {
    console.log('❌ Help Center menu not found')
    return
  }

  console.log(`\n📋 Found: ${helpCenterMenu.name} (ID: ${helpCenterMenu.id})`)

  // Get System Administrator role
  const sysAdminRole = await prisma.role.findFirst({
    where: { name: 'System Administrator' }
  })

  if (!sysAdminRole) {
    console.log('❌ System Administrator role not found')
    return
  }

  console.log(`📋 Found: ${sysAdminRole.name} (ID: ${sysAdminRole.id})`)

  // Check current assignment
  const currentAssignment = await prisma.roleMenuPermission.findFirst({
    where: {
      roleId: sysAdminRole.id,
      menuPermissionId: helpCenterMenu.id
    }
  })

  if (!currentAssignment) {
    console.log('\n✅ Help Center is already NOT assigned to System Administrator')
  } else {
    console.log('\n🗑️  Removing Help Center from System Administrator...')

    await prisma.roleMenuPermission.delete({
      where: {
        roleId_menuPermissionId: {
          roleId: sysAdminRole.id,
          menuPermissionId: helpCenterMenu.id
        }
      }
    })

    console.log('✅ Successfully removed!')
  }

  // Verify final state
  console.log('\n📊 Final state - Help Center is assigned to:')
  const finalAssignments = await prisma.roleMenuPermission.findMany({
    where: { menuPermissionId: helpCenterMenu.id },
    include: { role: true }
  })

  if (finalAssignments.length === 0) {
    console.log('   ⚠️  (not assigned to any role - you may want to add it back to Super Admin)')
  } else {
    finalAssignments.forEach(assignment => {
      console.log(`   ✅ ${assignment.role.name}`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✨ Done! Help Center is now ONLY in Super Admin role.')
  console.log('\n')
}

removeHelpCenterFromSystemAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
