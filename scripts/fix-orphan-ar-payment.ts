/**
 * Fix Orphan AR Payment Records
 *
 * This script finds and fixes AR payment records that were created but didn't
 * update the sale's paidAmount field (due to the bug before the fix).
 *
 * Run this to fix Warren Dulunuwan's ₱590 payment that was recorded but
 * didn't reduce the invoice balance.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixOrphanARPayments() {
  try {
    console.log('🔍 Searching for orphan AR payment records...\n')

    // Find all payments where the sale's paidAmount doesn't match the sum of payments
    const sales = await prisma.sale.findMany({
      where: {
        customerId: { not: null },
        status: 'pending', // Credit sales
      },
      include: {
        payments: {
          where: {
            paymentMethod: { not: 'credit' }, // Exclude credit marker
          },
        },
        customer: true,
      },
    })

    console.log(`📊 Found ${sales.length} credit sales to check\n`)

    let fixedCount = 0

    for (const sale of sales) {
      // Calculate what the paidAmount SHOULD be based on payment records
      const actualPayments = sale.payments.reduce((sum, p) => {
        return sum + parseFloat(p.amount.toString())
      }, 0)

      const recordedPaidAmount = parseFloat(sale.paidAmount.toString())

      // If there's a mismatch, we found an orphan payment
      if (Math.abs(actualPayments - recordedPaidAmount) > 0.01) {
        console.log('❌ MISMATCH FOUND:')
        console.log(`   Invoice: ${sale.invoiceNumber}`)
        console.log(`   Customer: ${sale.customer?.name || 'Unknown'}`)
        console.log(`   Total Amount: ₱${parseFloat(sale.totalAmount.toString()).toFixed(2)}`)
        console.log(`   Recorded paidAmount: ₱${recordedPaidAmount.toFixed(2)}`)
        console.log(`   Actual payments sum: ₱${actualPayments.toFixed(2)}`)
        console.log(`   Difference: ₱${(actualPayments - recordedPaidAmount).toFixed(2)}`)
        console.log(`   Payment records: ${sale.payments.length}`)

        // Fix it
        console.log('   🔧 Fixing...')

        const totalAmount = parseFloat(sale.totalAmount.toString())
        const isFullyPaid = actualPayments >= totalAmount - 0.01

        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: actualPayments,
            status: isFullyPaid ? 'completed' : 'pending',
          },
        })

        console.log(`   ✅ Fixed! New paidAmount: ₱${actualPayments.toFixed(2)}, Status: ${isFullyPaid ? 'completed' : 'pending'}`)
        console.log('')
        fixedCount++
      }
    }

    if (fixedCount === 0) {
      console.log('✅ No orphan payments found. All sales are consistent!')
    } else {
      console.log(`\n✅ Fixed ${fixedCount} orphan payment(s)`)
      console.log('\n⚠️ Users should refresh their AR Payment modal to see updated balances')
    }
  } catch (error) {
    console.error('❌ Error fixing orphan payments:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixOrphanARPayments()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
