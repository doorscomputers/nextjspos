/**
 * Search for the 6,100.01 cheque - check if it was entered as cash
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
})

async function search() {
  console.log('Searching for 6,100.01 payment (any method)...\n')

  // Search for exact amount or close to it
  const payments = await prisma.salePayment.findMany({
    where: {
      OR: [
        { amount: { gte: 6099, lte: 6102 } },
        { amount: { equals: 6100.01 } }
      ]
    },
    include: {
      sale: {
        select: {
          invoiceNumber: true,
          locationId: true,
          createdAt: true,
          customer: { select: { name: true } }
        }
      }
    },
    orderBy: { paidAt: 'desc' },
    take: 100
  })

  console.log(`Found ${payments.length} payments with amount ~6100:`)
  payments.forEach((p, i) => {
    console.log(`\n${i+1}. Amount: ${p.amount}`)
    console.log(`   Method: ${p.paymentMethod}`)
    console.log(`   Reference: ${p.referenceNumber || 'N/A'}`)
    console.log(`   Paid At: ${p.paidAt}`)
    console.log(`   Invoice: ${p.sale.invoiceNumber}`)
    console.log(`   Location: ${p.sale.locationId}`)
    console.log(`   Customer: ${p.sale.customer?.name || 'Walk-in'}`)
  })

  // Also search for PLGU in customer names
  console.log('\n\n--- Searching for PLGU/IFUGAO in customer names ---\n')

  const plguCustomers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'PLGU', mode: 'insensitive' } },
        { name: { contains: 'IFUGAO', mode: 'insensitive' } },
        { name: { contains: 'LGU', mode: 'insensitive' } }
      ]
    },
    take: 20
  })

  console.log(`Found ${plguCustomers.length} customers with PLGU/IFUGAO/LGU:`)
  plguCustomers.forEach((c, i) => {
    console.log(`  ${i+1}. ID: ${c.id} | Name: ${c.name}`)
  })

  // Search for sales to PLGU customers on Jan 8
  if (plguCustomers.length > 0) {
    console.log('\n\n--- Searching for Jan 8 sales to PLGU/LGU customers ---\n')

    const startDate = new Date('2026-01-07T16:00:00.000Z')
    const endDate = new Date('2026-01-08T15:59:59.999Z')

    const plguSales = await prisma.sale.findMany({
      where: {
        customerId: { in: plguCustomers.map(c => c.id) },
        createdAt: { gte: startDate, lte: endDate }
      },
      include: {
        customer: { select: { name: true } },
        payments: true
      }
    })

    console.log(`Found ${plguSales.length} sales to PLGU/LGU customers on Jan 8:`)
    plguSales.forEach((s, i) => {
      console.log(`\n${i+1}. Invoice: ${s.invoiceNumber}`)
      console.log(`   Customer: ${s.customer?.name}`)
      console.log(`   Total: ${s.totalAmount}`)
      console.log(`   Status: ${s.status}`)
      console.log(`   Payments:`)
      s.payments.forEach(p => {
        console.log(`     - ${p.amount} via ${p.paymentMethod} (ref: ${p.referenceNumber || 'N/A'})`)
      })
    })
  }

  // Search for any reference containing 1871982 (cheque number)
  console.log('\n\n--- Searching for cheque number 1871982 ---\n')

  const chequeRef = await prisma.salePayment.findMany({
    where: {
      referenceNumber: { contains: '1871982' }
    },
    include: {
      sale: { select: { invoiceNumber: true } }
    }
  })

  console.log(`Found ${chequeRef.length} payments with reference containing 1871982`)
  chequeRef.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.amount} | ${p.paymentMethod} | ${p.referenceNumber} | ${p.sale.invoiceNumber}`)
  })

  await prisma.$disconnect()
}

search().catch(console.error)
