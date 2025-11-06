import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generateReport() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('📊 PLAYWRIGHT TEST - ACTUAL DATA IN SUPABASE DATABASE')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    // Get all locations
    const locations = await prisma.businessLocation.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    })

    console.log('📍 LOCATIONS IN SYSTEM:\n')
    for (const loc of locations) {
      console.log(`   ${loc.id}: ${loc.name}`)
    }

    // Get the 3 most recently updated products
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null
      },
      include: {
        variations: {
          where: { deletedAt: null }
        },
        category: true,
        unit: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 3
    })

    console.log('\n\n🎯 TEST PRODUCTS (3 most recently updated):\n')

    for (const product of products) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📦 ${product.name}`)
      console.log(`   SKU: ${product.sku}`)
      console.log(`   Category: ${product.category?.name || 'N/A'}`)
      console.log(`   Unit: ${product.unit?.shortName || 'N/A'}`)
      console.log(`   Last Updated: ${product.updatedAt.toLocaleString()}`)

      for (const variation of product.variations) {
        console.log(`\n   📌 Variation: ${variation.name}`)
        console.log(`      Code: ${variation.variationCode}`)
        console.log(`      Cost: ₱${Number(variation.defaultPurchasePrice).toFixed(2)}`)
        console.log(`      Price: ₱${Number(variation.defaultSellingPrice).toFixed(2)}`)
        console.log(`      Profit: ₱${(Number(variation.defaultSellingPrice) - Number(variation.defaultPurchasePrice)).toFixed(2)}`)

        // Get stock per location
        const stockRecords = await prisma.variationLocationDetails.findMany({
          where: { productVariationId: variation.id }
        })

        if (stockRecords.length > 0) {
          console.log(`\n      📊 CURRENT STOCK BY LOCATION:`)
          let totalStock = 0

          for (const stock of stockRecords) {
            const location = locations.find(l => l.id === stock.locationId)
            const qty = Number(stock.qtyAvailable)
            totalStock += qty
            console.log(`         ${(location?.name || 'Unknown').padEnd(25)}: ${qty.toString().padStart(6)} units`)
          }

          console.log(`         ${'-'.repeat(25)}   ${'-'.repeat(6)}`)
          console.log(`         ${'TOTAL'.padEnd(25)}: ${totalStock.toString().padStart(6)} units`)
        } else {
          console.log(`\n      📊 STOCK: No stock records found`)
        }
      }
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    }

    // Get recent purchases
    console.log('\n💰 RECENT PURCHASES (Last 5):\n')
    const purchases = await prisma.purchase.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        supplier: true,
        location: true,
        lines: {
          include: {
            productVariation: {
              include: { product: true }
            }
          }
        }
      }
    })

    for (const purchase of purchases) {
      console.log(`   PO #${purchase.referenceNo} - ${purchase.purchaseDate.toLocaleDateString()}`)
      console.log(`   Supplier: ${purchase.supplier?.name || 'N/A'}`)
      console.log(`   Location: ${purchase.location.name}`)
      console.log(`   Status: ${purchase.status}`)
      console.log(`   Total: ₱${Number(purchase.totalAmount).toFixed(2)}`)
      console.log(`   Items:`)
      for (const line of purchase.lines) {
        console.log(`      - ${line.productVariation.product.name} (${line.productVariation.name})`)
        console.log(`        ${Number(line.quantity)} units x ₱${Number(line.unitCost)} = ₱${Number(line.lineTotal)}`)
      }
      console.log('')
    }

    // Get recent sales by location
    console.log('\n🛒 RECENT SALES (Last 10):\n')
    const sales = await prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        location: true,
        lines: {
          include: {
            productVariation: {
              include: { product: true }
            }
          }
        }
      }
    })

    const salesByLocation: Record<string, typeof sales> = {}
    for (const sale of sales) {
      const locName = sale.location.name
      if (!salesByLocation[locName]) salesByLocation[locName] = []
      salesByLocation[locName].push(sale)
    }

    for (const [locName, locSales] of Object.entries(salesByLocation)) {
      console.log(`   📍 ${locName}:`)
      let locationTotal = 0
      let locationQty = 0

      for (const sale of locSales) {
        const saleTotal = Number(sale.finalTotal)
        const saleQty = sale.lines.reduce((sum, l) => sum + Number(l.quantity), 0)
        locationTotal += saleTotal
        locationQty += saleQty

        console.log(`      Invoice #${sale.invoiceNo} - ₱${saleTotal.toFixed(2)} (${saleQty} items)`)
        for (const line of sale.lines) {
          console.log(`         - ${line.productVariation.product.name}: ${Number(line.quantity)} x ₱${Number(line.unitPrice)}`)
        }
      }

      console.log(`      ${'─'.repeat(50)}`)
      console.log(`      TOTAL: ₱${locationTotal.toFixed(2)} (${locationQty} items sold)\n`)
    }

    // Get recent transfers
    console.log('\n🔄 RECENT STOCK TRANSFERS (Last 10):\n')
    const transfers = await prisma.stockTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        fromLocation: true,
        toLocation: true,
        lines: {
          include: {
            productVariation: {
              include: { product: true }
            }
          }
        }
      }
    })

    for (const transfer of transfers) {
      console.log(`   Transfer #${transfer.referenceNumber}`)
      console.log(`   ${transfer.fromLocation.name} → ${transfer.toLocation.name}`)
      console.log(`   Status: ${transfer.status}`)
      console.log(`   Date: ${transfer.createdAt.toLocaleDateString()}`)
      console.log(`   Items:`)
      for (const line of transfer.lines) {
        console.log(`      - ${line.productVariation.product.name}: ${Number(line.quantity)} units`)
      }
      console.log('')
    }

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('📊 SUMMARY:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`   Products in Report: ${products.length}`)
    console.log(`   Recent Purchases: ${purchases.length}`)
    console.log(`   Recent Sales: ${sales.length}`)
    console.log(`   Recent Transfers: ${transfers.length}`)
    console.log(`   Database: Supabase (Production) ⚠️`)
    console.log('═══════════════════════════════════════════════════════════════\n')

    console.log('✅ Report generated successfully!\n')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

generateReport()
