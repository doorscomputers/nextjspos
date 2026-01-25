import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking database with raw SQL...\n')

  try {
    // Raw query to check package_templates table
    const templates: any[] = await prisma.$queryRaw`
      SELECT id, name, target_price, is_active, created_at
      FROM package_templates
      ORDER BY id
    `

    console.log(`PackageTemplate records: ${templates.length}`)

    if (templates.length > 0) {
      templates.forEach((t: any) => {
        console.log(`  ID ${t.id}: ${t.name} - Price: ${t.target_price}`)
      })
    } else {
      console.log('  ❌ TABLE IS EMPTY')
    }

    // Check items
    const items: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM package_template_items`
    console.log(`\nPackageTemplateItem count: ${items[0]?.count || 0}`)

  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
