/**
 * Find any invoice with amount ~6,100.01
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
})

async function findInvoice() {
  console.log('=' .repeat(80))
  console.log('SEARCHING FOR INVOICE WITH TOTAL ~6,100.01')
  console.log('=' .repeat(80))

  // Search for sales with total amount close to 6100.01
  const sales = await prisma.sale.findMany({
    where: {
      totalAmount: {
        gte: 6000,
        lte: 6200
      }
    },
    include: {
      payments: true,
      customer: { select: { name: true } },
      location: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`\nFound ${sales.length} invoice(s) with total between 6,000 and 6,200:`)

  for (const sale of sales) {
    const saleTotal = parseFloat(sale.totalAmount.toString())
    const paidAmount = sale.payments
      .filter(p => p.paymentMethod !== 'credit')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
    const balance = saleTotal - paidAmount

    console.log(`\n  Invoice: ${sale.invoiceNumber}`)
    console.log(`    Customer: ${sale.customer?.name || 'Walk-in'}`)
    console.log(`    Location: ${sale.location?.name}`)
    console.log(`    Date: ${sale.createdAt}`)
    console.log(`    Total: ${saleTotal.toFixed(2)}`)
    console.log(`    Paid: ${paidAmount.toFixed(2)}`)
    console.log(`    Balance: ${balance.toFixed(2)}`)
    console.log(`    Status: ${sale.status}`)

    if (Math.abs(saleTotal - 6100.01) < 1) {
      console.log(`    *** EXACT MATCH FOR 6,100.01! ***`)
    }

    if (sale.payments.length > 0) {
      console.log(`    Payments:`)
      sale.payments.forEach(p => {
        console.log(`      - ${p.amount} via ${p.paymentMethod} (ref: ${p.referenceNumber || 'N/A'}) on ${p.paidAt}`)
      })
    }
  }

  // Also search by exact amount
  console.log('\n\n' + '=' .repeat(80))
  console.log('SEARCHING FOR EXACT AMOUNT 6,100.01')
  console.log('=' .repeat(80))

  const exactSales = await prisma.sale.findMany({
    where: {
      OR: [
        { totalAmount: { equals: 6100.01 } },
        { totalAmount: { equals: 6100 } }
      ]
    },
    include: {
      payments: true,
      customer: { select: { name: true } },
      location: { select: { name: true } }
    }
  })

  console.log(`\nFound ${exactSales.length} invoice(s) with exact total 6,100.01:`)
  exactSales.forEach(sale => {
    console.log(`  - ${sale.invoiceNumber} | ${sale.customer?.name || 'Walk-in'} | ${sale.location?.name} | ${sale.createdAt}`)
  })

  // Search for recent pending/credit sales at Main Store
  console.log('\n\n' + '=' .repeat(80))
  console.log('RECENT PENDING/CREDIT SALES AT MAIN STORE (Last 30 days)')
  console.log('=' .repeat(80))

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const pendingSales = await prisma.sale.findMany({
    where: {
      locationId: 2,
      status: { in: ['pending', 'credit'] },
      createdAt: { gte: thirtyDaysAgo }
    },
    include: {
      payments: true,
      customer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`\nFound ${pendingSales.length} pending/credit sale(s):`)
  for (const sale of pendingSales) {
    const saleTotal = parseFloat(sale.totalAmount.toString())
    const paidAmount = sale.payments
      .filter(p => p.paymentMethod !== 'credit')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
    const balance = saleTotal - paidAmount

    console.log(`\n  ${sale.invoiceNumber}`)
    console.log(`    Customer: ${sale.customer?.name || 'Walk-in'}`)
    console.log(`    Total: ${saleTotal.toFixed(2)} | Paid: ${paidAmount.toFixed(2)} | Balance: ${balance.toFixed(2)}`)
  }

  await prisma.$disconnect()
}

findInvoice().catch(console.error)
