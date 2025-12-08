"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  PrinterIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface SaleItem {
  productName: string
  variationName: string
  sku: string
  quantity: number
  unitPrice: number
  total: number
}

interface Sale {
  id: number
  invoiceNumber: string
  saleDate: string
  customer: string
  customerId: number | null
  totalAmount: number
  discountAmount: number
  discountType: string | null
  status?: string
  payments: Array<{ method: string; amount: number }>
  itemCount: number
  items: SaleItem[]
}

interface ReportData {
  summary: {
    date: string
    totalSales: number
    totalAmount: number
  }
  sales: Sale[]
}

export default function SalesDetailPage() {
  const { can } = usePermissions()
  const { data: session } = useSession()

  if (!can(PERMISSIONS.REPORT_SALES_TODAY)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">You do not have permission to view reports</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [locationId, setLocationId] = useState("all")
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [hasAccessToAll, setHasAccessToAll] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")

  // Set default date on client side to ensure Philippines timezone
  useEffect(() => {
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const year = nowPH.getFullYear()
    const month = nowPH.getMonth()
    const day = nowPH.getDate()
    const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(todayStr)
  }, [])

  useEffect(() => {
    fetchUserLocations()
  }, [])

  const fetchUserLocations = async () => {
    try {
      let list: any[] = []
      let accessAll = false
      let primary: string | null = null

      try {
        const response = await fetch("/api/user-locations")
        if (response.ok) {
          const data = await response.json()
          const raw = Array.isArray(data.locations) ? data.locations : []
          list = raw.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = Boolean(data.hasAccessToAll)
          primary = data.primaryLocationId ? String(data.primaryLocationId) : null
        } else {
          throw new Error('user-locations not available')
        }
      } catch (e) {
        const res = await fetch('/api/locations')
        if (res.ok) {
          const data = await res.json()
          const raw = Array.isArray(data)
            ? data
            : Array.isArray(data.locations)
              ? data.locations
              : Array.isArray(data.data)
                ? data.data
                : []
          list = raw.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = true
        }
      }

      setLocations(list)
      setHasAccessToAll(accessAll)
      const resolved = primary || (list[0]?.id ? String(list[0].id) : 'all')
      setLocationId(resolved)
    } catch (error) {
      console.error("Failed to fetch user locations:", error)
      setLocations([])
      setHasAccessToAll(false)
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (locationId !== "all") params.append("locationId", locationId)

      let dateToUse = selectedDate
      if (!dateToUse) {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        const year = nowPH.getFullYear()
        const month = nowPH.getMonth()
        const day = nowPH.getDate()
        dateToUse = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }

      params.append("startDate", dateToUse)
      params.append("endDate", dateToUse)

      const response = await fetch(`/api/reports/sales-today?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        // Sort sales by invoice number
        if (data.sales) {
          data.sales.sort((a: { invoiceNumber: string }, b: { invoiceNumber: string }) =>
            a.invoiceNumber.localeCompare(b.invoiceNumber)
          )
        }
        setReportData(data)
      }
    } catch (error) {
      console.error("Failed to fetch report:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch when location or date changes
  useEffect(() => {
    if (selectedDate && locationId) {
      fetchReport()
    }
  }, [selectedDate, locationId])

  const handlePrint = () => {
    // Get location name for filename
    const locName = locationId === "all"
      ? "All_Locations"
      : locations.find(l => String(l.id) === locationId)?.name || "Unknown"
    const safeLocationName = locName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')

    // Get current date and time in Philippines timezone (12-hour format)
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const dateStr = `${nowPH.getFullYear()}-${String(nowPH.getMonth() + 1).padStart(2, '0')}-${String(nowPH.getDate()).padStart(2, '0')}`
    const hours = nowPH.getHours()
    const minutes = nowPH.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    const timeStr = `${hour12}${String(minutes).padStart(2, '0')}${ampm}`

    const originalTitle = document.title
    document.title = `${safeLocationName}_Sales_Detail_${dateStr}_${timeStr}`
    window.print()
    document.title = originalTitle
  }

  const exportToPDF = () => {
    if (!reportData || reportData.sales.length === 0) return

    // Get location name for filename
    const locName = locationId === "all"
      ? "All_Locations"
      : locations.find(l => String(l.id) === locationId)?.name || "Unknown"
    const safeLocationName = locName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')

    // Get current date and time in Philippines timezone (12-hour format)
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const dateStr = `${nowPH.getFullYear()}-${String(nowPH.getMonth() + 1).padStart(2, '0')}-${String(nowPH.getDate()).padStart(2, '0')}`
    const hours = nowPH.getHours()
    const minutes = nowPH.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    const timeStr = `${hour12}${String(minutes).padStart(2, '0')}${ampm}`

    const filename = `${safeLocationName}_Sales_Detail_${dateStr}_${timeStr}`

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    // Add title
    doc.setFontSize(16)
    doc.text('Sales Detail Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Date: ${selectedDate} | Location: ${locName}`, 14, 22)

    // Prepare table data - flatten all items from all sales
    const tableData: string[][] = []
    reportData.sales.forEach(sale => {
      sale.items.forEach((item, idx) => {
        tableData.push([
          idx === 0 ? sale.invoiceNumber : '',
          idx === 0 ? sale.customer : '',
          item.productName,
          item.sku,
          item.quantity.toString(),
          formatCurrency(item.unitPrice),
          formatCurrency(item.total),
          idx === 0 ? sale.payments.map(p => p.method).join(', ') : ''
        ])
      })
    })

    // Add table
    autoTable(doc, {
      head: [['Invoice', 'Customer', 'Product', 'SKU', 'Qty', 'Price', 'Total', 'Payment']],
      body: tableData,
      startY: 28,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    })

    // Add grand total at the end
    const finalY = (doc as any).lastAutoTable.finalY || 28
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Grand Total: ${formatCurrency(grandTotal)}`, 14, finalY + 10)

    // Save PDF
    doc.save(`${filename}.pdf`)
  }

  const exportToExcel = async () => {
    if (!reportData || reportData.sales.length === 0) return

    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Sales Detail')

    // Set column widths
    worksheet.columns = [
      { header: 'Invoice', key: 'invoice', width: 25 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Product', key: 'product', width: 40 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Qty', key: 'qty', width: 8 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Payment', key: 'payment', width: 20 },
    ]

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

    let rowIndex = 2
    let isAlternate = false

    reportData.sales.forEach((sale, saleIndex) => {
      const paymentStr = sale.payments.map(p => `${p.method}: ${formatCurrency(p.amount)}`).join(', ')

      // Add invoice header row
      const invoiceHeaderRow = worksheet.getRow(rowIndex)
      invoiceHeaderRow.values = [
        sale.invoiceNumber,
        sale.customer,
        '',
        '',
        '',
        '',
        '',
        paymentStr
      ]
      invoiceHeaderRow.font = { bold: true }
      invoiceHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAlternate ? 'FFFEF3C7' : 'FFDBEAFE' } // amber-100 or blue-100
      }
      rowIndex++

      // Add item rows
      sale.items.forEach((item) => {
        const itemRow = worksheet.getRow(rowIndex)
        itemRow.values = [
          '',
          '',
          item.productName + (item.variationName ? ` (${item.variationName})` : ''),
          item.sku,
          item.quantity,
          item.unitPrice,
          item.total,
          ''
        ]
        itemRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isAlternate ? 'FFFFFBEB' : 'FFF0F9FF' } // amber-50 or blue-50
        }
        rowIndex++
      })

      // Add invoice total row
      const totalRow = worksheet.getRow(rowIndex)
      totalRow.values = [
        '',
        '',
        '',
        '',
        '',
        'Invoice Total:',
        sale.totalAmount,
        ''
      ]
      totalRow.font = { bold: true }
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAlternate ? 'FFFEF3C7' : 'FFDBEAFE' }
      }
      rowIndex++

      // Add empty row between invoices
      rowIndex++
      isAlternate = !isAlternate
    })

    // Add grand total
    const grandTotalRow = worksheet.getRow(rowIndex)
    grandTotalRow.values = [
      '',
      '',
      '',
      '',
      '',
      'GRAND TOTAL:',
      reportData.summary.totalAmount,
      ''
    ]
    grandTotalRow.font = { bold: true, size: 12 }
    grandTotalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF22C55E' }
    }
    grandTotalRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }

    // Format currency columns
    worksheet.getColumn('price').numFmt = '#,##0.00'
    worksheet.getColumn('total').numFmt = '#,##0.00'

    // Get location name for filename
    const locName = locationId === "all"
      ? "All_Locations"
      : locations.find(l => String(l.id) === locationId)?.name || "Unknown"
    const safeLocationName = locName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')

    // Get current date and time in Philippines timezone (12-hour format)
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const dateStr = `${nowPH.getFullYear()}-${String(nowPH.getMonth() + 1).padStart(2, '0')}-${String(nowPH.getDate()).padStart(2, '0')}`
    const hours = nowPH.getHours()
    const minutes = nowPH.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    const timeStr = `${hour12}${String(minutes).padStart(2, '0')}${ampm}`

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `${safeLocationName}_Sales_Detail_${dateStr}_${timeStr}.xlsx`)
  }

  // Calculate grand total
  const grandTotal = reportData?.sales.reduce((sum, s) => sum + s.totalAmount, 0) || 0
  const totalItems = reportData?.sales.reduce((sum, s) => sum + s.itemCount, 0) || 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { break-inside: avoid; }
          body { font-size: 10pt; }
          .invoice-card { margin-bottom: 1rem; page-break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold">Sales Detail Report</h1>
            <p className="text-sm text-muted-foreground">
              All invoices with line items expanded
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />

          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {hasAccessToAll && <SelectItem value="all">All Locations</SelectItem>}
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={String(loc.id)}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!reportData?.sales.length}
            className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Excel
          </Button>

          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={!reportData?.sales.length}
            className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400">
            <DocumentArrowDownIcon className="h-4 w-4" />
            PDF
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint}
            className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
            <PrinterIcon className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Report Title for Print */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Sales Detail Report</h1>
        <p className="text-sm">Date: {selectedDate} | Location: {locations.find(l => String(l.id) === locationId)?.name || 'All Locations'}</p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading report...</p>
        </div>
      )}

      {/* No Data State */}
      {!loading && reportData && reportData.sales.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">No sales found for this date and location.</p>
          </CardContent>
        </Card>
      )}

      {/* Invoice Cards */}
      {!loading && reportData && reportData.sales.length > 0 && (
        <div className="space-y-4">
          {reportData.sales.map((sale, index) => (
            <div
              key={sale.id}
              className={`invoice-card print-break rounded-lg overflow-hidden border-2 ${
                index % 2 === 0
                  ? 'border-blue-300 bg-blue-50/30'
                  : 'border-amber-300 bg-amber-50/30'
              }`}
            >
              {/* Invoice Header */}
              <div className={`p-3 ${index % 2 === 0 ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <span className="font-bold text-lg">{sale.invoiceNumber}</span>
                    {sale.status === 'voided' && (
                      <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded">VOID</span>
                    )}
                  </div>
                  <span className="font-medium">{sale.customer}</span>
                </div>
                <div className="text-sm mt-1 flex flex-wrap gap-2">
                  {sale.payments.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded text-xs">
                      {p.method}: {formatCurrency(p.amount)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="p-2 text-left">Product</th>
                      <th className="p-2 text-left w-32">SKU</th>
                      <th className="p-2 text-center w-16">Qty</th>
                      <th className="p-2 text-right w-24">Price</th>
                      <th className="p-2 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item, itemIndex) => (
                      <tr key={itemIndex} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="p-2">
                          {item.productName}
                          {item.variationName && (
                            <span className="text-gray-500 text-xs ml-1">({item.variationName})</span>
                          )}
                        </td>
                        <td className="p-2 text-gray-600 dark:text-gray-400 text-xs">{item.sku}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoice Total */}
              <div className={`p-3 flex justify-between items-center ${index % 2 === 0 ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
                <span className="text-sm text-gray-600 dark:text-gray-400">{sale.itemCount} item(s)</span>
                <span className="font-bold text-lg">
                  Invoice Total: {formatCurrency(sale.totalAmount)}
                </span>
              </div>
            </div>
          ))}

          {/* Grand Total Card */}
          <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/30">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-lg font-medium">{reportData.sales.length} Invoice(s)</span>
                  <span className="text-gray-500 ml-2">| {totalItems} Total Item(s)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Grand Total</span>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotal)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
