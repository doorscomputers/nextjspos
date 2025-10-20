import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const history = await prisma.productHistory.findMany({
    where: {
      productId: 306,
      locationId: 1
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log('=== Product History for Product 306 at Location 1 ===')
  console.log(`Total history records: ${history.length}`)
  console.log(JSON.stringify(history, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
