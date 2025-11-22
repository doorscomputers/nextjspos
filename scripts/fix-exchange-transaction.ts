/**
 * Script to fix existing exchange transactions with incorrect totals
 *
 * This script updates exchange transactions to use the correct accounting:
 * - subtotal: Value of new items issued
 * - discountAmount: Value of returned items (credit applied)
 * - totalAmount: Price difference only
 * - Balance becomes 0 when paid
 *
 * Run with: npx tsx scripts/fix-exchange-transaction.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixExchangeTransactions() {
  try {
    console.log('🔍 Finding exchange transactions with incorrect totals...')

    // Find all exchange transactions
    const exchanges = await prisma.sale.findMany({
      where: {
        saleType: 'exchange',
        deletedAt: null,
      },
      include: {
        payments: true,
      },
    })

    console.log(`✅ Found ${exchanges.length} exchange transactions`)

    let fixedCount = 0

    for (const exchange of exchanges) {
      const subtotal = parseFloat(exchange.subtotal.toString())
      const totalAmount = parseFloat(exchange.totalAmount.toString())
      const paidAmount = parseFloat(exchange.paidAmount?.toString() || '0')
      const discountAmount = parseFloat(exchange.discountAmount.toString())

      // Check if this exchange has incorrect totals
      // Old format: subtotal = exchangeTotal, discount = 0, total = exchangeTotal
      // New format: subtotal = exchangeTotal, discount = returnTotal, total = priceDifference
      const hasIncorrectTotals = discountAmount === 0 && totalAmount === subtotal

      if (hasIncorrectTotals) {
        console.log(`\n🔧 Fixing exchange ${exchange.invoiceNumber}:`)
        console.log(`   Old: Subtotal=${subtotal}, Discount=0, Total=${totalAmount}, Paid=${paidAmount}`)

        // Calculate the correct values
        // For exchanges: priceDifference = exchangeTotal - returnTotal
        // We know: exchangeTotal = subtotal
        // We know: paidAmount = priceDifference (what customer actually paid)
        // Therefore: returnTotal = exchangeTotal - paidAmount

        const exchangeTotal = subtotal
        const priceDifference = paidAmount // Customer paid the price difference
        const returnTotal = exchangeTotal - priceDifference

        const newDiscountAmount = returnTotal // Credit from returned items
        const newTotalAmount = Math.max(priceDifference, 0) // Only positive difference

        console.log(`   New: Subtotal=${exchangeTotal}, Discount=${newDiscountAmount}, Total=${newTotalAmount}, Paid=${paidAmount}`)
        console.log(`   Balance: ${newTotalAmount - paidAmount}`)

        // Update the exchange transaction
        await prisma.sale.update({
          where: { id: exchange.id },
          data: {
            discountAmount: newDiscountAmount,
            totalAmount: newTotalAmount,
          },
        })

        fixedCount++
        console.log(`   ✅ Fixed exchange ${exchange.invoiceNumber}`)
      } else {
        console.log(`   ⏭️  Exchange ${exchange.invoiceNumber} already has correct totals`)
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} exchange transactions`)
    console.log('🎉 Script completed successfully!')
  } catch (error) {
    console.error('❌ Error fixing exchange transactions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
fixExchangeTransactions()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
