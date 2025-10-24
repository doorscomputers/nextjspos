/**
 * Diagnostic script to analyze shift cash calculations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find the most recent shift
  console.log('\n🔍 Finding most recent shift...\n')

  const shift = await prisma.cashierShift.findFirst({
    orderBy: { openedAt: 'desc' },
    include: {
      sales: {
        where: { status: 'completed' },
        include: {
          payments: true,
        },
      },
      cashInOutRecords: true,
    },
  })

  if (!shift) {
    console.log('❌ Shift not found')
    return
  }

  console.log('📊 SHIFT INFORMATION')
  console.log('='.repeat(60))
  console.log(`Shift Number: ${shift.shiftNumber}`)
  console.log(`Beginning Cash: ₱${shift.beginningCash}`)
  console.log(`Status: ${shift.status}`)
  console.log('')

  console.log('💰 SALES BREAKDOWN')
  console.log('='.repeat(60))

  let totalCashFromSales = 0
  let totalDigitalFromSales = 0
  let totalDiscounts = 0

  shift.sales.forEach((sale, index) => {
    console.log(`\nSale #${index + 1} (ID: ${sale.id})`)
    console.log(`  Invoice: ${sale.invoiceNumber}`)
    console.log(`  Subtotal: ₱${sale.subtotal}`)
    console.log(`  Discount: ₱${sale.discountAmount} ${sale.discountType ? `(${sale.discountType})` : ''}`)
    console.log(`  Total Amount: ₱${sale.totalAmount}`)

    totalDiscounts += parseFloat(sale.discountAmount.toString())

    console.log(`  Payments:`)
    let salePaymentTotal = 0
    sale.payments.forEach(payment => {
      console.log(`    - ${payment.paymentMethod}: ₱${payment.amount}`)
      salePaymentTotal += parseFloat(payment.amount.toString())

      if (payment.paymentMethod === 'cash') {
        totalCashFromSales += parseFloat(payment.amount.toString())
      } else {
        totalDigitalFromSales += parseFloat(payment.amount.toString())
      }
    })

    console.log(`  Total Payments: ₱${salePaymentTotal.toFixed(2)}`)

    const saleTotal = parseFloat(sale.totalAmount.toString())
    if (Math.abs(salePaymentTotal - saleTotal) > 0.01) {
      console.log(`  ⚠️  MISMATCH: Payments (₱${salePaymentTotal.toFixed(2)}) ≠ Sale Total (₱${saleTotal.toFixed(2)})`)
      console.log(`  Difference: ₱${(salePaymentTotal - saleTotal).toFixed(2)} (likely change given)`)
    }
  })

  console.log('\n' + '='.repeat(60))
  console.log('📈 TOTALS FROM SALES')
  console.log('='.repeat(60))
  console.log(`Total Cash Payments: ₱${totalCashFromSales.toFixed(2)}`)
  console.log(`Total Digital Payments: ₱${totalDigitalFromSales.toFixed(2)}`)
  console.log(`Total Discounts Given: ₱${totalDiscounts.toFixed(2)}`)

  console.log('\n' + '='.repeat(60))
  console.log('💵 CASH IN/OUT RECORDS')
  console.log('='.repeat(60))

  let totalCashIn = 0
  let totalCashOut = 0

  if (shift.cashInOutRecords.length === 0) {
    console.log('No cash in/out records')
  } else {
    shift.cashInOutRecords.forEach(record => {
      console.log(`${record.type}: ₱${record.amount} - ${record.reason || 'No reason'}`)
      if (record.type === 'cash_in') {
        totalCashIn += parseFloat(record.amount.toString())
      } else {
        totalCashOut += parseFloat(record.amount.toString())
      }
    })
  }

  console.log(`\nTotal Cash In: ₱${totalCashIn.toFixed(2)}`)
  console.log(`Total Cash Out: ₱${totalCashOut.toFixed(2)}`)

  console.log('\n' + '='.repeat(60))
  console.log('🧮 EXPECTED CASH CALCULATION')
  console.log('='.repeat(60))

  const beginningCash = parseFloat(shift.beginningCash.toString())
  const expectedCash = beginningCash + totalCashFromSales + totalCashIn - totalCashOut

  console.log(`Beginning Cash:           ₱${beginningCash.toFixed(2)}`)
  console.log(`+ Cash from Sales:        ₱${totalCashFromSales.toFixed(2)}`)
  console.log(`+ Cash In:                ₱${totalCashIn.toFixed(2)}`)
  console.log(`- Cash Out:               ₱${totalCashOut.toFixed(2)}`)
  console.log(`${'='.repeat(40)}`)
  console.log(`Expected Cash in Drawer:  ₱${expectedCash.toFixed(2)}`)

  if (shift.systemCash) {
    console.log(`\nSystem Recorded:          ₱${parseFloat(shift.systemCash.toString()).toFixed(2)}`)
    const diff = parseFloat(shift.systemCash.toString()) - expectedCash
    if (Math.abs(diff) > 0.01) {
      console.log(`⚠️  DISCREPANCY: ₱${diff.toFixed(2)}`)
    }
  }

  if (shift.endingCash) {
    console.log(`\nActual Counted:           ₱${parseFloat(shift.endingCash.toString()).toFixed(2)}`)
    const variance = parseFloat(shift.endingCash.toString()) - expectedCash
    console.log(`Variance:                 ₱${variance.toFixed(2)} ${variance > 0 ? '(OVER)' : variance < 0 ? '(SHORT)' : '(BALANCED)'}`)
  }

  console.log('\n✅ Diagnosis complete!\n')
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
