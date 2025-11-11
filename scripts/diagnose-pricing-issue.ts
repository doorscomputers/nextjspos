/**
 * Diagnose pricing issue - Check what's actually in the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Diagnosing Pricing Issue\n')
  console.log('='.repeat(60))

  const productName = 'Sample UTP CABLE'

  // Find product
  const product = await prisma.product.findFirst({
    where: { name: productName },
    select: { id: true, name: true, businessId: true }
  })

  if (!product) {
    console.log(`❌ Product "${productName}" not found`)
    return
  }

  console.log(`\n📦 Product: ${product.name} (ID: ${product.id})`)

  // Get all locations
  const locations = await prisma.businessLocation.findMany({
    where: { businessId: product.businessId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })

  console.log(`\n📍 ${locations.length} Locations Found:`)
  locations.forEach(loc => {
    console.log(`   ${loc.id}: ${loc.name}`)
  })

  // Get all units for this product
  const units = await prisma.unit.findMany({
    where: {
      OR: [
        { id: { in: [3, 4] } } // Roll and Meter
      ]
    },
    select: { id: true, name: true }
  })

  console.log(`\n🔢 Units:`)
  units.forEach(unit => {
    console.log(`   ${unit.id}: ${unit.name}`)
  })

  // Check GLOBAL prices (ProductUnitPrice)
  console.log(`\n${'='.repeat(60)}`)
  console.log('GLOBAL PRICES (ProductUnitPrice)')
  console.log('='.repeat(60))

  const globalPrices = await prisma.productUnitPrice.findMany({
    where: {
      productId: product.id,
      businessId: product.businessId
    },
    include: { unit: true },
    orderBy: { unitId: 'asc' }
  })

  if (globalPrices.length === 0) {
    console.log('⚠️  No global prices found')
  } else {
    globalPrices.forEach(gp => {
      console.log(`   ${gp.unit.name}: Purchase ₱${gp.purchasePrice}, Selling ₱${gp.sellingPrice}`)
    })
  }

  // Check LOCATION-SPECIFIC prices (ProductUnitLocationPrice)
  console.log(`\n${'='.repeat(60)}`)
  console.log('LOCATION-SPECIFIC PRICES (ProductUnitLocationPrice)')
  console.log('='.repeat(60))

  for (const location of locations) {
    const locationPrices = await prisma.productUnitLocationPrice.findMany({
      where: {
        productId: product.id,
        locationId: location.id,
        businessId: product.businessId
      },
      include: { unit: true },
      orderBy: { unitId: 'asc' }
    })

    console.log(`\n📍 ${location.name} (ID: ${location.id}):`)
    if (locationPrices.length === 0) {
      console.log(`   ⚠️  No location-specific prices (will use global fallback)`)
    } else {
      locationPrices.forEach(lp => {
        console.log(`   ${lp.unit.name}: Purchase ₱${lp.purchasePrice}, Selling ₱${lp.sellingPrice}`)
      })
    }
  }

  // ANALYZE THE ISSUE
  console.log(`\n${'='.repeat(60)}`)
  console.log('DIAGNOSIS')
  console.log('='.repeat(60))

  const bambang = locations.find(l => l.name.toLowerCase().includes('bambang'))
  const tugue = locations.find(l => l.name.toLowerCase().includes('tugue'))

  if (!bambang) {
    console.log('❌ Bambang location not found')
    return
  }

  const bambangPrices = await prisma.productUnitLocationPrice.findMany({
    where: { productId: product.id, locationId: bambang.id },
    include: { unit: true }
  })

  const tuguePrices = tugue ? await prisma.productUnitLocationPrice.findMany({
    where: { productId: product.id, locationId: tugue.id },
    include: { unit: true }
  }) : []

  console.log(`\n🔍 Checking if prices are DIFFERENT per location:`)

  if (bambangPrices.length === 0) {
    console.log(`\n❌ PROBLEM FOUND: Bambang has NO location-specific prices!`)
    console.log(`   This means prices were NOT saved to ProductUnitLocationPrice`)
    console.log(`   Bambang is using global fallback: ₱${globalPrices[0]?.sellingPrice}`)
  } else {
    console.log(`\n✅ Bambang HAS location-specific prices:`)
    bambangPrices.forEach(bp => {
      console.log(`   ${bp.unit.name}: ₱${bp.sellingPrice}`)
    })
  }

  if (tugue) {
    if (tuguePrices.length === 0) {
      console.log(`\n❌ PROBLEM FOUND: Tuguegarao has NO location-specific prices!`)
      console.log(`   Tuguegarao is using global fallback: ₱${globalPrices[0]?.sellingPrice}`)
    } else {
      console.log(`\n✅ Tuguegarao HAS location-specific prices:`)
      tuguePrices.forEach(tp => {
        console.log(`   ${tp.unit.name}: ₱${tp.sellingPrice}`)
      })
    }
  }

  // Check if ALL locations have SAME prices (indicating global update instead of location-specific)
  const allLocationPrices = await prisma.productUnitLocationPrice.findMany({
    where: { productId: product.id },
    include: { unit: true, location: true },
    orderBy: [{ locationId: 'asc' }, { unitId: 'asc' }]
  })

  if (allLocationPrices.length > 0) {
    console.log(`\n📊 Checking if all locations have IDENTICAL prices:`)

    const pricesByUnit: Record<number, Set<string>> = {}

    allLocationPrices.forEach(lp => {
      if (!pricesByUnit[lp.unitId]) {
        pricesByUnit[lp.unitId] = new Set()
      }
      pricesByUnit[lp.unitId].add(String(lp.sellingPrice))
    })

    Object.entries(pricesByUnit).forEach(([unitId, prices]) => {
      const unit = units.find(u => u.id === parseInt(unitId))
      if (prices.size === 1) {
        console.log(`   ⚠️  ${unit?.name}: ALL locations have SAME price: ₱${Array.from(prices)[0]}`)
        console.log(`       This might indicate global update instead of location-specific`)
      } else {
        console.log(`   ✅ ${unit?.name}: Locations have DIFFERENT prices: ${Array.from(prices).join(', ')}`)
      }
    })
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('RECOMMENDATIONS')
  console.log('='.repeat(60))

  if (bambangPrices.length === 0) {
    console.log(`\n1. ❌ Bambang has NO location-specific prices`)
    console.log(`   → Prices were NOT saved correctly`)
    console.log(`   → Check if Step 3 locations are being passed to API`)
    console.log(`   → Check browser Network tab for locationIds parameter`)
  }

  if (globalPrices.some(gp => gp.sellingPrice === 1650)) {
    console.log(`\n2. ⚠️  Global prices are ₱1,650 (old value)`)
    console.log(`   → This is why POS shows ₱1,650 (using global fallback)`)
    console.log(`   → Set location-specific prices in Step 5`)
  }

  console.log(`\n3. 🔧 TO FIX:`)
  console.log(`   → Clear browser cache (Ctrl+Shift+R)`)
  console.log(`   → Wait for Vercel deployment to complete`)
  console.log(`   → Set prices for Bambang ONLY in Step 5`)
  console.log(`   → Check Network tab to verify locationIds=[5] is sent`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
