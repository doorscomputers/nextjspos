import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPivotData() {
  try {
    console.log('Checking database for pivot data...\n')

    // Check for businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
    })
    console.log(`Found ${businesses.length} business(es):`)
    businesses.forEach(b => console.log(`  - ${b.name} (ID: ${b.id})`))
    console.log()

    if (businesses.length === 0) {
      console.log('No businesses found. Please run: npm run db:seed')
      process.exit(0)
    }

    const businessId = businesses[0].id

    // Check for locations
    const locations = await prisma.businessLocation.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true, name: true },
    })
    console.log(`Found ${locations.length} location(s) for business ${businessId}:`)
    locations.forEach(l => console.log(`  - ${l.name} (ID: ${l.id})`))
    console.log()

    // Check for products
    const products = await prisma.product.count({
      where: { businessId, deletedAt: null },
    })
    console.log(`Found ${products} product(s)`)

    // Check for variations
    const variations = await prisma.productVariation.count({
      where: { businessId, deletedAt: null },
    })
    console.log(`Found ${variations} product variation(s)`)

    // Check for stock data
    const stockData = await prisma.variationLocationDetails.count({
      where: {
        product: {
          businessId,
          deletedAt: null,
        },
      },
    })
    console.log(`Found ${stockData} stock location record(s)`)
    console.log()

    // Sample some stock data
    if (stockData > 0) {
      const sampleStock = await prisma.variationLocationDetails.findMany({
        where: {
          product: {
            businessId,
            deletedAt: null,
          },
        },
        include: {
          product: {
            select: { name: true, sku: true },
          },
          productVariation: {
            select: { name: true, sku: true },
          },
        },
        take: 3,
      })

      console.log('Sample stock data:')
      sampleStock.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.product.name} - ${s.productVariation.name}`)
        console.log(`     SKU: ${s.productVariation.sku}`)
        console.log(`     Location ID: ${s.locationId}, Qty: ${s.qtyAvailable}`)
      })
    } else {
      console.log('WARNING: No stock data found!')
      console.log('This could mean:')
      console.log('  1. No products have been created yet')
      console.log('  2. No opening stock has been set')
      console.log('  3. Database needs to be seeded: npm run db:seed')
    }

  } catch (error) {
    console.error('Error checking pivot data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPivotData()
