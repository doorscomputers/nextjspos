/**
 * EMERGENCY FIX: Correct inventory variance for demo
 *
 * Problem: Ledger shows +20 more than physical stock for 3 variations
 * Solution: Add corrective entries to sync ledger with physical stock
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixInventoryVariance() {
  console.log('🔧 Starting inventory variance fix...')

  const fixes = [
    { variationId: 964, locationId: 1, variance: -20, currentPhysical: 40 },
    { variationId: 819, locationId: 1, variance: -20, currentPhysical: 20 },
    { variationId: 411, locationId: 1, variance: -20, currentPhysical: 10 },
  ]

  for (const fix of fixes) {
    console.log(`\n📦 Fixing Variation ${fix.variationId}:`)
    console.log(`   Physical Stock: ${fix.currentPhysical}`)
    console.log(`   Variance: ${fix.variance}`)
    console.log(`   Adding correction entry...`)

    try {
      // Add a NEGATIVE correction entry to reduce ledger
      // Variance -20 means ledger is 20 too high, so we need to deduct 20
      const correction = await prisma.productHistory.create({
        data: {
          businessId: 1, // Your business ID
          productVariationId: fix.variationId,
          locationId: fix.locationId,
          type: 'adjustment', // Manual adjustment
          quantity: fix.variance, // -20 (negative to reduce ledger)
          quantityBefore: fix.currentPhysical - fix.variance, // 40-(-20)=60
          quantityAfter: fix.currentPhysical, // 40
          notes: `EMERGENCY FIX: Correcting ledger variance (ledger was 20 too high) to match physical stock ${fix.currentPhysical}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      console.log(`   ✅ Correction entry created: ID ${correction.id}`)
    } catch (error) {
      console.error(`   ❌ Failed to fix variation ${fix.variationId}:`, error)
    }
  }

  console.log('\n✅ Inventory variance fix complete!')
  console.log('⚠️  Please test transfer send operation again')
}

fixInventoryVariance()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
