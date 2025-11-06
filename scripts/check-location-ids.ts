import { prisma } from '../src/lib/prisma.simple.js'

async function checkLocationIds() {
  try {
    console.log('Fetching business locations...\n')

    const locations = await prisma.businessLocation.findMany({
      select: {
        id: true,
        name: true,
        businessId: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    console.log('Business Locations:')
    console.log('='.repeat(60))
    locations.forEach((loc) => {
      console.log(`ID: ${loc.id} | Name: ${loc.name} | BusinessID: ${loc.businessId}`)
    })
    console.log('='.repeat(60))
    console.log(`\nTotal locations: ${locations.length}`)

    // Specifically check what ID 2 is
    const location2 = locations.find(loc => loc.id === 2)
    if (location2) {
      console.log(`\n⚠️  Location ID 2 is: "${location2.name}"`)
    } else {
      console.log('\n⚠️  Location ID 2 does NOT exist!')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLocationIds()
