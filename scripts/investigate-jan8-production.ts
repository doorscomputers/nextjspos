/**
 * Investigation Script: Excel vs System Report Discrepancy
 * Queries PRODUCTION database (Supabase)
 *
 * Date: January 8, 2026
 * Location: Main Store (ID: 2)
 *
 * Usage: npx tsx scripts/investigate-jan8-production.ts
 */

import { PrismaClient } from '@prisma/client'

// Connect to Supabase production database (password URL-encoded)
const DATABASE_URL = 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
})

const LOCATION_ID = 2 // Main Store
const CHEQUE_AMOUNT = 6100.01

async function investigate() {
  console.log('=' .repeat(80))
  console.log('INVESTIGATION: Excel vs System Report Discrepancy')
  console.log('Database: PRODUCTION (Supabase)')
  console.log('Date: January 8, 2026')
  console.log('Location: Main Store (ID: 2)')
  console.log('=' .repeat(80))

  // ========================================
  // 0. First, let's see what dates have data
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('0. CHECKING RECENT PAYMENT DATES')
  console.log('=' .repeat(80))

  const recentPayments = await prisma.salePayment.findMany({
    where: {
      sale: {
        locationId: LOCATION_ID
      }
    },
    orderBy: { paidAt: 'desc' },
    take: 20,
    select: {
      paidAt: true,
      amount: true,
      paymentMethod: true,
      sale: {
        select: { invoiceNumber: true }
      }
    }
  })

  console.log('\n  Last 20 payments at Main Store:')
  recentPayments.forEach((p, i) => {
    console.log(`    ${i+1}. ${p.paidAt.toISOString().split('T')[0]} | ${p.paymentMethod.padEnd(12)} | ${parseFloat(p.amount.toString()).toFixed(2).padStart(12)} | ${p.sale.invoiceNumber}`)
  })

  // Get date range for Jan 8 Philippine time
  // Database likely stores in UTC, so Jan 8 PH = Jan 7 16:00 UTC to Jan 8 15:59 UTC
  const startDate = new Date('2026-01-07T16:00:00.000Z')
  const endDate = new Date('2026-01-08T15:59:59.999Z')

  console.log('\n  Querying date range (UTC):')
  console.log('    Start:', startDate.toISOString())
  console.log('    End:', endDate.toISOString())

  // ========================================
  // 1. Find the 6,100.01 cheque payment (any date, any location)
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('1. GLOBAL SEARCH FOR 6,100.01 CHEQUE')
  console.log('=' .repeat(80))

  const chequeSearchAll = await prisma.salePayment.findMany({
    where: {
      OR: [
        { amount: { equals: CHEQUE_AMOUNT } },
        { amount: { gte: 6099, lte: 6102 } },
        { referenceNumber: { contains: '1871982' } },
        { referenceNumber: { contains: 'PLGU', mode: 'insensitive' } },
        { referenceNumber: { contains: 'IFUGAO', mode: 'insensitive' } }
      ]
    },
    include: {
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          locationId: true,
          status: true,
          customer: { select: { name: true } }
        }
      }
    },
    orderBy: { paidAt: 'desc' },
    take: 50
  })

  console.log(`\n  Found ${chequeSearchAll.length} payment(s) matching search criteria:`)
  chequeSearchAll.forEach((p, i) => {
    console.log(`\n    [${i+1}] Payment ID: ${p.id}`)
    console.log(`        Amount: ${p.amount}`)
    console.log(`        Method: ${p.paymentMethod}`)
    console.log(`        Reference: ${p.referenceNumber || 'N/A'}`)
    console.log(`        Paid At: ${p.paidAt}`)
    console.log(`        Invoice: ${p.sale.invoiceNumber}`)
    console.log(`        Location ID: ${p.sale.locationId}`)
    console.log(`        Customer: ${p.sale.customer?.name || 'Walk-in'}`)
  })

  // ========================================
  // 2. Check CashInOut for misclassified cheque (any date)
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('2. GLOBAL SEARCH IN CASH IN/OUT FOR CHEQUE')
  console.log('=' .repeat(80))

  const cashInOutSearch = await prisma.cashInOut.findMany({
    where: {
      OR: [
        { reason: { contains: 'cheque', mode: 'insensitive' } },
        { reason: { contains: 'check', mode: 'insensitive' } },
        { reason: { contains: 'plgu', mode: 'insensitive' } },
        { reason: { contains: 'ifugao', mode: 'insensitive' } },
        { amount: { gte: 6099, lte: 6102 } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  console.log(`\n  Found ${cashInOutSearch.length} Cash In/Out record(s) mentioning cheque/PLGU/Ifugao or amount ~6100:`)
  cashInOutSearch.forEach((r, i) => {
    console.log(`\n    [${i+1}] ID: ${r.id}`)
    console.log(`        Type: ${r.type}`)
    console.log(`        Amount: ${r.amount}`)
    console.log(`        Reason: ${r.reason}`)
    console.log(`        Location ID: ${r.locationId}`)
    console.log(`        Created: ${r.createdAt}`)
  })

  // ========================================
  // 3. All payments for Jan 8, 2026 at Main Store
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('3. ALL PAYMENTS FOR JAN 8, 2026 AT MAIN STORE')
  console.log('=' .repeat(80))

  const jan8Payments = await prisma.salePayment.findMany({
    where: {
      paidAt: {
        gte: startDate,
        lte: endDate
      },
      sale: {
        locationId: LOCATION_ID
      }
    },
    include: {
      sale: {
        select: {
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          customer: { select: { name: true } }
        }
      }
    },
    orderBy: { paidAt: 'asc' }
  })

  console.log(`\n  Found ${jan8Payments.length} payment(s):`)

  // Group by payment method
  const byMethod: Record<string, { count: number, total: number, items: typeof jan8Payments }> = {}

  jan8Payments.forEach(p => {
    const method = p.paymentMethod
    if (!byMethod[method]) {
      byMethod[method] = { count: 0, total: 0, items: [] }
    }
    byMethod[method].count++
    byMethod[method].total += parseFloat(p.amount.toString())
    byMethod[method].items.push(p)
  })

  console.log('\n  Summary by Payment Method:')
  console.log('  ' + '-'.repeat(50))
  let grandTotal = 0
  Object.entries(byMethod).sort((a, b) => b[1].total - a[1].total).forEach(([method, data]) => {
    console.log(`    ${method.padEnd(15)}: ${data.total.toFixed(2).padStart(12)} (${data.count} transactions)`)
    grandTotal += data.total
  })
  console.log('  ' + '-'.repeat(50))
  console.log(`    ${'TOTAL'.padEnd(15)}: ${grandTotal.toFixed(2).padStart(12)}`)

  // Show cheque payments specifically
  if (byMethod['cheque']) {
    console.log('\n  Cheque Payment Details:')
    byMethod['cheque'].items.forEach((p, i) => {
      console.log(`    ${i+1}. ${parseFloat(p.amount.toString()).toFixed(2)} | Ref: ${p.referenceNumber || 'N/A'} | ${p.sale.invoiceNumber} | ${p.sale.customer?.name || 'Walk-in'}`)
    })
  } else {
    console.log('\n  *** NO CHEQUE PAYMENTS FOUND FOR JAN 8! ***')
  }

  // ========================================
  // 4. AR Payments (payments for OLD invoices)
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('4. AR PAYMENTS (For invoices created BEFORE Jan 8)')
  console.log('=' .repeat(80))

  const arPayments = await prisma.salePayment.findMany({
    where: {
      paidAt: {
        gte: startDate,
        lte: endDate
      },
      paymentMethod: { not: 'credit' },
      sale: {
        locationId: LOCATION_ID,
        createdAt: {
          lt: startDate
        }
      }
    },
    include: {
      sale: {
        select: {
          invoiceNumber: true,
          createdAt: true,
          customer: { select: { name: true } }
        }
      }
    },
    orderBy: { paidAt: 'asc' }
  })

  console.log(`\n  Found ${arPayments.length} AR payment(s):`)
  let arTotal = 0
  arPayments.forEach((p, i) => {
    const amount = parseFloat(p.amount.toString())
    arTotal += amount
    console.log(`\n    [${i+1}] Payment ID: ${p.id}`)
    console.log(`        Amount: ${amount.toFixed(2)}`)
    console.log(`        Method: ${p.paymentMethod}`)
    console.log(`        Reference: ${p.referenceNumber || 'N/A'}`)
    console.log(`        Invoice: ${p.sale.invoiceNumber}`)
    console.log(`        Invoice Created: ${p.sale.createdAt}`)
    console.log(`        Customer: ${p.sale.customer?.name || 'Walk-in'}`)
  })
  console.log(`\n  Total AR Payments: ${arTotal.toFixed(2)}`)

  // ========================================
  // 5. Cash In/Out for Jan 8
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('5. CASH IN/OUT RECORDS FOR JAN 8 AT MAIN STORE')
  console.log('=' .repeat(80))

  const cashInOut = await prisma.cashInOut.findMany({
    where: {
      locationId: LOCATION_ID,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`\n  Found ${cashInOut.length} Cash In/Out record(s):`)
  let totalIn = 0, totalOut = 0
  cashInOut.forEach((r, i) => {
    const amount = parseFloat(r.amount.toString())
    if (r.type === 'cash_in') totalIn += amount
    else totalOut += amount
    console.log(`\n    [${i+1}] ID: ${r.id}`)
    console.log(`        Type: ${r.type}`)
    console.log(`        Amount: ${amount.toFixed(2)}`)
    console.log(`        Reason: ${r.reason}`)
    console.log(`        Created: ${r.createdAt}`)
  })
  console.log(`\n  Total Cash In: ${totalIn.toFixed(2)}`)
  console.log(`  Total Cash Out: ${totalOut.toFixed(2)}`)

  // ========================================
  // 6. Compare with Excel
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('6. COMPARISON: EXCEL vs SYSTEM')
  console.log('=' .repeat(80))

  const systemCash = byMethod['cash']?.total || 0
  const systemCheque = byMethod['cheque']?.total || 0
  const systemGcash = (byMethod['gcash']?.total || 0) + (byMethod['mobile_payment']?.total || 0)
  const systemBank = byMethod['bank_transfer']?.total || 0
  const systemTotal = systemCash + systemCheque + systemGcash + systemBank

  console.log(`
  Category          | Excel        | System       | Difference
  ------------------|--------------|--------------|---------------
  Cash              | 84,445.00    | ${systemCash.toFixed(2).padStart(12)} | ${(84445 - systemCash).toFixed(2).padStart(13)}
  Cheque            |  6,100.01    | ${systemCheque.toFixed(2).padStart(12)} | ${(6100.01 - systemCheque).toFixed(2).padStart(13)}
  GCash             | 16,000.00    | ${systemGcash.toFixed(2).padStart(12)} | ${(16000 - systemGcash).toFixed(2).padStart(13)}
  Bank Transfer     | 15,394.00    | ${systemBank.toFixed(2).padStart(12)} | ${(15394 - systemBank).toFixed(2).padStart(13)}
  ------------------|--------------|--------------|---------------
  TOTAL             | 121,939.01   | ${systemTotal.toFixed(2).padStart(12)} | ${(121939.01 - systemTotal).toFixed(2).padStart(13)}
  `)

  // Show GCash details if available
  if (byMethod['gcash'] || byMethod['mobile_payment']) {
    console.log('\n  GCash/Mobile Payment Details:')
    const gcashItems = [...(byMethod['gcash']?.items || []), ...(byMethod['mobile_payment']?.items || [])]
    gcashItems.forEach((p, i) => {
      console.log(`    ${i+1}. ${parseFloat(p.amount.toString()).toFixed(2)} | ${p.paymentMethod} | ${p.sale.invoiceNumber} | ${p.sale.customer?.name || 'Walk-in'}`)
    })
  }

  // Show Bank Transfer details if available
  if (byMethod['bank_transfer']) {
    console.log('\n  Bank Transfer Details:')
    byMethod['bank_transfer'].items.forEach((p, i) => {
      console.log(`    ${i+1}. ${parseFloat(p.amount.toString()).toFixed(2)} | Ref: ${p.referenceNumber || 'N/A'} | ${p.sale.invoiceNumber} | ${p.sale.customer?.name || 'Walk-in'}`)
    })
  }

  // ========================================
  // 7. Conclusion
  // ========================================
  console.log('\n' + '=' .repeat(80))
  console.log('7. CONCLUSION')
  console.log('=' .repeat(80))

  if (systemCheque === 0) {
    console.log(`
  *** THE 6,100.01 CHEQUE IS MISSING FROM PAYMENT RECORDS ***

  The cheque from PLGU IFUGAO (Check #1871982) was NOT recorded as a
  cheque payment in the SalePayment table.

  Check sections 1 and 2 above for any clues about where it went.
  `)
  }

  if (chequeSearchAll.length > 0) {
    console.log('\n  POSSIBLE MATCH FOUND - Check section 1 above!')
  }

  if (cashInOutSearch.length > 0) {
    console.log('\n  POSSIBLE CASH IN/OUT MATCH - Check section 2 above!')
  }

  await prisma.$disconnect()
}

investigate().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
