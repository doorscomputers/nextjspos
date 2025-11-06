/**
 * Update jayvillalon user to "All Branch Admin" role
 * This allows the user to approve transfers across all locations without being tied to a specific location
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateJayvillalonRole() {
  try {
    console.log('🔍 Looking for user "jayvillalon"...')

    // Find the user
    const user = await prisma.user.findFirst({
      where: { username: 'jayvillalon' },
      include: {
        roles: {
          include: { role: true }
        },
        userLocations: {
          include: { location: true }
        }
      }
    })

    if (!user) {
      console.error('❌ User "jayvillalon" not found')
      console.log('\n💡 Available users:')
      const allUsers = await prisma.user.findMany({
        select: { id: true, username: true },
        take: 20
      })
      allUsers.forEach(u => console.log(`   - ${u.username} (ID: ${u.id})`))
      return
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`)
    console.log(`   Current roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`)
    console.log(`   Current locations: ${user.userLocations.map(l => l.location.name).join(', ') || 'None'}`)

    // Find the "All Branch Admin" role
    const allBranchAdminRole = await prisma.role.findFirst({
      where: { name: 'All Branch Admin' }
    })

    if (!allBranchAdminRole) {
      console.error('❌ "All Branch Admin" role not found')
      console.log('\n💡 Available roles:')
      const allRoles = await prisma.role.findMany({
        select: { id: true, name: true }
      })
      allRoles.forEach(r => console.log(`   - ${r.name} (ID: ${r.id})`))
      return
    }

    console.log(`\n✅ Found role: ${allBranchAdminRole.name} (ID: ${allBranchAdminRole.id})`)

    // Check if user already has this role
    const hasRole = user.roles.some(r => r.roleId === allBranchAdminRole.id)
    if (hasRole) {
      console.log('ℹ️  User already has "All Branch Admin" role')
    } else {
      console.log('\n📝 Assigning "All Branch Admin" role...')

      await prisma.$transaction(async (tx) => {
        // Remove all existing roles
        await tx.userRole.deleteMany({
          where: { userId: user.id }
        })

        // Assign All Branch Admin role
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: allBranchAdminRole.id
          }
        })

        console.log('   ✅ Role assigned successfully')
      })
    }

    // Remove location assignments (All Branch Admin doesn't need location)
    if (user.userLocations.length > 0) {
      console.log('\n📝 Removing location assignments (All Branch Admin works across all locations)...')

      await prisma.userLocation.deleteMany({
        where: { userId: user.id }
      })

      console.log('   ✅ Locations removed successfully')
    } else {
      console.log('\nℹ️  User has no location assignments (correct for All Branch Admin)')
    }

    // Verify the update
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: { role: true }
        },
        userLocations: {
          include: { location: true }
        }
      }
    })

    console.log('\n✅ UPDATE COMPLETE!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`👤 User: ${updatedUser?.username}`)
    console.log(`🎭 Role: ${updatedUser?.roles.map(r => r.role.name).join(', ') || 'None'}`)
    console.log(`📍 Locations: ${updatedUser?.userLocations.map(l => l.location.name).join(', ') || 'None (All Locations)'}`)
    console.log(`🔐 Permissions: ALL (${Object.keys(require('@/lib/rbac').PERMISSIONS).length} permissions)`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log('\n✅ Capabilities:')
    console.log('   ✓ Approve transfers across ALL locations')
    console.log('   ✓ Approve Z-Readings for ALL locations')
    console.log('   ✓ Access all menu items')
    console.log('   ✓ No location restriction')

  } catch (error) {
    console.error('❌ Error updating user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateJayvillalonRole()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
