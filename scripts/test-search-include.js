const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function test() {
  console.log('Test 1: WITHOUT include')
  let start = Date.now()
  await prisma.product.findMany({
    where: {
      businessId: 1,
      isActive: true,
      name: { contains: 'a', mode: 'insensitive' }
    },
    take: 20
  })
  console.log(`Time: ${Date.now() - start}ms\n`)

  console.log('Test 2: WITH include')
  start = Date.now()
  await prisma.product.findMany({
    where: {
      businessId: 1,
      isActive: true,
      name: { contains: 'a', mode: 'insensitive' }
    },
    include: {
      variations: true
    },
    take: 20
  })
  console.log(`Time: ${Date.now() - start}ms`)

  await prisma.$disconnect()
}

test()
