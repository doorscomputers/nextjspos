/**
 * Check location-specific pricing for single-unit products
 * Product: 303 4PORTS USB HUB 3.0
 * SKU: 6908620061125
 *
 * This checks variationLocationDetails table (for products without sub-units)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const targetSku = '6908620061125'

  console.log('📊 SINGLE-UNIT PRODUCT PRICING CHECK')
  console.log('='.repeat(80))
  console.log(`Product SKU: ${targetSku}`)
  console.log(`Product: 303 4PORTS USB HUB 3.0\n`)

  // Step 1: Find the product variation
  const variation = await prisma.productVariation.findFirst({
    where: { sku: targetSku },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  })

  if (!variation) {
    console.log('❌ Product variation not found!')
    return
  }

  console.log('─'.repeat(80))
  console.log('1️⃣  PRODUCT INFO')
  console.log('─'.repeat(80))
  console.log(`Product ID: ${variation.product.id}`)
  console.log(`Product Name: ${variation.product.name}`)
  console.log(`Variation ID: ${variation.id}`)
  console.log(`Variation SKU: ${variation.sku}`)
  console.log(`Default Selling Price: ₱${variation.defaultSellingPrice}`)
  console.log(`Default Purchase Price: ₱${variation.defaultPurchasePrice}`)

  // Step 2: Get all location-specific prices
  console.log('\n' + '─'.repeat(80))
  console.log('2️⃣  LOCATION-SPECIFIC PRICES (variation_location_details)')
  console.log('─'.repeat(80))

  const locationPrices = await prisma.variationLocationDetails.findMany({
    where: {
      productVariationId: variation.id,
    },
    include: {
      location: {
        select: {
          id: true,
          name: true,
        },
      },
      lastPriceUpdatedByUser: {
        select: {
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      location: {
        name: 'asc',
      },
    },
  })

  if (locationPrices.length === 0) {
    console.log('⚠️  No location-specific prices found!')
    console.log('   All locations will use default price: ₱' + variation.defaultSellingPrice)
  } else {
    for (const price of locationPrices) {
      console.log(`\n📍 ${price.location.name} (ID: ${price.location.id}):`)
      console.log(`   Selling Price: ₱${price.sellingPrice}`)
      console.log(`   Last Updated: ${price.lastPriceUpdate?.toLocaleString() || 'Never'}`)
      console.log(`   Updated By: ${price.lastPriceUpdatedByUser?.name || price.lastPriceUpdatedByUser?.username || 'Unknown'}`)
    }
  }

  // Step 3: Check Bambang specifically
  console.log('\n' + '─'.repeat(80))
  console.log('3️⃣  BAMBANG LOCATION CHECK (Expected: ₱420)')
  console.log('─'.repeat(80))

  const bambang = await prisma.businessLocation.findFirst({
    where: { name: 'Bambang' },
  })

  if (!bambang) {
    console.log('❌ Bambang location not found!')
  } else {
    const bambangPrice = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variation.id,
          locationId: bambang.id,
        },
      },
      include: {
        lastPriceUpdatedByUser: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    })

    if (!bambangPrice) {
      console.log('⚠️  NO LOCATION-SPECIFIC PRICE for Bambang')
      console.log(`   Using default: ₱${variation.defaultSellingPrice}`)
      console.log('   🔴 PROBLEM: Price change NOT saved!')
    } else {
      const price = parseFloat(String(bambangPrice.sellingPrice))
      console.log(`📍 Bambang (ID: ${bambang.id}):`)
      console.log(`   Price in Database: ₱${price}`)

      if (price === 420) {
        console.log('   ✅ CORRECT! Price successfully updated to ₱420')
      } else if (price === 430) {
        console.log('   ❌ WRONG! Still showing old price ₱430')
        console.log('   🔴 PROBLEM: Price change NOT saved!')
      } else {
        console.log(`   ⚠️  UNEXPECTED! Price is ₱${price} (expected ₱420)`)
      }

      console.log(`   Last Updated: ${bambangPrice.lastPriceUpdate?.toLocaleString() || 'Never'}`)
      console.log(`   Updated By: ${bambangPrice.lastPriceUpdatedByUser?.name || bambangPrice.lastPriceUpdatedByUser?.username || 'Unknown'}`)
    }
  }

  // Step 4: Show all locations with effective prices
  console.log('\n' + '─'.repeat(80))
  console.log('4️⃣  ALL LOCATIONS - EFFECTIVE PRICES')
  console.log('─'.repeat(80))

  const allLocations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })

  for (const location of allLocations) {
    const locationPrice = locationPrices.find(lp => lp.locationId === location.id)

    if (locationPrice) {
      console.log(`\n📍 ${location.name}: ₱${locationPrice.sellingPrice} (Location-Specific ✅)`)
    } else {
      console.log(`\n📍 ${location.name}: ₱${variation.defaultSellingPrice} (Global Default ⚠️)`)
    }
  }

  // Step 5: Recent updates check
  console.log('\n' + '─'.repeat(80))
  console.log('5️⃣  RECENT PRICE UPDATES (Last 24 hours)')
  console.log('─'.repeat(80))

  const oneDayAgo = new Date()
  oneDayAgo.setHours(oneDayAgo.getHours() - 24)

  const recentUpdates = await prisma.variationLocationDetails.findMany({
    where: {
      productVariationId: variation.id,
      lastPriceUpdate: {
        gte: oneDayAgo,
      },
    },
    include: {
      location: {
        select: {
          name: true,
        },
      },
      lastPriceUpdatedByUser: {
        select: {
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      lastPriceUpdate: 'desc',
    },
  })

  if (recentUpdates.length === 0) {
    console.log('⚠️  No price updates in the last 24 hours')
  } else {
    for (const update of recentUpdates) {
      const minutesAgo = Math.floor((Date.now() - update.lastPriceUpdate!.getTime()) / 1000 / 60)
      console.log(`\n📍 ${update.location.name}:`)
      console.log(`   New Price: ₱${update.sellingPrice}`)
      console.log(`   Updated: ${minutesAgo} minutes ago`)
      console.log(`   By: ${update.lastPriceUpdatedByUser?.name || update.lastPriceUpdatedByUser?.username || 'Unknown'}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('END OF REPORT')
  console.log('='.repeat(80))
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
