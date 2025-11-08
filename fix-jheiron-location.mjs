import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixJheironLocation() {
  try {
    console.log('\n=== FIXING JHEIRON LOCATION ASSIGNMENT ===\n')

    // Find Jheiron
    const user = await prisma.user.findFirst({
      where: {
        username: 'Jheiron',
        businessId: 1
      },
      include: {
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    if (!user) {
      console.log('❌ Jheiron not found')
      return
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`)
    console.log(`Current locations: ${user.userLocations.map(l => l.location.name).join(', ') || 'NONE'}`)

    // Clear existing locations
    await prisma.userLocation.deleteMany({
      where: {
        userId: user.id
      }
    })

    // Assign to Main Warehouse (ID 1)
    await prisma.userLocation.create({
      data: {
        userId: user.id,
        locationId: 1
      }
    })

    console.log(`\n✅ Assigned Jheiron → Main Warehouse (ID 1)`)

    // Verify
    const updated = await prisma.user.findFirst({
      where: { id: user.id },
      include: {
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    console.log(`\nVerification:`)
    console.log(`  Username: ${updated.username}`)
    console.log(`  Locations: ${updated.userLocations.map(l => l.location.name).join(', ')}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixJheironLocation()
