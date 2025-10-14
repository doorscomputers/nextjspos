const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Updating DUMMY variations to Default...\n')

  // Find all DUMMY variations
  const dummyVariations = await prisma.productVariation.findMany({
    where: { name: 'DUMMY' },
    select: { id: true, sku: true }
  })

  console.log(`Found ${dummyVariations.length} DUMMY variations`)

  if (dummyVariations.length === 0) {
    console.log('✓ No DUMMY variations found')
    return
  }

  // Update them to "Default"
  const result = await prisma.productVariation.updateMany({
    where: { name: 'DUMMY' },
    data: { name: 'Default' }
  })

  console.log(`✅ Updated ${result.count} variations from "DUMMY" to "Default"`)
  console.log('\nℹ️  New single products will now be created with "Default" variation name')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
