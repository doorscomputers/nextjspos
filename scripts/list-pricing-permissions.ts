import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function listPermissions() {
  const permissions = await prisma.permission.findMany({
    where: {
      OR: [
        { name: { contains: 'PRICE', mode: 'insensitive' } },
        { name: { contains: 'PRICING', mode: 'insensitive' } },
        { name: { contains: 'PRODUCT', mode: 'insensitive' } }
      ]
    },
    orderBy: { name: 'asc' }
  })

  console.log('\n📋 Product/Pricing-related Permissions in Database:\n')
  permissions.forEach(p => {
    console.log(`   • ${p.name} (ID: ${p.id})`)
  })
  console.log(`\n   Total: ${permissions.length} permissions\n`)

  await prisma.$disconnect()
}

listPermissions().catch(console.error)
