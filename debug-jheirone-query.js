const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugQuery() {
  try {
    console.log('Testing query for user Jheirone (businessId: 1)...\n')

    // Step 1: Query purchase items
    console.log('Step 1: Fetching purchase items...')
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
            expectedDeliveryDate: true,
            status: true,
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
                id: true,
                name: true
              }
            },
            variationDetails: true
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    })

    console.log(`✓ Found ${items.length} purchase items\n`)

    if (items.length > 0) {
      console.log('First item locationId:', items[0].purchase.locationId)

      // Step 2: Get unique location IDs
      console.log('\nStep 2: Getting unique location IDs...')
      const uniqueLocationIds = [...new Set(items.map(item => item.purchase.locationId))]
      console.log('Unique location IDs:', uniqueLocationIds)

      // Step 3: Fetch locations
      console.log('\nStep 3: Fetching locations...')
      const locations = await prisma.businessLocation.findMany({
        where: {
          id: { in: uniqueLocationIds }
        },
        select: {
          id: true,
          name: true
        }
      })

      console.log(`✓ Found ${locations.length} locations:`)
      locations.forEach(loc => console.log(`  - ID ${loc.id}: ${loc.name}`))

      // Step 4: Create lookup map
      console.log('\nStep 4: Creating lookup map...')
      const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))
      console.log('Location map:', Array.from(locationMap.entries()))

      // Step 5: Test mapping
      console.log('\nStep 5: Testing location mapping for first item...')
      const firstItemLocationId = items[0].purchase.locationId
      const locationName = locationMap.get(firstItemLocationId)
      console.log(`Location ID ${firstItemLocationId} maps to: "${locationName}"`)

      console.log('\n✓ ALL STEPS COMPLETED SUCCESSFULLY!')
    } else {
      console.log('⚠ No purchase items found')
    }

  } catch (error) {
    console.error('\n❌ ERROR OCCURRED:')
    console.error('Message:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

debugQuery()
