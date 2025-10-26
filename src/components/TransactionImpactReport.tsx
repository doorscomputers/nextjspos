'use client'

import { useState } from 'react'
import { TransactionImpact } from '@/types/inventory-impact'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Download, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface TransactionImpactReportProps {
  impact: TransactionImpact | null
  open: boolean
  onClose: () => void
}

export default function TransactionImpactReport({
  impact,
  open,
  onClose
}: TransactionImpactReportProps) {
  if (!impact) return null

  const handleExportPDF = () => {
    if (!impact) return

    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Transaction Impact Report', 14, 20)

    // Transaction Details
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    let yPos = 30
    doc.text(`Transaction: ${getTransactionTitle()}`, 14, yPos)
    yPos += 6
    doc.text(`Reference: ${impact.referenceNumber}`, 14, yPos)
    yPos += 6
    doc.text(`Date: ${new Date(impact.transactionDate).toLocaleString()}`, 14, yPos)
    if (impact.performedBy) {
      yPos += 6
      doc.text(`Performed By: ${impact.performedBy}`, 14, yPos)
    }
    yPos += 10

    // For each location
    impact.locations.forEach((location, idx) => {
      if (idx > 0) yPos += 10

      // Location header
      doc.setFont('helvetica', 'bold')
      doc.text(`Location: ${location.locationName} ${location.type !== 'single' ? '(' + getLocationLabel(location.type) + ')' : ''}`, 14, yPos)
      yPos += 2

      // Products table
      const tableData = location.products.map(product => [
        product.productName,
        product.sku,
        product.previousQty.toLocaleString(),
        (product.changeQty > 0 ? '+' : '') + product.changeQty.toLocaleString(),
        product.newQty.toLocaleString()
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Product Name', 'SKU', 'Previous Qty', 'Change', 'New Qty']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' }
        }
      })

      yPos = (doc as any).lastAutoTable.finalY + 5
    })

    // Summary
    doc.setFont('helvetica', 'bold')
    doc.text('Summary:', 14, yPos)
    yPos += 6
    doc.setFont('helvetica', 'normal')
    doc.text(`Total Products Affected: ${impact.totalProductsAffected}`, 14, yPos)
    yPos += 6
    doc.text(`Total Units Changed: ${impact.totalUnitsChanged.toLocaleString()}`, 14, yPos)

    // Save PDF
    doc.save(`transaction_impact_${impact.referenceNumber}.pdf`)
  }

  const handleExportCSV = () => {
    if (!impact) return

    // Build CSV content
    const rows: string[] = []

    // Header
    rows.push('Transaction Impact Report')
    rows.push(`Transaction Type: ${impact.transactionType.toUpperCase()}`)
    rows.push(`Reference: ${impact.referenceNumber}`)
    rows.push(`Date: ${new Date(impact.transactionDate).toLocaleString()}`)
    if (impact.performedBy) {
      rows.push(`Performed By: ${impact.performedBy}`)
    }
    rows.push('')

    // Data for each location
    impact.locations.forEach(location => {
      rows.push(`Location: ${location.locationName} (${location.type.toUpperCase()})`)
      rows.push('Product Name,SKU,Previous Qty,Change,New Qty')

      location.products.forEach(product => {
        const sign = product.changeQty > 0 ? '+' : ''
        rows.push(
          `"${product.productName}",${product.sku},${product.previousQty},${sign}${product.changeQty},${product.newQty}`
        )
      })

      rows.push('')
    })

    // Summary
    rows.push('Summary')
    rows.push(`Total Products Affected: ${impact.totalProductsAffected}`)
    rows.push(`Total Units Changed: ${impact.totalUnitsChanged}`)

    // Create and download
    const csvContent = rows.join('\\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `transaction_impact_${impact.referenceNumber}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getTransactionTitle = () => {
    const typeMap: Record<string, string> = {
      purchase: 'Purchase Receipt',
      sale: 'Sale',
      transfer: 'Stock Transfer',
      adjustment: 'Inventory Adjustment',
      correction: 'Inventory Correction',
      return: 'Return'
    }
    return typeMap[impact.transactionType] || 'Transaction'
  }

  const getLocationBadgeColor = (type: 'source' | 'destination' | 'single') => {
    switch (type) {
      case 'source':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'destination':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  const getLocationLabel = (type: 'source' | 'destination' | 'single') => {
    switch (type) {
      case 'source':
        return 'FROM (Sent)'
      case 'destination':
        return 'TO (Received)'
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center justify-between">
            <span>Transaction Impact Report</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Details */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Transaction</p>
                <p className="font-semibold">{getTransactionTitle()}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Reference</p>
                <p className="font-semibold">{impact.referenceNumber}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Date & Time</p>
                <p className="font-semibold">
                  {new Date(impact.transactionDate).toLocaleString()}
                </p>
              </div>
              {impact.performedBy && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Performed By</p>
                  <p className="font-semibold">{impact.performedBy}</p>
                </div>
              )}
            </div>
          </div>

          {/* Inventory Changes by Location */}
          {impact.locations.map((location, idx) => (
            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Location Header */}
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{location.locationName}</h3>
                  {location.type !== 'single' && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getLocationBadgeColor(location.type)}`}>
                      {getLocationLabel(location.type)}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {location.products.length} product{location.products.length !== 1 ? 's' : ''} affected
                </span>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Product Name</th>
                      <th className="px-4 py-3 text-left font-semibold">SKU</th>
                      <th className="px-4 py-3 text-right font-semibold">Previous Qty</th>
                      <th className="px-4 py-3 text-right font-semibold">Change</th>
                      <th className="px-4 py-3 text-right font-semibold">New Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {location.products.map((product, pIdx) => {
                      const isIncrease = product.changeQty > 0
                      const isDecrease = product.changeQty < 0

                      return (
                        <tr key={pIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3">{product.productName}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                            {product.sku}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {product.previousQty.toLocaleString()}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            isIncrease ? 'text-green-600 dark:text-green-400' :
                            isDecrease ? 'text-red-600 dark:text-red-400' :
                            'text-gray-600 dark:text-gray-400'
                          }`}>
                            {isIncrease && '+'}{product.changeQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                            {product.newQty.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-300">Summary</p>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {impact.totalProductsAffected} product{impact.totalProductsAffected !== 1 ? 's' : ''} affected | {' '}
                  {impact.totalUnitsChanged.toLocaleString()} units changed
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </Button>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
