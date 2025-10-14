const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkLocationAccess() {
  try {
    const userId = 12 // Jheirone

    const userLocations = await prisma.userLocation.findMany({
      where: {
        userId: userId,
      },
      select: {
        locationId: true,
      },
    })

    console.log('User ID:', userId)
    console.log('Accessible Locations:', userLocations)
    console.log('Accessible Location IDs:', userLocations.map((ul) => ul.locationId))

    const accessibleLocationIds = userLocations.map((ul) => ul.locationId)
    console.log('Is empty?', accessibleLocationIds.length === 0)

    // Try the query that's failing
    const where = {
      businessId: 1,
      locationId: { in: accessibleLocationIds }
    }

    console.log('\nWhere clause:', JSON.stringify(where, null, 2))

    const receipts = await prisma.purchaseReceipt.findMany({
      where,
      take: 5,
    })

    console.log('\n✓ Query succeeded! Found', receipts.length, 'receipts')
    process.exit(0)
  } catch (error) {
    console.error('\n✗ Error:', error.message)
    console.error('Error type:', error.constructor.name)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkLocationAccess()
