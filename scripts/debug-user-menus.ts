/**
 * Debug User Menu Permissions
 *
 * This script checks why certain menus are appearing for a user
 * even when they're disabled in roles.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugUserMenus(username: string) {
  console.log(`\n🔍 Debugging menu permissions for user: ${username}\n`)
  console.log('='.repeat(80))

  // Get user with all permission sources
  const user = await prisma.user.findFirst({
    where: { username },
    include: {
      roles: {
        include: {
          role: {
            include: {
              menuPermissions: {
                include: {
                  menuPermission: true
                }
              }
            }
          }
        }
      },
      menuPermissions: {
        include: {
          menuPermission: true
        }
      }
    }
  })

  if (!user) {
    console.log(`❌ User "${username}" not found`)
    return
  }

  console.log(`\n✅ User Found: ${user.firstName} ${user.lastName} (@${user.username})`)
  console.log(`   Business ID: ${user.businessId}`)
  console.log(`   User ID: ${user.id}`)

  // Check direct menu permissions
  console.log(`\n\n📋 DIRECT MENU PERMISSIONS (User-Specific):`)
  console.log('-'.repeat(80))
  if (user.menuPermissions.length === 0) {
    console.log('   ✅ No direct menu permissions assigned')
  } else {
    console.log(`   ⚠️  Found ${user.menuPermissions.length} direct menu permissions:`)
    user.menuPermissions.forEach(mp => {
      console.log(`      - ${mp.menuPermission.name} (Menu ID: ${mp.menuPermissionId})`)
    })
    console.log(`\n   ⚡ ACTION REQUIRED: Remove these direct permissions!`)
  }

  // Check role-based permissions
  console.log(`\n\n👥 ROLE-BASED MENU PERMISSIONS:`)
  console.log('-'.repeat(80))
  if (user.roles.length === 0) {
    console.log('   ⚠️  User has no roles assigned')
  } else {
    user.roles.forEach(userRole => {
      const role = userRole.role
      console.log(`\n   Role: "${role.name}" (Role ID: ${role.id})`)
      if (role.menuPermissions.length === 0) {
        console.log(`      ✅ No menu permissions in this role`)
      } else {
        console.log(`      Menus (${role.menuPermissions.length}):`)
        role.menuPermissions.forEach(mp => {
          console.log(`         - ${mp.menuPermission.name}`)
        })
      }
    })
  }

  // Aggregate all visible menus
  console.log(`\n\n📊 SUMMARY - ALL VISIBLE MENUS FOR THIS USER:`)
  console.log('-'.repeat(80))

  const allMenus = new Set<string>()

  // Add direct menus
  user.menuPermissions.forEach(mp => {
    allMenus.add(`${mp.menuPermission.name} (DIRECT)`)
  })

  // Add role-based menus
  user.roles.forEach(userRole => {
    userRole.role.menuPermissions.forEach(mp => {
      allMenus.add(`${mp.menuPermission.name} (from role: ${userRole.role.name})`)
    })
  })

  if (allMenus.size === 0) {
    console.log('   ✅ No menus should be visible')
  } else {
    Array.from(allMenus).sort().forEach(menu => {
      console.log(`   • ${menu}`)
    })
  }

  // Check for problematic menus
  console.log(`\n\n🚨 CHECKING FOR PROBLEM MENUS:`)
  console.log('-'.repeat(80))

  const problematicMenus = ['Analytics Dashboard V2', 'Analytics Dashboard V3', 'Help Center']
  let foundProblems = false

  for (const menuName of problematicMenus) {
    // Check if in direct permissions
    const inDirect = user.menuPermissions.some(mp => mp.menuPermission.name === menuName)

    // Check if in any role
    const rolesWithMenu: string[] = []
    user.roles.forEach(userRole => {
      if (userRole.role.menuPermissions.some(mp => mp.menuPermission.name === menuName)) {
        rolesWithMenu.push(userRole.role.name)
      }
    })

    if (inDirect || rolesWithMenu.length > 0) {
      foundProblems = true
      console.log(`\n   ⚠️  FOUND: "${menuName}"`)
      if (inDirect) {
        console.log(`      Source: DIRECT user permission`)
        console.log(`      Fix: Remove from user's direct menu permissions`)
      }
      if (rolesWithMenu.length > 0) {
        console.log(`      Source: Role-based (${rolesWithMenu.join(', ')})`)
        console.log(`      Fix: Remove from these roles' menu permissions`)
      }
    }
  }

  if (!foundProblems) {
    console.log('   ✅ None of the problem menus found in user permissions')
    console.log('   💡 Issue might be in the Sidebar component or session cache')
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n')
}

// Get username from command line or use default
const username = process.argv[2] || 'JASMINX2'

debugUserMenus(username)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
