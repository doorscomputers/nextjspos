const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testPurchaseItems() {
  try {
    console.log('Testing purchase items query...')

    const items = await prisma.purchaseItem.findMany({
      where: {
        purchase: {
          businessId: 1,
          deletedAt: null
        }
      },
      include: {
        purchase: {
          select: {
            id: true,
            purchaseOrderNumber: true,
            purchaseDate: true,
            locationId: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        productVariation: {
          select: {
            id: true,
            sku: true,
            product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        id: 'desc'
      },
      take: 5
    })

    console.log(`Found ${items.length} purchase items`)
    if (items.length > 0) {
      console.log('\nFirst item:')
      console.log(JSON.stringify(items[0], null, 2))

      // Also fetch location names
      const uniqueLocationIds = [...new Set(items.map(item => item.purchase.locationId))]
      const locations = await prisma.businessLocation.findMany({
        where: {
          id: { in: uniqueLocationIds }
        },
        select: {
          id: true,
          name: true
        }
      })
      console.log('\nLocations:')
      console.log(JSON.stringify(locations, null, 2))
    }

  } catch (error) {
    console.error('Error:', error.message)
    if (error.meta) {
      console.error('Meta:', error.meta)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testPurchaseItems()
