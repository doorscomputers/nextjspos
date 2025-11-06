/**
 * Update jayvillalon from "All Branch Admin" to "Cross-Location Approver"
 * This gives him ONLY approval permissions (NO create permissions)
 */

import { PrismaClient } from '@prisma/client'
import { DEFAULT_ROLES } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function updateJayvillalonToApprover() {
  try {
    console.log('🔍 Looking for user "jayvillalon"...')

    // Find the user
    const user = await prisma.user.findFirst({
      where: { username: 'jayvillalon' },
      include: {
        roles: { include: { role: true } },
        userLocations: { include: { location: true } }
      }
    })

    if (!user) {
      console.error('❌ User "jayvillalon" not found')
      return
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`)
    console.log(`   Current roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`)
    console.log(`   Current locations: ${user.userLocations.map(l => l.location.name).join(', ') || 'None'}`)

    // Find or create the "Cross-Location Approver" role
    let approverRole = await prisma.role.findFirst({
      where: {
        name: 'Cross-Location Approver',
        businessId: user.businessId
      }
    })

    if (!approverRole) {
      console.log('\n📝 Creating "Cross-Location Approver" role...')

      const roleDefinition = DEFAULT_ROLES.CROSS_LOCATION_APPROVER

      approverRole = await prisma.role.create({
        data: {
          name: roleDefinition.name,
          description: roleDefinition.description,
          businessId: user.businessId,
          permissions: {
            create: roleDefinition.permissions.map((permission: string) => ({
              permission,
              businessId: user.businessId
            }))
          }
        }
      })

      console.log(`   ✅ Role created with ${roleDefinition.permissions.length} permissions`)
    } else {
      console.log(`\n✅ Found existing role: ${approverRole.name} (ID: ${approverRole.id})`)
    }

    await prisma.$transaction(async (tx) => {
      // Remove all existing roles
      await tx.userRole.deleteMany({
        where: { userId: user.id }
      })

      console.log('   ✅ Removed old roles')

      // Assign Cross-Location Approver role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: approverRole!.id
        }
      })

      console.log('   ✅ Assigned Cross-Location Approver role')
    })

    // Remove location assignments (approver doesn't need specific location)
    if (user.userLocations.length > 0) {
      await prisma.userLocation.deleteMany({
        where: { userId: user.id }
      })
      console.log('   ✅ Removed location assignments')
    }

    // Verify the update
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: true
              }
            }
          }
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
    console.log(`🔐 Permissions: ${updatedUser?.roles[0]?.role.permissions.length || 0}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log('\n✅ What jayvillalon CAN do:')
    console.log('   ✓ VIEW all transfers across all locations')
    console.log('   ✓ APPROVE transfers (check & complete)')
    console.log('   ✓ APPROVE Z-Readings')
    console.log('   ✓ VIEW reports')
    console.log('   ✓ VIEW audit logs')

    console.log('\n❌ What jayvillalon CANNOT do:')
    console.log('   ✗ CREATE transfers')
    console.log('   ✗ CREATE sales')
    console.log('   ✗ CREATE purchases')
    console.log('   ✗ Access settings pages')
    console.log('   ✗ Manage users or roles')

  } catch (error) {
    console.error('❌ Error updating user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateJayvillalonToApprover()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
