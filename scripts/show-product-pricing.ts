/**
 * Show pricing per location for specific products
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const productNames = ['Sample UTP CABLE', '303 4PORTS USB HUB 3.0']

  console.log('📊 LOCATION-SPECIFIC PRICING REPORT')
  console.log('='.repeat(80))
  console.log(`Products: ${productNames.join(', ')}\n`)

  // Query 1: Location-Specific Prices
  console.log('─'.repeat(80))
  console.log('1️⃣  LOCATION-SPECIFIC PRICES (product_unit_location_prices)')
  console.log('─'.repeat(80))

  const locationPrices = await prisma.$queryRaw`
    SELECT
      p.name as product_name,
      bl.name as location_name,
      u.name as unit_name,
      pulp.purchase_price,
      pulp.selling_price,
      pulp.updated_at
    FROM product_unit_location_prices pulp
    JOIN products p ON pulp.product_id = p.id
    JOIN business_locations bl ON pulp.location_id = bl.id
    JOIN units u ON pulp.unit_id = u.id
    WHERE p.name IN (${productNames[0]}, ${productNames[1]})
    ORDER BY p.name, bl.name, u.name
  ` as any[]

  if (locationPrices.length === 0) {
    console.log('⚠️  No location-specific prices found')
  } else {
    let currentProduct = ''
    let currentLocation = ''

    locationPrices.forEach((row: any) => {
      if (row.product_name !== currentProduct) {
        console.log(`\n📦 ${row.product_name}`)
        currentProduct = row.product_name
        currentLocation = ''
      }

      if (row.location_name !== currentLocation) {
        console.log(`\n   📍 ${row.location_name}:`)
        currentLocation = row.location_name
      }

      console.log(`      ${row.unit_name}: Purchase ₱${row.purchase_price}, Selling ₱${row.selling_price}`)
    })
  }

  // Query 2: Global Prices
  console.log('\n\n' + '─'.repeat(80))
  console.log('2️⃣  GLOBAL PRICES (product_unit_prices) - Fallback')
  console.log('─'.repeat(80))

  const globalPrices = await prisma.$queryRaw`
    SELECT
      p.name as product_name,
      u.name as unit_name,
      pup.purchase_price,
      pup.selling_price
    FROM product_unit_prices pup
    JOIN products p ON pup.product_id = p.id
    JOIN units u ON pup.unit_id = u.id
    WHERE p.name IN (${productNames[0]}, ${productNames[1]})
    ORDER BY p.name, u.name
  ` as any[]

  if (globalPrices.length === 0) {
    console.log('⚠️  No global prices found')
  } else {
    let currentProduct = ''

    globalPrices.forEach((row: any) => {
      if (row.product_name !== currentProduct) {
        console.log(`\n📦 ${row.product_name} (applies to ALL locations if no location-specific price)`)
        currentProduct = row.product_name
      }

      console.log(`   ${row.unit_name}: Purchase ₱${row.purchase_price}, Selling ₱${row.selling_price}`)
    })
  }

  // Query 3: Summary
  console.log('\n\n' + '─'.repeat(80))
  console.log('3️⃣  SUMMARY - Coverage')
  console.log('─'.repeat(80))

  for (const productName of productNames) {
    const product = await prisma.product.findFirst({
      where: { name: productName },
      select: { id: true, name: true }
    })

    if (!product) {
      console.log(`\n❌ ${productName}: NOT FOUND`)
      continue
    }

    const totalLocations = await prisma.businessLocation.count()
    const locationsWithPrices = await prisma.productUnitLocationPrice.groupBy({
      by: ['locationId'],
      where: { productId: product.id },
      _count: true
    })

    const unitsWithPrices = await prisma.productUnitLocationPrice.groupBy({
      by: ['unitId'],
      where: { productId: product.id },
      _count: true
    })

    console.log(`\n📦 ${product.name}:`)
    console.log(`   Locations with specific prices: ${locationsWithPrices.length} / ${totalLocations}`)
    console.log(`   Units with prices: ${unitsWithPrices.length}`)

    if (locationsWithPrices.length < totalLocations) {
      const locationsWithoutPrices = await prisma.businessLocation.findMany({
        where: {
          id: {
            notIn: locationsWithPrices.map(l => l.locationId)
          }
        },
        select: { name: true }
      })

      console.log(`   ⚠️  Missing prices for: ${locationsWithoutPrices.map(l => l.name).join(', ')}`)
      console.log(`      (These locations will use global fallback: ₱${globalPrices.find(gp => gp.product_name === productName)?.selling_price || 'N/A'})`)
    } else {
      console.log(`   ✅ All locations have specific prices`)
    }
  }

  // Query 4: What POS will actually use
  console.log('\n\n' + '─'.repeat(80))
  console.log('4️⃣  EFFECTIVE PRICES (What POS will use)')
  console.log('─'.repeat(80))

  const locations = await prisma.businessLocation.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })

  for (const productName of productNames) {
    const product = await prisma.product.findFirst({
      where: { name: productName },
      select: { id: true }
    })

    if (!product) continue

    console.log(`\n📦 ${productName}:`)

    for (const location of locations) {
      const locationPrices = await prisma.productUnitLocationPrice.findMany({
        where: {
          productId: product.id,
          locationId: location.id
        },
        include: { unit: true }
      })

      const globalPrices = await prisma.productUnitPrice.findMany({
        where: { productId: product.id },
        include: { unit: true }
      })

      console.log(`\n   📍 ${location.name}:`)

      const unitIds = [...new Set([
        ...locationPrices.map(lp => lp.unitId),
        ...globalPrices.map(gp => gp.unitId)
      ])]

      for (const unitId of unitIds) {
        const locPrice = locationPrices.find(lp => lp.unitId === unitId)
        const globPrice = globalPrices.find(gp => gp.unitId === unitId)

        if (locPrice) {
          console.log(`      ${locPrice.unit.name}: ₱${locPrice.sellingPrice} (Location-Specific ✅)`)
        } else if (globPrice) {
          console.log(`      ${globPrice.unit.name}: ₱${globPrice.sellingPrice} (Global Fallback ⚠️)`)
        }
      }
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
