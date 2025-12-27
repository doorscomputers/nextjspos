"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import {
  CalendarIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  DocumentTextIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  Toolbar,
  Item
} from 'devextreme-react/data-grid'
import 'devextreme/dist/css/dx.light.css'

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const formatCurrencyValue = (value: unknown) => {
  if (value === null || value === undefined) return '—'
  const numeric = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(numeric)) return '—'
  return pesoFormatter.format(numeric)
}

interface Reading {
  id: number
  shiftNumber: string
  shiftId: number
  type: 'X' | 'Z'
  readingNumber: number
  readingTime: string
  cashierName: string
  locationName: string
  grossSales: number
  netSales: number
  totalDiscounts: number
  expectedCash: number | null
  transactionCount: number
  reportNumber?: string | null
}

export default function ReadingsHistoryPage() {
  const { data: session } = useSession()
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'X' | 'Z'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchReadings()
  }, [])

  const fetchReadings = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '300' })
      const response = await fetch(`/api/readings/history?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch readings')

      const data = await response.json()
      setReadings(Array.isArray(data.readings) ? data.readings : [])
    } catch (error: any) {
      console.error('Error fetching readings:', error)
      toast.error('Failed to load readings history')
    } finally {
      setLoading(false)
    }
  }

  const filteredReadings = readings.filter(reading => {
    // Filter by type
    if (filterType !== 'ALL' && reading.type !== filterType) return false

    // Filter by search term
    if (
      searchTerm &&
      ![
        reading.shiftNumber,
        reading.cashierName,
        reading.locationName,
        reading.reportNumber || '',
      ]
        .some(value => value.toLowerCase().includes(searchTerm.toLowerCase()))
    ) {
      return false
    }

    // Filter by date range
    if (dateFrom && new Date(reading.readingTime) < new Date(dateFrom)) return false
    if (dateTo && new Date(reading.readingTime) > new Date(dateTo + 'T23:59:59')) return false

    return true
  })

  const handlePrint = (reading: Reading) => {
    const url = reading.type === 'X'
      ? `/dashboard/readings/x-reading?shiftId=${reading.shiftId}&print=true`
      : `/dashboard/readings/z-reading?shiftId=${reading.shiftId}&print=true`

    window.open(url, '_blank')
  }

  const handleView = (reading: Reading) => {
    const url = reading.type === 'X'
      ? `/dashboard/readings/x-reading?shiftId=${reading.shiftId}`
      : `/dashboard/readings/z-reading?shiftId=${reading.shiftId}`

    window.open(url, '_blank')
  }

  // Render badge for reading type
  const renderTypeBadge = (data: any) => {
    const isXReading = data.value === 'X'
    return (
      <Badge className={cn(isXReading ? 'bg-blue-600' : 'bg-purple-600', 'text-white')}>
        {data.value} Reading
      </Badge>
    )
  }

  // Render formatted date
  const renderDate = (data: any) => {
    return format(new Date(data.value), 'MMM dd, yyyy hh:mm a')
  }

  // Render currency values
  const renderCurrency = (data: any) => {
    return <span className="font-medium">{formatCurrencyValue(data.value)}</span>
  }

  // Render gross sales with color
  const renderGrossSales = (data: any) => {
    return <span className="font-bold text-green-600">{formatCurrencyValue(data.value)}</span>
  }

  const renderReportNumber = (data: any) => {
    return data.value
      ? <span className="font-medium">{data.value}</span>
      : <span className="text-muted-foreground">—</span>
  }

  // Render action buttons
  const renderActions = (data: any) => {
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleView(data.data)}
          className="h-7 text-xs"
        >
          <DocumentTextIcon className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => handlePrint(data.data)}
          className="h-7 text-xs"
        >
          <PrinterIcon className="h-3 w-3 mr-1" />
          Print
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Readings History</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and print past X and Z readings
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Reading Type Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Reading Type</label>
              <div className="flex gap-2">
                <Button
                  variant={filterType === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('ALL')}
                  className={cn(
                    filterType === 'ALL'
                      ? 'text-white hover:text-white focus-visible:ring-primary/40'
                      : 'text-gray-700 hover:text-gray-900'
                  )}
                >
                  All
                </Button>
                <Button
                  variant={filterType === 'X' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('X')}
                  className={cn(
                    'transition-colors',
                    filterType === 'X'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white hover:text-white focus-visible:ring-blue-400 focus-visible:ring-offset-0'
                      : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800'
                  )}
                >
                  X Reading
                </Button>
                <Button
                  variant={filterType === 'Z' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('Z')}
                  className={cn(
                    'transition-colors',
                    filterType === 'Z'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white hover:text-white focus-visible:ring-purple-400 focus-visible:ring-offset-0'
                      : 'border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800'
                  )}
                >
                  Z Reading
                </Button>
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Shift #, cashier, location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-2">From Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-2">To Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                setFilterType('ALL')
                setDateFrom('')
                setDateTo('')
              }}
            >
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReadings}
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading readings...</p>
            </div>
          ) : (
            <DataGrid
              dataSource={filteredReadings}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              hoverStateEnabled={true}
              keyExpr="id"
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              noDataText={
                searchTerm || dateFrom || dateTo || filterType !== 'ALL'
                  ? 'No readings found. Try adjusting your filters.'
                  : 'No readings have been generated yet.'
              }
            >
              <Paging defaultPageSize={10} />
              <Pager
                visible={true}
                displayMode="full"
                allowedPageSizes={[5, 10, 20, 50, 100]}
                showPageSizeSelector={true}
                showInfo={true}
                showNavigationButtons={true}
              />
              <FilterRow visible={false} />
              <HeaderFilter visible={false} />

              <Column
                dataField="type"
                caption="Type"
                width={120}
                alignment="center"
                cellRender={renderTypeBadge}
              />
              <Column
                dataField="readingNumber"
                caption="Reading #"
                width={110}
                alignment="center"
                dataType="number"
              />
              <Column
                dataField="shiftNumber"
                caption="Shift #"
                width={100}
              />
              <Column
                dataField="reportNumber"
                caption="Report #"
                width={120}
                cellRender={renderReportNumber}
              />
              <Column
                dataField="readingTime"
                caption="Date & Time"
                width={180}
                cellRender={renderDate}
                dataType="datetime"
              />
              <Column
                dataField="cashierName"
                caption="Cashier"
                width={120}
              />
              <Column
                dataField="locationName"
                caption="Location"
                width={150}
              />
              <Column
                dataField="grossSales"
                caption="Gross Sales"
                width={130}
                cellRender={renderGrossSales}
                dataType="number"
              />
              <Column
                dataField="netSales"
                caption="Net Sales"
                width={120}
                cellRender={renderCurrency}
                dataType="number"
              />
              <Column
                dataField="totalDiscounts"
                caption="Discounts"
                width={110}
                cellRender={renderCurrency}
                dataType="number"
              />
              <Column
                dataField="transactionCount"
                caption="Transactions"
                width={110}
                alignment="center"
                dataType="number"
              />
              <Column
                caption="Actions"
                width={150}
                cellRender={renderActions}
                allowSorting={false}
                allowFiltering={false}
              />

              <Export enabled={true} allowExportSelectedData={false} />
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
