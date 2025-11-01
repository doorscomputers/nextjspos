import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
/**
 * GET /api/purchases/[id]/export?format=pdf|excel
 * Export Purchase Order to PDF or Excel format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const resolvedParams = await params
    const purchaseId = parseInt(resolvedParams.id)

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'Invalid purchase ID' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf'

    if (!['pdf', 'excel'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use pdf or excel' },
        { status: 400 }
      )
    }

    // Fetch purchase with all related data
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      select: {
        supplier: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
            mobile: { select: { id: true, name: true } },
            alternateNumber: { select: { id: true, name: true } },
            address: { select: { id: true, name: true } },
            paymentTerms: { select: { id: true, name: true } },
          },
        },
        items: {
          select: {
            product: {
              select: {
                name: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                sku: { select: { id: true, name: true } },
              },
            },
            productVariation: {
              select: {
                name: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase order not found or does not belong to your business' },
        { status: 404 }
      )
    }

    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) },
      select: {
        name: { select: { id: true, name: true } },
      },
    })

    // Get main business location for address/contact info
    const mainLocation = await prisma.businessLocation.findFirst({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      orderBy: {
        id: 'asc', // Get the first/main location
      },
      select: {
        name: { select: { id: true, name: true } },
        landmark: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        state: { select: { id: true, name: true } },
        country: { select: { id: true, name: true } },
        zipCode: { select: { id: true, name: true } },
        mobile: { select: { id: true, name: true } },
        email: { select: { id: true, name: true } },
      },
    })

    const addressParts = [
      mainLocation?.landmark,
      mainLocation?.city,
      mainLocation?.state,
      mainLocation?.zipCode,
      mainLocation?.country,
    ].filter(Boolean)

    const purchaseForExport = {
      ...purchase,
      business: {
        name: business?.name || '',
        address: addressParts.join(', '),
        phone: mainLocation?.mobile || '',
        email: mainLocation?.email || '',
      },
    }

    if (format === 'pdf') {
      return generatePDF(purchaseForExport)
    } else {
      return generateExcel(purchaseForExport)
    }
  } catch (error) {
    console.error('Error exporting purchase order:', error)
    return NextResponse.json(
      {
        error: 'Failed to export purchase order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Generate PDF document for Purchase Order using jsPDF
 */
function generatePDF(purchase: any) {
  const doc = new jsPDF()

  const businessName = purchase.business?.name || 'Company Name'
  const businessAddress = purchase.business?.address || ''
  const businessPhone = purchase.business?.phone || ''
  const businessEmail = purchase.business?.email || ''
  const supplier = purchase.supplier || {}
  const purchaseDate = purchase.purchaseDate || purchase.orderDate || purchase.createdAt

  const contactLine = [
    businessPhone ? `Phone: ${businessPhone}` : null,
    businessEmail ? `Email: ${businessEmail}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  // Header - Business Info
  doc.setFontSize(18)
  doc.setTextColor(29, 78, 216) // Blue color
  doc.setFont('helvetica', 'bold')
  doc.text(businessName, 15, 20)

  doc.setFontSize(9)
  doc.setTextColor(55, 65, 81) // Gray color
  doc.setFont('helvetica', 'normal')
  let yPos = 27
  if (businessAddress) {
    doc.text(businessAddress, 15, yPos)
    yPos += 5
  }
  if (contactLine) {
    doc.text(contactLine, 15, yPos)
  }

  // Header - Purchase Order Info (Right aligned)
  doc.setFontSize(16)
  doc.setTextColor(17, 24, 39) // Dark gray
  doc.setFont('helvetica', 'bold')
  doc.text('PURCHASE ORDER', 200, 20, { align: 'right' })

  doc.setFontSize(9)
  doc.setTextColor(55, 65, 81)
  doc.setFont('helvetica', 'normal')
  yPos = 27
  doc.text(`PO #: ${purchase.purchaseOrderNumber || ''}`, 200, yPos, { align: 'right' })
  yPos += 5
  if (purchaseDate) {
    doc.text(`Date: ${formatDateHuman(purchaseDate)}`, 200, yPos, { align: 'right' })
    yPos += 5
  }
  if (purchase.expectedDeliveryDate) {
    doc.text(`Expected Delivery: ${formatDateHuman(purchase.expectedDeliveryDate)}`, 200, yPos, { align: 'right' })
    yPos += 5
  }
  doc.text(`Status: ${(purchase.status || '').toString().toUpperCase()}`, 200, yPos, { align: 'right' })

  // Supplier Information
  yPos = 50
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('SUPPLIER INFORMATION', 15, yPos)

  yPos += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(55, 65, 81)
  doc.text(supplier.name || 'N/A', 15, yPos)
  yPos += 5

  if (supplier.address) {
    doc.text(supplier.address, 15, yPos)
    yPos += 5
  }

  const supplierPhone = supplier.mobile || supplier.alternateNumber || ''
  if (supplierPhone) {
    doc.text(`Phone: ${supplierPhone}`, 15, yPos)
    yPos += 5
  }

  if (supplier.email) {
    doc.text(`Email: ${supplier.email}`, 15, yPos)
    yPos += 5
  }

  // Items Table
  yPos += 5
  const tableData = purchase.items.map((item: any, index: number) => {
    const description = [item.product?.name, item.productVariation?.name].filter(Boolean).join(' - ')
    const quantity = toNumber(item.quantity)
    const unitCost = toNumber(item.unitCost)
    const lineTotal = quantity * unitCost

    return [
      (index + 1).toString(),
      description || '—',
      item.product?.sku || '—',
      formatQuantity(quantity),
      formatCurrency(unitCost),
      formatCurrency(lineTotal),
    ]
  })

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Product', 'SKU', 'Quantity', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [29, 78, 216], // Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 35 },
      5: { halign: 'right', cellWidth: 37 },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
  })

  // Get Y position after table
  yPos = (doc as any).lastAutoTable.finalY + 10

  // Totals Section (Right aligned)
  const totals: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Subtotal:', value: formatCurrency(toNumber(purchase.subtotal)) },
  ]

  if (toNumber(purchase.taxAmount) > 0) {
    totals.push({ label: 'Tax:', value: formatCurrency(toNumber(purchase.taxAmount)) })
  }
  if (toNumber(purchase.discountAmount) > 0) {
    totals.push({ label: 'Discount:', value: formatCurrency(-toNumber(purchase.discountAmount)) })
  }
  if (toNumber(purchase.shippingCost) > 0) {
    totals.push({ label: 'Shipping:', value: formatCurrency(toNumber(purchase.shippingCost)) })
  }
  totals.push({ label: 'TOTAL:', value: formatCurrency(toNumber(purchase.totalAmount)), bold: { select: { id: true, name: true } } })

  totals.forEach((total) => {
    if (total.bold) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
    }

    doc.text(total.label, 140, yPos)
    doc.text(total.value, 200, yPos, { align: 'right' })
    yPos += total.bold ? 8 : 6
  })

  // Notes Section
  if (purchase.notes) {
    yPos += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Notes:', 15, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const splitNotes = doc.splitTextToSize(String(purchase.notes), 180)
    doc.text(splitNotes, 15, yPos)
    yPos += splitNotes.length * 5
  }

  // Signature Section
  yPos += 15
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Prepared By:', 15, yPos)
  doc.text('Approved By:', 140, yPos)

  yPos += 15
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setDrawColor(156, 163, 175) // Gray
  doc.line(15, yPos, 80, yPos)
  doc.line(140, yPos, 200, yPos)

  yPos += 3
  doc.setTextColor(107, 114, 128)
  doc.text('Signature & Date', 15, yPos)
  doc.text('Signature & Date', 140, yPos)

  // Convert to buffer and return
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${purchase.purchaseOrderNumber}.pdf"`,
    },
  })
}

function toNumber(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = parseFloat(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatQuantity(value: number): string {
  const safe = toNumber(value)
  if (Number.isInteger(safe)) {
    return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  return safe.toFixed(2).replace(/\.?0+$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatDateHuman(value: any): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  const safe = toNumber(amount)
  // Format number with commas, ensuring 2 decimal places
  const absValue = Math.abs(safe)
  const formatted = absValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  // Add sign if negative (for discounts)
  const sign = safe < 0 ? '-' : ''
  // Use PHP text instead of peso symbol to avoid rendering issues
  return `${sign}PHP ${formatted}`
}

/**
 * Generate Excel workbook for Purchase Order
 */
async function generateExcel(purchase: any) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Purchase Order')

  worksheet.columns = [
    { width: 6 },
    { width: 32 },
    { width: 18 },
    { width: 12 },
    { width: 18 },
    { width: 20 },
  ]

  const headerColor = 'FF1D4ED8'
  const borderColor = { argb: 'FFD1D5DB' }
  const currencyFormat = '"PHP "#,##0.00'
  const quantityFormat = '#,##0.##'

  const businessName = purchase.business?.name || 'Company Name'
  const businessAddress = purchase.business?.address || ''
  const businessPhone = purchase.business?.phone || ''
  const businessEmail = purchase.business?.email || ''
  const purchaseDate = purchase.purchaseDate || purchase.orderDate || purchase.createdAt
  const supplier = purchase.supplier || {}

  const contactLine = [
    businessPhone ? `Phone: ${businessPhone}` : null,
    businessEmail ? `Email: ${businessEmail}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  worksheet.mergeCells('A1:C1')
  const businessCell = worksheet.getCell('A1')
  businessCell.value = businessName
  businessCell.font = { size: 18, bold: { select: { id: true, name: true } }, color: { argb: headerColor } }

  worksheet.mergeCells('D1:F1')
  const titleCell = worksheet.getCell('D1')
  titleCell.value = 'PURCHASE ORDER'
  titleCell.font = { size: 18, bold: { select: { id: true, name: true } } }
  titleCell.alignment = { horizontal: 'right' }

  worksheet.mergeCells('A2:C2')
  worksheet.getCell('A2').value = businessAddress

  worksheet.mergeCells('A3:C3')
  worksheet.getCell('A3').value = contactLine

  worksheet.mergeCells('D2:F2')
  worksheet.getCell('D2').value = `PO #: ${purchase.purchaseOrderNumber || ''}`
  worksheet.getCell('D2').alignment = { horizontal: 'right' }

  worksheet.mergeCells('D3:F3')
  worksheet.getCell('D3').value = purchaseDate ? `Date: ${formatDateHuman(purchaseDate)}` : ''
  worksheet.getCell('D3').alignment = { horizontal: 'right' }

  worksheet.mergeCells('D4:F4')
  worksheet.getCell('D4').value = purchase.expectedDeliveryDate
    ? `Expected Delivery: ${formatDateHuman(purchase.expectedDeliveryDate)}`
    : ''
  worksheet.getCell('D4').alignment = { horizontal: 'right' }

  worksheet.mergeCells('D5:F5')
  worksheet.getCell('D5').value = `Status: ${(purchase.status || '').toString().toUpperCase()}`
  worksheet.getCell('D5').alignment = { horizontal: 'right' }

  worksheet.addRow([])

  const supplierHeaderRow = worksheet.addRow(['SUPPLIER INFORMATION'])
  worksheet.mergeCells(`A${supplierHeaderRow.number}:F${supplierHeaderRow.number}`)
  supplierHeaderRow.font = { bold: { select: { id: true, name: true } } }
  const supplierDetails: Array<[string, string]> = [
    ['Name', supplier.name || 'N/A'],
  ]
  if (supplier.address) {
    supplierDetails.push(['Address', supplier.address])
  }
  const supplierPhoneCsv = supplier.mobile || supplier.alternateNumber || ''
  supplierDetails.push(['Phone', supplierPhoneCsv || 'N/A'])
  supplierDetails.push(['Email', supplier.email || 'N/A'])

  supplierDetails.forEach(([label, value]) => {
    const row = worksheet.addRow([`${label}:`, value])
    worksheet.getCell(`A${row.number}`).font = { bold: { select: { id: true, name: true } } }
    worksheet.mergeCells(`B${row.number}:F${row.number}`)
  })

  worksheet.addRow([])

  const applyBorder = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: borderColor },
        bottom: { style: 'thin', color: borderColor },
        left: { style: 'thin', color: borderColor },
        right: { style: 'thin', color: borderColor },
      }
    })
  }

  const tableHeaderRow = worksheet.addRow(['#', 'Product', 'SKU', 'Quantity', 'Unit Price', 'Total'])
  tableHeaderRow.font = { bold: { select: { id: true, name: true } }, color: { argb: 'FF111827' } }
  tableHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF6FF' },
  }
  tableHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }
  applyBorder(tableHeaderRow)

  purchase.items.forEach((item: any, index: number) => {
    const description = [item.product?.name, item.productVariation?.name].filter(Boolean).join(' - ')
    const quantity = toNumber(item.quantity)
    const unitCost = toNumber(item.unitCost)
    const lineTotal = quantity * unitCost

    const row = worksheet.addRow([
      index + 1,
      description || '—',
      item.product?.sku || '—',
      quantity,
      unitCost,
      lineTotal,
    ])

    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(2).alignment = { wrapText: { select: { id: true, name: true } } }
    row.getCell(4).numFmt = quantityFormat
    row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(5).numFmt = currencyFormat
    row.getCell(5).alignment = { horizontal: 'right' }
    row.getCell(6).numFmt = currencyFormat
    row.getCell(6).alignment = { horizontal: 'right' }

    applyBorder(row)
  })

  worksheet.addRow([])
  worksheet.addRow([])

  const addSummaryRow = (label: string, value: number, options?: { bold?: boolean; topBorder?: boolean; bottomBorder?: boolean; background?: boolean }) => {
    const row = worksheet.addRow(['', '', '', '', `${label}`, value])
    row.getCell(5).alignment = { horizontal: 'right' }
    row.getCell(6).alignment = { horizontal: 'right' }
    row.getCell(6).numFmt = currencyFormat
    if (options?.bold) {
      row.getCell(5).font = { bold: { select: { id: true, name: true } }, size: 11 }
      row.getCell(6).font = { bold: { select: { id: true, name: true } }, size: 11 }
    }
    if (options?.background) {
      row.getCell(5).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      }
      row.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      }
    }
    if (options?.topBorder || options?.bottomBorder) {
      const border: Partial<ExcelJS.Border> = { style: 'thin', color: borderColor }
      row.getCell(5).border = {
        top: options?.topBorder ? border : undefined,
        bottom: options?.bottomBorder ? border : undefined,
        left: border,
        right: undefined,
      }
      row.getCell(6).border = {
        top: options?.topBorder ? border : undefined,
        bottom: options?.bottomBorder ? border : undefined,
        left: undefined,
        right: border,
      }
    }
    return row
  }

  addSummaryRow('Subtotal:', toNumber(purchase.subtotal), { topBorder: { select: { id: true, name: true } } })
  if (toNumber(purchase.taxAmount) > 0) {
    addSummaryRow('Tax:', toNumber(purchase.taxAmount))
  }
  if (toNumber(purchase.discountAmount) > 0) {
    addSummaryRow('Discount:', -toNumber(purchase.discountAmount))
  }
  if (toNumber(purchase.shippingCost) > 0) {
    addSummaryRow('Shipping:', toNumber(purchase.shippingCost))
  }
  addSummaryRow('TOTAL:', toNumber(purchase.totalAmount), { bold: { select: { id: true, name: true } }, topBorder: { select: { id: true, name: true } }, bottomBorder: { select: { id: true, name: true } }, background: { select: { id: true, name: true } } })

  if (purchase.notes) {
    worksheet.addRow([])
    const notesHeader = worksheet.addRow(['Notes:'])
    worksheet.mergeCells(`A${notesHeader.number}:F${notesHeader.number}`)
    notesHeader.font = { bold: { select: { id: true, name: true } } }

    const notesRow = worksheet.addRow([String(purchase.notes)])
    worksheet.mergeCells(`A${notesRow.number}:F${notesRow.number}`)
    notesRow.alignment = { wrapText: { select: { id: true, name: true } } }
  }

  worksheet.addRow([])
  const signatureLabels = worksheet.addRow(['Prepared By:', '', '', '', 'Approved By:', ''])
  signatureLabels.getCell(1).font = { bold: { select: { id: true, name: true } } }
  signatureLabels.getCell(5).font = { bold: { select: { id: true, name: true } } }

  const signatureLines = worksheet.addRow(['___________________________', '', '', '', '___________________________', ''])
  const signatureCaptions = worksheet.addRow(['Signature & Date', '', '', '', 'Signature & Date', ''])
  signatureCaptions.getCell(1).font = { size: 9, color: { argb: 'FF6B7280' } }
  signatureCaptions.getCell(5).font = { size: 9, color: { argb: 'FF6B7280' } }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${purchase.purchaseOrderNumber}.xlsx"`,
    },
  })
}
