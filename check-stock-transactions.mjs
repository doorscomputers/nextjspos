import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const transactions = await prisma.stockTransaction.findMany({
    where: {
      productId: 306,
      locationId: 1
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log('=== Stock Transactions for Product 306 at Location 1 ===')
  console.log(`Total transactions: ${transactions.length}`)
  console.log(JSON.stringify(transactions, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
