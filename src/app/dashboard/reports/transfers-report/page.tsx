"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

// DevExtreme imports
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Export,
  ColumnChooser,
  StateStoring,
  Selection,
  Toolbar,
  Item,
  MasterDetail,
  Sorting,
  Scrolling,
  LoadPanel as DxLoadPanel,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid'
import { SelectBox } from 'devextreme-react/select-box'
import { DateBox } from 'devextreme-react/date-box'
import CustomStore from 'devextreme/data/custom_store'

// DevExtreme CSS
import 'devextreme/dist/css/dx.light.css'

interface Location {
  id: number
  name: string
}

export default function TransfersReportPage() {
  const dataGridRef = useRef<DataGrid>(null)
  const [locations, setLocations] = useState<Location[]>([])

  // Filter states with default date range (last 30 days)
  const today = new Date()
  const thirtyDaysAgo = subDays(today, 29)
  const [fromLocationId, setFromLocationId] = useState<number | null>(null)
  const [toLocationId, setToLocationId] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Date>(thirtyDaysAgo)
  const [endDate, setEndDate] = useState<Date>(today)
  const [activeDateFilter, setActiveDateFilter] = useState<string>("last-30-days")

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      const data = await response.json()
      setLocations(data.locations || data || [])
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  // Custom Store for server-side data fetching
  const dataSource = new CustomStore({
    key: 'id',
    load: async (loadOptions) => {
      try {
        const params = new URLSearchParams()

        // Pagination
        const page = Math.floor((loadOptions.skip || 0) / (loadOptions.take || 50)) + 1
        const limit = loadOptions.take || 50
        params.append("page", page.toString())
        params.append("limit", limit.toString())

        // Filters
        if (fromLocationId) params.append("fromLocationId", fromLocationId.toString())
        if (toLocationId) params.append("toLocationId", toLocationId.toString())
        if (status) params.append("status", status)
        if (startDate) params.append("startDate", format(startDate, 'yyyy-MM-dd'))
        if (endDate) params.append("endDate", format(endDate, 'yyyy-MM-dd'))

        const response = await fetch(`/api/reports/transfers?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to fetch transfers')
        }

        const data = await response.json()

        return {
          data: data.transfers || [],
          totalCount: data.pagination?.totalCount || 0,
        }
      } catch (error) {
        console.error("Failed to fetch transfers:", error)
        return {
          data: [],
          totalCount: 0,
        }
      }
    },
  })

  const setDateFilter = (filter: string) => {
    const today = new Date()
    let start: Date
    let end: Date = today

    switch (filter) {
      case 'today':
        start = end = today
        break
      case 'yesterday':
        start = end = subDays(today, 1)
        break
      case 'this-week':
        start = startOfWeek(today, { weekStartsOn: 1 })
        end = endOfWeek(today, { weekStartsOn: 1 })
        break
      case 'last-week':
        const lastWeek = subDays(today, 7)
        start = startOfWeek(lastWeek, { weekStartsOn: 1 })
        end = endOfWeek(lastWeek, { weekStartsOn: 1 })
        break
      case 'this-month':
        start = startOfMonth(today)
        end = endOfMonth(today)
        break
      case 'last-month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        start = startOfMonth(lastMonth)
        end = endOfMonth(lastMonth)
        break
      case 'this-year':
        start = startOfYear(today)
        end = endOfYear(today)
        break
      case 'last-7-days':
        start = subDays(today, 6)
        break
      case 'last-30-days':
        start = subDays(today, 29)
        break
      case 'last-90-days':
        start = subDays(today, 89)
        break
      default:
        start = thirtyDaysAgo
    }

    setStartDate(start)
    setEndDate(end)
    setActiveDateFilter(filter)

    // Refresh the grid
    refreshGrid()
  }

  const handleApplyFilters = () => {
    refreshGrid()
  }

  const handleReset = () => {
    setFromLocationId(null)
    setToLocationId(null)
    setStatus(null)
    setStartDate(thirtyDaysAgo)
    setEndDate(today)
    setActiveDateFilter("last-30-days")
    refreshGrid()
  }

  const refreshGrid = () => {
    dataGridRef.current?.instance.refresh()
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "#6b7280",
      SUBMITTED: "#3b82f6",
      CHECKED: "#06b6d4",
      APPROVED: "#10b981",
      SENT: "#eab308",
      IN_TRANSIT: "#f97316",
      ARRIVED: "#6366f1",
      VERIFYING: "#a855f7",
      VERIFIED: "#a855f7",
      COMPLETED: "#10b981",
      CANCELLED: "#ef4444",
    }
    return colors[status] || "#6b7280"
  }

  // Master Detail Template for Transfer Items
  const renderDetailTemplate = (props: any) => {
    const transfer = props.data

    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900">
        <div className="space-y-4">
          {/* Transfer Timeline */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Transfer Timeline</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Submitted:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{transfer.submittedAt || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Checked:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{transfer.checkedAt || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Approved:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{transfer.approvedAt || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Sent:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{transfer.sentAt || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Arrived:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{transfer.arrivedAt || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Verified:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{transfer.verifiedAt || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Completed:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{transfer.completedAt || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Transfer Items */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Transfer Items</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-300">Product</th>
                    <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-300">Variation</th>
                    <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-300">SKU</th>
                    <th className="text-right p-2 font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {transfer.items && transfer.items.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-2 text-gray-800 dark:text-gray-200">{item.productName}</td>
                      <td className="p-2 text-gray-800 dark:text-gray-200">{item.variationName}</td>
                      <td className="p-2 text-gray-700 dark:text-gray-400">{item.sku}</td>
                      <td className="p-2 text-right font-medium text-gray-900 dark:text-gray-100">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Notes</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{transfer.notes}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Stock Transfers Report</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive view of all stock transfers between locations
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Date Filters */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Quick Date Filters</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'this-week', label: 'This Week' },
                { value: 'last-week', label: 'Last Week' },
                { value: 'this-month', label: 'This Month' },
                { value: 'last-month', label: 'Last Month' },
                { value: 'this-year', label: 'This Year' },
                { value: 'last-7-days', label: 'Last 7 Days' },
                { value: 'last-30-days', label: 'Last 30 Days' },
                { value: 'last-90-days', label: 'Last 90 Days' },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  variant={activeDateFilter === filter.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(filter.value)}
                  className={activeDateFilter === filter.value ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* From Location Filter */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">From Location</label>
              <SelectBox
                dataSource={locations}
                displayExpr="name"
                valueExpr="id"
                value={fromLocationId}
                onValueChanged={(e) => setFromLocationId(e.value)}
                placeholder="All Locations"
                showClearButton={true}
                stylingMode="outlined"
              />
            </div>

            {/* To Location Filter */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">To Location</label>
              <SelectBox
                dataSource={locations}
                displayExpr="name"
                valueExpr="id"
                value={toLocationId}
                onValueChanged={(e) => setToLocationId(e.value)}
                placeholder="All Locations"
                showClearButton={true}
                stylingMode="outlined"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Status</label>
              <SelectBox
                dataSource={[
                  'draft', 'submitted', 'checked', 'approved', 'sent',
                  'in_transit', 'arrived', 'verifying', 'verified', 'completed', 'cancelled'
                ]}
                value={status}
                onValueChanged={(e) => setStatus(e.value)}
                placeholder="All Statuses"
                showClearButton={true}
                stylingMode="outlined"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Start Date</label>
              <DateBox
                type="date"
                value={startDate}
                onValueChanged={(e) => {
                  setStartDate(e.value)
                  setActiveDateFilter("")
                }}
                displayFormat="MM/dd/yyyy"
                stylingMode="outlined"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">End Date</label>
              <DateBox
                type="date"
                value={endDate}
                onValueChanged={(e) => {
                  setEndDate(e.value)
                  setActiveDateFilter("")
                }}
                displayFormat="MM/dd/yyyy"
                stylingMode="outlined"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApplyFilters} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleReset} className="border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card>
        <CardContent className="pt-6">
          <DataGrid
            ref={dataGridRef}
            dataSource={dataSource}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            hoverStateEnabled={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
            columnAutoWidth={false}
            wordWrapEnabled={false}
            remoteOperations={{
              paging: true,
              filtering: false,
              sorting: false,
            }}
          >
            <StateStoring enabled={true} type="localStorage" storageKey="transfers-report-grid-state" />
            <DxLoadPanel enabled={true} />
            <Scrolling mode="virtual" rowRenderingMode="virtual" />
            <Paging enabled={true} defaultPageSize={50} />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search transfers..." />
            <ColumnChooser enabled={true} mode="select" />
            <Export enabled={true} allowExportSelectedData={true} />
            <Selection mode="multiple" showCheckBoxesMode="always" />
            <Sorting mode="none" />

            <Column
              dataField="transferNumber"
              caption="Transfer #"
              width={140}
              cellRender={(data) => (
                <span className="font-medium text-blue-600 dark:text-blue-400">{data.value}</span>
              )}
            />

            <Column
              dataField="fromLocation"
              caption="From Location"
              width={150}
            />

            <Column
              dataField="toLocation"
              caption="To Location"
              width={150}
            />

            <Column
              dataField="status"
              caption="Status"
              width={120}
              cellRender={(data) => (
                <span
                  className="px-2 py-1 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: `${getStatusColor(data.value)}20`,
                    color: getStatusColor(data.value),
                  }}
                >
                  {data.value}
                </span>
              )}
            />

            <Column
              dataField="createdAt"
              caption="Created Date"
              dataType="date"
              width={120}
            />

            <Column
              dataField="itemCount"
              caption="Items"
              dataType="number"
              width={80}
              alignment="right"
            />

            <Column
              dataField="totalQuantity"
              caption="Total Qty"
              dataType="number"
              width={100}
              alignment="right"
            />

            <Column
              dataField="stockDeducted"
              caption="Stock Deducted"
              width={130}
              alignment="center"
              cellRender={(data) => (
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    data.value ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {data.value ? "Yes" : "No"}
                </span>
              )}
            />

            <Summary>
              <TotalItem column="transferNumber" summaryType="count" displayFormat="Total: {0}" />
              <TotalItem column="totalQuantity" summaryType="sum" displayFormat="{0}" />
            </Summary>

            <MasterDetail enabled={true} render={renderDetailTemplate} />

            <Toolbar>
              <Item name="searchPanel" />
              <Item name="exportButton" />
              <Item name="columnChooserButton" />
              <Item location="after">
                <Button
                  onClick={refreshGrid}
                  size="sm"
                  className="ml-2 bg-teal-600 hover:bg-teal-700 text-white font-medium border-2 border-teal-700 hover:border-teal-800 shadow-sm"
                >
                  Refresh
                </Button>
              </Item>
            </Toolbar>
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  )
}
