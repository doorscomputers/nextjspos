import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bwipjs from 'bwip-js'
import { jsPDF } from 'jspdf'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    const body = await request.json()
    const { products, settings } = body

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 })
    }

    // Fetch business name
    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) }
    })

    // Get label format dimensions
    const labelFormats: Record<string, { width: number; height: number; perRow: number; perCol: number }> = {
      '20_labels_4x1': { width: 101.6, height: 25.4, perRow: 2, perCol: 10 },
      '30_labels_2.625x1': { width: 66.675, height: 25.4, perRow: 3, perCol: 10 },
      '32_labels_2x1.25': { width: 50.8, height: 31.75, perRow: 4, perCol: 8 },
      '40_labels_2x1': { width: 50.8, height: 25.4, perRow: 4, perCol: 10 },
      '50_labels_1.5x1': { width: 38.1, height: 25.4, perRow: 5, perCol: 10 },
      'continuous': { width: 31.75, height: 25.4, perRow: 6, perCol: 10 }
    }

    const format = labelFormats[settings.barcodeFormat] || labelFormats['20_labels_4x1']

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter' // 8.5" x 11" (215.9mm x 279.4mm)
    })

    // Page dimensions
    const pageWidth = 215.9
    const pageHeight = 279.4
    const marginX = 5
    const marginY = 10

    // Calculate label positions
    const labelWidth = format.width
    const labelHeight = format.height
    const gapX = (pageWidth - marginX * 2 - labelWidth * format.perRow) / (format.perRow - 1)
    const gapY = (pageHeight - marginY * 2 - labelHeight * format.perCol) / (format.perCol - 1)

    let currentLabel = 0
    let currentPage = 0

    // Generate labels for each product
    for (const product of products) {
      for (let i = 0; i < product.quantity; i++) {
        // Calculate position
        const row = Math.floor((currentLabel % (format.perRow * format.perCol)) / format.perRow)
        const col = currentLabel % format.perRow

        // Add new page if needed
        if (currentLabel > 0 && currentLabel % (format.perRow * format.perCol) === 0) {
          doc.addPage()
          currentPage++
        }

        const x = marginX + col * (labelWidth + gapX)
        const y = marginY + row * (labelHeight + gapY)

        // Draw label border (for debugging)
        // doc.rect(x, y, labelWidth, labelHeight)

        let currentY = y + 3

        // Business name
        if (settings.businessName && business) {
          const fontSize = Math.min(settings.businessNameSize, 10) // Cap at 10pt
          doc.setFontSize(fontSize)
          doc.setFont('helvetica', 'bold')
          doc.text(business.name, x + labelWidth / 2, currentY, { align: 'center', maxWidth: labelWidth - 2 })
          currentY += fontSize * 0.5 + 1
        }

        // Product name
        if (settings.productName) {
          const fontSize = Math.min(settings.productNameSize, 9) // Cap at 9pt
          doc.setFontSize(fontSize)
          doc.setFont('helvetica', 'bold')
          const productText = product.name.substring(0, 35) // Limit length
          doc.text(productText, x + labelWidth / 2, currentY, { align: 'center', maxWidth: labelWidth - 2 })
          currentY += fontSize * 0.5 + 1
        }

        // Product variation
        if (settings.productVariation && product.variation !== 'Default') {
          const fontSize = Math.min(settings.productVariationSize, 8) // Cap at 8pt
          doc.setFontSize(fontSize)
          doc.setFont('helvetica', 'normal')
          doc.text(product.variation, x + labelWidth / 2, currentY, { align: 'center', maxWidth: labelWidth - 2 })
          currentY += fontSize * 0.5 + 1
        }

        // Add small spacing before barcode
        currentY += 0.5

        // Generate barcode
        try {
          const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: product.sku,
            scale: 2,
            height: 6,
            includetext: false, // We'll show SKU below barcode
            textxalign: 'center'
          })

          // Convert buffer to base64
          const barcodeBase64 = `data:image/png;base64,${barcodeBuffer.toString('base64')}`

          // Add barcode image to PDF
          const barcodeWidth = labelWidth - 4
          const barcodeHeight = 8
          doc.addImage(barcodeBase64, 'PNG', x + 2, currentY, barcodeWidth, barcodeHeight)
          currentY += barcodeHeight + 0.5

          // Show SKU below barcode
          doc.setFontSize(6)
          doc.setFont('helvetica', 'normal')
          doc.text(product.sku, x + labelWidth / 2, currentY, { align: 'center' })
          currentY += 3
        } catch (error) {
          console.error('Barcode generation error:', error)
          // Fallback: show SKU as text
          doc.setFontSize(8)
          doc.text(product.sku, x + labelWidth / 2, currentY, { align: 'center' })
          currentY += 4
        }

        // Price
        if (settings.productPrice) {
          const fontSize = Math.min(settings.productPriceSize, 11) // Cap at 11pt
          doc.setFontSize(fontSize)
          doc.setFont('helvetica', 'bold')
          const priceText = `$${product.price.toFixed(2)}`
          doc.text(priceText, x + labelWidth / 2, currentY, { align: 'center' })
          currentY += fontSize * 0.5 + 1
        }

        // Packing date
        if (settings.packingDate && product.packingDate) {
          const fontSize = Math.min(settings.packingDateSize, 6) // Cap at 6pt for date
          doc.setFontSize(fontSize)
          doc.setFont('helvetica', 'normal')
          const dateText = `Packed: ${product.packingDate}`
          doc.text(dateText, x + labelWidth / 2, currentY, { align: 'center' })
        }

        currentLabel++
      }
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="product-labels-${Date.now()}.pdf"`,
      },
    })

  } catch (error) {
    console.error('Error generating labels:', error)
    return NextResponse.json(
      { error: 'Failed to generate labels', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
