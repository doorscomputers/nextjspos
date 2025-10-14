/**
 * Sync User Permissions Script
 * Updates all users' permissions based on their assigned roles
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncUserPermissions() {
  console.log('🔄 Syncing user permissions with role permissions...\n')

  try {
    // Get all users with their roles
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    console.log(`Found ${users.length} users to sync\n`)

    for (const user of users) {
      // Collect all permissions from roles
      const rolePermissions = new Set<string>()

      for (const userRole of user.roles) {
        for (const rolePermission of userRole.role.permissions) {
          rolePermissions.add(rolePermission.permission.name)
        }
      }

      // Get direct user permissions
      const directPermissions = user.permissions.map(up => up.permission.name)

      // Combine role permissions and direct permissions
      const allPermissions = Array.from(new Set([...rolePermissions, ...directPermissions]))

      // Update user's permissions JSON field
      await prisma.user.update({
        where: { id: user.id },
        data: {
          permissions: allPermissions,
        },
      })

      console.log(`✅ Updated ${user.username}:`)
      console.log(`   Roles: ${user.roles.map(ur => ur.role.name).join(', ')}`)
      console.log(`   Permissions: ${allPermissions.length} total`)
      if (allPermissions.includes('physical_inventory.export')) {
        console.log(`   ✅ Has PHYSICAL_INVENTORY permissions`)
      }
      console.log('')
    }

    console.log('✅ All user permissions synced successfully!')
  } catch (error) {
    console.error('❌ Error syncing permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

syncUserPermissions()
  .then(() => {
    console.log('\n🎉 Done! Users can now access Physical Inventory feature.')
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
