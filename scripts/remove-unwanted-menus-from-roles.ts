/**
 * Remove unwanted menus from specific roles
 *
 * This removes "Analytics Dashboard V2", "Analytics Dashboard V3", and "Help Center"
 * from roles where they shouldn't be.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeUnwantedMenus() {
  console.log('\n🔧 REMOVING UNWANTED MENUS FROM ROLES')
  console.log('='.repeat(80))

  const menuToRemove = ['Analytics Dashboard V2', 'Analytics Dashboard V3', 'Help Center']

  // Get menu IDs
  const menus = await prisma.menuPermission.findMany({
    where: {
      name: { in: menuToRemove }
    }
  })

  if (menus.length === 0) {
    console.log('✅ No problematic menus found')
    return
  }

  const menuIds = menus.map(m => m.id)
  console.log(`\n📋 Found ${menus.length} menus to remove:`)
  menus.forEach(m => console.log(`   - ${m.name} (ID: ${m.id})`))

  // OPTION 1: Remove from ALL roles except Super Admin and System Administrator
  console.log('\n\n🎯 Removing from all roles EXCEPT Super Admin and System Administrator...')

  const allowedRoles = ['Super Admin', 'System Administrator']

  // Get IDs of allowed roles
  const allowedRoleRecords = await prisma.role.findMany({
    where: {
      name: { in: allowedRoles }
    },
    select: { id: true, name: true }
  })

  const allowedRoleIds = allowedRoleRecords.map(r => r.id)
  console.log(`\nKeeping menus in: ${allowedRoleRecords.map(r => r.name).join(', ')}`)

  // Delete from all other roles
  const result = await prisma.roleMenuPermission.deleteMany({
    where: {
      menuPermissionId: { in: menuIds },
      roleId: { notIn: allowedRoleIds }
    }
  })

  console.log(`\n✅ Removed ${result.count} menu-role assignments`)

  // Show summary
  console.log('\n📊 Checking remaining assignments:')
  for (const menu of menus) {
    const remaining = await prisma.roleMenuPermission.findMany({
      where: { menuPermissionId: menu.id },
      include: { role: true }
    })

    console.log(`\n   ${menu.name}:`)
    if (remaining.length === 0) {
      console.log('     (not assigned to any role)')
    } else {
      remaining.forEach(r => {
        console.log(`     - ${r.role.name}`)
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✨ Done! Users should log out and log back in to see changes.')
  console.log('\n')
}

removeUnwantedMenus()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
