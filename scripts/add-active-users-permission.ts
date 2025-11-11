/**
 * Add USER_VIEW_ACTIVE_SESSIONS permission to existing admin roles
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addActiveUsersPermission() {
  try {
    console.log('🔧 Adding USER_VIEW_ACTIVE_SESSIONS permission to admin roles...')

    // Check if permission already exists (permissions are global, not per-business)
    let permission = await prisma.permission.findFirst({
      where: {
        name: 'user.view_active_sessions',
      },
    })

    // Create permission if it doesn't exist
    if (!permission) {
      permission = await prisma.permission.create({
        data: {
          name: 'user.view_active_sessions',
          guardName: 'web',
        },
      })
      console.log(`✅ Created global permission: user.view_active_sessions`)
    } else {
      console.log(`ℹ️  Permission already exists: user.view_active_sessions`)
    }

    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
    })

    for (const business of businesses) {
      console.log(`\n📌 Processing business: ${business.name}`)

      // Find admin roles (System Administrator, Admin, All Branch Admin, User Manager)
      const adminRoles = await prisma.role.findMany({
        where: {
          businessId: business.id,
          name: {
            in: [
              'System Administrator',
              'Admin',
              'All Branch Admin',
              'User Manager',
              'Super Admin', // Legacy
            ],
          },
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      })

      // Add permission to each admin role if not already added
      for (const role of adminRoles) {
        const hasPermission = role.permissions.some(
          (rp) => rp.permission.name === 'user.view_active_sessions'
        )

        if (!hasPermission) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id,
            },
          })
          console.log(`   ✅ Added permission to role: ${role.name}`)
        } else {
          console.log(`   ℹ️  Role already has permission: ${role.name}`)
        }
      }
    }

    console.log('\n✅ Successfully added USER_VIEW_ACTIVE_SESSIONS permission to all admin roles!')
    console.log('\n⚠️  IMPORTANT: Users must log out and log back in to get the new permission.')
  } catch (error) {
    console.error('❌ Error adding permission:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addActiveUsersPermission()
  .then(() => {
    console.log('\n🎉 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
