/**
 * Check X/Z Reading data for Jan 8, 2026 at Main Store
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
})

const LOCATION_ID = 2 // Main Store

async function checkXZReading() {
  console.log('=' .repeat(80))
  console.log('X/Z READING ANALYSIS FOR JAN 8, 2026 - MAIN STORE')
  console.log('=' .repeat(80))

  // Find shifts for Jan 8, 2026
  const startDate = new Date('2026-01-07T16:00:00.000Z')
  const endDate = new Date('2026-01-08T15:59:59.999Z')

  const shifts = await prisma.cashierShift.findMany({
    where: {
      locationId: LOCATION_ID,
      openedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      cashInOutRecords: true
    },
    orderBy: { openedAt: 'asc' }
  })

  console.log(`\n Found ${shifts.length} shift(s) for Jan 8, 2026 at Main Store\n`)

  for (const shift of shifts) {
    console.log('=' .repeat(60))
    console.log(`SHIFT #${shift.shiftNumber} (ID: ${shift.id})`)
    console.log('=' .repeat(60))
    console.log(`Cashier ID: ${shift.cashierId}`)
    console.log(`Status: ${shift.status}`)
    console.log(`Opened: ${shift.openedAt}`)
    console.log(`Closed: ${shift.closedAt || 'Not closed'}`)

    // Running totals (from the shift record)
    console.log('\n--- Running Totals (stored in shift) ---')
    console.log(`  Gross Sales: ${shift.runningGrossSales}`)
    console.log(`  Net Sales: ${shift.runningNetSales}`)
    console.log(`  Cash Sales: ${shift.runningCashSales}`)
    console.log(`  Card Sales: ${shift.runningCardSales}`)
    console.log(`  GCash Sales: ${shift.runningGcashSales}`)
    console.log(`  PayMaya Sales: ${shift.runningPaymayaSales}`)
    console.log(`  Bank Sales: ${shift.runningBankSales}`)
    console.log(`  Check Sales: ${shift.runningCheckSales}`)
    console.log(`  Credit Sales: ${shift.runningCreditSales}`)

    console.log('\n--- AR Payments Running Totals ---')
    console.log(`  AR Cash: ${shift.runningArPaymentsCash}`)
    console.log(`  AR Check: ${shift.runningArPaymentsCheck}`)
    console.log(`  AR GCash: ${shift.runningArPaymentsGcash}`)
    console.log(`  AR PayMaya: ${shift.runningArPaymentsPaymaya}`)
    console.log(`  AR Bank: ${shift.runningArPaymentsBank}`)

    console.log('\n--- Cash In/Out ---')
    console.log(`  Total Cash In: ${shift.runningTotalCashIn}`)
    console.log(`  Total Cash Out: ${shift.runningTotalCashOut}`)

    // Calculate expected cash
    const beginningCash = parseFloat(shift.beginningCash?.toString() || '0')
    const cashSales = parseFloat(shift.runningCashSales?.toString() || '0')
    const arCash = parseFloat(shift.runningArPaymentsCash?.toString() || '0')
    const cashIn = parseFloat(shift.runningTotalCashIn?.toString() || '0')
    const cashOut = parseFloat(shift.runningTotalCashOut?.toString() || '0')

    const expectedCash = beginningCash + cashSales + arCash + cashIn - cashOut

    console.log('\n--- Expected Cash Calculation ---')
    console.log(`  Beginning Cash: ${beginningCash.toFixed(2)}`)
    console.log(`  + Cash Sales: ${cashSales.toFixed(2)}`)
    console.log(`  + AR Cash Payments: ${arCash.toFixed(2)}`)
    console.log(`  + Cash In: ${cashIn.toFixed(2)}`)
    console.log(`  - Cash Out: ${cashOut.toFixed(2)}`)
    console.log(`  = Expected Cash: ${expectedCash.toFixed(2)}`)

    // Ending cash (physical count)
    const endingCash = parseFloat(shift.endingCash?.toString() || '0')
    const variance = endingCash - expectedCash

    console.log(`\n  Ending Cash (Physical): ${endingCash.toFixed(2)}`)
    console.log(`  Variance (Over/Short): ${variance.toFixed(2)} ${variance >= 0 ? '(OVER)' : '(SHORT)'}`)

    // Cash In/Out details
    if (shift.cashInOutRecords.length > 0) {
      console.log('\n--- Cash In/Out Records ---')
      shift.cashInOutRecords.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.type}: ${r.amount} - ${r.reason}`)
      })
    }

    console.log('\n')
  }

  // Also check if there's a Z Reading record
  console.log('\n' + '=' .repeat(80))
  console.log('Z READING RECORDS')
  console.log('=' .repeat(80))

  const zReadings = await prisma.zReading.findMany({
    where: {
      locationId: LOCATION_ID,
      createdAt: {
        gte: startDate,
        lte: new Date('2026-01-09T15:59:59.999Z') // Extend to capture Z readings done next day
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`\nFound ${zReadings.length} Z Reading(s):`)
  zReadings.forEach((z, i) => {
    console.log(`\n${i+1}. Z Counter: ${z.zCounter}`)
    console.log(`   Shift ID: ${z.shiftId}`)
    console.log(`   Created: ${z.createdAt}`)
    console.log(`   Gross Sales: ${z.grossSales}`)
    console.log(`   Net Sales: ${z.netSales}`)
    console.log(`   Beginning Cash: ${z.beginningCash}`)
    console.log(`   Ending Cash: ${z.endingCash}`)
    console.log(`   Expected Cash: ${z.expectedCash}`)
    console.log(`   Cash Variance: ${z.cashVariance}`)
  })

  await prisma.$disconnect()
}

checkXZReading().catch(console.error)
