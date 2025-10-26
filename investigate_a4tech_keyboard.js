const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function investigateProduct() {
  console.log('='.repeat(80))
  console.log('INVESTIGATING: A4TECH FKS11 KB MINI GREY')
  console.log('='.repeat(80))

  try {
    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { contains: 'A4TECH FKS11', mode: 'insensitive' } },
          { sku: '4711421960458' }
        ]
      },
      include: {
        variations: {
          include: {
            variationLocationDetails: true
          }
        }
      }
    })

    // Get all locations
    const locations = await prisma.businessLocation.findMany()

    if (!product) {
      console.log('❌ Product not found!')
      return
    }

    console.log('\n📦 PRODUCT INFO:')
    console.log(`ID: ${product.id}`)
    console.log(`Name: ${product.name}`)
    console.log(`SKU: ${product.sku}`)

    const variation = product.variations[0]
    console.log(`\nVariation ID: ${variation.id}`)

    console.log('\n📍 CURRENT INVENTORY (variationLocationDetails):')
    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))
    for (const detail of variation.variationLocationDetails) {
      const locationName = locationMap.get(detail.locationId) || 'Unknown'
      console.log(`  ${locationName}: ${detail.qtyAvailable} units`)
    }

    // Get all stockTransaction records
    console.log('\n📋 STOCK TRANSACTIONS:')
    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        productVariationId: variation.id
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    console.log(`Total transactions: ${stockTransactions.length}\n`)

    let runningBalance = 0
    for (const tx of stockTransactions) {
      const qty = parseFloat(tx.quantity)
      runningBalance += qty
      const sign = qty > 0 ? '+' : ''
      const txLocationName = locationMap.get(tx.locationId) || 'Unknown'
      console.log(`${tx.createdAt.toISOString().split('T')[0]} | ${tx.type.padEnd(20)} | ${sign}${qty.toFixed(2).padStart(8)} | Balance: ${runningBalance.toFixed(2).padStart(8)} | Loc: ${txLocationName} | Ref: ${tx.referenceType || tx.refNo || 'N/A'}`)
    }

    // Get all productHistory records
    console.log('\n📜 PRODUCT HISTORY:')
    const productHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: variation.id
      },
      orderBy: {
        transactionDate: 'asc'
      }
    })

    console.log(`Total history records: ${productHistory.length}\n`)

    for (const history of productHistory) {
      const change = parseFloat(history.quantityChange)
      const balance = parseFloat(history.balanceQuantity)
      const sign = change > 0 ? '+' : ''
      const histLocationName = locationMap.get(history.locationId) || 'Unknown'
      console.log(`${history.transactionDate.toISOString().split('T')[0]} | ${history.transactionType.padEnd(20)} | ${sign}${change.toFixed(2).padStart(8)} | Balance: ${balance.toFixed(2).padStart(8)} | Loc: ${histLocationName} | Ref: ${history.referenceNumber || 'N/A'}`)
    }

    // Check for sales involving this product
    console.log('\n💰 SALES RECORDS:')
    const sales = await prisma.sale.findMany({
      where: {
        items: {
          some: {
            productVariationId: variation.id
          }
        }
      },
      include: {
        items: {
          where: {
            productVariationId: variation.id
          }
        }
      },
      orderBy: {
        saleDate: 'asc'
      }
    })

    console.log(`Total sales: ${sales.length}\n`)

    for (const sale of sales) {
      const saleLocationName = locationMap.get(sale.locationId) || 'Unknown'
      console.log(`Sale ID: ${sale.id}`)
      console.log(`Invoice: ${sale.invoiceNumber}`)
      console.log(`Date: ${sale.saleDate.toISOString().split('T')[0]}`)
      console.log(`Location: ${saleLocationName}`)
      console.log(`Status: ${sale.status}`)

      for (const item of sale.items) {
        console.log(`  - Quantity: ${item.quantity}`)
        console.log(`  - Unit Price: ${item.unitPrice}`)
        console.log(`  - Total: ${item.totalAmount}`)
      }
      console.log('')
    }

    // COMPARISON: Expected vs Actual
    console.log('\n🔍 DISCREPANCY ANALYSIS:')
    console.log('='.repeat(80))

    for (const detail of variation.variationLocationDetails) {
      const locationId = detail.locationId

      // Calculate expected from stockTransaction
      const locationStockTxs = stockTransactions.filter(tx => tx.locationId === locationId)
      const expectedFromStockTx = locationStockTxs.reduce((sum, tx) => sum + parseFloat(tx.quantity), 0)

      // Calculate expected from productHistory
      const locationHistory = productHistory.filter(h => h.locationId === locationId)
      const expectedFromHistory = locationHistory.reduce((sum, h) => sum + parseFloat(h.quantityChange), 0)

      const actual = parseFloat(detail.qtyAvailable)

      const locationName = locationMap.get(detail.locationId) || 'Unknown'
      console.log(`\n📍 Location: ${locationName}`)
      console.log(`   Expected (from stockTransaction): ${expectedFromStockTx.toFixed(2)}`)
      console.log(`   Expected (from productHistory):   ${expectedFromHistory.toFixed(2)}`)
      console.log(`   Actual (qtyAvailable):            ${actual.toFixed(2)}`)
      console.log(`   Discrepancy (stockTx):            ${(expectedFromStockTx - actual).toFixed(2)}`)
      console.log(`   Discrepancy (history):            ${(expectedFromHistory - actual).toFixed(2)}`)

      if (Math.abs(expectedFromStockTx - actual) > 0.01) {
        console.log(`   ❌ MISMATCH DETECTED!`)
      } else {
        console.log(`   ✅ Match!`)
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

investigateProduct()
