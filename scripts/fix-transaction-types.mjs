import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixTransactionTypes() {
  try {
    console.log('🔧 Updating transaction types from "beginning_inventory" to "opening_stock"...\n')

    // Update ProductHistory records
    const result = await prisma.productHistory.updateMany({
      where: {
        transactionType: 'beginning_inventory'
      },
      data: {
        transactionType: 'opening_stock'
      }
    })

    console.log(`✅ Updated ${result.count} ProductHistory records`)
    console.log('\n✨ Migration complete!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixTransactionTypes()
