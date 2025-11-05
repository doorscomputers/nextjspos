/**
 * Add Purchase Report Hub Menu Permission
 * This adds the "purchase_reports_hub" menu key so it shows up in the sidebar
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addPurchaseHubMenuPermission() {
  console.log('\n' + '='.repeat(80))
  console.log('🔧 ADDING PURCHASE REPORT HUB MENU PERMISSION')
  console.log('='.repeat(80))
  console.log('')

  try {
    // Step 1: Get the parent "purchase_reports" menu permission
    let parentMenu = await prisma.menuPermission.findUnique({
      where: { key: 'purchase_reports' }
    })

    if (!parentMenu) {
      console.log('📝 Creating parent "Purchase Reports" menu permission...')
      parentMenu = await prisma.menuPermission.create({
        data: {
          key: 'purchase_reports',
          name: 'Purchase Reports',
          href: null, // Parent menu (dropdown only)
          icon: 'TruckIcon',
          order: 0
        }
      })
      console.log('✅ Parent menu permission created!')
    } else {
      console.log('✅ Parent "Purchase Reports" menu permission already exists')
    }

    // Step 2: Create or get the "purchase_reports_hub" menu permission
    let hubMenu = await prisma.menuPermission.findUnique({
      where: { key: 'purchase_reports_hub' }
    })

    if (!hubMenu) {
      console.log('📝 Creating "Purchase Report Hub" menu permission...')
      hubMenu = await prisma.menuPermission.create({
        data: {
          key: 'purchase_reports_hub',
          name: 'Purchase Report Hub',
          href: '/dashboard/reports/purchases',
          icon: 'ChartBarIcon',
          parentId: parentMenu.id,
          order: 0
        }
      })
      console.log('✅ "Purchase Report Hub" menu permission created!')
    } else {
      console.log('✅ "Purchase Report Hub" menu permission already exists')
    }

    // Step 3: Get all admin/superadmin users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: 'superadmin' },
          { username: 'admin' },
        ]
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (users.length === 0) {
      console.log('❌ No superadmin or admin users found')
      return
    }

    console.log(`\nFound ${users.length} user(s) to update:`)
    users.forEach(user => console.log(`  - ${user.username}`))
    console.log('')

    // Step 4: Add menu permissions to each user's roles
    for (const user of users) {
      console.log(`\n👤 Processing user: ${user.username}`)

      if (user.roles.length === 0) {
        console.log(`  ⚠️  User has no roles, adding direct user permission`)

        // Add both parent and child directly to user
        for (const menu of [parentMenu, hubMenu]) {
          const existingUserPerm = await prisma.userMenuPermission.findUnique({
            where: {
              userId_menuPermissionId: {
                userId: user.id,
                menuPermissionId: menu.id
              }
            }
          })

          if (!existingUserPerm) {
            await prisma.userMenuPermission.create({
              data: {
                userId: user.id,
                menuPermissionId: menu.id
              }
            })
            console.log(`  ✅ Added "${menu.name}" menu permission to user directly`)
          } else {
            console.log(`  ⏭️  User already has "${menu.name}" menu permission`)
          }
        }
      } else {
        // Add to roles
        for (const userRole of user.roles) {
          console.log(`  📋 Role: ${userRole.role.name}`)

          for (const menu of [parentMenu, hubMenu]) {
            const existingRolePerm = await prisma.roleMenuPermission.findUnique({
              where: {
                roleId_menuPermissionId: {
                  roleId: userRole.roleId,
                  menuPermissionId: menu.id
                }
              }
            })

            if (!existingRolePerm) {
              await prisma.roleMenuPermission.create({
                data: {
                  roleId: userRole.roleId,
                  menuPermissionId: menu.id
                }
              })
              console.log(`    ✅ Added "${menu.name}" to role ${userRole.role.name}`)
            } else {
              console.log(`    ⏭️  Role already has "${menu.name}" menu permission`)
            }
          }
        }
      }
    }

    console.log('')
    console.log('='.repeat(80))
    console.log('✅ PURCHASE REPORT HUB MENU PERMISSION ADDED!')
    console.log('='.repeat(80))
    console.log('')
    console.log('📋 Next Steps:')
    console.log('  1. LOGOUT of your browser session')
    console.log('  2. LOGIN again (this refreshes menu permissions)')
    console.log('  3. Click "Reports" → "Purchase Reports"')
    console.log('  4. You should now see "Purchase Report Hub" as first item!')
    console.log('')
    console.log('⚠️  IMPORTANT: Hard refresh (Ctrl+Shift+R) alone won\'t work.')
    console.log('   You MUST logout and login again to refresh the session!')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addPurchaseHubMenuPermission()
