"use client"

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/transfers">
            <Button variant="outline" size="sm"><ArrowLeftIcon className="w-4 h-4 mr-2" />Back</Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{transfer.transferNumber}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">DevExtreme Professional Report</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
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
          <p className="text-sm text-blue-800 dark:text-blue-200"><strong>💡 Tip:</strong> Click export icon (top-right) → Perfect PDF with balanced margins!</p>
        </div>
      </div>
    </div>
  )
}
