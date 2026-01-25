/**
 * Check PLGU IFUGAO customer balance
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
})

async function checkBalance() {
  console.log('=' .repeat(80))
  console.log('CHECKING PLGU IFUGAO CUSTOMER BALANCE')
  console.log('=' .repeat(80))

  // Search for PLGU IFUGAO customer
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'PLGU', mode: 'insensitive' } },
        { name: { contains: 'IFUGAO', mode: 'insensitive' } },
        { name: { contains: 'PROVINCIAL', mode: 'insensitive' } }
      ]
    }
  })

  console.log(`\nFound ${customers.length} customer(s) matching PLGU/IFUGAO/PROVINCIAL:`)
  customers.forEach((c, i) => {
    console.log(`  ${i+1}. ID: ${c.id} | Name: ${c.name}`)
  })

  // For each matching customer, find their outstanding invoices
  for (const customer of customers) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`CUSTOMER: ${customer.name} (ID: ${customer.id})`)
    console.log('─'.repeat(60))

    // Find all sales for this customer
    const sales = await prisma.sale.findMany({
      where: {
        customerId: customer.id
      },
      include: {
        payments: true,
        location: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`\nTotal sales: ${sales.length}`)

    let totalOwed = 0
    let totalPaid = 0
    let unpaidInvoices: typeof sales = []

    for (const sale of sales) {
      const saleTotal = parseFloat(sale.totalAmount.toString())
      const paidAmount = sale.payments.reduce((sum, p) => {
        // Skip credit placeholders
        if (p.paymentMethod === 'credit') return sum
        return sum + parseFloat(p.amount.toString())
      }, 0)
      const balance = saleTotal - paidAmount

      totalOwed += saleTotal
      totalPaid += paidAmount

      if (balance > 0.01) {
        unpaidInvoices.push(sale)
      }
    }

    console.log(`\nFinancial Summary:`)
    console.log(`  Total Invoiced: ${totalOwed.toFixed(2)}`)
    console.log(`  Total Paid: ${totalPaid.toFixed(2)}`)
    console.log(`  Outstanding Balance: ${(totalOwed - totalPaid).toFixed(2)}`)

    if (unpaidInvoices.length > 0) {
      console.log(`\nUnpaid/Partially Paid Invoices (${unpaidInvoices.length}):`)
      for (const sale of unpaidInvoices) {
        const saleTotal = parseFloat(sale.totalAmount.toString())
        const paidAmount = sale.payments
          .filter(p => p.paymentMethod !== 'credit')
          .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
        const balance = saleTotal - paidAmount

        console.log(`\n  Invoice: ${sale.invoiceNumber}`)
        console.log(`    Date: ${sale.createdAt}`)
        console.log(`    Location: ${sale.location?.name}`)
        console.log(`    Total: ${saleTotal.toFixed(2)}`)
        console.log(`    Paid: ${paidAmount.toFixed(2)}`)
        console.log(`    Balance: ${balance.toFixed(2)}`)
        console.log(`    Status: ${sale.status}`)

        // Check if any payment is ~6100.01
        if (Math.abs(balance - 6100.01) < 1) {
          console.log(`    *** THIS MIGHT BE THE MISSING CHEQUE! ***`)
        }

        // Show payment history
        if (sale.payments.length > 0) {
          console.log(`    Payments:`)
          sale.payments.forEach(p => {
            if (p.paymentMethod !== 'credit') {
              console.log(`      - ${p.amount} via ${p.paymentMethod} on ${p.paidAt}`)
            }
          })
        }
      }
    } else {
      console.log(`\n  No unpaid invoices - all accounts settled.`)
    }
  }

  // Also search more broadly for any invoice with balance ~6100
  console.log('\n\n' + '=' .repeat(80))
  console.log('SEARCHING FOR ANY INVOICE WITH BALANCE ~6,100.01')
  console.log('=' .repeat(80))

  const allSales = await prisma.sale.findMany({
    where: {
      status: { in: ['completed', 'pending', 'credit'] },
      locationId: 2 // Main Store
    },
    include: {
      payments: true,
      customer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 500
  })

  const matchingBalances: typeof allSales = []

  for (const sale of allSales) {
    const saleTotal = parseFloat(sale.totalAmount.toString())
    const paidAmount = sale.payments
      .filter(p => p.paymentMethod !== 'credit')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
    const balance = saleTotal - paidAmount

    // Check if balance is close to 6100.01
    if (Math.abs(balance - 6100.01) < 10 || (balance > 6000 && balance < 6200)) {
      matchingBalances.push(sale)
    }
  }

  console.log(`\nFound ${matchingBalances.length} invoice(s) with balance ~6,100:`)
  for (const sale of matchingBalances) {
    const saleTotal = parseFloat(sale.totalAmount.toString())
    const paidAmount = sale.payments
      .filter(p => p.paymentMethod !== 'credit')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
    const balance = saleTotal - paidAmount

    console.log(`\n  Invoice: ${sale.invoiceNumber}`)
    console.log(`    Customer: ${sale.customer?.name || 'Walk-in'}`)
    console.log(`    Date: ${sale.createdAt}`)
    console.log(`    Total: ${saleTotal.toFixed(2)}`)
    console.log(`    Paid: ${paidAmount.toFixed(2)}`)
    console.log(`    Balance: ${balance.toFixed(2)}`)
  }

  await prisma.$disconnect()
}

checkBalance().catch(console.error)
