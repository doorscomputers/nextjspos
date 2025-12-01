'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { RefreshCw, Wrench, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Editing,
  Popup,
  Form as DxForm,
  RequiredRule,
  PatternRule,
  RangeRule,
  ColumnChooser,
} from 'devextreme-react/data-grid'
import { Item } from 'devextreme-react/form'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'
import 'devextreme/dist/css/dx.light.css'

interface RepairServiceType {
  id: number
  code: string
  name: string
  description: string | null
  category: string
  standardPrice: number
  laborCostPerHour: number
  estimatedHours: number
  warrantyPeriodDays: number
  isCoveredByWarranty: boolean
  isActive: boolean
  createdAt: string
}

export default function ServiceTypesPage() {
  const { can } = usePermissions()
  const [serviceTypes, setServiceTypes] = useState<RepairServiceType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const dataGridRef = useRef<DataGrid>(null)

  useEffect(() => {
    if (!can(PERMISSIONS.SERVICE_TYPE_VIEW)) {
      toast.error('You do not have permission to view service types')
      return
    }
    fetchServiceTypes()
  }, [can])

  const fetchServiceTypes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/service-types')
      const data = await response.json()
      if (response.ok) {
        setServiceTypes(Array.isArray(data) ? data : data.serviceTypes || [])
      } else {
        toast.error(data.error || 'Failed to fetch service types')
      }
    } catch (error) {
      console.error('Error fetching service types:', error)
      toast.error('Failed to fetch service types')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchServiceTypes()
    setRefreshing(false)
    toast.success('Service types refreshed')
  }

  const onExporting = (e: any) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Service Types')

    exportToExcel({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(
          new Blob([buffer], { type: 'application/octet-stream' }),
          `Service_Types_${new Date().toISOString().split('T')[0]}.xlsx`
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
        doc.save(`Service_Types_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    }
  }

  const onRowInserted = async (e: any) => {
    try {
      const response = await fetch('/api/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e.data),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Service type created successfully')
        fetchServiceTypes()
      } else {
        toast.error(data.error || 'Failed to create service type')
        e.cancel = true
      }
    } catch (error) {
      console.error('Error creating service type:', error)
      toast.error('Failed to create service type')
      e.cancel = true
    }
  }

  const onRowUpdated = async (e: any) => {
    try {
      const response = await fetch(`/api/service-types/${e.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e.data),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Service type updated successfully')
        fetchServiceTypes()
      } else {
        toast.error(data.error || 'Failed to update service type')
        e.cancel = true
      }
    } catch (error) {
      console.error('Error updating service type:', error)
      toast.error('Failed to update service type')
      e.cancel = true
    }
  }

  const onRowRemoved = async (e: any) => {
    try {
      const response = await fetch(`/api/service-types/${e.key}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Service type deleted successfully')
      } else {
        toast.error(data.error || 'Failed to delete service type')
        e.cancel = true
      }
    } catch (error) {
      console.error('Error deleting service type:', error)
      toast.error('Failed to delete service type')
      e.cancel = true
    }
  }

  const statusCellRender = (data: any) => {
    const isActive = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isActive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    )
  }

  const warrantyCoverageCellRender = (data: any) => {
    const isCovered = data.value
    return (
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isCovered
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {isCovered ? 'Covered' : 'Not Covered'}
        </span>
      </div>
    )
  }

  const currencyCellRender = (data: any) => {
    return (
      <span className="text-gray-900 dark:text-gray-100">
        ₱{data.value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-900 dark:border-t-blue-400"></div>
          <p className="mt-4 text-slate-600 font-medium dark:text-gray-300">Loading service types...</p>
        </div>
      </div>
    )
  }

  if (!can(PERMISSIONS.SERVICE_TYPE_VIEW)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 font-medium dark:text-red-400">Access denied. You do not have permission to view service types.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Wrench className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-blue-400 dark:to-white">
                Service Types
              </h1>
            </div>
            <p className="text-slate-600 text-sm sm:text-base dark:text-gray-400">
              Manage repair and service type definitions
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
              disabled={serviceTypes.length === 0}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-all dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Export to PDF
            </Button>
          </div>
        </div>
      </div>

      {/* DataGrid Card */}
      <Card className="shadow-xl border-slate-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataGrid
              ref={dataGridRef}
              dataSource={serviceTypes}
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={false}
              onExporting={onExporting}
              onRowInserted={onRowInserted}
              onRowUpdated={onRowUpdated}
              onRowRemoved={onRowRemoved}
              className="dx-card"
              width="100%"
              keyExpr="id"
            >
              <LoadPanel enabled={true} />
              <Scrolling mode="virtual" />
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
                placeholder="Search service types..."
              />
              <Sorting mode="multiple" />
              <Export enabled={true} allowExportSelectedData={false} />
              <ColumnChooser enabled={true} mode="select" />

              {can(PERMISSIONS.SERVICE_TYPE_CREATE) && can(PERMISSIONS.SERVICE_TYPE_EDIT) && can(PERMISSIONS.SERVICE_TYPE_DELETE) && (
                <Editing
                  mode="popup"
                  allowAdding={can(PERMISSIONS.SERVICE_TYPE_CREATE)}
                  allowUpdating={can(PERMISSIONS.SERVICE_TYPE_EDIT)}
                  allowDeleting={can(PERMISSIONS.SERVICE_TYPE_DELETE)}
                  useIcons={true}
                >
                  <Popup
                    title="Service Type Details"
                    showTitle={true}
                    width={700}
                    height="auto"
                  />
                  <DxForm>
                    <Item dataField="code" />
                    <Item dataField="name" />
                    <Item dataField="description" editorType="dxTextArea" />
                    <Item dataField="category" />
                    <Item dataField="standardPrice" />
                    <Item dataField="laborCostPerHour" />
                    <Item dataField="estimatedHours" />
                    <Item dataField="warrantyPeriodDays" />
                    <Item dataField="isCoveredByWarranty" />
                    <Item dataField="isActive" />
                  </DxForm>
                </Editing>
              )}

              <Column
                dataField="code"
                caption="Code"
                minWidth={100}
              >
                <RequiredRule message="Code is required" />
              </Column>
              <Column
                dataField="name"
                caption="Service Name"
                minWidth={200}
              >
                <RequiredRule message="Name is required" />
              </Column>
              <Column
                dataField="description"
                caption="Description"
                minWidth={250}
                visible={false}
                cellRender={(data) => (
                  <span className={data.value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {data.value || '-'}
                  </span>
                )}
              />
              <Column
                dataField="category"
                caption="Category"
                minWidth={150}
              >
                <RequiredRule message="Category is required" />
              </Column>
              <Column
                dataField="standardPrice"
                caption="Standard Price"
                minWidth={130}
                dataType="number"
                cellRender={currencyCellRender}
              >
                <RequiredRule message="Standard price is required" />
                <RangeRule min={0} message="Price must be positive" />
              </Column>
              <Column
                dataField="laborCostPerHour"
                caption="Labor Cost/Hour"
                minWidth={140}
                dataType="number"
                cellRender={currencyCellRender}
              >
                <RequiredRule message="Labor cost is required" />
                <RangeRule min={0} message="Labor cost must be positive" />
              </Column>
              <Column
                dataField="estimatedHours"
                caption="Est. Hours"
                minWidth={100}
                dataType="number"
              >
                <RequiredRule message="Estimated hours is required" />
                <RangeRule min={0} message="Hours must be positive" />
              </Column>
              <Column
                dataField="warrantyPeriodDays"
                caption="Warranty (Days)"
                minWidth={130}
                dataType="number"
              >
                <RequiredRule message="Warranty period is required" />
                <RangeRule min={0} message="Warranty period must be positive" />
              </Column>
              <Column
                dataField="isCoveredByWarranty"
                caption="Warranty Coverage"
                minWidth={150}
                dataType="boolean"
                alignment="center"
                cellRender={warrantyCoverageCellRender}
              />
              <Column
                dataField="isActive"
                caption="Status"
                width={120}
                dataType="boolean"
                alignment="center"
                cellRender={statusCellRender}
              />
            </DataGrid>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
