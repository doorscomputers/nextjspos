import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function compareHistoryVsTransactions() {
  try {
    const productId = 306
    const variationId = 306
    const locationId = 2

    const allHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: variationId,
        locationId: locationId
      },
      orderBy: { transactionDate: 'asc' }
    })

    const allStockTx = await prisma.stockTransaction.findMany({
      where: {
        productVariationId: variationId,
        locationId: locationId
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log('='.repeat(80))
    console.log('COMPARISON: ProductHistory vs StockTransaction')
    console.log('='.repeat(80))
    console.log('ProductHistory records:', allHistory.length)
    console.log('StockTransaction records:', allStockTx.length)

    console.log('\nProductHistory:')
    allHistory.forEach(h => {
      console.log(`  - ${h.transactionType} | Qty: ${h.quantityChange} | Date: ${h.transactionDate}`)
    })

    console.log('\nStockTransaction:')
    allStockTx.forEach(t => {
      console.log(`  - ${t.type} | Qty: ${t.quantity} | Balance: ${t.balanceQty} | Date: ${t.createdAt}`)
    })

    console.log()
    console.log('='.repeat(80))
    console.log('ANALYSIS')
    console.log('='.repeat(80))

    // Check which transaction types are in ProductHistory but not in StockTransaction
    const historyTypes = new Set(allHistory.map(h => h.transactionType))
    const stockTxTypes = new Set(allStockTx.map(t => t.type))

    console.log('\nTransaction types in ProductHistory:', Array.from(historyTypes))
    console.log('Transaction types in StockTransaction:', Array.from(stockTxTypes))

    const onlyInHistory = Array.from(historyTypes).filter(type => !stockTxTypes.has(type))
    const onlyInStockTx = Array.from(stockTxTypes).filter(type => !historyTypes.has(type))

    console.log('\nTypes ONLY in ProductHistory:', onlyInHistory.length > 0 ? onlyInHistory : 'None')
    console.log('Types ONLY in StockTransaction:', onlyInStockTx.length > 0 ? onlyInStockTx : 'None')

    // THIS IS THE SMOKING GUN!
    if (onlyInHistory.length > 0) {
      console.log()
      console.log('WARNING: ProductHistory has transaction types that are NOT in StockTransaction!')
      console.log('This is why the inventory ledger is showing duplicates.')
      console.log()
      console.log('Details of missing transactions:')
      onlyInHistory.forEach(type => {
        const records = allHistory.filter(h => h.transactionType === type)
        console.log(`  - ${type}: ${records.length} record(s)`)
        records.forEach(r => {
          console.log(`    * Qty: ${r.quantityChange} | Date: ${r.transactionDate} | Ref: ${r.referenceNumber}`)
        })
      })
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

compareHistoryVsTransactions()
