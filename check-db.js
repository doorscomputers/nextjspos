const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    await prisma.$connect()
    console.log('✓ Database connection: OK')

    const counts = {
      sales: await prisma.sale.count(),
      purchases: await prisma.purchase.count(),
      transfers: await prisma.stockTransfer.count(),
      corrections: await prisma.inventoryCorrection.count(),
    }

    console.log('\nCurrent transaction counts:')
    console.log('  Sales:', counts.sales)
    console.log('  Purchases:', counts.purchases)
    console.log('  Transfers:', counts.transfers)
    console.log('  Corrections:', counts.corrections)
    console.log('  Total:', Object.values(counts).reduce((a, b) => a + b, 0))

    await prisma.$disconnect()
  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

checkDatabase()
