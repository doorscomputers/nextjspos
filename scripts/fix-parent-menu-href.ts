import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing parent menu href...\n')

  // Update the parent menu href to match the simple_price_editor
  const updatedMenu = await prisma.menuPermission.update({
    where: { key: 'pricing_management' },
    data: {
      href: '/dashboard/products/simple-price-editor'
    }
  })

  console.log(`✅ Updated parent menu href:`)
  console.log(`   Key: ${updatedMenu.key}`)
  console.log(`   Name: ${updatedMenu.name}`)
  console.log(`   Href: ${updatedMenu.href}`)

  await prisma.$disconnect()
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())