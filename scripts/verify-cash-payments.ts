/**
 * Script to verify cash payments for today
 * Shows every payment record to help reconcile manual count vs system
 *
 * Run with: npx tsx scripts/verify-cash-payments.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyCashPayments() {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

    console.log('📅 Checking payments for:', today.toISOString().split('T')[0])
    console.log('━'.repeat(100))

    // Get all sales today
    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        deletedAt: null,
      },
      include: {
        payments: true,
        customer: {
          select: { name: true }
        }
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    console.log(`\n✅ Found ${sales.length} sales today\n`)

    let totalCash = 0
    let totalCard = 0
    let totalNFC = 0
    let totalBankTransfer = 0
    let totalCheque = 0
    let totalCredit = 0

    sales.forEach((sale, index) => {
      const saleTotal = parseFloat(sale.totalAmount.toString())
      const paidAmount = parseFloat(sale.paidAmount?.toString() || '0')
      const balance = saleTotal - paidAmount

      console.log(`\n📋 Sale #${index + 1}: ${sale.invoiceNumber}`)
      console.log(`   Customer: ${sale.customer?.name || 'Walk-in'}`)
      console.log(`   Type: ${sale.saleType || 'regular'}`)
      console.log(`   Total: ₱${saleTotal.toFixed(2)}`)
      console.log(`   Status: ${sale.status}`)
      console.log(`   Payments:`)

      sale.payments.forEach((payment) => {
        const amount = parseFloat(payment.amount.toString())
        const method = payment.paymentMethod

        console.log(`      - ${method}: ₱${amount.toFixed(2)}`)

        // Tally by payment method
        const methodLower = method.toLowerCase()
        if (methodLower === 'cash') {
          totalCash += amount
        } else if (methodLower === 'card' || methodLower === 'credit_card' || methodLower === 'debit_card') {
          totalCard += amount
        } else if (methodLower === 'nfc' || methodLower === 'gcash' || methodLower === 'paymaya') {
          totalNFC += amount
        } else if (methodLower === 'bank_transfer') {
          totalBankTransfer += amount
        } else if (methodLower === 'cheque') {
          totalCheque += amount
        } else if (methodLower === 'credit') {
          totalCredit += amount
        }
      })

      console.log(`   Paid: ₱${paidAmount.toFixed(2)}`)
      console.log(`   Balance: ₱${balance.toFixed(2)}`)
    })

    console.log('\n' + '━'.repeat(100))
    console.log('\n💰 PAYMENT METHOD SUMMARY:')
    console.log(`   Cash:          ₱${totalCash.toFixed(2)}`)
    console.log(`   Card:          ₱${totalCard.toFixed(2)}`)
    console.log(`   NFC/Digital:   ₱${totalNFC.toFixed(2)}`)
    console.log(`   Bank Transfer: ₱${totalBankTransfer.toFixed(2)}`)
    console.log(`   Cheque:        ₱${totalCheque.toFixed(2)}`)
    if (totalCredit > 0) {
      console.log(`   Credit:        ₱${totalCredit.toFixed(2)} (unpaid)`)
    }
    console.log(`   ────────────────────────────`)
    console.log(`   TOTAL:         ₱${(totalCash + totalCard + totalNFC + totalBankTransfer + totalCheque).toFixed(2)}`)

    console.log('\n✅ This is what the system has recorded.')
    console.log('💡 If this doesn\'t match your manual count, check:')
    console.log('   1. Did any customer use split payment?')
    console.log('   2. Did you count any voided/cancelled sales?')
    console.log('   3. Did any customer say "cash" but pay by card/transfer?')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verifyCashPayments()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
