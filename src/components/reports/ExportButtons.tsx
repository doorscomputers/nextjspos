"use client"

import { Button } from "@/components/ui/button"
import {
  ArrowDownTrayIcon,
  DocumentTextIcon,
  TableCellsIcon
} from "@heroicons/react/24/outline"
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportButtonsProps {
  data: any[]
  headers: string[]
  filename: string
  title?: string
  disabled?: boolean
  className?: string
}

export function ExportButtons({
  data,
  headers,
  filename,
  title = "Report",
  disabled = false,
  className = ""
}: ExportButtonsProps) {

  const exportToExcel = () => {
    if (!data || data.length === 0) return

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])

    // Create workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Report")

    // Save file
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  const exportToPDF = () => {
    if (!data || data.length === 0) return

    const doc = new jsPDF('l', 'mm', 'a4') // landscape orientation

    // Add title
    doc.setFontSize(16)
    doc.text(title, 14, 15)

    // Add date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)

    // Add table
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 28 }
    })

    // Save PDF
    doc.save(`${filename}.pdf`)
  }

  const exportToCSV = () => {
    if (!data || data.length === 0) return

    const csvContent = [
      headers.join(","),
      ...data.map(row => row.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        onClick={exportToExcel}
        disabled={disabled}
        className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
        size="default"
      >
        <TableCellsIcon className="w-5 h-5 mr-2" />
        Export Excel
      </Button>
      <Button
        onClick={exportToPDF}
        disabled={disabled}
        className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
        size="default"
      >
        <DocumentTextIcon className="w-5 h-5 mr-2" />
        Export PDF
      </Button>
      <Button
        onClick={exportToCSV}
        disabled={disabled}
        className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 hover:border-blue-800 shadow-sm font-medium"
        size="default"
      >
        <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
        Export CSV
      </Button>
    </div>
  )
}
