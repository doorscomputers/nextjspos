import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function auditInventoryTables() {
  try {
    console.log('='.repeat(80))
    console.log('INVENTORY ARCHITECTURE AUDIT')
    console.log('='.repeat(80))
    console.log()

    // Test product details
    const productId = 306
    const variationId = 306
    const locationId = 2

    // 1. Check StockTransaction table
    console.log('1. STOCK TRANSACTION TABLE')
    console.log('-'.repeat(80))

    const stockTransactions = await prisma.stockTransaction.findMany({
      where: { productVariationId: variationId },
      orderBy: { createdAt: 'asc' },
      take: 100
    })

    console.log(`Total StockTransaction records found: ${stockTransactions.length}`)

    if (stockTransactions.length > 0) {
      console.log('\nSample records:')
      stockTransactions.slice(0, 10).forEach((tx, idx) => {
        console.log(`${idx + 1}. ${tx.type} | Qty: ${tx.quantity} | Balance: ${tx.balanceQty} | Date: ${tx.createdAt}`)
      })

      console.log('\nTransaction type breakdown:')
      const typeBreakdown = {}
      stockTransactions.forEach(tx => {
        typeBreakdown[tx.type] = (typeBreakdown[tx.type] || 0) + 1
      })
      console.log(JSON.stringify(typeBreakdown, null, 2))
    } else {
      console.log('NO RECORDS FOUND in StockTransaction table!')
    }

    console.log()
    console.log('2. PRODUCT HISTORY TABLE')
    console.log('-'.repeat(80))

    const productHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: variationId,
        locationId: locationId
      },
      orderBy: { transactionDate: 'asc' },
      take: 100
    })

    console.log(`Total ProductHistory records found: ${productHistory.length}`)

    if (productHistory.length > 0) {
      console.log('\nAll records:')
      productHistory.forEach((hist, idx) => {
        console.log(`${idx + 1}. ${hist.transactionType} | Qty: ${hist.quantityChange} | Ref: ${hist.referenceNumber} | Date: ${hist.transactionDate}`)
      })

      console.log('\nTransaction type breakdown:')
      const typeBreakdown = {}
      productHistory.forEach(hist => {
        typeBreakdown[hist.transactionType] = (typeBreakdown[hist.transactionType] || 0) + 1
      })
      console.log(JSON.stringify(typeBreakdown, null, 2))
    }

    console.log()
    console.log('3. PURCHASE RECEIPTS')
    console.log('-'.repeat(80))

    const purchaseReceipts = await prisma.purchaseReceipt.findMany({
      where: {
        locationId: locationId,
        status: 'approved',
        items: {
          some: {
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: { productVariationId: variationId }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Total Purchase Receipts: ${purchaseReceipts.length}`)
    purchaseReceipts.forEach((receipt, idx) => {
      const item = receipt.items[0]
      console.log(`${idx + 1}. ${receipt.receiptNumber} | Qty: ${item?.quantityReceived} | Date: ${receipt.approvedAt || receipt.createdAt}`)
    })

    console.log()
    console.log('4. SALES')
    console.log('-'.repeat(80))

    const sales = await prisma.sale.findMany({
      where: {
        locationId: locationId,
        status: 'completed',
        items: {
          some: {
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: { productVariationId: variationId }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Total Sales: ${sales.length}`)
    sales.forEach((sale, idx) => {
      const item = sale.items[0]
      console.log(`${idx + 1}. ${sale.invoiceNumber} | Qty: ${item?.quantity} | Date: ${sale.createdAt}`)
    })

    console.log()
    console.log('5. STOCK TRANSFERS (OUT)')
    console.log('-'.repeat(80))

    const transfersOut = await prisma.stockTransfer.findMany({
      where: {
        fromLocationId: locationId,
        status: 'completed',
        items: {
          some: {
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: { productVariationId: variationId }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Total Transfers Out: ${transfersOut.length}`)

    console.log()
    console.log('6. STOCK TRANSFERS (IN)')
    console.log('-'.repeat(80))

    const transfersIn = await prisma.stockTransfer.findMany({
      where: {
        toLocationId: locationId,
        status: 'completed',
        items: {
          some: {
            productVariationId: variationId
          }
        }
      },
      include: {
        items: {
          where: { productVariationId: variationId }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Total Transfers In: ${transfersIn.length}`)

    console.log()
    console.log('7. INVENTORY CORRECTIONS')
    console.log('-'.repeat(80))

    const corrections = await prisma.inventoryCorrection.findMany({
      where: {
        locationId: locationId,
        productVariationId: variationId,
        status: 'approved'
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log(`Total Corrections: ${corrections.length}`)
    corrections.forEach((corr, idx) => {
      console.log(`${idx + 1}. System: ${corr.systemCount} | Physical: ${corr.physicalCount} | Diff: ${corr.difference} | Date: ${corr.approvedAt || corr.createdAt}`)
    })

    console.log()
    console.log('8. CURRENT INVENTORY')
    console.log('-'.repeat(80))

    const currentInventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: variationId,
        locationId: locationId
      }
    })

    console.log(`Current System Inventory: ${currentInventory?.qtyAvailable || 0}`)

    console.log()
    console.log('='.repeat(80))
    console.log('CRITICAL ANALYSIS')
    console.log('='.repeat(80))

    console.log('\nStockTransaction Coverage:')
    if (stockTransactions.length === 0) {
      console.log('❌ StockTransaction table is EMPTY - Not being used!')
      console.log('   This table is NOT a reliable source of truth.')
    } else {
      console.log(`✓ StockTransaction has ${stockTransactions.length} records`)
      console.log('   Checking if it covers all transaction types...')

      const hasOpening = stockTransactions.some(tx => tx.type === 'opening_stock')
      const hasPurchase = stockTransactions.some(tx => tx.type && tx.type.includes('purchase'))
      const hasSale = stockTransactions.some(tx => tx.type && tx.type.includes('sale'))
      const hasTransfer = stockTransactions.some(tx => tx.type && tx.type.includes('transfer'))
      const hasCorrection = stockTransactions.some(tx => tx.type && tx.type.includes('correction'))

      console.log(`   - Opening Stock: ${hasOpening ? '✓' : '❌'}`)
      console.log(`   - Purchases: ${hasPurchase ? '✓' : '❌'}`)
      console.log(`   - Sales: ${hasSale ? '✓' : '❌'}`)
      console.log(`   - Transfers: ${hasTransfer ? '✓' : '❌'}`)
      console.log(`   - Corrections: ${hasCorrection ? '✓' : '❌'}`)
    }

    console.log('\nProductHistory Coverage:')
    if (productHistory.length === 0) {
      console.log('❌ ProductHistory table is EMPTY for this product!')
    } else {
      console.log(`✓ ProductHistory has ${productHistory.length} records`)
    }

    console.log('\nDedicated Transaction Tables:')
    console.log(`   - Purchase Receipts: ${purchaseReceipts.length} records`)
    console.log(`   - Sales: ${sales.length} records`)
    console.log(`   - Transfers Out: ${transfersOut.length} records`)
    console.log(`   - Transfers In: ${transfersIn.length} records`)
    console.log(`   - Corrections: ${corrections.length} records`)

    console.log()
    console.log('RECOMMENDATION:')
    console.log('-'.repeat(80))

    if (stockTransactions.length === 0) {
      console.log('⚠️  StockTransaction table is NOT populated!')
      console.log('⚠️  System is using MULTIPLE SOURCES (ProductHistory + dedicated tables)')
      console.log('⚠️  This creates DUPLICATION RISK as seen in the inventory ledger')
      console.log()
      console.log('OPTIONS:')
      console.log('A) Implement StockTransaction as single source of truth (requires refactoring)')
      console.log('B) Use ONLY dedicated transaction tables (PurchaseReceipt, Sale, etc.)')
      console.log('C) Remove inventory ledger report entirely')
    } else {
      console.log('✓ StockTransaction table exists and has data')
      console.log('  Need to verify if it has ALL transaction types...')
    }

  } catch (error) {
    console.error('Error during audit:', error)
  } finally {
    await prisma.$disconnect()
  }
}

auditInventoryTables()
