import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const maxPH = await prisma.$queryRaw<any[]>`SELECT MAX(id) as max_id FROM product_history`
  console.log('Max ProductHistory ID:', maxPH[0]?.max_id)

  const maxST = await prisma.$queryRaw<any[]>`SELECT MAX(id) as max_id FROM stock_transactions`
  console.log('Max StockTransaction ID:', maxST[0]?.max_id)

  const maxIC = await prisma.$queryRaw<any[]>`SELECT MAX(id) as max_id FROM inventory_corrections`
  console.log('Max InventoryCorrection ID:', maxIC[0]?.max_id)

  // Check if any ProductHistory has ID 12665
  const ph12665 = await prisma.$queryRaw<any[]>`SELECT * FROM product_history WHERE id = 12665`
  console.log('\nProductHistory 12665:', ph12665.length > 0 ? ph12665[0] : 'NOT FOUND')
}

main().catch(console.error).finally(() => prisma.$disconnect())
