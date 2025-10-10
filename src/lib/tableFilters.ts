import { DateRange } from '@/components/DateRangeFilter'
import { Row } from '@tanstack/react-table'

/**
 * Custom filter function for date range filtering
 * This is used by TanStack Table to filter rows based on date ranges
 */
export function dateRangeFilter<TData>(
  row: Row<TData>,
  columnId: string,
  filterValue: DateRange
): boolean {
  const { from, to } = filterValue

  if (!from && !to) {
    return true // No filter applied
  }

  const cellValue = row.getValue(columnId)

  if (!cellValue) {
    return false
  }

  // Convert cell value to Date
  const cellDate = new Date(cellValue as string)

  if (isNaN(cellDate.getTime())) {
    return false // Invalid date
  }

  // Check if date is within range
  if (from && to) {
    return cellDate >= from && cellDate <= to
  } else if (from) {
    return cellDate >= from
  } else if (to) {
    return cellDate <= to
  }

  return true
}

/**
 * Register custom filter functions
 * Use this in your DataTable component
 */
export const customFilterFns = {
  dateRange: dateRangeFilter,
}
