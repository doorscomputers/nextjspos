/**
 * Clean Test Database
 * Deletes all test data but keeps schema intact
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanTestDatabase() {
  console.log('\n🧹 Cleaning test database...\n')

  try {
    // Delete in order (respect foreign keys)
    console.log('   🗑️  Deleting sales...')
    await prisma.salePayment.deleteMany()
    await prisma.saleLine.deleteMany()
    await prisma.sale.deleteMany()

    console.log('   🗑️  Deleting purchases...')
    await prisma.purchasePayment.deleteMany()
    await prisma.purchaseLine.deleteMany()
    await prisma.purchase.deleteMany()

    console.log('   🗑️  Deleting stock transfers...')
    await prisma.stockTransferLine.deleteMany()
    await prisma.stockTransfer.deleteMany()

    console.log('   🗑️  Deleting stock transactions...')
    await prisma.stockTransaction.deleteMany()

    console.log('   🗑️  Deleting inventory corrections...')
    await prisma.inventoryCorrection.deleteMany()

    console.log('   🗑️  Deleting accounts payable...')
    await prisma.accountsPayable.deleteMany()

    console.log('   🗑️  Deleting accounts receivable...')
    await prisma.accountsReceivable.deleteMany()

    console.log('   🗑️  Deleting cash register sessions...')
    await prisma.cashRegisterSession.deleteMany()

    console.log('   🗑️  Deleting product history...')
    await prisma.productHistory.deleteMany()

    console.log('   🗑️  Deleting variation location details...')
    await prisma.variationLocationDetails.deleteMany()

    console.log('   🗑️  Deleting product variations...')
    await prisma.productVariation.deleteMany()

    console.log('   🗑️  Deleting products...')
    await prisma.product.deleteMany()

    console.log('\n✅ Test database cleaned successfully!\n')
    console.log('💡 Ready for fresh test data. Run: npm run db:seed\n')

  } catch (error: any) {
    console.error('\n❌ Error cleaning database:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanTestDatabase()
