/**
 * Remove Opening Stock Permission from Branch Manager Roles
 *
 * This script removes the PRODUCT_OPENING_STOCK permission from all Branch Manager roles
 * (including location-specific ones like "Main Store Branch Manager", etc.)
 * while keeping it for Super Admin and Opening Stock Manager roles.
 *
 * Usage: node scripts/remove-opening-stock-from-managers.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Roles to KEEP the permission (these should retain opening stock access)
const ROLES_TO_KEEP = [
  'System Administrator',
  'Super Admin',
  'Super Admin (Legacy)',
  'Opening Stock Manager',
]

async function removeOpeningStockFromManagers() {
  console.log('🚀 Starting Opening Stock Permission Removal from Branch Manager Roles...\n')

  try {
    // Find the PRODUCT_OPENING_STOCK permission
    const permission = await prisma.permission.findUnique({
      where: { name: 'product.opening_stock' },
    })

    if (!permission) {
      console.log('⚠️  PRODUCT_OPENING_STOCK permission not found in database')
      return
    }

    // Get all roles that have this permission
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        permissionId: permission.id,
      },
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
    })

    console.log(`📊 Found ${rolePermissions.length} role(s) with PRODUCT_OPENING_STOCK permission\n`)

    let removedCount = 0
    let skippedCount = 0

    for (const rolePermission of rolePermissions) {
      const role = rolePermission.role

      console.log(`\n${'='.repeat(80)}`)
      console.log(`📌 Role: ${role.name} (ID: ${role.id})`)
      console.log(`   Business: ${role.business.name}`)
      console.log(`   Assigned to: ${role._count.users} user(s)`)

      // Check if this role should keep the permission
      if (ROLES_TO_KEEP.includes(role.name)) {
        console.log(`   ✅ KEPT - This role should retain opening stock access`)
        skippedCount++
        continue
      }

      // Check if it's a Branch Manager type role
      if (role.name.includes('Branch Manager') || role.name === 'Branch Manager') {
        // Remove the permission
        await prisma.rolePermission.delete({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
        })

        console.log(`   ❌ REMOVED - Branch Manager roles should not have opening stock access`)
        removedCount++

        // If users are assigned, remind to notify them
        if (role._count.users > 0) {
          const users = await prisma.user.findMany({
            where: {
              roles: {
                some: {
                  roleId: role.id,
                },
              },
            },
            select: {
              username: true,
              firstName: true,
              lastName: true,
            },
          })

          console.log(`   ⚠️  Affected users (need to re-login):`)
          for (const user of users) {
            console.log(`      - ${user.username} (${user.firstName} ${user.lastName})`)
          }
        }
      } else {
        console.log(`   ⏭️  SKIPPED - Not a Branch Manager role`)
        skippedCount++
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`)
    console.log('SUMMARY')
    console.log('='.repeat(80))
    console.log(`✅ Total roles processed: ${rolePermissions.length}`)
    console.log(`❌ Permissions removed: ${removedCount}`)
    console.log(`✅ Permissions kept: ${skippedCount}`)
    console.log(`\n✅ Opening Stock permission has been removed from Branch Manager roles!`)

    console.log(`\n${'='.repeat(80)}`)
    console.log('NEXT STEPS')
    console.log('='.repeat(80))
    console.log(`1. Ask all affected Branch Manager users to LOGOUT and LOGIN again`)
    console.log(`2. Verify the "Add/Edit Opening Stock" menu is hidden for these users`)
    console.log(`3. Test with a Branch Manager account`)
    console.log(`\nℹ️  Branch Manager users will no longer see the "Add/Edit Opening Stock" option.`)
    console.log(`ℹ️  Only Super Admin and Opening Stock Manager can still access this feature.`)

  } catch (error) {
    console.error('\n❌ Error removing permission:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
removeOpeningStockFromManagers()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
