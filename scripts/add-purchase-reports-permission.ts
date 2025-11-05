/**
 * Add Purchase Reports Permission to Super Admin
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addPurchaseReportsPermission() {
  console.log('\n' + '='.repeat(80))
  console.log('🔧 ADDING PURCHASE REPORTS PERMISSION')
  console.log('='.repeat(80))
  console.log('')

  try {
    // Get your user
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: 'superadmin' },
          { username: 'admin' },
        ]
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (users.length === 0) {
      console.log('❌ No superadmin or admin user found')
      return
    }

    console.log(`Found ${users.length} user(s) to update:`)
    users.forEach(user => console.log(`  - ${user.username}`))
    console.log('')

    // Permissions to add
    const permissionsToAdd = [
      'REPORT_PURCHASE_VIEW',
      'REPORT_PURCHASE_ANALYTICS', 
      'REPORT_PURCHASE_TRENDS',
      'REPORT_PURCHASE_ITEMS'
    ]

    for (const permName of permissionsToAdd) {
      // Find or create permission
      let permission = await prisma.permission.findUnique({
        where: { name: permName }
      })

      if (!permission) {
        console.log(`📝 Creating permission: ${permName}`)
        permission = await prisma.permission.create({
          data: {
            name: permName
          }
        })
        console.log('✅ Permission created!')
      } else {
        console.log(`✅ Permission exists: ${permName}`)
      }

      // Add to each user
      for (const user of users) {
        const hasPermission = user.permissions.some(up => up.permission.name === permName)
        
        if (!hasPermission) {
          await prisma.userPermission.create({
            data: {
              userId: user.id,
              permissionId: permission.id
            }
          })
          console.log(`  ✅ Added ${permName} to ${user.username}`)
        } else {
          console.log(`  ⏭️  ${user.username} already has ${permName}`)
        }
      }
    }

    console.log('')
    console.log('='.repeat(80))
    console.log('✅ PURCHASE REPORTS PERMISSIONS ADDED!')
    console.log('='.repeat(80))
    console.log('')
    console.log('📋 Next Steps:')
    console.log('  1. Refresh your browser (Ctrl+R or F5)')
    console.log('  2. Click "Reports" in the sidebar')
    console.log('  3. You should now see "Purchase Reports"!')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addPurchaseReportsPermission()
