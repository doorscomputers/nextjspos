const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkStockAlerts() {
  try {
    console.log('=== Checking Products with Alert Quantities ===\n')

    // Get all products with alert quantities
    const products = await prisma.product.findMany({
      where: {
        businessId: 1,
        alertQuantity: { not: null }
      },
      include: {
        variations: {
          include: {
            variationLocationDetails: true
          }
        }
      }
    })

    // Get locations separately
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: 1 }
    })
    const locationMap = Object.fromEntries(locations.map(l => [l.id, l.name]))

    console.log(`Found ${products.length} products with alert quantities\n`)

    products.forEach(product => {
      console.log(`Product: ${product.name} (SKU: ${product.sku})`)
      console.log(`Alert Quantity: ${product.alertQuantity}`)

      product.variations.forEach(variation => {
        console.log(`  Variation: ${variation.name}`)

        variation.variationLocationDetails.forEach(vld => {
          const currentQty = parseFloat(vld.qtyAvailable.toString())
          const alertQty = parseFloat(product.alertQuantity.toString())
          const isLow = currentQty <= alertQty

          console.log(`    Location: ${locationMap[vld.locationId] || 'Unknown'}`)
          console.log(`    Current Qty: ${currentQty}`)
          console.log(`    Alert Qty: ${alertQty}`)
          console.log(`    Below Alert? ${isLow ? 'YES ⚠️' : 'NO ✓'}`)
        })
      })
      console.log('')
    })

    // Now test the exact query from the dashboard API
    console.log('\n=== Testing Dashboard API Query ===\n')

    const lowStockProducts = await prisma.variationLocationDetails.findMany({
      where: {
        product: {
          businessId: 1,
          alertQuantity: { not: null },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            alertQuantity: true,
          },
        },
        productVariation: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
    })

    console.log(`Query returned ${lowStockProducts.length} variation location records\n`)

    const stockAlerts = lowStockProducts.filter((item) => {
      const alertQty = item.product.alertQuantity
        ? parseFloat(item.product.alertQuantity.toString())
        : 0
      const currentQty = parseFloat(item.qtyAvailable.toString())
      return currentQty <= alertQty
    })

    console.log(`After filtering: ${stockAlerts.length} items below alert quantity\n`)

    stockAlerts.forEach(item => {
      console.log(`Product: ${item.product.name}`)
      console.log(`Variation: ${item.productVariation.name}`)
      console.log(`SKU: ${item.product.sku}`)
      console.log(`Current Qty: ${item.qtyAvailable}`)
      console.log(`Alert Qty: ${item.product.alertQuantity}`)
      console.log('')
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkStockAlerts()
