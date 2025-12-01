'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Users, Award, Clock, TrendingUp, CheckCircle, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  ColumnChooser,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface TechnicianPerformance {
  id: number
  employeeCode: string
  firstName: string
  lastName: string
  fullName: string
  position: string
  specialization: string
  isAvailable: boolean
  isActive: boolean
  totalJobsCompleted: number
  currentJobCount: number
  averageRepairTime: number | null
  customerSatisfaction: number | null
  onTimeCompletionRate: number | null
  firstTimeFixRate: number | null
  jobsThisPeriod: number
  revenueGenerated: number
}

interface PerformanceStats {
  totalTechnicians: number
  activeTechnicians: number
  totalJobsCompleted: number
  avgRepairTime: number
  avgSatisfaction: number
  avgOnTimeRate: number
}

export default function TechnicianPerformanceReportPage() {
  const { can, user } = usePermissions()
  const [performanceData, setPerformanceData] = useState<TechnicianPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<PerformanceStats>({
    totalTechnicians: 0,
    activeTechnicians: 0,
    totalJobsCompleted: 0,
    avgRepairTime: 0,
    avgSatisfaction: 0,
    avgOnTimeRate: 0,
  })
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })
  const dataGridRef = useRef<DataGrid>(null)

  useEffect(() => {
    if (!user) return

    if (!can(PERMISSIONS.TECHNICIAN_VIEW)) {
      toast.error('You do not have permission to view technician performance')
      setLoading(false)
      return
    }
    fetchPerformanceData()
  }, [user])

  const fetchPerformanceData = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/technicians/performance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      )

      if (!response.ok) {
        // Fallback to regular technicians API if performance endpoint doesn't exist
        const techResponse = await fetch('/api/technicians')
        const techData = await techResponse.json()

        if (techResponse.ok) {
          const technicians = Array.isArray(techData) ? techData : techData.technicians || []
          const performanceList: TechnicianPerformance[] = technicians.map((tech: any) => ({
            id: tech.id,
            employeeCode: tech.employeeCode,
            firstName: tech.firstName,
            lastName: tech.lastName,
            fullName: `${tech.firstName} ${tech.lastName}`,
            position: tech.position,
            specialization: tech.specialization || tech.primarySpecialization || '-',
            isAvailable: tech.isAvailable ?? true,
            isActive: tech.isActive ?? true,
            totalJobsCompleted: tech.totalJobsCompleted || 0,
            currentJobCount: tech.currentJobCount || 0,
            averageRepairTime: tech.averageRepairTime || null,
            customerSatisfaction: null,
            onTimeCompletionRate: null,
            firstTimeFixRate: null,
            jobsThisPeriod: tech.totalJobsCompleted || 0,
            revenueGenerated: 0,
          }))

          setPerformanceData(performanceList)
          calculateStats(performanceList)
        } else {
          toast.error('Failed to fetch technician data')
        }
      } else {
        const data = await response.json()
        const performanceList = Array.isArray(data) ? data : data.performance || []
        setPerformanceData(performanceList)
        calculateStats(performanceList)
      }
    } catch (error) {
      console.error('Error fetching performance data:', error)
      toast.error('Failed to fetch performance data')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data: TechnicianPerformance[]) => {
    const active = data.filter(t => t.isActive).length
    const totalJobs = data.reduce((sum, t) => sum + (t.totalJobsCompleted || 0), 0)
    const avgTime = data.length > 0
      ? data.reduce((sum, t) => sum + (t.averageRepairTime || 0), 0) / data.filter(t => t.averageRepairTime).length || 0
      : 0
    const avgSat = data.length > 0
      ? data.reduce((sum, t) => sum + (t.customerSatisfaction || 0), 0) / data.filter(t => t.customerSatisfaction).length || 0
      : 0
    const avgOnTime = data.length > 0
      ? data.reduce((sum, t) => sum + (t.onTimeCompletionRate || 0), 0) / data.filter(t => t.onTimeCompletionRate).length || 0
      : 0

    setStats({
      totalTechnicians: data.length,
      activeTechnicians: active,
      totalJobsCompleted: totalJobs,
      avgRepairTime: avgTime,
      avgSatisfaction: avgSat,
      avgOnTimeRate: avgOnTime,
    })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPerformanceData()
    setRefreshing(false)
    toast.success('Performance data refreshed')
  }

  const handleDateChange = () => {
    fetchPerformanceData()
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Technician Performance')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Technician_Performance_${dateRange.startDate}_to_${dateRange.endDate}.xlsx`
        )
      })
    })
    e.cancel = true
  }

  const onExportingToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4')

    if (dataGridRef.current) {
      exportToPDF({
        jsPDFDocument: doc,
        component: dataGridRef.current.instance,
      }).then(() => {
        doc.save(`Technician_Performance_${dateRange.startDate}_to_${dateRange.endDate}.pdf`)
      })
    }
  }

  const statusCellRender = (data: any) => {
    const isAvailable = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isAvailable
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }`}
        >
          {isAvailable ? 'Available' : 'Busy'}
        </span>
      </div>
    )
  }

  const ratingCellRender = (data: any) => {
    const rating = data.value
    if (!rating) return <span className="text-gray-400">-</span>
    return (
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        <span className="text-gray-900 dark:text-gray-100">{rating.toFixed(1)}</span>
      </div>
    )
  }

  const percentageCellRender = (data: any) => {
    const value = data.value
    if (!value) return <span className="text-gray-400">-</span>
    return (
      <span className="text-gray-900 dark:text-gray-100">{value.toFixed(1)}%</span>
    )
  }

  const hoursCellRender = (data: any) => {
    const value = data.value
    if (!value) return <span className="text-gray-400">-</span>
    return (
      <span className="text-gray-900 dark:text-gray-100">{value.toFixed(1)} hrs</span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-950 dark:via-orange-900 dark:to-amber-950 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin dark:border-amber-900 dark:border-t-amber-400"></div>
          <p className="mt-4 text-amber-700 font-medium dark:text-amber-300">Loading performance data...</p>
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
              <TrendingUp className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-900 via-orange-800 to-amber-900 bg-clip-text text-transparent dark:from-amber-100 dark:via-orange-300 dark:to-amber-100">
                Technician Performance
              </h1>
            </div>
            <p className="text-amber-700 text-sm sm:text-base dark:text-amber-300">
              Performance metrics and analytics for technical service employees
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
              onClick={onExportingToPDF}
              disabled={performanceData.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Export to PDF
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card className="shadow-md border-amber-200 mb-6 dark:bg-amber-900/30 dark:border-amber-700">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[150px]">
                <Label htmlFor="startDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Date
                </Label>
                <input
                  type="date"
                  id="startDate"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label htmlFor="endDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  End Date
                </Label>
                <input
                  type="date"
                  id="endDate"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <Button
                onClick={handleDateChange}
                variant="default"
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Apply Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                  <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Technicians</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalTechnicians}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Active</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.activeTechnicians}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Jobs Completed</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalJobsCompleted}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Avg Repair Time</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.avgRepairTime > 0 ? `${stats.avgRepairTime.toFixed(1)}h` : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
                  <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Avg Satisfaction</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.avgSatisfaction > 0 ? stats.avgSatisfaction.toFixed(1) : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 dark:bg-amber-900/30 dark:border-amber-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
                  <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">On-Time Rate</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.avgOnTimeRate > 0 ? `${stats.avgOnTimeRate.toFixed(1)}%` : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DataGrid Card */}
      <Card className="shadow-xl border-amber-200 overflow-hidden dark:bg-amber-900/30 dark:border-amber-700">
        <CardHeader className="border-b border-amber-200 dark:border-amber-700">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataGrid
              ref={dataGridRef}
              dataSource={performanceData}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              onExporting={onExporting}
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
              <SearchPanel
                visible={true}
                width={300}
                placeholder="Search technicians..."
              />
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />
              <ColumnChooser enabled={true} mode="select" />

              <Column
                dataField="employeeCode"
                caption="Code"
                minWidth={100}
              />
              <Column
                dataField="fullName"
                caption="Technician"
                minWidth={180}
                calculateCellValue={(data: any) => `${data.firstName} ${data.lastName}`}
              />
              <Column
                dataField="position"
                caption="Position"
                minWidth={130}
              />
              <Column
                dataField="specialization"
                caption="Specialization"
                minWidth={150}
              />
              <Column
                dataField="isAvailable"
                caption="Status"
                minWidth={100}
                alignment="center"
                cellRender={statusCellRender}
              />
              <Column
                dataField="totalJobsCompleted"
                caption="Jobs Completed"
                minWidth={130}
                dataType="number"
                alignment="center"
              />
              <Column
                dataField="currentJobCount"
                caption="Current Jobs"
                minWidth={120}
                dataType="number"
                alignment="center"
              />
              <Column
                dataField="averageRepairTime"
                caption="Avg Repair Time"
                minWidth={140}
                cellRender={hoursCellRender}
              />
              <Column
                dataField="customerSatisfaction"
                caption="Satisfaction"
                minWidth={120}
                cellRender={ratingCellRender}
              />
              <Column
                dataField="onTimeCompletionRate"
                caption="On-Time Rate"
                minWidth={130}
                cellRender={percentageCellRender}
              />
              <Column
                dataField="firstTimeFixRate"
                caption="First Fix Rate"
                minWidth={130}
                cellRender={percentageCellRender}
              />

              <Summary>
                <TotalItem
                  column="totalJobsCompleted"
                  summaryType="sum"
                  displayFormat="Total: {0}"
                />
              </Summary>
            </DataGrid>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
