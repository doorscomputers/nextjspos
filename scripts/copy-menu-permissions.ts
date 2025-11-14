/**
 * Copy Menu Permissions Between Users and Roles
 *
 * This script allows you to copy menu permissions from:
 * - User to Role (e.g., copy pcinetadmin's menus to "Branch Manager" role)
 * - Role to Role (e.g., copy "All Branch Admin" menus to "Branch Manager")
 * - Role to User (e.g., copy "Sales Cashier" menus to specific user)
 *
 * Usage:
 *   npx tsx scripts/copy-menu-permissions.ts
 *
 * Examples:
 *   Copy pcinetadmin user's menus to "Warehouse Manager" role
 *   Copy "All Branch Admin" role's menus to "Branch Manager" role
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('🔄 Menu Permissions Copy Tool')
  console.log('=' .repeat(50))
  console.log('')

  // Step 1: Choose source type
  console.log('📤 SELECT SOURCE (where to copy FROM):')
  console.log('  1. User (e.g., pcinetadmin)')
  console.log('  2. Role (e.g., All Branch Admin)')
  console.log('')
  const sourceTypeChoice = await question('Enter choice (1 or 2): ')

  let sourceMenuKeys: string[] = []
  let sourceName = ''

  if (sourceTypeChoice === '1') {
    // Copy from user
    const username = await question('\nEnter source username (e.g., pcinetadmin): ')

    const user = await prisma.user.findFirst({
      where: { username },
      select: {
        id: true,
        username: true,
        roles: {
          include: {
            role: {
              include: {
                menuPermissions: {
                  include: {
                    menuPermission: { select: { key: true, name: true } }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      console.log(`\n❌ User "${username}" not found`)
      rl.close()
      await prisma.$disconnect()
      return
    }

    // Get all menu keys from user's roles
    const menuKeysSet = new Set<string>()
    user.roles.forEach(userRole => {
      userRole.role.menuPermissions.forEach(rmp => {
        menuKeysSet.add(rmp.menuPermission.key)
      })
    })

    sourceMenuKeys = Array.from(menuKeysSet)
    sourceName = `User: ${user.username}`

    console.log(`\n✅ Found ${sourceMenuKeys.length} menus from user "${username}"`)

  } else if (sourceTypeChoice === '2') {
    // Copy from role
    console.log('\n📋 Available roles:')
    const roles = await prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    roles.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.name}`)
    })

    const roleChoice = await question('\nEnter role number: ')
    const roleIndex = parseInt(roleChoice) - 1

    if (roleIndex < 0 || roleIndex >= roles.length) {
      console.log('\n❌ Invalid role selection')
      rl.close()
      await prisma.$disconnect()
      return
    }

    const selectedRole = roles[roleIndex]

    const roleWithMenus = await prisma.role.findUnique({
      where: { id: selectedRole.id },
      include: {
        menuPermissions: {
          include: {
            menuPermission: { select: { key: true, name: true } }
          }
        }
      }
    })

    if (!roleWithMenus) {
      console.log(`\n❌ Role not found`)
      rl.close()
      await prisma.$disconnect()
      return
    }

    sourceMenuKeys = roleWithMenus.menuPermissions.map(rmp => rmp.menuPermission.key)
    sourceName = `Role: ${roleWithMenus.name}`

    console.log(`\n✅ Found ${sourceMenuKeys.length} menus from role "${roleWithMenus.name}"`)

  } else {
    console.log('\n❌ Invalid choice')
    rl.close()
    await prisma.$disconnect()
    return
  }

  if (sourceMenuKeys.length === 0) {
    console.log('\n⚠️  Source has no menu permissions to copy!')
    rl.close()
    await prisma.$disconnect()
    return
  }

  // Step 2: Choose destination type
  console.log('\n📥 SELECT DESTINATION (where to copy TO):')
  console.log('  1. User')
  console.log('  2. Role')
  console.log('')
  const destTypeChoice = await question('Enter choice (1 or 2): ')

  if (destTypeChoice === '2') {
    // Copy to role
    console.log('\n📋 Available roles:')
    const roles = await prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    roles.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.name}`)
    })

    const roleChoice = await question('\nEnter role number: ')
    const roleIndex = parseInt(roleChoice) - 1

    if (roleIndex < 0 || roleIndex >= roles.length) {
      console.log('\n❌ Invalid role selection')
      rl.close()
      await prisma.$disconnect()
      return
    }

    const targetRole = roles[roleIndex]

    // Get menu permission IDs
    const menuPermissions = await prisma.menuPermission.findMany({
      where: { key: { in: sourceMenuKeys } }
    })

    console.log(`\n🔄 Copying ${sourceMenuKeys.length} menus...`)
    console.log(`   FROM: ${sourceName}`)
    console.log(`   TO:   Role: ${targetRole.name}`)
    console.log('')

    const confirm = await question('Proceed? (yes/no): ')
    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled')
      rl.close()
      await prisma.$disconnect()
      return
    }

    // Delete existing and create new
    await prisma.$transaction(async (tx) => {
      await tx.roleMenuPermission.deleteMany({
        where: { roleId: targetRole.id }
      })

      if (menuPermissions.length > 0) {
        await tx.roleMenuPermission.createMany({
          data: menuPermissions.map(mp => ({
            roleId: targetRole.id,
            menuPermissionId: mp.id
          }))
        })
      }
    })

    console.log(`\n✅ Successfully copied ${menuPermissions.length} menu permissions!`)
    console.log(`   Role "${targetRole.name}" now has the same menus as ${sourceName}`)

  } else if (destTypeChoice === '1') {
    // Copy to user
    const username = await question('\nEnter destination username: ')

    const user = await prisma.user.findFirst({
      where: { username },
      select: { id: true, username: true }
    })

    if (!user) {
      console.log(`\n❌ User "${username}" not found`)
      rl.close()
      await prisma.$disconnect()
      return
    }

    // Get menu permission IDs
    const menuPermissions = await prisma.menuPermission.findMany({
      where: { key: { in: sourceMenuKeys } }
    })

    console.log(`\n🔄 Copying ${sourceMenuKeys.length} menus...`)
    console.log(`   FROM: ${sourceName}`)
    console.log(`   TO:   User: ${user.username}`)
    console.log('')

    const confirm = await question('Proceed? (yes/no): ')
    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled')
      rl.close()
      await prisma.$disconnect()
      return
    }

    // Delete existing and create new
    await prisma.$transaction(async (tx) => {
      await tx.userMenuPermission.deleteMany({
        where: { userId: user.id }
      })

      if (menuPermissions.length > 0) {
        await tx.userMenuPermission.createMany({
          data: menuPermissions.map(mp => ({
            userId: user.id,
            menuPermissionId: mp.id
          }))
        })
      }
    })

    console.log(`\n✅ Successfully copied ${menuPermissions.length} menu permissions!`)
    console.log(`   User "${user.username}" now has the same menus as ${sourceName}`)

  } else {
    console.log('\n❌ Invalid choice')
  }

  rl.close()
  await prisma.$disconnect()
}

main().catch(console.error)
