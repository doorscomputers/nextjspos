"use client"

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import DataGrid, { Column, Export, Summary, TotalItem } from 'devextreme-react/data-grid'
import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'

interface Transfer {
  id: number
  transferNumber: string
  transferDate: string
  fromLocationId: number
  toLocationId: number
  fromLocationName?: string
  toLocationName?: string
  status: string
  notes: string | null
  createdAt: string
  items: TransferItem[]
  creator?: { username: string } | null
  checker?: { username: string } | null
  checkedAt: string | null
}

interface TransferItem {
  id: number
  quantity: string
  product: { name: string; sku: string }
  productVariation: { name: string; sku: string | null }
}

interface GridItem {
  itemNumber: number
  productName: string
  variation: string
  sku: string
  quantity: number
}

export default function TransferDevExtremePage() {
  const { can } = usePermissions()
  const params = useParams()
  const transferId = params.id as string

  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [gridData, setGridData] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTransfer()
  }, [transferId])

  useEffect(() => {
    if (transfer) {
      document.title = `Transfer ${transfer.transferNumber} - Igoro Tech(IT)`
    }
  }, [transfer])

  const fetchTransfer = async () => {
    try {
      const response = await fetch(`/api/transfers/${transferId}`)
      const data = await response.json()

      if (response.ok) {
        setTransfer(data)

        const transformedData: GridItem[] = data.items.map((item: TransferItem, index: number) => ({
          itemNumber: index + 1,
          productName: item.product.name,
          variation: item.productVariation.name?.toLowerCase() !== 'default' ? item.productVariation.name : '',
          sku: item.productVariation.sku || item.product.sku || 'N/A',
          quantity: parseFloat(item.quantity),
        }))

        setGridData(transformedData)
      } else {
        toast.error(data.error || 'Failed to fetch transfer')
      }
    } catch (error) {
      toast.error('Failed to fetch transfer')
    } finally {
      setLoading(false)
    }
  }

  const getLocationName = (locationId: number) => {
    if (transfer) {
      if (locationId === transfer.fromLocationId && transfer.fromLocationName) return transfer.fromLocationName
      if (locationId === transfer.toLocationId && transfer.toLocationName) return transfer.toLocationName
    }
    return `Location ${locationId}`
  }

  const handlePrint = () => {
    window.print()
  }

  const onExporting = (e: any) => {
    if (e.format === 'pdf') {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('STOCK TRANSFER REPORT', 105, 20, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Igoro Tech(IT) • Inventory Management System`, 105, 28, { align: 'center' })

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Transfer #: ${transfer?.transferNumber || 'N/A'}`, 15, 40)

      doc.setFont('helvetica', 'normal')
      doc.text(`From: ${getLocationName(transfer?.fromLocationId || 0)}`, 15, 48)
      doc.text(`To: ${getLocationName(transfer?.toLocationId || 0)}`, 15, 54)
      doc.text(`Date: ${transfer ? new Date(transfer.transferDate).toLocaleDateString() : 'N/A'}`, 15, 60)
      doc.text(`Printed: ${new Date().toLocaleString()}`, 15, 66)

      exportToPDF({
        jsPDFDocument: doc,
        component: e.component,
        topLeft: { x: 5, y: 75 },
        columnWidths: [15, 70, 40, 30, 30],
      }).then(() => {
        const finalY = (doc as any).lastAutoTable?.finalY || 200

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.line(15, finalY + 40, 80, finalY + 40)
        doc.text('Prepared By', 47.5, finalY + 45, { align: 'center' })
        if (transfer?.creator?.username) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text(transfer.creator.username, 47.5, finalY + 50, { align: 'center' })
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.line(115, finalY + 40, 180, finalY + 40)
        doc.text('Approved By', 147.5, finalY + 45, { align: 'center' })
        if (transfer?.checker?.username) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text(transfer.checker.username, 147.5, finalY + 50, { align: 'center' })
        }

        doc.save(`transfer_${transfer?.transferNumber || 'report'}.pdf`)
        toast.success('PDF exported successfully')
      })
    } else if (e.format === 'xlsx') {
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet('Transfer')

      exportToExcel({
        component: e.component,
        worksheet,
        topLeftCell: { row: 1, column: 1 },
      }).then(() => {
        workbook.xlsx.writeBuffer().then((buffer) => {
          saveAs(new Blob([buffer]), `transfer_${transfer?.transferNumber || 'report'}.xlsx`)
          toast.success('Excel exported')
        })
      })
    }
  }

  if (!can(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
    return <div className="p-8"><div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">No permission</div></div>
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!transfer) return <div className="p-8">Transfer not found</div>

  const totalQuantity = gridData.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Print-Only Header - Professional Transfer Template */}
      <div className="hidden print:block print-header">
        <div className="border-b-4 border-blue-600 pb-6 mb-6">
          {/* Company Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold text-blue-600 mb-2">Igoro Tech(IT)</h1>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Inventory Management System</p>
                <p>Stock Transfer Report</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-800 mb-2">STOCK TRANSFER</div>
              <div className="text-sm text-gray-600">
                <p><strong>Transfer #:</strong> {transfer.transferNumber}</p>
                <p><strong>Date:</strong> {new Date(transfer.transferDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><strong>Printed:</strong> {new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Transfer Route Information */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-2">FROM LOCATION</h3>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{getLocationName(transfer.fromLocationId)}</p>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-2">TO LOCATION</h3>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{getLocationName(transfer.toLocationId)}</p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-sm"><strong>Status:</strong> <span className="uppercase font-semibold text-blue-800">{transfer.status}</span></p>
          </div>
        </div>
      </div>

      {/* Screen-Only Header */}
      <div className="print:hidden flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/transfers">
            <Button variant="outline" size="sm"><ArrowLeftIcon className="w-4 h-4 mr-2" />Back</Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{transfer.transferNumber}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">DevExtreme Professional Report</p>
          </div>
        </div>
        <div>
          <Button onClick={handlePrint} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Print-Only Items Table */}
      <div className="hidden print:block">
        <table className="w-full border-collapse border border-gray-300 mt-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">#</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Variation</th>
              <th className="border border-gray-300 px-4 py-2 text-left">SKU</th>
              <th className="border border-gray-300 px-4 py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {gridData.map((item) => (
              <tr key={item.itemNumber}>
                <td className="border border-gray-300 px-4 py-2 text-center">{item.itemNumber}</td>
                <td className="border border-gray-300 px-4 py-2">{item.productName}</td>
                <td className="border border-gray-300 px-4 py-2">{item.variation || '-'}</td>
                <td className="border border-gray-300 px-4 py-2 text-sm">{item.sku}</td>
                <td className="border border-gray-300 px-4 py-2 text-right font-medium">{item.quantity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={4} className="border border-gray-300 px-4 py-2 text-right">TOTAL:</td>
              <td className="border border-gray-300 px-4 py-2 text-right">{totalQuantity.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        {/* Print Notes */}
        {transfer.notes && (
          <div className="mt-6 border border-gray-300 p-4 rounded">
            <h3 className="font-semibold mb-2">Notes:</h3>
            <p className="text-sm">{transfer.notes}</p>
          </div>
        )}

        {/* Print Signature Section */}
        <div className="mt-12 border-t border-gray-300 pt-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold mb-4">Prepared By:</p>
              <div className="border-b border-gray-400 w-48 mb-1"></div>
              <p className="text-xs text-gray-600">Signature & Date</p>
              {transfer.creator?.username && (
                <p className="text-xs text-gray-700 mt-2 font-medium">{transfer.creator.username}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold mb-4">Approved By:</p>
              <div className="border-b border-gray-400 w-48 mb-1"></div>
              <p className="text-xs text-gray-600">Signature & Date</p>
              {transfer.checker?.username && (
                <p className="text-xs text-gray-700 mt-2 font-medium">{transfer.checker.username}</p>
              )}
            </div>
          </div>
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>This is a computer-generated stock transfer report and is valid without signature.</p>
            <p>Date Printed: {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Screen-Only Content with DevExtreme Grid */}
      <div className="print:hidden bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Transfer Details</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div><span className="text-gray-500">From:</span> <strong>{getLocationName(transfer.fromLocationId)}</strong></div>
          <div><span className="text-gray-500">To:</span> <strong>{getLocationName(transfer.toLocationId)}</strong></div>
          <div><span className="text-gray-500">Date:</span> <strong>{new Date(transfer.transferDate).toLocaleDateString()}</strong></div>
          <div><span className="text-gray-500">Status:</span> <strong>{transfer.status.toUpperCase()}</strong></div>
        </div>

        <DataGrid dataSource={gridData} showBorders={true} columnAutoWidth={true} rowAlternationEnabled={true} onExporting={onExporting} height={400}>
          <Export enabled={true} formats={['xlsx', 'pdf']} />
          <Column dataField="itemNumber" caption="#" width={60} alignment="center" />
          <Column dataField="productName" caption="Product" />
          <Column dataField="variation" caption="Variation" />
          <Column dataField="sku" caption="SKU" />
          <Column dataField="quantity" caption="Quantity" format="#,##0.##" alignment="right" />
          <Summary>
            <TotalItem column="quantity" summaryType="sum" displayFormat="Total: {0}" valueFormat="#,##0.##" />
          </Summary>
        </DataGrid>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200"><strong>💡 Tip:</strong> Click export icon (top-right) for DevExtreme PDF, or use Print button for browser print with clean margins!</p>
        </div>
      </div>
    </div>
  )
}
