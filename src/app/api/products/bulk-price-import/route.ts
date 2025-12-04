import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { sendTelegramBulkPriceChangeAlert } from '@/lib/telegram'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

/**
 * Helper function to parse file data
 */
async function parseFileData(file: File): Promise<any[]> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.csv')) {
      const text = buffer.toString('utf-8')
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      })

      if (result.errors && result.errors.length > 0) {
        console.error('CSV Parse errors:', result.errors)
      }

      return result.data || []
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      return XLSX.utils.sheet_to_json(worksheet) || []
    } else {
      throw new Error('Invalid file type. Please upload CSV or XLSX file.')
    }
  } catch (error) {
    console.error('Error parsing file:', error)
    throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Helper function to extract item name from row
 */
function getItemName(row: any): string | null {
  const value = (
    row['Item Name'] ||
    row['item name'] ||
    row['Product Name'] ||
    row['product name'] ||
    row['Name'] ||
    row['name'] ||
    row['ITEM NAME'] ||
    row['PRODUCT NAME'] ||
    row['NAME']
  )
  return value?.toString().trim() || null
}

/**
 * Helper function to extract price from row
 */
function getNewPrice(row: any): number | null {
  const rawValue = (
    row['New Selling Price'] ||
    row['new selling price'] ||
    row['Selling Price'] ||
    row['selling price'] ||
    row['Price'] ||
    row['price'] ||
    row['NEW SELLING PRICE'] ||
    row['SELLING PRICE'] ||
    row['PRICE']
  )

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null
  }

  const priceString = rawValue.toString().replace(/,/g, '')
  const price = parseFloat(priceString)

  if (isNaN(price) || price < 0) {
    return null
  }

  return price
}

/**
 * POST /api/products/bulk-price-import
 * Import product prices from CSV/XLSX file
 *
 * Modes:
 * - preview=true: Parse file and show old vs new prices WITHOUT saving (dry run)
 * - preview=false or not set: Actually apply the price changes
 *
 * Expected columns:
 * - Item Name (or Product Name, Name) - Required
 * - New Selling Price (or Selling Price, Price) - Required
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    if (!hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_IMPORT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const isPreview = formData.get('preview') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Parse file
    let data: any[]
    try {
      data = await parseFileData(file)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Empty or invalid file' }, { status: 400 })
    }

    const userId = Number(session.user.id)
    const now = new Date()

    // Get all locations for this business
    const allLocations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true, name: true },
    })

    if (allLocations.length === 0) {
      return NextResponse.json({ error: 'No business locations found' }, { status: 400 })
    }

    // Arrays to collect results
    const previewItems: Array<{
      row: number
      itemName: string
      oldPrice: number
      newPrice: number
      priceDifference: number
      productId: number
      variationIds: number[]
      status: 'will_update' | 'no_change'
    }> = []

    const results: Array<{
      row: number
      itemName: string
      newPrice: number
      locationsUpdated: number
      variationsUpdated: number
    }> = []

    const errors: Array<{
      row: number
      itemName?: string
      error: string
      data?: any
    }> = []

    const priceChanges: Array<{
      productName: string
      productSku: string
      locationName: string
      oldPrice: number
      newPrice: number
    }> = []

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]

      try {
        const itemName = getItemName(row)
        const newPrice = getNewPrice(row)

        if (!itemName) {
          errors.push({ row: i + 2, error: 'Item Name is required', data: row })
          continue
        }

        if (newPrice === null) {
          const rawValue = row['New Selling Price'] || row['Selling Price'] || row['Price']
          errors.push({
            row: i + 2,
            itemName,
            error: rawValue ? `Invalid price value: ${rawValue}` : 'New Selling Price is required'
          })
          continue
        }

        // Find product by name (case-insensitive)
        const product = await prisma.product.findFirst({
          where: {
            businessId,
            name: {
              equals: itemName,
              mode: 'insensitive',
            },
          },
          include: {
            variations: {
              select: {
                id: true,
                name: true,
                variationLocationDetails: {
                  select: {
                    id: true,
                    locationId: true,
                    sellingPrice: true,
                  },
                },
              },
            },
          },
        })

        if (!product) {
          errors.push({ row: i + 2, itemName, error: 'Product not found' })
          continue
        }

        if (!product.variations || product.variations.length === 0) {
          errors.push({ row: i + 2, itemName, error: 'Product has no variations' })
          continue
        }

        // Get current price (use first variation's first location as reference)
        const firstVariation = product.variations[0]
        const firstLocationDetail = firstVariation.variationLocationDetails.find(
          d => d.locationId === allLocations[0]?.id
        )
        const currentPrice = firstLocationDetail ? Number(firstLocationDetail.sellingPrice || 0) : 0

        // PREVIEW MODE: Just collect data, don't save
        if (isPreview) {
          const priceDiff = newPrice - currentPrice
          previewItems.push({
            row: i + 2,
            itemName: product.name, // Use actual product name from DB
            oldPrice: currentPrice,
            newPrice: newPrice,
            priceDifference: priceDiff,
            productId: product.id,
            variationIds: product.variations.map(v => v.id),
            status: priceDiff !== 0 ? 'will_update' : 'no_change',
          })
          continue
        }

        // ACTUAL UPDATE MODE: Apply changes
        let updatedCount = 0
        for (const variation of product.variations) {
          for (const location of allLocations) {
            const existingDetail = variation.variationLocationDetails.find(
              d => d.locationId === location.id
            )
            const oldPrice = existingDetail ? Number(existingDetail.sellingPrice || 0) : 0

            await prisma.variationLocationDetails.upsert({
              where: {
                productVariationId_locationId: {
                  productVariationId: variation.id,
                  locationId: location.id,
                },
              },
              update: {
                sellingPrice: newPrice,
                lastPriceUpdate: now,
                lastPriceUpdatedBy: userId,
              },
              create: {
                productId: product.id,
                productVariationId: variation.id,
                locationId: location.id,
                qtyAvailable: 0,
                sellingPrice: newPrice,
                lastPriceUpdate: now,
                lastPriceUpdatedBy: userId,
              },
            })

            updatedCount++

            if (oldPrice !== newPrice) {
              priceChanges.push({
                productName: product.name,
                productSku: product.sku || 'N/A',
                locationName: location.name,
                oldPrice,
                newPrice,
              })
            }
          }
        }

        results.push({
          row: i + 2,
          itemName: product.name,
          newPrice,
          locationsUpdated: allLocations.length,
          variationsUpdated: product.variations.length,
        })
      } catch (error) {
        console.error(`Error processing row ${i + 2}:`, error)
        errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // PREVIEW MODE: Return preview data without saving
    if (isPreview) {
      const willUpdate = previewItems.filter(p => p.status === 'will_update').length
      const noChange = previewItems.filter(p => p.status === 'no_change').length

      return NextResponse.json({
        success: true,
        mode: 'preview',
        message: `Preview: ${willUpdate} products will be updated, ${noChange} unchanged, ${errors.length} errors.`,
        data: {
          preview: previewItems,
          errors,
          summary: {
            totalRows: data.length,
            willUpdate,
            noChange,
            errorCount: errors.length,
            locationsCount: allLocations.length,
          },
        },
      })
    }

    // ACTUAL UPDATE: Send Telegram notification
    if (priceChanges.length > 0) {
      try {
        const changedBy = session.user.name || session.user.username || 'Unknown User'
        await sendTelegramBulkPriceChangeAlert({
          changedBy,
          totalProducts: results.length,
          changeType: 'Bulk Price Import',
          timestamp: now,
          sampleChanges: priceChanges.slice(0, 5),
        })
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError)
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      message: `Updated ${results.length} products. ${errors.length} errors.`,
      data: {
        updated: results,
        errors,
        summary: {
          totalRows: data.length,
          successCount: results.length,
          errorCount: errors.length,
          locationsUpdated: allLocations.length,
        },
      },
    })
  } catch (error) {
    console.error('Bulk price import error:', error)
    return NextResponse.json(
      {
        error: 'Failed to import prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/products/bulk-price-import
 * Download template for bulk price import
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create sample template
    const template = [
      { 'Item Name': 'HIKSEMI 8GB DDR4 3200 LODIMM', 'New Selling Price': 2934.00 },
      { 'Item Name': 'PATRIOT 8GB DDR4 3200 LODIMM', 'New Selling Price': 2484.00 },
      { 'Item Name': 'PNY 16GB DDR4 3200 LODIMM', 'New Selling Price': 6192.00 },
    ]

    const worksheet = XLSX.utils.json_to_sheet(template)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 40 }, // Item Name
      { wch: 20 }, // New Selling Price
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Price Import')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="bulk-price-import-template.xlsx"',
      },
    })
  } catch (error) {
    console.error('Template download error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate template',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
