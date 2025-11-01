import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkReceiverUser() {
  try {
    const username = 'JOJITKATETransferReceiverBambang'
    const transferNumber = 'TR-202511-0001'
    
    console.log(`\n🔍 Checking Receiver User: ${username}\n`)
    
    // Get transfer
    const transfer = await prisma.stockTransfer.findFirst({
      where: { transferNumber, deletedAt: null },
      include: {
        toLocation: { select: { id: true, name: true } }
      }
    })
    
    if (!transfer) {
      console.log('❌ Transfer not found')
      return
    }
    
    console.log(`📦 Transfer: ${transferNumber}`)
    console.log(`   Destination: ${transfer.toLocation.name} (ID: ${transfer.toLocationId})`)
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
            role: { select: { id: true, name: true } }
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
      console.log(`❌ User "${username}" not found in database`)
      console.log('\n📋 Searching for similar usernames...')
      
      const similarUsers = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: 'bambang', mode: 'insensitive' } },
            { username: { contains: 'receiver', mode: 'insensitive' } },
            { username: { contains: 'jojit', mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true
        }
      })
      
      if (similarUsers.length > 0) {
        console.log('\n✅ Found similar users:')
        similarUsers.forEach(u => {
          console.log(`   - ${u.username} (${u.firstName} ${u.lastName || ''})`)
        })
      }
      return
    }
    
    console.log(`👤 User Found: ${user.username}`)
    console.log(`   Name: ${user.firstName} ${user.lastName || ''}`)
    console.log(`   User ID: ${user.id}`)
    
    const userRole = user.roles[0]?.role
    console.log(`   Role: ${userRole?.name || 'No role assigned'}`)
    console.log()
    
    // Get permissions
    const directPermissions = user.permissions.map(up => up.permission.name)
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
    const allPermissions = [...new Set([...directPermissions, ...rolePermissions])]
    
    // Check required permissions
    console.log(`🔐 Permission Check:`)
    const requiredPerms = [
      'stock_transfer.view',
      'stock_transfer.complete',
      'stock_transfer.receive',
      'access_all_locations'
    ]
    
    requiredPerms.forEach(perm => {
      const has = allPermissions.includes(perm)
      console.log(`   ${has ? '✅' : '❌'} ${perm}`)
    })
    console.log()
    
    // Check location access
    console.log(`📍 Location Access:`)
    if (user.userLocations.length === 0) {
      console.log('   ❌ No locations assigned!')
    } else {
      user.userLocations.forEach(ul => {
        const isDestination = ul.locationId === transfer.toLocationId
        console.log(`   ${isDestination ? '✅' : '  '} ${ul.location.name} (ID: ${ul.locationId}) ${isDestination ? '← DESTINATION' : ''}`)
      })
    }
    console.log()
    
    // Final verdict
    const hasCompletePermission = allPermissions.includes('stock_transfer.complete')
    const hasAccessAllLocations = allPermissions.includes('access_all_locations')
    const hasDestinationAccess = user.userLocations.some(ul => ul.locationId === transfer.toLocationId)
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📊 FINAL VERDICT:`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    
    if (hasCompletePermission && (hasAccessAllLocations || hasDestinationAccess)) {
      console.log(`\n✅ YES! User "${username}" CAN complete the transfer!`)
      console.log(`\n   ✓ Has stock_transfer.complete permission`)
      if (hasAccessAllLocations) {
        console.log(`   ✓ Has access_all_locations permission (can receive at any location)`)
      } else {
        console.log(`   ✓ Has access to Bambang destination location`)
      }
      console.log(`\n🎉 You can now log in as "${username}" and click "Receive Transfer"!`)
    } else {
      console.log(`\n❌ NO! User "${username}" CANNOT complete the transfer yet.`)
      console.log(`\nMissing:`)
      if (!hasCompletePermission) {
        console.log(`   ❌ stock_transfer.complete permission`)
      }
      if (!hasAccessAllLocations && !hasDestinationAccess) {
        console.log(`   ❌ Access to Bambang location (ID: ${transfer.toLocationId})`)
      }
      console.log(`\n💡 Need to fix these issues first!`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkReceiverUser()

