import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'

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
    const { id } = await params
    const purchaseId = parseInt(id)

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
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            paymentTerms: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            productVariation: {
              select: {
                name: true,
              },
            },
          },
          where: {
            deletedAt: null,
          },
        },
        businessLocation: {
          select: {
            name: true,
            address: true,
            phone: true,
          },
        },
        business: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        createdByUser: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
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

    if (format === 'pdf') {
      return generatePDF(purchase)
    } else {
      return generateExcel(purchase)
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
 * Generate PDF document for Purchase Order
 */
function generatePDF(purchase: any) {
  return new Promise<NextResponse>((resolve) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      const response = new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${purchase.purchaseOrderNumber}.pdf"`,
        },
      })
      resolve(response)
    })

    // Header - Business Info
    doc.fontSize(20).text(purchase.business.name, { align: 'center' })
    doc.fontSize(10).text(purchase.business.address || '', { align: 'center' })
    doc.text(`Phone: ${purchase.business.phone || 'N/A'} | Email: ${purchase.business.email || 'N/A'}`, {
      align: 'center',
    })
    doc.moveDown()

    // Title
    doc.fontSize(16).text('PURCHASE ORDER', { align: 'center', underline: true })
    doc.moveDown()

    // PO Details - Two Columns
    const leftColumnX = 50
    const rightColumnX = 320

    // Left Column - PO Info
    doc.fontSize(10)
    doc.text('PO Number:', leftColumnX, doc.y, { continued: true, width: 100 })
    doc.font('Helvetica-Bold').text(purchase.purchaseOrderNumber, { width: 200 })
    doc.font('Helvetica')

    doc.text('Date:', leftColumnX, doc.y, { continued: true, width: 100 })
    doc.text(new Date(purchase.orderDate).toLocaleDateString(), { width: 200 })

    doc.text('Status:', leftColumnX, doc.y, { continued: true, width: 100 })
    doc.text(purchase.status.toUpperCase(), { width: 200 })

    if (purchase.expectedDeliveryDate) {
      doc.text('Expected Delivery:', leftColumnX, doc.y, { continued: true, width: 100 })
      doc.text(new Date(purchase.expectedDeliveryDate).toLocaleDateString(), { width: 200 })
    }

    // Right Column - Supplier Info
    const supplierY = 200
    doc.text('SUPPLIER:', rightColumnX, supplierY)
    doc.font('Helvetica-Bold').text(purchase.supplier.name, rightColumnX, doc.y)
    doc.font('Helvetica')
    if (purchase.supplier.address) {
      doc.text(purchase.supplier.address, rightColumnX, doc.y, { width: 200 })
    }
    if (purchase.supplier.phone) {
      doc.text(`Phone: ${purchase.supplier.phone}`, rightColumnX, doc.y)
    }
    if (purchase.supplier.email) {
      doc.text(`Email: ${purchase.supplier.email}`, rightColumnX, doc.y)
    }

    doc.moveDown(2)

    // Items Table
    const tableTop = doc.y
    const itemCodeX = 50
    const descriptionX = 120
    const qtyOrderedX = 280
    const qtyReceivedX = 340
    const unitCostX = 410
    const totalX = 480

    // Table Header
    doc.font('Helvetica-Bold')
    doc.text('Item', itemCodeX, tableTop)
    doc.text('Description', descriptionX, tableTop)
    doc.text('Ordered', qtyOrderedX, tableTop)
    doc.text('Received', qtyReceivedX, tableTop)
    doc.text('Unit Cost', unitCostX, tableTop)
    doc.text('Total', totalX, tableTop)

    // Draw line under header
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke()

    // Table Body
    doc.font('Helvetica')
    let yPosition = tableTop + 25

    purchase.items.forEach((item: any, index: number) => {
      if (yPosition > 700) {
        doc.addPage()
        yPosition = 50
      }

      const itemName = item.product.name
      const variationName = item.productVariation?.name || ''
      const fullDescription = variationName ? `${itemName} - ${variationName}` : itemName

      doc.text(item.product.sku || `#${index + 1}`, itemCodeX, yPosition, { width: 60 })
      doc.text(fullDescription, descriptionX, yPosition, { width: 150 })
      doc.text(parseFloat(item.quantity.toString()).toFixed(2), qtyOrderedX, yPosition, { width: 50 })
      doc.text(parseFloat(item.quantityReceived.toString()).toFixed(2), qtyReceivedX, yPosition, { width: 60 })
      doc.text(`₱${parseFloat(item.unitCost.toString()).toFixed(2)}`, unitCostX, yPosition, { width: 60 })

      const lineTotal = parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString())
      doc.text(`₱${lineTotal.toFixed(2)}`, totalX, yPosition, { width: 70, align: 'right' })

      yPosition += 25
    })

    // Draw line before totals
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 10

    // Totals Section
    const totalsX = 400
    const amountsX = 480

    doc.text('Subtotal:', totalsX, yPosition)
    doc.text(`₱${parseFloat(purchase.subtotal.toString()).toFixed(2)}`, amountsX, yPosition, {
      width: 70,
      align: 'right',
    })
    yPosition += 20

    if (parseFloat(purchase.taxAmount.toString()) > 0) {
      doc.text('Tax:', totalsX, yPosition)
      doc.text(`₱${parseFloat(purchase.taxAmount.toString()).toFixed(2)}`, amountsX, yPosition, {
        width: 70,
        align: 'right',
      })
      yPosition += 20
    }

    if (parseFloat(purchase.discountAmount.toString()) > 0) {
      doc.text('Discount:', totalsX, yPosition)
      doc.text(`-₱${parseFloat(purchase.discountAmount.toString()).toFixed(2)}`, amountsX, yPosition, {
        width: 70,
        align: 'right',
      })
      yPosition += 20
    }

    if (parseFloat(purchase.shippingCost.toString()) > 0) {
      doc.text('Shipping:', totalsX, yPosition)
      doc.text(`₱${parseFloat(purchase.shippingCost.toString()).toFixed(2)}`, amountsX, yPosition, {
        width: 70,
        align: 'right',
      })
      yPosition += 20
    }

    // Draw line before grand total
    doc.moveTo(400, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 10

    doc.font('Helvetica-Bold').fontSize(12)
    doc.text('TOTAL:', totalsX, yPosition)
    doc.text(`₱${parseFloat(purchase.totalAmount.toString()).toFixed(2)}`, amountsX, yPosition, {
      width: 70,
      align: 'right',
    })

    // Notes
    if (purchase.notes) {
      yPosition += 40
      doc.font('Helvetica').fontSize(10)
      doc.text('Notes:', 50, yPosition)
      doc.text(purchase.notes, 50, yPosition + 15, { width: 500 })
    }

    // Footer
    yPosition += 80
    if (yPosition > 700) {
      doc.addPage()
      yPosition = 50
    }

    doc.fontSize(9).text('Payment Terms:', 50, yPosition)
    doc.text(`${purchase.supplier.paymentTerms || 30} days`, 150, yPosition)
    yPosition += 30

    doc.text('___________________________', 50, yPosition)
    doc.text('___________________________', 320, yPosition)
    yPosition += 15
    doc.text('Prepared By', 50, yPosition)
    doc.text('Approved By', 320, yPosition)

    // Finalize PDF
    doc.end()
  })
}

/**
 * Generate Excel workbook for Purchase Order
 */
async function generateExcel(purchase: any) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Purchase Order')

  // Set column widths
  worksheet.columns = [
    { width: 5 },
    { width: 15 },
    { width: 30 },
    { width: 12 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
  ]

  // Header - Business Info
  worksheet.mergeCells('A1:G1')
  const headerCell = worksheet.getCell('A1')
  headerCell.value = purchase.business.name
  headerCell.font = { size: 16, bold: true }
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' }

  worksheet.mergeCells('A2:G2')
  const addressCell = worksheet.getCell('A2')
  addressCell.value = purchase.business.address || ''
  addressCell.alignment = { horizontal: 'center' }

  worksheet.mergeCells('A3:G3')
  const contactCell = worksheet.getCell('A3')
  contactCell.value = `Phone: ${purchase.business.phone || 'N/A'} | Email: ${purchase.business.email || 'N/A'}`
  contactCell.alignment = { horizontal: 'center' }

  // Title
  worksheet.addRow([])
  worksheet.mergeCells('A5:G5')
  const titleCell = worksheet.getCell('A5')
  titleCell.value = 'PURCHASE ORDER'
  titleCell.font = { size: 14, bold: true }
  titleCell.alignment = { horizontal: 'center' }

  worksheet.addRow([])

  // PO Details
  worksheet.addRow(['', 'PO Number:', purchase.purchaseOrderNumber, '', '', 'SUPPLIER:', purchase.supplier.name])
  worksheet.addRow(['', 'Date:', new Date(purchase.orderDate).toLocaleDateString(), '', '', 'Address:', purchase.supplier.address || ''])
  worksheet.addRow(['', 'Status:', purchase.status.toUpperCase(), '', '', 'Phone:', purchase.supplier.phone || ''])

  if (purchase.expectedDeliveryDate) {
    worksheet.addRow(['', 'Expected Delivery:', new Date(purchase.expectedDeliveryDate).toLocaleDateString(), '', '', 'Email:', purchase.supplier.email || ''])
  }

  worksheet.addRow([])

  // Items Table Header
  const headerRow = worksheet.addRow(['', 'Item Code', 'Description', 'Qty Ordered', 'Qty Received', 'Unit Cost', 'Total'])
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Items Data
  purchase.items.forEach((item: any, index: number) => {
    const itemName = item.product.name
    const variationName = item.productVariation?.name || ''
    const fullDescription = variationName ? `${itemName} - ${variationName}` : itemName
    const lineTotal = parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString())

    const row = worksheet.addRow([
      '',
      item.product.sku || `#${index + 1}`,
      fullDescription,
      parseFloat(item.quantity.toString()),
      parseFloat(item.quantityReceived.toString()),
      parseFloat(item.unitCost.toString()),
      lineTotal,
    ])

    // Format currency columns
    row.getCell(6).numFmt = '₱#,##0.00'
    row.getCell(7).numFmt = '₱#,##0.00'
  })

  // Totals Section
  worksheet.addRow([])
  const subtotalRow = worksheet.addRow(['', '', '', '', '', 'Subtotal:', parseFloat(purchase.subtotal.toString())])
  subtotalRow.getCell(7).numFmt = '₱#,##0.00'
  subtotalRow.getCell(6).font = { bold: true }

  if (parseFloat(purchase.taxAmount.toString()) > 0) {
    const taxRow = worksheet.addRow(['', '', '', '', '', 'Tax:', parseFloat(purchase.taxAmount.toString())])
    taxRow.getCell(7).numFmt = '₱#,##0.00'
  }

  if (parseFloat(purchase.discountAmount.toString()) > 0) {
    const discountRow = worksheet.addRow(['', '', '', '', '', 'Discount:', -parseFloat(purchase.discountAmount.toString())])
    discountRow.getCell(7).numFmt = '₱#,##0.00'
  }

  if (parseFloat(purchase.shippingCost.toString()) > 0) {
    const shippingRow = worksheet.addRow(['', '', '', '', '', 'Shipping:', parseFloat(purchase.shippingCost.toString())])
    shippingRow.getCell(7).numFmt = '₱#,##0.00'
  }

  const totalRow = worksheet.addRow(['', '', '', '', '', 'TOTAL:', parseFloat(purchase.totalAmount.toString())])
  totalRow.getCell(6).font = { bold: true, size: 12 }
  totalRow.getCell(7).font = { bold: true, size: 12 }
  totalRow.getCell(7).numFmt = '₱#,##0.00'

  // Notes
  if (purchase.notes) {
    worksheet.addRow([])
    const notesLabelRow = worksheet.addRow(['', 'Notes:'])
    notesLabelRow.getCell(2).font = { bold: true }
    worksheet.mergeCells(`B${worksheet.lastRow!.number + 1}:G${worksheet.lastRow!.number + 1}`)
    const notesRow = worksheet.addRow(['', purchase.notes])
    notesRow.getCell(2).alignment = { wrapText: true }
  }

  // Payment Terms
  worksheet.addRow([])
  worksheet.addRow(['', 'Payment Terms:', `${purchase.supplier.paymentTerms || 30} days`])

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${purchase.purchaseOrderNumber}.xlsx"`,
    },
  })
}
