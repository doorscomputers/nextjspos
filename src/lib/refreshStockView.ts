import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

/**
 * Refresh the stock_pivot_view materialized view
 * This should be called after operations that affect product visibility or stock levels:
 * - Product activation/deactivation
 * - Product/variation soft delete/restore
 * - Stock transactions (optional, based on performance needs)
 */
export async function refreshStockView(options?: {
  silent?: boolean
  tx?: Prisma.TransactionClient
}): Promise<{
  success: boolean
  rowsAffected?: number
  durationMs?: number
  error?: string
}> {
  const { silent = true, tx } = options || {}

  try {
    const startTime = Date.now()
    const client = tx ?? prisma

    // Call the stored procedure to refresh the materialized view
    const result = await client.$queryRaw<
      Array<{
        rows_affected: bigint
        refresh_duration_ms: number
        last_refreshed: Date
      }>
    >`SELECT * FROM refresh_stock_pivot_view()`

    const endTime = Date.now()
    const refreshData = result[0]

    if (!silent) {
      console.log(`[Stock View Refresh] ✓ Success`)
      console.log(`[Stock View Refresh] Rows: ${refreshData.rows_affected}`)
      console.log(`[Stock View Refresh] DB Duration: ${refreshData.refresh_duration_ms}ms`)
      console.log(`[Stock View Refresh] Total Duration: ${endTime - startTime}ms`)
    }

    return {
      success: true,
      rowsAffected: Number(refreshData.rows_affected),
      durationMs: endTime - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (!silent) {
      console.error('[Stock View Refresh] ❌ Error:', errorMessage)
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Debounced refresh to prevent excessive refreshes
 * Useful when multiple stock operations happen in quick succession
 */
let refreshTimeout: NodeJS.Timeout | null = null

export async function debouncedRefreshStockView(delayMs: number = 2000): Promise<void> {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout)
  }

  refreshTimeout = setTimeout(async () => {
    await refreshStockView({ silent: true })
    refreshTimeout = null
  }, delayMs)
}
