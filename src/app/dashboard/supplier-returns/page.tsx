"use client"

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserLocations } from '@/hooks/useUserLocations'
import { PERMISSIONS } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import DataGrid, {
  Column,
  Export,
  SearchPanel,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  Scrolling,
  LoadPanel,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver-es'
import { exportDataGrid as exportDataGridToPdf } from 'devextreme/pdf_exporter'
import { exportDataGrid as exportDataGridToExcel } from 'devextreme/excel_exporter'
import { jsPDF } from 'jspdf'
import DxButton from 'devextreme-react/button'
import SelectBox from 'devextreme-react/select-box'
import { Button as UiButton } from '@/components/ui/button'
import { Eye } from 'lucide-react'

interface SupplierReturn {
  id: number
  returnNumber: string
  returnDate: string
  status: string
  returnReason: string
  totalAmount: number
  notes: string | null
  createdAt: string
  supplier: {
    id: number
    name: string
    mobile: string | null
    email: string | null
  }
  items: {
    id: number
    quantity: number
    unitCost: number
    condition: string
  }[]
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
]

export default function SupplierReturnsPage() {
  const { can } = usePermissions()
  const { isLocationUser, loading: locationsLoading } = useUserLocations()
  const router = useRouter()
  const dataGridRef = useRef<DataGrid>(null)

  const [returns, setReturns] = useState<SupplierReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchReturns()
  }, [statusFilter])

  const fetchReturns = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/supplier-returns?${params}`)
      const data = await response.json()

      if (response.ok) {
        setReturns(data.returns || [])
      } else {
        toast.error(data.error || 'Failed to fetch supplier returns')
      }
    } catch (error) {
      console.error('Error fetching supplier returns:', error)
      toast.error('Failed to fetch supplier returns')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '₱0.00'
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount).replace('PHP', '₱')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusDisplay = (status: string) => {
    const config: { [key: string]: { color: string, text: string } } = {
      'pending': { color: '#f59e0b', text: 'Pending' },
      'approved': { color: '#10b981', text: 'Approved' },
    }
    return config[status] || { color: '#6b7280', text: status }
  }

  const getReasonDisplay = (reason: string) => {
    const config: { [key: string]: { color: string, text: string } } = {
      'warranty': { color: '#3b82f6', text: 'Warranty' },
      'defective': { color: '#ef4444', text: 'Defective' },
      'damaged': { color: '#f59e0b', text: 'Damaged' },
    }
    return config[reason] || { color: '#6b7280', text: reason }
  }

  const getConditionSummary = (items: SupplierReturn['items']) => {
    const damaged = items.filter(i => i.condition === 'damaged').length
    const defective = items.filter(i => i.condition === 'defective').length
    const warranty = items.filter(i => i.condition === 'warranty_claim').length

    const parts = []
    if (damaged > 0) parts.push(`${damaged} Damaged`)
    if (defective > 0) parts.push(`${defective} Defective`)
    if (warranty > 0) parts.push(`${warranty} Warranty`)

    return parts.length > 0 ? parts.join(', ') : 'None'
  }

  const onExporting = (e: any) => {
    if (e.format === 'pdf') {
      const doc = new jsPDF()
      exportDataGridToPdf({
        jsPDFDocument: doc,
        component: e.component,
      }).then(() => {
        doc.save(`supplier_returns_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    } else if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Supplier Returns')

      exportDataGridToExcel({
        component: e.component,
        worksheet,
        autoFilterEnabled: true,
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(
            new Blob([buffer], { type: 'application/octet-stream' }),
            `supplier_returns_${new Date().toISOString().split('T')[0]}.xlsx`
          )
        })
      })
    }
    e.cancel = true
  }

  const handleViewReturn = (returnId: number) => {
    router.push(`/dashboard/supplier-returns/${returnId}`)
  }

  if (!can(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view supplier returns.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Supplier Returns
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage returns to suppliers for damaged, defective, or warranty items
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {can(PERMISSIONS.PURCHASE_RETURN_CREATE) && isLocationUser && (
            <DxButton
              text="Create Return (Manual)"
              icon="add"
              type="default"
              stylingMode="contained"
              onClick={() => router.push('/dashboard/supplier-returns/create-manual')}
              disabled={locationsLoading}
            />
          )}
          {can(PERMISSIONS.PURCHASE_RETURN_CREATE) && !isLocationUser && !locationsLoading && (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded border border-amber-200 dark:border-amber-800">
              ⓘ Create button is only available for users assigned to specific locations
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="w-64">
          <SelectBox
            dataSource={STATUS_OPTIONS}
            displayExpr="label"
            valueExpr="value"
            value={statusFilter}
            onValueChanged={(e) => setStatusFilter(e.value)}
            placeholder="Filter by status"
            searchEnabled={false}
          />
        </div>
      </div>

      {/* DataGrid */}
      <DataGrid
        ref={dataGridRef}
        dataSource={returns}
        keyExpr="id"
        showBorders={true}
        showRowLines={true}
        showColumnLines={true}
        rowAlternationEnabled={true}
        hoverStateEnabled={true}
        allowColumnReordering={true}
        allowColumnResizing={true}
        columnAutoWidth={true}
        wordWrapEnabled={false}
        onExporting={onExporting}
      >
        <SearchPanel visible={true} width={300} placeholder="Search..." />
        <FilterRow visible={true} />
        <HeaderFilter visible={true} />
        <Scrolling mode="virtual" />
        <LoadPanel enabled={true} />
        <Paging enabled={true} defaultPageSize={20} />
        <Pager
          visible={true}
          showPageSizeSelector={true}
          allowedPageSizes={[10, 20, 50, 100]}
          showInfo={true}
          showNavigationButtons={true}
        />

        <Export
          enabled={true}
          formats={['xlsx', 'pdf']}
          allowExportSelectedData={false}
        />

        <Toolbar>
          <Item name="searchPanel" />
          <Item name="exportButton" />
          <Item name="columnChooserButton" />
        </Toolbar>

        <Column
          dataField="returnNumber"
          caption="Return #"
          width={150}
          fixed={true}
          allowFiltering={true}
        />

        <Column
          dataField="returnDate"
          caption="Date"
          dataType="date"
          format="MMM dd, yyyy"
          width={120}
          customizeText={(cellInfo) => formatDate(cellInfo.value)}
        />

        <Column
          dataField="supplier.name"
          caption="Supplier"
          width={200}
          allowFiltering={true}
        />

        <Column
          dataField="returnReason"
          caption="Reason"
          width={120}
          cellRender={(cellData) => {
            const reasonInfo = getReasonDisplay(cellData.value)
            return (
              <span
                style={{
                  backgroundColor: reasonInfo.color + '20',
                  color: reasonInfo.color,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontWeight: '500',
                  fontSize: '12px',
                }}
              >
                {reasonInfo.text}
              </span>
            )
          }}
        />

        <Column
          caption="Items"
          width={80}
          alignment="center"
          calculateCellValue={(rowData: SupplierReturn) => rowData.items.length}
        />

        <Column
          caption="Conditions"
          width={200}
          allowFiltering={false}
          calculateCellValue={(rowData: SupplierReturn) => getConditionSummary(rowData.items)}
        />

        <Column
          dataField="totalAmount"
          caption="Total"
          dataType="number"
          width={120}
          format={{ type: 'currency', currency: 'PHP' }}
          customizeText={(cellInfo) => formatCurrency(cellInfo.value)}
        />

        <Column
          dataField="status"
          caption="Status"
          width={100}
          cellRender={(cellData) => {
            const statusInfo = getStatusDisplay(cellData.value)
            return (
              <span
                style={{
                  backgroundColor: statusInfo.color + '20',
                  color: statusInfo.color,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontWeight: '500',
                  fontSize: '12px',
                }}
              >
                {statusInfo.text}
              </span>
            )
          }}
        />

        <Column
          caption="Actions"
          width={130}
          alignment="center"
          allowFiltering={false}
          allowSorting={false}
          allowExporting={false}
          cellRender={(cellData) => (
            <div className="flex justify-center">
              <UiButton
                variant="outline"
                size="sm"
                className="min-w-[96px]"
                title="View details"
                onClick={() => handleViewReturn(cellData.data.id)}
              >
                <Eye className="size-4" />
                View
              </UiButton>
            </div>
          )}
        />
      </DataGrid>
    </div>
  )
}
