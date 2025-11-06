const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function test() {
  console.log('Testing product search speed...\n')
  
  const start = Date.now()
  const results = await prisma.product.findMany({
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
  const duration = Date.now() - start
  
  console.log(`Found: ${results.length} products`)
  console.log(`Time: ${duration}ms`)
  console.log(duration > 1000 ? '❌ SLOW!' : duration > 500 ? '⚠️ OK' : '✅ FAST')
  
  await prisma.$disconnect()
}

test()
