import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const locations = await prisma.businessLocation.findMany({
    where: { id: { in: [1, 2] } },
    select: { id: true, name: true }
  })

  console.log('=== Locations ===')
  locations.forEach(loc => {
    console.log(`ID ${loc.id}: ${loc.name}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
