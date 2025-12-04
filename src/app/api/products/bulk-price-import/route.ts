import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { sendTelegramBulkPriceChangeAlert } from '@/lib/telegram'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

/**
 * POST /api/products/bulk-price-import
 * Import product prices from CSV/XLSX file
 * Updates sellingPrice in VariationLocationDetails for ALL locations
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

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name.toLowerCase()

    let data: any[] = []

    // Parse based on file type
    if (fileName.endsWith('.csv')) {
      // Parse CSV
      const text = buffer.toString('utf-8')
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      })
      data = result.data
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Parse Excel
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet)
    } else {
      return NextResponse.json({ error: 'Invalid file type. Please upload CSV or XLSX file.' }, { status: 400 })
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Empty or invalid file' }, { status: 400 })
    }

    const userId = Number(session.user.id)
    const now = new Date()
    const results: any[] = []
    const errors: any[] = []
    const priceChanges: Array<{
      productName: string
      productSku: string
      locationName: string
      oldPrice: number
      newPrice: number
    }> = []

    // Get all locations for this business
    const allLocations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true, name: true },
    })

    if (allLocations.length === 0) {
      return NextResponse.json({ error: 'No business locations found' }, { status: 400 })
    }

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]

      try {
        // Get item name (support multiple column names)
        const itemName = (
          row['Item Name'] ||
          row['item name'] ||
          row['Product Name'] ||
          row['product name'] ||
          row['Name'] ||
          row['name'] ||
          row['ITEM NAME'] ||
          row['PRODUCT NAME'] ||
          row['NAME']
        )?.toString().trim()

        // Get new selling price (support multiple column names)
        const newPriceRaw = (
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

        if (!itemName) {
          errors.push({ row: i + 2, error: 'Item Name is required', data: row })
          continue
        }

        if (newPriceRaw === undefined || newPriceRaw === null || newPriceRaw === '') {
          errors.push({ row: i + 2, itemName, error: 'New Selling Price is required' })
          continue
        }

        // Parse price (handle comma-formatted numbers like 2,934.00)
        const priceString = newPriceRaw.toString().replace(/,/g, '')
        const newPrice = parseFloat(priceString)

        if (isNaN(newPrice) || newPrice < 0) {
          errors.push({ row: i + 2, itemName, error: `Invalid price value: ${newPriceRaw}` })
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

        // Update price for all variations and all locations
        let updatedCount = 0
        for (const variation of product.variations) {
          for (const location of allLocations) {
            // Check existing price
            const existingDetail = variation.variationLocationDetails.find(
              d => d.locationId === location.id
            )
            const oldPrice = existingDetail ? Number(existingDetail.sellingPrice || 0) : 0

            // Upsert the price for this variation at this location
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

            // Track price change for notification (only if price actually changed)
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
          itemName,
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

    // Send Telegram notification for price changes
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
