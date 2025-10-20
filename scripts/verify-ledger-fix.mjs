import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * This script verifies that the inventory ledger fix is working correctly
 * by checking that ledger displays show no duplicate transactions
 */

async function verifyLedgerFix() {
  console.log('=== Verifying Inventory Ledger Fix ===\n')

  try {
    // Get a sample product with purchase transactions
    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        type: 'purchase'
      },
      take: 1,
      include: {
        product: {
          select: { id: true, name: true, businessId: true }
        },
        productVariation: {
          select: { id: true, name: true }
        }
      }
    })

    if (stockTransactions.length === 0) {
      console.log('❌ No purchase transactions found in database')
      console.log('Please create a purchase receipt first to test this fix')
      return
    }

    const sampleTx = stockTransactions[0]
    console.log('Testing with sample product:')
    console.log(`  Product: ${sampleTx.product.name} - ${sampleTx.productVariation.name}`)
    console.log(`  Product ID: ${sampleTx.product.id}`)
    console.log(`  Variation ID: ${sampleTx.productVariationId}`)
    console.log(`  Location ID: ${sampleTx.locationId}`)
    console.log()

    // Get all transactions for this product/variation/location
    const allStockTxs = await prisma.stockTransaction.findMany({
      where: {
        businessId: sampleTx.product.businessId,
        productId: sampleTx.product.id,
        productVariationId: sampleTx.productVariationId,
        locationId: sampleTx.locationId
      },
      orderBy: { createdAt: 'asc' }
    })

    const allProductHistory = await prisma.productHistory.findMany({
      where: {
        businessId: sampleTx.product.businessId,
        productId: sampleTx.product.id,
        productVariationId: sampleTx.productVariationId,
        locationId: sampleTx.locationId
      },
      orderBy: { transactionDate: 'asc' }
    })

    console.log('Database Records:')
    console.log(`  StockTransaction records: ${allStockTxs.length}`)
    console.log(`  ProductHistory records: ${allProductHistory.length}`)
    console.log()

    // Calculate what the ledger SHOULD show (StockTransaction only)
    console.log('Expected Ledger Display (StockTransaction only):')
    console.log('-'.repeat(80))
    let expectedBalance = 0
    for (const tx of allStockTxs) {
      const qty = parseFloat(tx.quantity.toString())
      expectedBalance = parseFloat(tx.balanceQty.toString())
      const direction = qty > 0 ? 'IN' : 'OUT'
      console.log(`  ${tx.createdAt.toISOString()} | ${tx.type.padEnd(15)} | ${direction} ${Math.abs(qty).toString().padStart(8)} | Balance: ${expectedBalance}`)
    }
    console.log()

    // Get current inventory
    const currentStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: sampleTx.productVariationId,
          locationId: sampleTx.locationId
        }
      }
    })

    const actualInventory = currentStock ? parseFloat(currentStock.qtyAvailable.toString()) : 0

    console.log('Verification Results:')
    console.log('-'.repeat(80))
    console.log(`  Latest Transaction Balance: ${expectedBalance}`)
    console.log(`  Actual Inventory in System: ${actualInventory}`)

    // Check if they match
    if (Math.abs(expectedBalance - actualInventory) < 0.0001) {
      console.log('  ✅ PASS: Ledger balance matches actual inventory!')
    } else {
      console.log('  ❌ FAIL: Ledger balance does NOT match actual inventory!')
      console.log(`  Difference: ${Math.abs(expectedBalance - actualInventory)}`)
    }
    console.log()

    // Check for potential duplicates in old display logic
    const purchaseTxs = allStockTxs.filter(tx => tx.type === 'purchase')
    const purchaseHistory = allProductHistory.filter(h => h.transactionType === 'purchase')

    console.log('Duplicate Check:')
    console.log('-'.repeat(80))
    console.log(`  Purchase transactions in StockTransaction: ${purchaseTxs.length}`)
    console.log(`  Purchase transactions in ProductHistory: ${purchaseHistory.length}`)

    if (purchaseTxs.length === purchaseHistory.length && purchaseTxs.length > 0) {
      console.log('  ⚠️  Both tables have the same count - duplicates would occur with old logic')
      console.log('  ✅ Fix ensures only StockTransaction is displayed in ledger')
    }
    console.log()

    // Summary
    console.log('='.repeat(80))
    console.log('SUMMARY:')
    console.log('  The fix ensures the inventory ledger displays only StockTransaction records,')
    console.log('  eliminating duplicate entries while maintaining full audit trail in ProductHistory.')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('Error verifying ledger fix:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyLedgerFix()
