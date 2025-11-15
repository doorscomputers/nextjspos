/**
 * Migration Script: Fix Missing paidAmount on Sales
 *
 * PROBLEM:
 * Sales created before the paidAmount fix have null paidAmount values.
 * This causes the Sales Today report to incorrectly show them as "Credit / Charge"
 * even when they are fully paid with cash/card/cheque.
 *
 * SOLUTION:
 * Calculate paidAmount for each sale by summing up actual payments
 * (excluding 'credit' placeholder payments).
 *
 * HOW TO RUN:
 * npx tsx scripts/fix-sales-paidAmount.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixSalesPaidAmount() {
  console.log('🔧 Starting Sales paidAmount migration...')
  console.log('================================================\n')

  try {
    // Find all sales with null or incorrect paidAmount
    const sales = await prisma.sale.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        payments: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    console.log(`📊 Found ${sales.length} sales to process\n`)

    let fixed = 0
    let skipped = 0
    let errors = 0

    for (const sale of sales) {
      try {
        // Calculate actual paid amount (excluding 'credit' placeholder)
        const actualPaid = sale.payments
          .filter((p) => p.paymentMethod.toLowerCase() !== 'credit')
          .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)

        const currentPaidAmount = sale.paidAmount
          ? parseFloat(sale.paidAmount.toString())
          : 0

        // Only update if different
        if (Math.abs(actualPaid - currentPaidAmount) > 0.01) {
          await prisma.sale.update({
            where: { id: sale.id },
            data: {
              paidAmount: actualPaid,
            },
          })

          console.log(
            `✅ Fixed #${sale.id} (${sale.invoiceNumber}): ` +
              `${currentPaidAmount.toFixed(2)} → ${actualPaid.toFixed(2)}`
          )
          fixed++
        } else {
          skipped++
        }
      } catch (error) {
        console.error(`❌ Error fixing sale #${sale.id}:`, error)
        errors++
      }
    }

    console.log('\n================================================')
    console.log('✅ Migration completed!')
    console.log(`   Fixed: ${fixed}`)
    console.log(`   Skipped (already correct): ${skipped}`)
    console.log(`   Errors: ${errors}`)
    console.log('================================================\n')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
fixSalesPaidAmount()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
