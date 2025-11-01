/**
 * Check "All Branch Admin" Role Permission
 *
 * This script checks if the "All Branch Admin" role exists and what permissions it has.
 *
 * Usage: node scripts/check-all-branch-admin-role.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllBranchAdminRole() {
  console.log('🔍 Checking "All Branch Admin" Role...\n')

  try {
    // Find roles with "All Branch Admin" in the name
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: 'All Branch Admin' } },
          { name: { contains: 'All Branch' } },
        ],
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    })

    if (roles.length === 0) {
      console.log('⚠️  No "All Branch Admin" role found')
      return
    }

    for (const role of roles) {
      console.log('='.repeat(80))
      console.log(`\n📌 Role: ${role.name} (ID: ${role.id})`)
      console.log(`   Business: ${role.business.name}`)
      console.log(`   Assigned to: ${role._count.users} user(s)`)
      console.log(`   Total permissions: ${role._count.permissions}`)

      // Get users with this role
      const users = await prisma.user.findMany({
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

      if (users.length > 0) {
        console.log(`\n   👥 Users with this role:`)
        for (const user of users) {
          console.log(`      - ${user.username} (${user.firstName} ${user.lastName})`)
        }
      }

      // Check if this role has the opening stock permission
      const hasOpeningStock = await prisma.rolePermission.findFirst({
        where: {
          roleId: role.id,
          permission: {
            name: 'product.opening_stock',
          },
        },
      })

      console.log(`\n   🔑 Has PRODUCT_OPENING_STOCK permission: ${hasOpeningStock ? '✅ YES' : '❌ NO'}`)

      // Get all permissions for this role
      const permissions = await prisma.rolePermission.findMany({
        where: {
          roleId: role.id,
        },
        include: {
          permission: {
            select: {
              name: true,
            },
          },
        },
        take: 20, // Show first 20 permissions
      })

      if (permissions.length > 0) {
        console.log(`\n   📜 Sample permissions (first 20):`)
        for (const perm of permissions) {
          console.log(`      - ${perm.permission.name}`)
        }
        if (role._count.permissions > 20) {
          console.log(`      ... and ${role._count.permissions - 20} more`)
        }
      }
    }

    console.log('\n' + '='.repeat(80))

  } catch (error) {
    console.error('\n❌ Error checking role:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkAllBranchAdminRole()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Check failed:', error)
    process.exit(1)
  })
