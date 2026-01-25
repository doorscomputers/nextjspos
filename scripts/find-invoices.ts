/**
 * Find invoices at Tuguegarao
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Searching for Tuguegarao Invoices ===\n')

  // Search for invoices at Tuguegarao (location 4)
  const tuguegaraoSales = await prisma.$queryRaw<any[]>`
    SELECT s.id, s.invoice_number, s.sale_date, s.created_at, s.status, s.total_amount
    FROM sales s
    WHERE s.location_id = 4
    ORDER BY s.created_at DESC
    LIMIT 20
  `

  console.log(`Found ${tuguegaraoSales.length} sales at Tuguegarao:`)
  for (const s of tuguegaraoSales) {
    console.log(`  ${s.id} | ${s.invoice_number} | ${s.sale_date} | ${s.status}`)
  }

  // Search for invoices starting with InvTuguega
  console.log('\n=== Searching for InvTuguega invoices ===')
  const tuguegaInvoices = await prisma.$queryRaw<any[]>`
    SELECT s.id, s.invoice_number, s.sale_date, s.location_id, s.status
    FROM sales s
    WHERE s.invoice_number LIKE 'InvTuguega%'
    ORDER BY s.created_at DESC
    LIMIT 20
  `

  console.log(`Found ${tuguegaInvoices.length} InvTuguega invoices:`)
  for (const s of tuguegaInvoices) {
    console.log(`  ${s.id} | ${s.invoice_number} | ${s.sale_date} | loc: ${s.location_id}`)
  }

  // Check stock_transactions ID range around 12665
  console.log('\n=== StockTransactions around ID 12665 ===')
  const txnsAround = await prisma.$queryRaw<any[]>`
    SELECT st.id, st.type, st.product_id, st.location_id, st.quantity, p.name
    FROM stock_transactions st
    JOIN products p ON p.id = st.product_id
    WHERE st.id BETWEEN 12660 AND 12670
    ORDER BY st.id
  `

  console.log(`Found ${txnsAround.length} transactions:`)
  for (const t of txnsAround) {
    console.log(`  ${t.id} | ${t.type} | ${t.name} | loc: ${t.location_id} | qty: ${t.quantity}`)
  }

  // Get max ID in stock_transactions
  const maxId = await prisma.$queryRaw<any[]>`SELECT MAX(id) as max_id FROM stock_transactions`
  console.log('\nMax stock_transaction ID:', maxId[0]?.max_id)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
