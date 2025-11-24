import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * POST /api/products/refresh-stock-pivot
 *
 * Refreshes the stock_pivot_view materialized view to get the latest inventory data.
 * This is necessary because materialized views cache data for performance and don't
 * automatically update when underlying tables change.
 *
 * @returns JSON with refresh statistics (rows affected, duration, timestamp)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Refreshing stock_pivot_view materialized view...')
    const startTime = Date.now()

    // Call the stored function to refresh the materialized view
    const result = await prisma.$queryRaw<
      Array<{
        rows_affected: bigint
        refresh_duration_ms: number
        last_refreshed: Date
      }>
    >`SELECT * FROM refresh_stock_pivot_view()`

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    if (result && result.length > 0) {
      const stats = result[0]
      const rowsAffected = Number(stats.rows_affected)
      const dbDuration = stats.refresh_duration_ms

      console.log(`✅ Stock pivot view refreshed successfully`)
      console.log(`   - Rows: ${rowsAffected}`)
      console.log(`   - DB Duration: ${dbDuration}ms`)
      console.log(`   - Total Duration: ${totalDuration}ms`)
      console.log(`   - Timestamp: ${stats.last_refreshed}`)

      return NextResponse.json({
        success: true,
        message: 'Stock inventory data refreshed successfully',
        stats: {
          rowsAffected,
          dbDurationMs: dbDuration,
          totalDurationMs: totalDuration,
          lastRefreshed: stats.last_refreshed,
        },
      })
    }

    // Fallback if stored function doesn't return expected result
    console.warn('⚠️  Stored function returned unexpected result, using manual refresh')
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY stock_pivot_view`

    return NextResponse.json({
      success: true,
      message: 'Stock inventory data refreshed successfully',
      stats: {
        totalDurationMs: totalDuration,
        lastRefreshed: new Date(),
      },
    })
  } catch (error: any) {
    console.error('❌ Error refreshing stock pivot view:', error)

    return NextResponse.json(
      {
        error: 'Failed to refresh inventory data',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
