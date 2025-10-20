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

    // Fetch business details (name + pricing configuration)
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

    const mmPerPoint = 0.352778
    const lineHeightFactor = 1.2

    const productIdSet = new Set<number>()
    products.forEach((item: any) => {
      if (item?.productId) {
        productIdSet.add(Number(item.productId))
      }
    })

    const productRecords = await prisma.product.findMany({
      where: {
        id: { in: Array.from(productIdSet) },
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        tax: { select: { amount: true } },
        variations: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true,
            isDefault: true,
          },
        },
      },
    })

    const productLookup = new Map<number, typeof productRecords[number]>()
    productRecords.forEach((record) => {
      productLookup.set(record.id, record)
    })

    let currentLabel = 0
    let currentPage = 0

    // Generate labels for each product
    for (const product of products as Array<any>) {
      const productId = Number(product.productId)
      const variationId = product.variationId ? Number(product.variationId) : null
      const productRecord = productLookup.get(productId)

      const taxRate = productRecord?.tax?.amount ? Number(productRecord.tax.amount) : 0

      const variationRecord = variationId
        ? productRecord?.variations.find((variation) => variation.id === variationId)
        : productRecord?.variations.find((variation) => variation.isDefault) ||
          productRecord?.variations.find((variation) => variation.sku === product.sku)

      const basePrice = variationRecord?.sellingPrice
        ? Number(variationRecord.sellingPrice)
        : productRecord?.sellingPrice
        ? Number(productRecord.sellingPrice)
        : typeof product.price === 'number'
        ? Number(product.price)
        : 0

      const showPriceMode: 'inc_tax' | 'exc_tax' = settings.showPrice === 'exc_tax' ? 'exc_tax' : 'inc_tax'
      const businessPriceTax = business?.sellPriceTax === 'excludes' ? 'excludes' : 'includes'

      const computePrice = () => {
        if (basePrice <= 0) {
          return 0
        }

        if (showPriceMode === 'inc_tax') {
          if (businessPriceTax === 'includes') {
            return basePrice
          }
          return taxRate ? basePrice * (1 + taxRate / 100) : basePrice
        } else {
          if (businessPriceTax === 'includes') {
            return taxRate ? basePrice / (1 + taxRate / 100) : basePrice
          }
          return basePrice
        }
      }

      const displayPrice = computePrice()

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

        const addTextBlock = (
          text: string,
          {
            fontSize,
            fontStyle = 'normal',
            extraSpacing = 0.6,
            maxWidth = labelWidth - 4,
            maxLines,
          }: {
            fontSize: number
            fontStyle?: 'normal' | 'bold'
            extraSpacing?: number
            maxWidth?: number
            maxLines?: number
          }
        ) => {
          if (!text || text.trim().length === 0) return

          doc.setFontSize(fontSize)
          doc.setFont('helvetica', fontStyle)

          let lines = doc.splitTextToSize(text, maxWidth) as string[]
          if (maxLines && lines.length > maxLines) {
            lines = lines.slice(0, maxLines)
          }

          doc.text(lines, x + labelWidth / 2, currentY, {
            align: 'center',
            baseline: 'top',
            lineHeightFactor,
          })

          const blockHeight = lines.length * fontSize * lineHeightFactor * mmPerPoint
          currentY += blockHeight + extraSpacing
        }

        // Business name
        if (settings.businessName && business) {
          const fontSize = Math.min(settings.businessNameSize, 10) // Cap at 10pt
          addTextBlock(business.name, { fontSize, fontStyle: 'bold', maxLines: 2, extraSpacing: 0.6 })
        }

        // Product name
        if (settings.productName) {
          const fontSize = Math.min(settings.productNameSize, 9) // Cap at 9pt
          const productText = product.name.substring(0, 60) // Allow longer names, will wrap if needed
          addTextBlock(productText, { fontSize, fontStyle: 'bold', maxLines: 3, extraSpacing: 0.6 })
        }

        // Product variation
        if (settings.productVariation && product.variation !== 'Default') {
          const fontSize = Math.min(settings.productVariationSize, 8) // Cap at 8pt
          addTextBlock(product.variation, { fontSize, maxLines: 2, extraSpacing: 0.6 })
        }

        // Add small spacing before barcode
        currentY += 0.8

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
          currentY += barcodeHeight + 1.4

          // Show SKU below barcode with clearer spacing
          addTextBlock(product.sku, { fontSize: 8, extraSpacing: 1.2, maxLines: 1 })
        } catch (error) {
          console.error('Barcode generation error:', error)
          // Fallback: show SKU as text
          addTextBlock(product.sku, { fontSize: 8, extraSpacing: 1.2, maxLines: 1 })
        }

        // Price
        if (settings.productPrice) {
          const fontSize = Math.min(settings.productPriceSize, 11) // Cap at 11pt
          const priceText =
            displayPrice > 0
              ? displayPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00'
          addTextBlock(priceText, { fontSize, fontStyle: 'bold', maxLines: 1, extraSpacing: 1 })
        }

        // Packing date
        if (settings.packingDate && product.packingDate) {
          const fontSize = Math.min(settings.packingDateSize, 6) // Cap at 6pt for date
          const dateText = `Packed: ${product.packingDate}`
          addTextBlock(dateText, { fontSize, extraSpacing: 0 })
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
