'use client'

import { useCallback, useRef, useState } from 'react'
import type { ContentReadyEvent } from 'devextreme/ui/data_grid'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type GridInstance = ContentReadyEvent['component']

interface PagerState {
  pageIndex: number
  pageCount: number
  pageSize: number
  total: number
}

/**
 * Shared pager for DevExtreme DataGrids: Rows per page, record count,
 * First / Previous / Page N of M / Next / Last.
 * Usage: const pager = useDataGridPager(20)
 *        <DataGrid onContentReady={pager.onContentReady}> <Paging defaultPageSize={20} /> <Pager visible={false} />
 *        <DataGridPagerBar pager={pager} />
 */
export function useDataGridPager(initialPageSize = 20) {
  const gridRef = useRef<GridInstance | null>(null)
  const [state, setState] = useState<PagerState>({
    pageIndex: 0,
    pageCount: 1,
    pageSize: initialPageSize,
    total: 0,
  })

  const onContentReady = useCallback((e: ContentReadyEvent) => {
    const grid = e.component
    gridRef.current = grid
    const next: PagerState = {
      pageIndex: grid.pageIndex(),
      pageCount: Math.max(grid.pageCount(), 1),
      pageSize: grid.pageSize(),
      total: grid.totalCount(), // count after filters/search
    }
    setState((prev) =>
      prev.pageIndex === next.pageIndex &&
      prev.pageCount === next.pageCount &&
      prev.pageSize === next.pageSize &&
      prev.total === next.total
        ? prev
        : next
    )
  }, [])

  return { gridRef, state, onContentReady }
}

const PAGE_SIZES = [10, 20, 30, 40, 50, 100]

export function DataGridPagerBar({ pager }: { pager: ReturnType<typeof useDataGridPager> }) {
  const { gridRef, state } = pager
  const { pageIndex, pageCount, pageSize, total } = state
  const isFirst = pageIndex <= 0
  const isLast = pageIndex >= pageCount - 1
  const from = total === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, total)

  const goTo = (index: number) => gridRef.current?.pageIndex(index)
  const changeSize = (size: number) => gridRef.current?.pageSize(size)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 rounded-b-lg text-sm">
      <div className="flex flex-wrap items-center gap-3 text-gray-700 dark:text-gray-300">
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => changeSize(Number(e.target.value))}
            className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>
          Showing <strong>{from.toLocaleString()}</strong>–<strong>{to.toLocaleString()}</strong> of{' '}
          <strong>{total.toLocaleString()}</strong> records
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => goTo(0)} disabled={isFirst} title="First page">
          <ChevronsLeft className="h-4 w-4" />
          <span className="hidden sm:inline">First</span>
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => goTo(pageIndex - 1)} disabled={isFirst} title="Previous page">
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="px-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Page <strong>{pageIndex + 1}</strong> of <strong>{pageCount}</strong>
        </span>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => goTo(pageIndex + 1)} disabled={isLast} title="Next page">
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => goTo(pageCount - 1)} disabled={isLast} title="Last page">
          <span className="hidden sm:inline">Last</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
