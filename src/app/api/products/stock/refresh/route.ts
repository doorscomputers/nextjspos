import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/products/stock/refresh
 * Refreshes the stock_pivot_view materialized view
 * Requires PRODUCT_VIEW permission
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to refresh stock data' },
        { status: 403 }
      )
    }

    console.log(`[Stock Refresh] Starting materialized view refresh...`)
    const startTime = Date.now()

    // Call the stored procedure to refresh the materialized view
    const result = await prisma.$queryRaw<
      Array<{
        rows_affected: bigint
        refresh_duration_ms: number
        last_refreshed: Date
      }>
    >`SELECT * FROM refresh_stock_pivot_view()`

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    const refreshData = result[0]

    console.log(`[Stock Refresh] ✓ Complete`)
    console.log(`[Stock Refresh] Rows: ${refreshData.rows_affected}`)
    console.log(`[Stock Refresh] DB Duration: ${refreshData.refresh_duration_ms}ms`)
    console.log(`[Stock Refresh] Total Duration: ${totalDuration}ms`)

    return NextResponse.json({
      success: true,
      message: 'Stock data refreshed successfully',
      stats: {
        rowsAffected: Number(refreshData.rows_affected),
        dbRefreshDurationMs: refreshData.refresh_duration_ms,
        totalDurationMs: totalDuration,
        lastRefreshed: refreshData.last_refreshed,
      },
    })
  } catch (error) {
    console.error('[Stock Refresh] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to refresh stock data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
