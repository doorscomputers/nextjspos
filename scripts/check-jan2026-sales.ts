import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking for January 2026 Sales ===\n')

  // Check for any sales in January 2026
  const jan2026Sales = await prisma.$queryRaw<any[]>`
    SELECT s.id, s.invoice_number, s.sale_date, s.location_id, s.total_amount, bl.name as location_name
    FROM sales s
    JOIN business_locations bl ON bl.id = s.location_id
    WHERE s.sale_date >= '2026-01-01'
    ORDER BY s.sale_date DESC
    LIMIT 50
  `

  console.log(`Found ${jan2026Sales.length} sales in Jan 2026:`)
  for (const s of jan2026Sales) {
    console.log(`  ${s.id} | ${s.invoice_number} | ${s.sale_date} | ${s.location_name}`)
  }

  // Check the most recent sales overall
  console.log('\n=== Most Recent Sales (any date) ===')
  const recentSales = await prisma.$queryRaw<any[]>`
    SELECT s.id, s.invoice_number, s.sale_date, s.created_at, bl.name as location_name
    FROM sales s
    JOIN business_locations bl ON bl.id = s.location_id
    ORDER BY s.created_at DESC
    LIMIT 10
  `

  console.log(`Most recent ${recentSales.length} sales:`)
  for (const s of recentSales) {
    console.log(`  ${s.id} | ${s.invoice_number} | ${s.sale_date} | ${s.location_name} | created: ${s.created_at}`)
  }

  // Check database current timestamp
  const now = await prisma.$queryRaw<any[]>`SELECT NOW() as now`
  console.log('\nDatabase NOW():', now[0]?.now)
}

main().catch(console.error).finally(() => prisma.$disconnect())
