'use client'

import { useState, useMemo } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter'
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { dateRangeFilter } from '@/lib/tableFilters'

export interface DataTableColumn<TData> extends ColumnDef<TData> {
  accessorKey?: string
  header?: string | ((props: any) => any)
  enableSorting?: boolean
  enableFiltering?: boolean
  filterType?: 'text' | 'date' | 'select'
  filterOptions?: { label: string; value: string }[]
}

interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[]
  data: TData[]
  searchPlaceholder?: string
  enableGlobalFilter?: boolean
  enableColumnFilters?: boolean
  enableExport?: boolean
  exportFileName?: string
  enableColumnVisibility?: boolean
  pageSize?: number
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  enableGlobalFilter = true,
  enableColumnFilters = true,
  enableExport = true,
  exportFileName = 'export',
  enableColumnVisibility = true,
  pageSize = 10,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize,
  })

  // Process columns to add sorting headers and filter functions
  const processedColumns = useMemo(() => {
    return columns.map((col) => {
      const filterType = (col as any).filterType

      return {
        ...col,
        enableSorting: col.enableSorting !== false,
        filterFn: filterType === 'date' ? dateRangeFilter : undefined,
        header: ({ column }: any) => {
          const originalHeader = typeof col.header === 'function' ? col.header({ column }) : col.header

          if (col.enableSorting === false) {
            return <div className="font-semibold">{originalHeader}</div>
          }

          const isSorted = column.getIsSorted()

          return (
            <button
              className="flex items-center gap-1 font-semibold hover:text-blue-600 transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {originalHeader}
              {isSorted === 'asc' ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === 'desc' ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              )}
            </button>
          )
        },
      }
    })
  }, [columns])

  const table = useReactTable({
    data,
    columns: processedColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
  })

  const handleExport = () => {
    const exportData = table.getFilteredRowModel().rows.map((row) => {
      const rowData: any = {}
      row.getVisibleCells().forEach((cell) => {
        const column = cell.column
        const header = typeof column.columnDef.header === 'string'
          ? column.columnDef.header
          : column.id
        rowData[header] = cell.getValue()
      })
      return rowData
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `${exportFileName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {enableGlobalFilter && (
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {enableExport && (
            <Button
              variant="outline"
              onClick={handleExport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}

          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    const header = typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {header}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Column Filters */}
      {enableColumnFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {columns.map((col) => {
            if (col.enableFiltering === false || !col.accessorKey) return null

            const column = table.getColumn(col.accessorKey)
            if (!column) return null

            const filterType = (col as any).filterType || 'text'
            const currentFilter = column.getFilterValue()

            return (
              <div key={col.accessorKey}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {typeof col.header === 'string' ? col.header : col.accessorKey}
                </label>

                {filterType === 'date' ? (
                  <DateRangeFilter
                    value={
                      currentFilter
                        ? (currentFilter as DateRange)
                        : { from: null, to: null }
                    }
                    onChange={(range) => {
                      if (range.from || range.to) {
                        column.setFilterValue(range)
                      } else {
                        column.setFilterValue(undefined)
                      }
                    }}
                    placeholder={`Filter ${typeof col.header === 'string' ? col.header : col.accessorKey}...`}
                  />
                ) : filterType === 'select' ? (
                  <select
                    value={(currentFilter as string) ?? ''}
                    onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All</option>
                    {((col as any).filterOptions || []).map((option: any) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder={`Filter ${typeof col.header === 'string' ? col.header : col.accessorKey}...`}
                    value={(currentFilter as string) ?? ''}
                    onChange={(e) => column.setFilterValue(e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-gray-50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-gray-500"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing{' '}
          <span className="font-medium">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
          </span>{' '}
          to{' '}
          <span className="font-medium">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}
          </span>{' '}
          of{' '}
          <span className="font-medium">{table.getFilteredRowModel().rows.length}</span>{' '}
          results
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-700">
            Page{' '}
            <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span>{' '}
            of{' '}
            <span className="font-medium">{table.getPageCount()}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
