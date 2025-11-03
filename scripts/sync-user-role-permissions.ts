import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncUserRolePermissions() {
  console.log('🔄 Syncing User Permissions with Role Permissions...\n')

  try {
    // Get all users with their roles
    const users = await prisma.user.findMany({
      include: {
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

    console.log(`📊 Processing ${users.length} users...\n`)

    let totalAdded = 0
    let totalUsers = 0

    for (const user of users) {
      // Skip users without roles
      if (user.roles.length === 0) {
        console.log(`⚠️  ${user.username}: No roles assigned (skipping)`)
        continue
      }

      // Collect all permissions from all roles
      const rolePermissionIds = new Set<number>()
      const roleNames: string[] = []

      user.roles.forEach(ur => {
        roleNames.push(ur.role.name)
        ur.role.permissions.forEach(rp => {
          rolePermissionIds.add(rp.permission.id)
        })
      })

      if (rolePermissionIds.size === 0) {
        console.log(`⚠️  ${user.username} (${roleNames.join(', ')}): Roles have no permissions`)
        continue
      }

      // Get user's current direct permissions
      const userPermissions = await prisma.userPermission.findMany({
        where: { userId: user.id }
      })

      const userPermissionIds = new Set(userPermissions.map(up => up.permissionId))

      // Find missing permissions
      const missingPermissions = Array.from(rolePermissionIds).filter(
        id => !userPermissionIds.has(id)
      )

      if (missingPermissions.length === 0) {
        console.log(`✅ ${user.username} (${roleNames.join(', ')}): Already synced (${rolePermissionIds.size} permissions)`)
      } else {
        // Add missing permissions
        for (const permissionId of missingPermissions) {
          await prisma.userPermission.create({
            data: {
              userId: user.id,
              permissionId
            }
          })
        }

        totalAdded += missingPermissions.length
        console.log(`✅ ${user.username} (${roleNames.join(', ')}): Added ${missingPermissions.length} permissions (total: ${rolePermissionIds.size})`)
      }

      totalUsers++
    }

    console.log(`\n🎉 Sync Complete!`)
    console.log(`   Users Processed: ${totalUsers}`)
    console.log(`   Permissions Added: ${totalAdded}`)

    console.log('\n📝 Next steps:')
    console.log('1. Users should logout and login again to refresh their session')
    console.log('2. Run: npx tsx scripts/fix-user-permissions.ts')
    console.log('   to verify all users now have correct permissions')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

syncUserRolePermissions()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
