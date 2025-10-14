const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkReturns() {
  try {
    const count = await prisma.purchaseReturn.count({
      where: { businessId: 1 }
    })
    console.log('Purchase Returns count:', count)
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkReturns()
