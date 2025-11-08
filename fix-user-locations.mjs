import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUserLocations() {
  try {
    console.log('\n=== FIXING USER LOCATION ASSIGNMENTS ===\n')

    // Clear existing location assignments (except super admins)
    console.log('Step 1: Clearing old location assignments...')
    const deleted = await prisma.userLocation.deleteMany({
      where: {
        user: {
          businessId: 1,
          username: {
            notIn: ['superadmin', 'pcinetadmin']
          }
        }
      }
    })
    console.log(`Cleared ${deleted.count} old assignments\n`)

    // Define user-to-location mapping based on username patterns
    const assignments = [
      // Main Warehouse (ID 1)
      { username: 'Jheiron', locationId: 1, locationName: 'Main Warehouse' },

      // Main Store (ID 2)
      { username: 'invcormain', locationId: 2, locationName: 'Main Store' },
      { username: 'JASMINKATECashierMain', locationId: 2, locationName: 'Main Store' },
      { username: 'JOJITKATECashierMain', locationId: 2, locationName: 'Main Store' },
      { username: 'JASMINKATETransferReceiverMain', locationId: 2, locationName: 'Main Store' },
      { username: 'JOJITKATETransferReceiverMain', locationId: 2, locationName: 'Main Store' },
      { username: 'PriceMgrMain', locationId: 2, locationName: 'Main Store' },

      // Bambang (ID 3)
      { username: 'invcorbambang', locationId: 3, locationName: 'Bambang' },
      { username: 'JASMINKATECashierBambang', locationId: 3, locationName: 'Bambang' },
      { username: 'JOJITKATECashierBambang', locationId: 3, locationName: 'Bambang' },
      { username: 'JASMINKATETransferReceiverBambang', locationId: 3, locationName: 'Bambang' },
      { username: 'JOJITKATETransferReceiverBambang', locationId: 3, locationName: 'Bambang' },
      { username: 'PriceMgrBambang', locationId: 3, locationName: 'Bambang' },

      // Tuguegarao (ID 4)
      { username: 'invcortugue', locationId: 4, locationName: 'Tuguegarao' },
      { username: 'EricsonChanCashierTugue', locationId: 4, locationName: 'Tuguegarao' },
      { username: 'EricsonChanTransferReceiverTugue', locationId: 4, locationName: 'Tuguegarao' },
      { username: 'PriceMgrTugue', locationId: 4, locationName: 'Tuguegarao' },
    ]

    console.log('Step 2: Assigning users to locations based on username patterns...\n')

    let successCount = 0
    let notFoundCount = 0

    for (const assignment of assignments) {
      const user = await prisma.user.findFirst({
        where: {
          username: assignment.username,
          businessId: 1
        }
      })

      if (user) {
        await prisma.userLocation.create({
          data: {
            userId: user.id,
            locationId: assignment.locationId
          }
        })
        console.log(`✅ ${assignment.username} -> ${assignment.locationName}`)
        successCount++
      } else {
        console.log(`⚠️  ${assignment.username} -> User not found`)
        notFoundCount++
      }
    }

    console.log(`\n=== SUMMARY ===`)
    console.log(`✅ Successfully assigned: ${successCount} users`)
    console.log(`⚠️  Users not found: ${notFoundCount}`)

    // Verification
    console.log(`\n=== VERIFICATION ===\n`)

    const verifyUsers = await prisma.user.findMany({
      where: {
        businessId: 1,
        username: {
          in: assignments.map(a => a.username)
        }
      },
      include: {
        locations: {
          include: {
            location: true
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    })

    for (const user of verifyUsers) {
      const locationNames = user.locations.map(ul => ul.location.name).join(', ') || 'NO LOCATION'
      console.log(`${user.username} -> ${locationNames}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixUserLocations()
