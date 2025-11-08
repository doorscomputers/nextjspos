import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function restoreVariation() {
  try {
    console.log('\n=== RESTORING SAMPLE UTP CABLE VARIATION ===\n')

    // Find the deleted variation
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: 4628
      }
    })

    if (!variation) {
      console.log('❌ Variation not found')
      return
    }

    console.log(`Variation: ${variation.name}`)
    console.log(`deleted_at: ${variation.deletedAt}`)

    // Restore it
    await prisma.productVariation.update({
      where: { id: 4628 },
      data: { deletedAt: null }
    })

    console.log(`\n✅ Variation restored (deleted_at set to NULL)`)

    // Refresh materialized view
    console.log(`\nRefreshing materialized view...`)
    await prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`

    console.log(`✅ View refreshed!`)
    console.log(`\nSample UTP CABLE should now appear in ALL inventory reports:`)
    console.log(`  - All Branch Stock`)
    console.log(`  - Branch Stock Pivot`)
    console.log(`  - Branch Stock Pivot V2`)
    console.log(`  - Stock History V3`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

restoreVariation()
