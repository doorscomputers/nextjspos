import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generateTestReport() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('📊 PLAYWRIGHT E2E TEST EXECUTION REPORT')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    // Get the 3 most recently updated products (these were likely used in tests)
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null
      },
      include: {
        variations: {
          where: { deletedAt: null },
          include: {
            variationLocationDetails: {
              include: {
                location: {
                  select: { name: true }
                }
              }
            }
          }
        },
        category: {
          select: { name: true }
        },
        unit: {
          select: { shortName: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 3
    })

    console.log('🎯 TEST PRODUCTS USED:\n')

    for (const product of products) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📦 Product: ${product.name}`)
      console.log(`   SKU: ${product.sku}`)
      console.log(`   Category: ${product.category?.name || 'N/A'}`)
      console.log(`   Unit: ${product.unit?.shortName || 'N/A'}`)

      for (const variation of product.variations) {
        console.log(`\n   📌 Variation: ${variation.name}`)
        console.log(`      Variation Code: ${variation.variationCode}`)
        console.log(`      Cost: ₱${Number(variation.defaultPurchasePrice).toFixed(2)}`)
        console.log(`      Price: ₱${Number(variation.defaultSellingPrice).toFixed(2)}`)
        console.log(`      Profit: ₱${(Number(variation.defaultSellingPrice) - Number(variation.defaultPurchasePrice)).toFixed(2)}`)

        if (variation.variationLocationDetails.length > 0) {
          console.log(`\n      📍 STOCK BY LOCATION:`)
          let totalStock = 0
          for (const loc of variation.variationLocationDetails) {
            const qty = Number(loc.qtyAvailable)
            totalStock += qty
            console.log(`         ${loc.location.name.padEnd(20)} : ${qty.toString().padStart(5)} units`)
          }
          console.log(`         ${'TOTAL'.padEnd(20)} : ${totalStock.toString().padStart(5)} units`)
        }
      }
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    }

    // Get recent purchase transactions
    console.log('\n\n💰 RECENT PURCHASE TRANSACTIONS:\n')
    const recentPurchases = await prisma.purchase.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        supplier: { select: { name: true } },
        location: { select: { name: true } },
        lines: {
          include: {
            productVariation: {
              include: {
                product: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    for (const purchase of recentPurchases) {
      console.log(`   PO #${purchase.referenceNo}`)
      console.log(`   Date: ${purchase.purchaseDate.toLocaleDateString()}`)
      console.log(`   Supplier: ${purchase.supplier?.name || 'N/A'}`)
      console.log(`   Location: ${purchase.location.name}`)
      console.log(`   Status: ${purchase.status}`)
      console.log(`   Total: ₱${Number(purchase.totalAmount).toFixed(2)}`)
      console.log(`   Items:`)
      for (const line of purchase.lines) {
        console.log(`      - ${line.productVariation.product.name} (${line.productVariation.name})`)
        console.log(`        Qty: ${Number(line.quantity)} x ₱${Number(line.unitCost)} = ₱${Number(line.lineTotal)}`)
      }
      console.log('')
    }

    // Get recent sales transactions
    console.log('\n\n🛒 RECENT SALES TRANSACTIONS:\n')
    const recentSales = await prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        location: { select: { name: true } },
        lines: {
          include: {
            productVariation: {
              include: {
                product: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    const salesByLocation: Record<string, any[]> = {}

    for (const sale of recentSales) {
      const locName = sale.location.name
      if (!salesByLocation[locName]) {
        salesByLocation[locName] = []
      }
      salesByLocation[locName].push(sale)
    }

    for (const [location, sales] of Object.entries(salesByLocation)) {
      console.log(`\n   📍 ${location}:`)
      let locationTotal = 0
      let locationQty = 0

      for (const sale of sales) {
        const saleTotal = Number(sale.finalTotal)
        const saleQty = sale.lines.reduce((sum, line) => sum + Number(line.quantity), 0)
        locationTotal += saleTotal
        locationQty += saleQty

        console.log(`      Invoice #${sale.invoiceNo} - ₱${saleTotal.toFixed(2)} (${saleQty} items)`)
        for (const line of sale.lines) {
          console.log(`         - ${line.productVariation.product.name}: ${Number(line.quantity)} x ₱${Number(line.unitPrice)}`)
        }
      }

      console.log(`      ─────────────────────────────────────`)
      console.log(`      Total: ₱${locationTotal.toFixed(2)} (${locationQty} items sold)`)
    }

    // Get stock transfers
    console.log('\n\n🔄 RECENT STOCK TRANSFERS:\n')
    const recentTransfers = await prisma.stockTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        lines: {
          include: {
            productVariation: {
              include: {
                product: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    for (const transfer of recentTransfers) {
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

    // Summary
    console.log('\n\n═══════════════════════════════════════════════════════════════')
    console.log('📊 SUMMARY:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`   Products Tested: ${products.length}`)
    console.log(`   Recent Purchases: ${recentPurchases.length}`)
    console.log(`   Recent Sales: ${recentSales.length}`)
    console.log(`   Recent Transfers: ${recentTransfers.length}`)
    console.log('═══════════════════════════════════════════════════════════════\n')

    // Create text file report
    const reportLines: string[] = []
    reportLines.push('═══════════════════════════════════════════════════════════════')
    reportLines.push('📊 PLAYWRIGHT E2E TEST EXECUTION REPORT')
    reportLines.push(`Generated: ${new Date().toLocaleString()}`)
    reportLines.push('═══════════════════════════════════════════════════════════════\n')

    reportLines.push('🎯 TEST PRODUCTS USED:\n')

    for (const product of products) {
      reportLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      reportLines.push(`📦 Product: ${product.name}`)
      reportLines.push(`   SKU: ${product.sku}`)
      reportLines.push(`   Category: ${product.category?.name || 'N/A'}`)

      for (const variation of product.variations) {
        reportLines.push(`\n   📌 Variation: ${variation.name}`)
        reportLines.push(`      Cost: ₱${Number(variation.defaultPurchasePrice).toFixed(2)}`)
        reportLines.push(`      Price: ₱${Number(variation.defaultSellingPrice).toFixed(2)}`)

        if (variation.variationLocationDetails.length > 0) {
          reportLines.push(`\n      📍 CURRENT STOCK BY LOCATION:`)
          let totalStock = 0
          for (const loc of variation.variationLocationDetails) {
            const qty = Number(loc.qtyAvailable)
            totalStock += qty
            reportLines.push(`         ${loc.location.name.padEnd(20)} : ${qty.toString().padStart(5)} units`)
          }
          reportLines.push(`         ${'TOTAL'.padEnd(20)} : ${totalStock.toString().padStart(5)} units`)
        }
      }
      reportLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    }

    // Write to file
    const fs = require('fs')
    fs.writeFileSync('TEST-EXECUTION-REPORT.txt', reportLines.join('\n'))
    console.log('✅ Report saved to: TEST-EXECUTION-REPORT.txt\n')

  } catch (error: any) {
    console.error('❌ Error generating report:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

generateTestReport()
