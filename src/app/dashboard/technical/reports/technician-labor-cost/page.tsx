'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import {
  RefreshCw,
  DollarSign,
  Users,
  FileText,
  Calendar,
  TrendingUp,
  Download,
  Printer,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  Pager,
  Paging,
  SearchPanel,
  Sorting,
  HeaderFilter,
  LoadPanel,
  Scrolling,
  Summary,
  TotalItem,
  GroupPanel,
  Grouping,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface TechnicianSummary {
  technicianId: number
  employeeCode: string
  technicianName: string
  position: string
  specialization: string
  totalJobsCompleted: number
  totalLaborCost: number
}

interface DetailedJobOrder {
  id: number
  jobOrderNumber: string
  completedDate: string
  technicianId: number | null
  employeeCode: string
  technicianName: string
  position: string
  specialization: string
  locationId: number
  locationName: string
  serviceTypeName: string
  customerName: string
  laborCost: number
  itemDescription: string
}

interface ReportTotals {
  grandTotalLaborCost: number
  grandTotalJobs: number
  techniciansCount: number
}

interface Technician {
  id: number
  firstName: string
  lastName: string
  employeeCode: string
}

interface Location {
  id: number
  name: string
}

// Pre-defined date ranges
const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Custom', value: 'custom' },
]

function getDateRange(preset: string): { startDate: string; endDate: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case 'today':
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      }
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        startDate: yesterday.toISOString().split('T')[0],
        endDate: yesterday.toISOString().split('T')[0],
      }
    }
    case 'this_week': {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay()) // Sunday
      return {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      }
    }
    case 'last_week': {
      const startOfLastWeek = new Date(today)
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 7)
      const endOfLastWeek = new Date(startOfLastWeek)
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6)
      return {
        startDate: startOfLastWeek.toISOString().split('T')[0],
        endDate: endOfLastWeek.toISOString().split('T')[0],
      }
    }
    case 'this_month':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      }
    case 'last_month': {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        startDate: firstDayLastMonth.toISOString().split('T')[0],
        endDate: lastDayLastMonth.toISOString().split('T')[0],
      }
    }
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3)
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1)
      return {
        startDate: startOfQuarter.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      }
    }
    case 'this_year':
      return {
        startDate: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      }
    default:
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      }
  }
}

export default function TechnicianLaborCostReportPage() {
  const { can, user } = usePermissions()
  const [summaryData, setSummaryData] = useState<TechnicianSummary[]>([])
  const [detailedData, setDetailedData] = useState<DetailedJobOrder[]>([])
  const [totals, setTotals] = useState<ReportTotals>({
    grandTotalLaborCost: 0,
    grandTotalJobs: 0,
    techniciansCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  // Filter state
  const [datePreset, setDatePreset] = useState('this_month')
  const [dateRange, setDateRange] = useState(() => getDateRange('this_month'))
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')

  const summaryGridRef = useRef<DataGrid>(null)
  const detailedGridRef = useRef<DataGrid>(null)

  useEffect(() => {
    if (!user) return

    if (!can(PERMISSIONS.TECHNICIAN_VIEW)) {
      toast.error('You do not have permission to view this report')
      setLoading(false)
      return
    }

    fetchFilterData()
    fetchReportData()
  }, [user])

  const fetchFilterData = async () => {
    try {
      const [techRes, locRes] = await Promise.all([
        fetch('/api/technicians?limit=500'),
        fetch('/api/locations'),
      ])

      if (techRes.ok) {
        const data = await techRes.json()
        setTechnicians(data.technicians || data.data || [])
      }
      if (locRes.ok) {
        const data = await locRes.json()
        setLocations(data.data || data.locations || data || [])
      }
    } catch (error) {
      console.error('Error fetching filter data:', error)
    }
  }

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange.endDate) params.append('endDate', dateRange.endDate)
      if (selectedTechnician) params.append('technicianId', selectedTechnician)
      if (selectedLocation) params.append('locationId', selectedLocation)

      const response = await fetch(`/api/reports/technician-labor-cost?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch report data')
      }

      const data = await response.json()
      setSummaryData(data.summary || [])
      setDetailedData(data.detailed || [])
      setTotals(data.totals || { grandTotalLaborCost: 0, grandTotalJobs: 0, techniciansCount: 0 })
    } catch (error) {
      console.error('Error fetching report data:', error)
      toast.error('Failed to fetch report data')
    } finally {
      setLoading(false)
    }
  }

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      setDateRange(getDateRange(preset))
    }
  }

  const handleApplyFilter = () => {
    fetchReportData()
    toast.success('Report updated')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchReportData()
    setRefreshing(false)
    toast.success('Report refreshed')
  }

  const onExportingToExcel = (gridRef: React.RefObject<DataGrid>) => {
    if (!gridRef.current) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Technician Labor Cost')

    exportToExcel({
      component: gridRef.current.instance,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Technician_Labor_Cost_${dateRange.startDate}_to_${dateRange.endDate}.xlsx`
        )
      })
    })
  }

  const onExportingToPDF = (gridRef: React.RefObject<DataGrid>) => {
    if (!gridRef.current) return

    const doc = new jsPDF('l', 'mm', 'a4')

    exportToPDF({
      jsPDFDocument: doc,
      component: gridRef.current.instance,
    }).then(() => {
      doc.save(`Technician_Labor_Cost_${dateRange.startDate}_to_${dateRange.endDate}.pdf`)
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (value: number) => {
    return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const currencyCellRender = (data: any) => {
    const value = data.value || 0
    return <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(value)}</span>
  }

  const dateCellRender = (data: any) => {
    if (!data.value) return <span className="text-gray-400">-</span>
    return (
      <span className="text-gray-900 dark:text-gray-100">
        {new Date(data.value).toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin dark:border-amber-900 dark:border-t-amber-400"></div>
          <p className="mt-4 text-amber-700 font-medium dark:text-amber-300">Loading report data...</p>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.TECHNICIAN_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view this report.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 bg-clip-text text-transparent dark:from-amber-100 dark:via-orange-300 dark:to-amber-100">
                Technician Labor Cost Report
              </h1>
            </div>
            <p className="text-amber-700 text-sm sm:text-base dark:text-amber-300">
              Labor cost collected from completed job orders grouped by technician
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => onExportingToExcel(viewMode === 'summary' ? summaryGridRef : detailedGridRef)}
              disabled={summaryData.length === 0 && detailedData.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              onClick={() => onExportingToPDF(viewMode === 'summary' ? summaryGridRef : detailedGridRef)}
              disabled={summaryData.length === 0 && detailedData.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all hover:border-red-500 hover:text-red-700 dark:hover:text-red-400"
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Filter Card */}
        <Card className="shadow-md border-amber-200 mb-6 dark:bg-amber-900/30 dark:border-amber-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              {/* Date Preset */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Period
                </Label>
                <Select value={datePreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Start Date
                </Label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => {
                    setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                    setDatePreset('custom')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                />
              </div>

              {/* End Date */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  End Date
                </Label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => {
                    setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                    setDatePreset('custom')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                />
              </div>

              {/* Technician Filter */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Technician
                </Label>
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600">
                    <SelectValue placeholder="All Technicians" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Technicians</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id.toString()}>
                        {tech.firstName} {tech.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Location
                </Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Locations</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Apply Button */}
              <div>
                <Button
                  onClick={handleApplyFilter}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Apply Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg dark:bg-green-900/30">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Labor Cost</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(totals.grandTotalLaborCost)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                  <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Completed Jobs</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {totals.grandTotalJobs}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Technicians</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {totals.techniciansCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === 'summary' ? 'default' : 'outline'}
            onClick={() => setViewMode('summary')}
            className={viewMode === 'summary' ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            Summary by Technician
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'outline'}
            onClick={() => setViewMode('detailed')}
            className={viewMode === 'detailed' ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            Detailed Job Orders
          </Button>
        </div>
      </div>

      {/* DataGrid Card */}
      <Card className="shadow-xl border-amber-200 overflow-hidden dark:bg-amber-900/30 dark:border-amber-700">
        <CardHeader className="border-b border-amber-200 dark:border-amber-700">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {viewMode === 'summary' ? 'Labor Cost by Technician' : 'Completed Job Orders'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {viewMode === 'summary' ? (
              <DataGrid
                ref={summaryGridRef}
                dataSource={summaryData}
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={false}
                className="dx-card"
                width="100%"
                keyExpr="technicianId"
              >
                <LoadPanel enabled={true} />
                <Scrolling mode="standard" />
                <Paging defaultPageSize={20} />
                <Pager
                  visible={true}
                  showPageSizeSelector={true}
                  allowedPageSizes={[10, 20, 50, 100]}
                  showInfo={true}
                  showNavigationButtons={true}
                />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <SearchPanel visible={true} width={300} placeholder="Search technicians..." />
                <Sorting mode="multiple" />
                <Export enabled={true} allowExportSelectedData={false} />

                <Column dataField="employeeCode" caption="Code" minWidth={100} />
                <Column dataField="technicianName" caption="Technician Name" minWidth={180} />
                <Column dataField="position" caption="Position" minWidth={120} />
                <Column dataField="specialization" caption="Specialization" minWidth={150} />
                <Column
                  dataField="totalJobsCompleted"
                  caption="Jobs Completed"
                  minWidth={130}
                  dataType="number"
                  alignment="center"
                />
                <Column
                  dataField="totalLaborCost"
                  caption="Total Labor Cost"
                  minWidth={160}
                  dataType="number"
                  cellRender={currencyCellRender}
                  sortOrder="desc"
                />

                <Summary>
                  <TotalItem column="totalJobsCompleted" summaryType="sum" displayFormat="Total: {0}" />
                  <TotalItem
                    column="totalLaborCost"
                    summaryType="sum"
                    valueFormat={{ type: 'currency', currency: 'PHP' }}
                    displayFormat="Total: ₱{0}"
                  />
                </Summary>
              </DataGrid>
            ) : (
              <DataGrid
                ref={detailedGridRef}
                dataSource={detailedData}
                showBorders={true}
                showRowLines={true}
                showColumnLines={true}
                rowAlternationEnabled={true}
                allowColumnReordering={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={false}
                className="dx-card"
                width="100%"
                keyExpr="id"
              >
                <LoadPanel enabled={true} />
                <Scrolling mode="standard" />
                <Paging defaultPageSize={20} />
                <Pager
                  visible={true}
                  showPageSizeSelector={true}
                  allowedPageSizes={[10, 20, 50, 100]}
                  showInfo={true}
                  showNavigationButtons={true}
                />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <SearchPanel visible={true} width={300} placeholder="Search job orders..." />
                <Sorting mode="multiple" />
                <Export enabled={true} allowExportSelectedData={false} />
                <GroupPanel visible={true} />
                <Grouping autoExpandAll={true} />

                <Column dataField="jobOrderNumber" caption="JO Number" minWidth={130} />
                <Column
                  dataField="completedDate"
                  caption="Completed Date"
                  minWidth={130}
                  dataType="date"
                  cellRender={dateCellRender}
                  sortOrder="desc"
                />
                <Column dataField="technicianName" caption="Technician" minWidth={160} groupIndex={0} />
                <Column dataField="employeeCode" caption="Code" minWidth={100} />
                <Column dataField="locationName" caption="Location" minWidth={130} />
                <Column dataField="serviceTypeName" caption="Service Type" minWidth={150} />
                <Column dataField="customerName" caption="Customer" minWidth={150} />
                <Column dataField="itemDescription" caption="Item" minWidth={200} />
                <Column
                  dataField="laborCost"
                  caption="Labor Cost"
                  minWidth={130}
                  dataType="number"
                  cellRender={currencyCellRender}
                />

                <Summary>
                  <TotalItem
                    column="laborCost"
                    summaryType="sum"
                    valueFormat={{ type: 'currency', currency: 'PHP' }}
                    displayFormat="Grand Total: ₱{0}"
                  />
                </Summary>
              </DataGrid>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Note about commission */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> This report shows labor costs from <strong>completed</strong> job orders only.
          Use this data to calculate technician commissions or performance-based wages.
          Job orders that are pending, in progress, or marked as unrepairable with zero labor cost are excluded.
        </p>
      </div>
    </div>
  )
}
