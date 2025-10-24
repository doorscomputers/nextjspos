'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowPathIcon, PlusIcon, PrinterIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  Paging,
  SearchPanel,
  ColumnChooser,
  ColumnFixing,
  StateStoring,
  LoadPanel,
  Scrolling,
  Toolbar,
  Item
} from 'devextreme-react/data-grid'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

interface Printer {
  id: number
  name: string
  connectionType: string
  capabilityProfile: string
  charPerLine: number
  ipAddress: string | null
  port: string | null
  path: string | null
  business: {
    id: number
    name: string
  }
  locations: Array<{
    id: number
    name: string
  }>
  createdAt: string
  // Display fields
  connectionDisplay?: string
  locationCount?: string
}

export default function PrintersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const dataGridRef = useRef<any>(null)
  const { can } = usePermissions()

  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    fetchPrinters()
  }, [])

  const fetchPrinters = async () => {
    try {
      setLoading(true)
      console.log('[Printers Page] Fetching printers...')

      const res = await fetch('/api/printers')

      if (!res.ok) {
        throw new Error('Failed to fetch printers')
      }

      const response = await res.json()
      const data = response.data

      // Transform data for DataGrid display
      const transformedData = data.map((printer: Printer) => ({
        ...printer,
        connectionDisplay: formatConnectionType(printer),
        locationCount: printer.locations.length > 0
          ? `${printer.locations.length} location(s)`
          : 'Not assigned'
      }))

      console.log('[Printers Page] Printers fetched:', transformedData.length)
      setPrinters(transformedData)
      toast.success('Printers loaded successfully')
    } catch (err) {
      console.error('[Printers Page] Error fetching printers:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to load printers')
    } finally {
      setLoading(false)
    }
  }

  const formatConnectionType = (printer: Printer) => {
    switch (printer.connectionType) {
      case 'network':
        return `Network - ${printer.ipAddress}:${printer.port || '9100'}`
      case 'windows':
      case 'linux':
        return `${printer.connectionType.charAt(0).toUpperCase() + printer.connectionType.slice(1)} - ${printer.path || 'N/A'}`
      default:
        return printer.connectionType
    }
  }

  const handleDelete = async (printerId: number) => {
    try {
      const res = await fetch(`/api/printers/${printerId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete printer')
      }

      setDeleteConfirm(null)
      toast.success('Printer deleted successfully')
      fetchPrinters()
    } catch (err) {
      console.error('[Printers Page] Error deleting printer:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete printer')
    }
  }

  // Excel Export
  const onExportExcel = useCallback(() => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Printers')

    exportToExcel({
      component: dataGridRef.current?.instance,
      worksheet: worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }: any) => {
        if (gridCell?.rowType === 'data') {
          excelCell.font = { name: 'Arial', size: 10 }
          excelCell.alignment = { horizontal: 'left' }
        }
      }
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer: any) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'Printers.xlsx')
      })
    })
  }, [])

  // PDF Export
  const onExportPDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4')

    exportToPDF({
      jsPDFDocument: doc,
      component: dataGridRef.current?.instance,
      autoTableOptions: {
        startY: 20,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 9
        }
      }
    }).then(() => {
      doc.save('Printers.pdf')
    })
  }, [])

  const renderActionCell = (cellData: any) => {
    const printer = cellData.data

    return (
      <div className="flex gap-2">
        {can(PERMISSIONS.PRINTER_UPDATE) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/printers/${printer.id}`)}
            title="Edit Printer"
          >
            <PencilIcon className="w-4 h-4" />
          </Button>
        )}
        {can(PERMISSIONS.PRINTER_DELETE) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirm(printer.id)}
            title="Delete Printer"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <TrashIcon className="w-4 h-4" />
          </Button>
        )}
      </div>
    )
  }

  if (!can(PERMISSIONS.PRINTER_VIEW)) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p>You don&apos;t have permission to view printers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PrinterIcon className="w-8 h-8" />
            Printer Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure and manage thermal receipt printers for your business locations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchPrinters}
            disabled={loading}
            className="gap-2"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {can(PERMISSIONS.PRINTER_CREATE) && (
            <Button
              onClick={() => router.push('/dashboard/printers/create')}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4" />
              Add Printer
            </Button>
          )}
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <DataGrid
          ref={dataGridRef}
          dataSource={printers}
          keyExpr="id"
          showBorders={true}
          showRowLines={true}
          showColumnLines={true}
          rowAlternationEnabled={true}
          hoverStateEnabled={true}
          allowColumnReordering={true}
          allowColumnResizing={true}
          columnResizingMode="widget"
          columnAutoWidth={true}
          wordWrapEnabled={false}
        >
          <StateStoring enabled={true} type="localStorage" storageKey="printersGrid" />
          <LoadPanel enabled={true} />
          <Scrolling mode="standard" />
          <Paging defaultPageSize={20} />
          <FilterRow visible={true} />
          <HeaderFilter visible={true} />
          <SearchPanel visible={true} highlightCaseSensitive={false} placeholder="Search printers..." />
          <ColumnChooser enabled={true} mode="select" />
          <ColumnFixing enabled={true} />
          <Export enabled={false} />

          <Column
            dataField="id"
            caption="ID"
            width={70}
            alignment="center"
            fixed={true}
          />

          <Column
            dataField="name"
            caption="Printer Name"
            minWidth={200}
          />

          <Column
            dataField="connectionType"
            caption="Type"
            width={120}
            alignment="center"
          >
            <HeaderFilter dataSource={[
              { text: 'Network', value: 'network' },
              { text: 'Windows', value: 'windows' },
              { text: 'Linux', value: 'linux' },
            ]} />
          </Column>

          <Column
            dataField="connectionDisplay"
            caption="Connection Details"
            minWidth={250}
          />

          <Column
            dataField="capabilityProfile"
            caption="Capability Profile"
            width={150}
            alignment="center"
          />

          <Column
            dataField="charPerLine"
            caption="Chars/Line"
            width={100}
            alignment="center"
          />

          <Column
            dataField="locationCount"
            caption="Assigned Locations"
            width={150}
            alignment="center"
          />

          <Column
            dataField="createdAt"
            caption="Created"
            dataType="date"
            format="MMM dd, yyyy"
            width={130}
          />

          <Column
            caption="Actions"
            width={120}
            cellRender={renderActionCell}
            allowExporting={false}
            allowFiltering={false}
            allowSorting={false}
            fixed={true}
            fixedPosition="right"
          />

          <Toolbar>
            <Item name="searchPanel" />
            <Item name="columnChooserButton" />
            <Item location="after">
              <Button
                variant="outline"
                size="sm"
                onClick={onExportExcel}
                className="gap-1"
              >
                📊 Excel
              </Button>
            </Item>
            <Item location="after">
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPDF}
                className="gap-1"
              >
                📄 PDF
              </Button>
            </Item>
          </Toolbar>
        </DataGrid>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-3">Confirm Deletion</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this printer? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirm)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-3">🖨️ Printer Configuration Guidelines:</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Connection Types:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Network:</strong> Thermal printers connected via IP address (most common)</li>
              <li><strong>Windows:</strong> Local printers using COM/LPT ports</li>
              <li><strong>Linux:</strong> Local printers using /dev paths</li>
            </ul>
          </div>
          <div>
            <strong>Capability Profiles:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Default:</strong> Standard ESC/POS commands</li>
              <li><strong>Simple:</strong> Basic compatibility mode</li>
              <li><strong>SP2000, TEP-200M, P822D:</strong> Printer-specific profiles</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <strong className="text-yellow-800 dark:text-yellow-200">⚠️ Note:</strong>
          <span className="text-yellow-700 dark:text-yellow-300 ml-2">
            Most thermal printers work on port 9100. Make sure the printer is accessible from your network before adding it.
          </span>
        </div>
      </div>
    </div>
  )
}
