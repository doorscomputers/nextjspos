import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkJayLocation() {
  try {
    console.log('🔍 Checking Jay\'s location assignments...\n')

    const user = await prisma.user.findUnique({
      where: { username: 'jayvillalon' },
      include: {
        userLocations: {
          include: {
            location: true
          }
        },
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!user) {
      console.error('❌ User jayvillalon not found!')
      return
    }

    console.log('✅ User: jayvillalon')
    console.log(`   Roles: ${user.roles.map(r => r.role.name).join(', ')}`)
    console.log('')

    console.log('📍 Location Assignments:')
    if (user.userLocations.length === 0) {
      console.log('   ❌ NO LOCATIONS ASSIGNED')
      console.log('   This is why Jay cannot approve transfers!')
    } else {
      user.userLocations.forEach(ul => {
        console.log(`   - ${ul.location.name} (ID: ${ul.locationId})`)
      })
    }
    console.log('')

    // Check all locations
    const allLocations = await prisma.businessLocation.findMany({
      where: { businessId: user.businessId },
      select: {
        id: true,
        name: true,
        locationCode: true
      }
    })

    console.log('🏢 All Available Locations:')
    allLocations.forEach(loc => {
      console.log(`   - ${loc.name} (ID: ${loc.id})`)
    })
    console.log('')

    console.log('💡 SOLUTION:')
    console.log('   Jay has ACCESS_ALL_LOCATIONS permission but NO assigned locations.')
    console.log('   The transfer approval button checks for PRIMARY location assignment.')
    console.log('   ')
    console.log('   Option 1: Assign Jay to Main Warehouse location')
    console.log('   Option 2: Fix the code to allow ACCESS_ALL_LOCATIONS users')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkJayLocation()
