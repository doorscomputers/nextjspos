import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { contains: 'HIKSEMI', mode: 'insensitive' } },
    select: { id: true, name: true }
  })

  console.log('HIKSEMI products in database:')
  products.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`))

  // Also search for 128GB specifically
  console.log('\n128GB SSD products:')
  const ssd128 = await prisma.product.findMany({
    where: { name: { contains: '128GB', mode: 'insensitive' } },
    select: { id: true, name: true }
  })
  ssd128.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`))

  await prisma.$disconnect()
}

main()
