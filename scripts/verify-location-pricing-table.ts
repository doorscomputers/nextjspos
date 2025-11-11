/**
 * Verify ProductUnitLocationPrice table exists
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verifying ProductUnitLocationPrice table...\n')

  try {
    // Try to query the table
    const count = await prisma.productUnitLocationPrice.count()
    console.log('✅ Table exists!')
    console.log(`   Current records: ${count}`)

    // Check if we can query with our expected structure
    const sample = await prisma.productUnitLocationPrice.findFirst({
      select: {
        id: true,
        productId: true,
        locationId: true,
        unitId: true,
        purchasePrice: true,
        sellingPrice: true,
        lastUpdatedBy: true,
      },
    })

    if (sample) {
      console.log('\n✅ Sample record structure is correct:')
      console.log('   ', JSON.stringify(sample, null, 2))
    } else {
      console.log('\n⚠️  No records found in table (this is OK if starting fresh)')
    }

    console.log('\n✅ Database schema is correct!')
  } catch (error) {
    console.error('❌ Error accessing table:', error)

    if (error instanceof Error) {
      console.error('\n💡 Fix: Run this command to sync your database schema:')
      console.error('   npx prisma db push')
      console.error('   npx prisma generate')
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
