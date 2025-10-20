import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Cleaning up test products...')

  const result = await prisma.product.deleteMany({
    where: {
      OR: [
        { sku: { startsWith: 'TW' } },
        { sku: { startsWith: 'MLW' } },
        { sku: { startsWith: 'ZSW' } }
      ]
    }
  })

  console.log(`Deleted ${result.count} products`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
