/**
 * Check which roles have Opening Stock Permission
 *
 * This script shows which roles have the PRODUCT_OPENING_STOCK permission
 * and how many users are assigned to each role.
 *
 * Usage: node scripts/check-opening-stock-permission.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkOpeningStockPermission() {
  console.log('🔍 Checking Opening Stock Permission Assignment...\n')

  try {
    // Find the PRODUCT_OPENING_STOCK permission
    const permission = await prisma.permission.findUnique({
      where: { name: 'product.opening_stock' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                business: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                _count: {
                  select: { users: true },
                },
              },
            },
          },
        },
      },
    })

    if (!permission) {
      console.log('⚠️  PRODUCT_OPENING_STOCK permission not found in database')
      return
    }

    console.log(`✅ Found permission: ${permission.name}\n`)

    if (permission.roles.length === 0) {
      console.log('✅ No roles have this permission assigned')
      return
    }

    console.log(`📊 ${permission.roles.length} role(s) have this permission:\n`)
    console.log('='.repeat(80))

    for (const rolePermission of permission.roles) {
      const role = rolePermission.role
      console.log(`\n📌 Role: ${role.name} (ID: ${role.id})`)
      console.log(`   Business: ${role.business.name} (ID: ${role.business.id})`)
      console.log(`   Assigned to: ${role._count.users} user(s)`)
      console.log(`   Is Default: ${role.isDefault ? 'Yes' : 'No'}`)

      // Get users assigned to this role
      const usersWithRole = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              roleId: role.id,
            },
          },
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      })

      if (usersWithRole.length > 0) {
        console.log(`   Users:`)
        for (const user of usersWithRole) {
          console.log(`      - ${user.username} (${user.firstName} ${user.lastName})`)
        }
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('\n💡 To remove this permission from a specific role:')
    console.log('   1. Note the role name above')
    console.log('   2. Use the remove-opening-stock-permission.mjs script')
    console.log('   3. Or manually remove it via the Roles management UI\n')

  } catch (error) {
    console.error('\n❌ Error checking permission:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkOpeningStockPermission()
  .then(() => {
    console.log('✅ Check completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Check failed:', error)
    process.exit(1)
  })
