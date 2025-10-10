/**
 * Export Utilities for Table Data
 * Supports: CSV, Excel, PDF, Print
 */

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExportColumn {
  id: string
  label: string
  getValue: (row: any) => string | number
}

export interface ExportOptions {
  filename: string
  columns: ExportColumn[]
  data: any[]
  title?: string
}

/**
 * Export data to CSV
 */
export function exportToCSV(options: ExportOptions) {
  const { filename, columns, data } = options

  // Create header row
  const headers = columns.map(col => col.label)

  // Create data rows
  const rows = data.map(row =>
    columns.map(col => {
      const value = col.getValue(row)
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
  )

  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

/**
 * Export data to Excel
 */
export function exportToExcel(options: ExportOptions) {
  const { filename, columns, data, title } = options

  // Create header row
  const headers = columns.map(col => col.label)

  // Create data rows
  const rows = data.map(row =>
    columns.map(col => col.getValue(row))
  )

  // Create worksheet
  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Set column widths
  const colWidths = columns.map(col => ({
    wch: Math.max(col.label.length, 15)
  }))
  ws['!cols'] = colWidths

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title || 'Data')

  // Save file
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Export data to PDF
 */
export function exportToPDF(options: ExportOptions) {
  const { filename, columns, data, title } = options

  const doc = new jsPDF({
    orientation: columns.length > 8 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Add title
  if (title) {
    doc.setFontSize(16)
    doc.text(title, 14, 15)
  }

  // Prepare table data
  const headers = columns.map(col => col.label)
  const rows = data.map(row =>
    columns.map(col => {
      const value = col.getValue(row)
      return value !== null && value !== undefined ? String(value) : ''
    })
  )

  // Add table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: title ? 20 : 10,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // Light gray
    },
    margin: { top: 10 },
  })

  // Save PDF
  doc.save(`${filename}.pdf`)
}

/**
 * Print table data
 */
export function printTable(options: ExportOptions) {
  const { columns, data, title } = options

  // Create a temporary window for printing
  const printWindow = window.open('', '', 'width=800,height=600')

  if (!printWindow) {
    alert('Please allow popups to print')
    return
  }

  // Create header row
  const headers = columns.map(col => `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f3f4f6; text-align: left;">${col.label}</th>`).join('')

  // Create data rows
  const rows = data.map(row => {
    const cells = columns.map(col => {
      const value = col.getValue(row)
      return `<td style="border: 1px solid #ddd; padding: 8px;">${value !== null && value !== undefined ? value : ''}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  // Build HTML
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title || 'Print'}</title>
        <style>
          @media print {
            body { margin: 0; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
        </style>
      </head>
      <body>
        ${title ? `<h1>${title}</h1>` : ''}
        <table>
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

/**
 * Helper function to download a blob
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
