import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Verifying Package Templates after schema fix...\n')

  const templates = await prisma.packageTemplate.findMany({
    select: {
      id: true,
      name: true,
      templateType: true,
      isActive: true,
      businessId: true
    },
    orderBy: { id: 'asc' }
  })

  console.log(`Total records: ${templates.length}\n`)
  templates.forEach(t => {
    console.log(`ID ${t.id}: ${t.name}`)
    console.log(`  - businessId: ${t.businessId}, templateType: ${t.templateType}, active: ${t.isActive}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
