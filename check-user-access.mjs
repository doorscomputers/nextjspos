import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUserAccess() {
  try {
    const transferNumber = 'TR-202511-0001'
    const username = 'jheiron' // From screenshot
    
    console.log(`\n🔍 Checking User Access for Transfer: ${transferNumber}\n`)
    
    // Get transfer
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        transferNumber: transferNumber,
        deletedAt: null
      },
      include: {
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } }
      }
    })
    
    if (!transfer) {
      console.log('❌ Transfer not found')
      return
    }
    
    console.log('📦 Transfer Info:')
    console.log(`  From: ${transfer.fromLocation.name} (ID: ${transfer.fromLocationId})`)
    console.log(`  To: ${transfer.toLocation.name} (ID: ${transfer.toLocationId})`)
    console.log()
    
    // Get user
    const user = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' }
      },
      include: {
        userLocations: {
          include: {
            location: { select: { id: true, name: true } }
          }
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        permissions: {
          include: {
            permission: { select: { name: true } }
          }
        }
      }
    })
    
    if (!user) {
      console.log(`❌ User "${username}" not found`)
      return
    }
    
    const userRole = user.roles[0]?.role
    
    console.log(`👤 User: ${user.username}`)
    console.log(`  First Name: ${user.firstName}`)
    console.log(`  Last Name: ${user.lastName}`)
    console.log(`  Role: ${userRole?.name || 'No role'}`)
    console.log(`  Primary Location ID: ${user.primaryLocationId || 'Not set'}`)
    console.log()
    
    // Get user permissions (from direct permissions + role permissions)
    const directPermissions = user.permissions.map(up => up.permission.name)
    
    // Get role permissions
    let rolePermissions = []
    if (userRole) {
      const roleWithPerms = await prisma.role.findUnique({
        where: { id: userRole.id },
        include: {
          permissions: {
            include: {
              permission: { select: { name: true } }
            }
          }
        }
      })
      rolePermissions = roleWithPerms?.permissions.map(rp => rp.permission.name) || []
    }
    
    // Combine all permissions
    const permissions = [...new Set([...directPermissions, ...rolePermissions])]
    console.log(`🔐 Permissions (${permissions.length} total):`)
    const relevantPermissions = [
      'stock_transfer_view',
      'stock_transfer_complete',
      'access_all_locations'
    ]
    relevantPermissions.forEach(perm => {
      const has = permissions.includes(perm)
      console.log(`  ${has ? '✓' : '❌'} ${perm}`)
    })
    console.log()
    
    // Check location access
    console.log(`📍 User Location Access:`)
    if (user.userLocations.length === 0) {
      console.log('  ❌ No locations assigned!')
    } else {
      user.userLocations.forEach(ul => {
        console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`)
      })
    }
    console.log()
    
    // Check access to destination
    const hasAccessAllLocations = permissions.includes('access_all_locations')
    const hasAccessToDestination = user.userLocations.some(ul => ul.locationId === transfer.toLocationId)
    const isPrimaryLocation = user.primaryLocationId === transfer.toLocationId
    
    console.log(`✅ Access Validation:`)
    console.log(`  Has ACCESS_ALL_LOCATIONS permission: ${hasAccessAllLocations}`)
    console.log(`  Has access to destination location (${transfer.toLocation.name}): ${hasAccessToDestination}`)
    console.log(`  Destination is primary location: ${isPrimaryLocation}`)
    console.log()
    
    if (hasAccessAllLocations) {
      console.log('✓ User can complete transfer (has ACCESS_ALL_LOCATIONS)')
    } else if (hasAccessToDestination) {
      console.log('✓ User can complete transfer (assigned to destination location)')
    } else {
      console.log('❌ User CANNOT complete transfer (no access to destination location)')
      console.log('\nThis is likely the issue!')
    }
    
    // Check who created/verified the transfer (for SOD)
    console.log('\n\n🔄 Transfer Workflow Participants:')
    console.log(`  Created By: ${transfer.createdBy}`)
    console.log(`  Checked By: ${transfer.checkedBy}`)
    console.log(`  Sent By: ${transfer.sentBy}`)
    console.log(`  Verifying By: ${transfer.verifyingBy}`)
    console.log(`  Verified By: ${transfer.verifiedBy}`)
    console.log(`  Completed By: ${transfer.completedBy}`)
    console.log(`  Current User ID: ${user.id}`)
    
    if (user.id === transfer.createdBy || 
        user.id === transfer.checkedBy || 
        user.id === transfer.sentBy ||
        user.id === transfer.verifiedBy) {
      console.log('\n⚠️  WARNING: User has participated in this transfer workflow')
      console.log('   SOD (Separation of Duties) validation might prevent completion')
      console.log('   Check business SOD settings')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserAccess()

