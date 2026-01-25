import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking PackageTemplate records in database...\n')

  try {
    const templates = await prisma.packageTemplate.findMany({
      select: {
        id: true,
        name: true,
        templateType: true,
        targetPrice: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { id: 'asc' }
    })

    console.log(`Total PackageTemplate records: ${templates.length}\n`)

    if (templates.length > 0) {
      console.log('Records found:')
      templates.forEach(t => {
        console.log(`  ID ${t.id}: ${t.name} (${t.templateType}) - Price: ${t.targetPrice} - Active: ${t.isActive}`)
      })
    } else {
      console.log('❌ NO RECORDS FOUND - The table is empty!')
    }

    // Also check PackageTemplateItem
    const items = await prisma.packageTemplateItem.count()
    console.log(`\nPackageTemplateItem records: ${items}`)

  } catch (error) {
    console.error('Error:', error)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
