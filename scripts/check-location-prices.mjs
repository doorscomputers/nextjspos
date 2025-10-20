import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkLocationPrices() {
  try {
    console.log('\n🏪 Checking Per-Location Selling Prices...\n')

    const totalDetails = await prisma.variationLocationDetails.count()
    console.log(`Total Location Detail Records: ${totalDetails}`)

    // Check how many have selling prices set
    const withPrice = await prisma.variationLocationDetails.count({
      where: { sellingPrice: { not: null } }
    })
    const withoutPrice = await prisma.variationLocationDetails.count({
      where: { sellingPrice: null }
    })

    console.log(`\n💰 Selling Price Analysis:`)
    console.log(`  Records WITH location-specific price: ${withPrice}`)
    console.log(`  Records WITHOUT location-specific price: ${withoutPrice}`)

    // Get sample records
    const samples = await prisma.variationLocationDetails.findMany({
      take: 10,
      include: {
        productVariation: {
          select: {
            sku: true,
            purchasePrice: true,
            sellingPrice: true
          }
        }
      }
    })

    console.log('\n📋 Sample Location Details:')
    console.log('─'.repeat(100))
    console.log('SKU'.padEnd(20), 'Variation Price'.padEnd(20), 'Location Price'.padEnd(20), 'Stock'.padEnd(10))
    console.log('─'.repeat(100))

    samples.forEach((s) => {
      const variationPrice = `₱${Number(s.productVariation.sellingPrice).toFixed(2)}`
      const locationPrice = s.sellingPrice ? `₱${Number(s.sellingPrice).toFixed(2)}` : 'NULL (not set)'
      console.log(
        s.productVariation.sku.padEnd(20),
        variationPrice.padEnd(20),
        locationPrice.padEnd(20),
        s.qtyAvailable.toString().padEnd(10)
      )
    })
    console.log('─'.repeat(100))

    console.log('\n📝 Notes:')
    console.log('  - "Variation Price" = Default price from ProductVariation table')
    console.log('  - "Location Price" = Per-location override (if set)')
    console.log('  - When Location Price is NULL, system should use Variation Price')

    // Check product variation prices
    console.log('\n\n🏷️  Checking Product Variation Prices...\n')

    const totalVariations = await prisma.productVariation.count()
    const variationsWithPrice = await prisma.productVariation.count({
      where: { sellingPrice: { gt: 0 } }
    })
    const variationsWithoutPrice = await prisma.productVariation.count({
      where: { sellingPrice: 0 }
    })

    console.log(`Total Product Variations: ${totalVariations}`)
    console.log(`  WITH selling price (>0): ${variationsWithPrice}`)
    console.log(`  WITHOUT selling price (=0): ${variationsWithoutPrice}`)

    // Sample variation prices
    const variationSamples = await prisma.productVariation.findMany({
      take: 5,
      select: {
        sku: true,
        purchasePrice: true,
        sellingPrice: true
      }
    })

    console.log('\n📋 Sample Variation Prices:')
    console.log('─'.repeat(80))
    variationSamples.forEach((v, i) => {
      console.log(`${i+1}. ${v.sku} - Cost: ₱${Number(v.purchasePrice).toFixed(2)}, Price: ₱${Number(v.sellingPrice).toFixed(2)}`)
    })
    console.log('─'.repeat(80))

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLocationPrices()
