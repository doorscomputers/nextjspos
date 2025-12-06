import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const units = await prisma.unit.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
    },
    orderBy: { name: 'asc' }
  })
  console.log('Units in database:')
  console.log(JSON.stringify(units, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
