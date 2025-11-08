import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function refreshStockView() {
  try {
    console.log('\n=== REFRESHING STOCK MATERIALIZED VIEW ===\n')
    console.log('This will update all inventory reports to show current stock levels...\n')

    const startTime = Date.now()

    // Call the stored procedure to refresh the materialized view
    const result = await prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    console.log('✅ Stock view refreshed successfully!\n')
    console.log(`Rows affected: ${result[0].rows_affected}`)
    console.log(`Database refresh time: ${result[0].refresh_duration_ms}ms`)
    console.log(`Total time: ${totalDuration}ms`)
    console.log(`Last refreshed: ${result[0].last_refreshed}\n`)

    console.log('Your Sample UTP CABLE should now appear in:')
    console.log('  - All Branch Stock')
    console.log('  - Branch Stock Pivot')
    console.log('  - Branch Stock Pivot V2')
    console.log('  - Stock History V3\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

refreshStockView()
