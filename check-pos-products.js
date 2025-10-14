// Diagnostic script to check POS product loading
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPOSProducts() {
  try {
    console.log('=== POS Product Loading Diagnostic ===\n')

    // 1. Check if there are any products
    const allProducts = await prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        variations: {
          where: { deletedAt: null },
          include: {
            variationLocationDetails: true
          }
        }
      }
    })

    console.log(`📦 Total Products: ${allProducts.length}\n`)

    if (allProducts.length === 0) {
      console.log('❌ No products found in database!')
      return
    }

    // 2. Check products with stock
    console.log('📊 Products with Stock at Locations:\n')

    for (const product of allProducts.slice(0, 5)) {
      console.log(`Product: ${product.name} (ID: ${product.id})`)
      console.log(`  SKU: ${product.sku}`)
      console.log(`  Active: ${product.isActive}`)
      console.log(`  Variations: ${product.variations.length}`)

      for (const variation of product.variations) {
        console.log(`    - Variation: ${variation.name} (SKU: ${variation.sku})`)
        console.log(`      Location Stock:`)

        if (variation.variationLocationDetails.length === 0) {
          console.log(`        ⚠️  No location stock records!`)
        } else {
          for (const location of variation.variationLocationDetails) {
            console.log(`        Location ${location.locationId}: ${location.qtyAvailable} units`)
          }
        }
      }
      console.log('')
    }

    // 3. Check active shift
    const activeShifts = await prisma.shift.findMany({
      where: {
        status: 'open'
      },
      include: {
        location: true,
        user: true
      }
    })

    console.log(`\n🔄 Active Shifts: ${activeShifts.length}`)

    if (activeShifts.length > 0) {
      const shift = activeShifts[0]
      console.log(`  Shift ID: ${shift.id}`)
      console.log(`  Location: ${shift.location?.name || 'Unknown'} (ID: ${shift.locationId})`)
      console.log(`  User: ${shift.user?.username || 'Unknown'}`)
      console.log(`  Beginning Cash: ${shift.beginningCash}`)

      // 4. Check products with stock at this specific location
      const productsWithStockAtLocation = allProducts.filter(p => {
        return p.variations?.some(v => {
          return v.variationLocationDetails?.some(vl =>
            vl.locationId === shift.locationId && parseFloat(vl.qtyAvailable) > 0
          )
        })
      })

      console.log(`\n✅ Products with stock at Location ${shift.locationId}: ${productsWithStockAtLocation.length}`)

      if (productsWithStockAtLocation.length === 0) {
        console.log(`\n⚠️  WARNING: No products have stock at the current shift location!`)
        console.log(`   This is why products aren't showing in the POS.`)
      }
    } else {
      console.log(`  ⚠️  No active shift found!`)
    }

    // 5. Check API response format
    console.log('\n📡 Checking API Response Format:')
    const sampleProduct = allProducts[0]
    if (sampleProduct) {
      console.log('Sample product structure:')
      console.log(JSON.stringify({
        id: sampleProduct.id,
        name: sampleProduct.name,
        sku: sampleProduct.sku,
        variations: sampleProduct.variations.map(v => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          variationLocationDetails: v.variationLocationDetails.map(vl => ({
            locationId: vl.locationId,
            qtyAvailable: vl.qtyAvailable.toString()
          }))
        }))
      }, null, 2))
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkPOSProducts()
