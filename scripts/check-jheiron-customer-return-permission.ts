import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkJheironCustomerReturnPermission() {
  console.log('🔍 Checking Jheiron Customer Return Permission...\n')

  // Find Jheiron
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'Jheiron' },
        { username: '@Jheiron' },
        { firstName: 'Jheiron' },
      ]
    },
    include: {
      permissions: {
        include: {
          permission: true
        }
      },
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user) {
    console.log('❌ User Jheiron not found')
    return
  }

  console.log(`✅ Found user: ${user.username} (ID: ${user.id})\n`)

  // Get all RBAC permissions
  const allPermissions = [
    ...user.permissions.map(up => up.permission.name),
    ...user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
  ]

  console.log('🔑 Customer Return Permissions Check:')
  console.log(`   customer_return.view: ${allPermissions.includes('customer_return.view') ? '✅ YES' : '❌ NO'}`)
  console.log(`   customer_return.create: ${allPermissions.includes('customer_return.create') ? '✅ YES' : '❌ NO'}`)
  console.log(`   customer_return.approve: ${allPermissions.includes('customer_return.approve') ? '✅ YES' : '❌ NO'}`)

  console.log('\n📋 Summary:')
  if (!allPermissions.includes('customer_return.view')) {
    console.log('   ❌ Jheiron does NOT have customer_return.view permission!')
    console.log('   ⚠️  This is why the Returns Management menu is not visible!')
    console.log('   📝 The Sidebar requires PERMISSIONS.CUSTOMER_RETURN_VIEW to show the menu.')
    console.log('\n   Solution: Add customer_return.view permission to Warehouse Manager role.')
  } else {
    console.log('   ✅ Jheiron has customer_return.view permission!')
    console.log('   🤔 The menu should be visible... investigating other causes.')
  }

  await prisma.$disconnect()
}

checkJheironCustomerReturnPermission()
  .catch(console.error)
