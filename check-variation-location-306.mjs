import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const varLocation = await prisma.variationLocationDetails.findFirst({
    where: {
      productId: 306,
      productVariationId: 306,
      locationId: 1
    }
  })

  console.log('=== Variation Location Details for Product 306 ===')
  console.log(JSON.stringify(varLocation, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
