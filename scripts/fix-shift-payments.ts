/**
 * Fix Shift Running Totals - Recalculate Payment Breakdown
 *
 * This script recalculates shift running totals to fix payment method mappings
 * Specifically handles maya→paymaya and cheque→check normalization
 *
 * Usage: npx tsx scripts/fix-shift-payments.ts <shiftId>
 * Example: npx tsx scripts/fix-shift-payments.ts 123
 */

import { PrismaClient } from '@prisma/client'
import { calculateRunningTotalsFromSales } from '../src/lib/shift-running-totals'

const prisma = new PrismaClient()

async function fixShiftPayments(shiftId: number) {
  console.log(`\n🔧 Fixing shift payment breakdown for shift ID: ${shiftId}\n`)

  // Fetch shift
  const shift = await prisma.cashierShift.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      shiftNumber: true,
      status: true,
      openedAt: true,
      closedAt: true,
    }
  })

  if (!shift) {
    console.error('❌ Shift not found!')
    process.exit(1)
  }

  console.log(`📋 Shift: ${shift.shiftNumber}`)
  console.log(`📊 Status: ${shift.status}`)
  console.log(`📅 Opened: ${shift.openedAt}`)
  if (shift.closedAt) {
    console.log(`🔒 Closed: ${shift.closedAt}`)
  }

  // Calculate corrected running totals
  console.log('\n🔄 Recalculating running totals with payment normalization...\n')
  const correctedTotals = await calculateRunningTotalsFromSales(shiftId)

  // Update shift with corrected totals
  await prisma.cashierShift.update({
    where: { id: shiftId },
    data: correctedTotals
  })

  console.log('✅ Shift running totals updated successfully!')
  console.log('\n📊 Updated Payment Breakdown:')
  console.log(`   - Cash Sales: ₱${(correctedTotals.runningCashSales as number).toFixed(2)}`)
  console.log(`   - GCash Sales: ₱${(correctedTotals.runningGcashSales as number).toFixed(2)}`)
  console.log(`   - PayMaya Sales: ₱${(correctedTotals.runningPaymayaSales as number).toFixed(2)}`)
  console.log(`   - Check Sales: ₱${(correctedTotals.runningCheckSales as number).toFixed(2)}`)
  console.log(`   - Card Sales: ₱${(correctedTotals.runningCardSales as number).toFixed(2)}`)
  console.log(`   - Bank Transfer: ₱${(correctedTotals.runningBankSales as number).toFixed(2)}`)
  console.log(`   - Credit Sales: ₱${(correctedTotals.runningCreditSales as number).toFixed(2)}`)
  console.log(`   - Other Payments: ₱${(correctedTotals.runningOtherPayments as number).toFixed(2)}`)

  console.log('\n💰 Sales Totals:')
  console.log(`   - Gross Sales: ₱${(correctedTotals.runningGrossSales as number).toFixed(2)}`)
  console.log(`   - Net Sales: ₱${(correctedTotals.runningNetSales as number).toFixed(2)}`)
  console.log(`   - Transactions: ${correctedTotals.runningTransactions}`)

  console.log('\n✨ Done! You can now regenerate X/Z readings with corrected payment breakdown.\n')
}

// Get shift ID from command line argument
const shiftId = parseInt(process.argv[2])

if (!shiftId || isNaN(shiftId)) {
  console.error('❌ Please provide a valid shift ID')
  console.error('Usage: npx tsx scripts/fix-shift-payments.ts <shiftId>')
  console.error('Example: npx tsx scripts/fix-shift-payments.ts 123')
  process.exit(1)
}

// Run the fix
fixShiftPayments(shiftId)
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
