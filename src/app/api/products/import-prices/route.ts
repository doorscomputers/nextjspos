import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { sendTelegramPriceChangeAlert, sendTelegramBulkPriceChangeAlert } from '@/lib/telegram'
import * as XLSX from 'xlsx'

/**
 * POST /api/products/import-prices
 * Import product prices from Excel/CSV file
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

    const businessId = Number(session.user.businessId)
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

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Empty or invalid file' }, { status: 400 })
    }

    // Get accessible location IDs for this user
    const accessibleLocationIds = getUserAccessibleLocationIds(session.user)
    const canEditAll = hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_EDIT_ALL)

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

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]

      try {
        // Required fields validation
        const sku = row['SKU'] || row['sku'] || row['Product SKU']
        const locationName = row['Location'] || row['location'] || row['Location Name']
        const sellingPrice = row['Selling Price'] || row['selling_price'] || row['Price']
        const pricePercentage = row['Price Percentage'] || row['price_percentage'] || row['Percentage']

        if (!sku) {
          errors.push({ row: i + 2, error: 'SKU is required' })
          continue
        }

        if (!locationName) {
          errors.push({ row: i + 2, sku, error: 'Location is required' })
          continue
        }

        // Find product variation by SKU
        const variation = await prisma.productVariation.findFirst({
          where: {
            OR: [
              { sku: sku },
              {
                product: {
                  sku: sku,
                  businessId,
                },
              },
            ],
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                businessId: true,
              },
            },
          },
        })

        if (!variation) {
          errors.push({ row: i + 2, sku, error: 'Product not found' })
          continue
        }

        if (variation.product.businessId !== businessId) {
          errors.push({ row: i + 2, sku, error: 'Product does not belong to your business' })
          continue
        }

        // Find location by name
        const location = await prisma.businessLocation.findFirst({
          where: {
            businessId,
            name: {
              equals: locationName,
              mode: 'insensitive',
            },
          },
        })

        if (!location) {
          errors.push({ row: i + 2, sku, locationName, error: 'Location not found' })
          continue
        }

        // Check location access
        if (!canEditAll && accessibleLocationIds !== null) {
          if (!accessibleLocationIds.includes(location.id)) {
            errors.push({ row: i + 2, sku, locationName, error: 'Access denied to this location' })
            continue
          }
        }

        // Parse prices
        const parsedPrice = sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== ''
          ? Number(sellingPrice)
          : null

        const parsedPercentage = pricePercentage !== undefined && pricePercentage !== null && pricePercentage !== ''
          ? Number(pricePercentage)
          : null

        if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) {
          errors.push({ row: i + 2, sku, error: 'Invalid selling price' })
          continue
        }

        if (parsedPercentage !== null && isNaN(parsedPercentage)) {
          errors.push({ row: i + 2, sku, error: 'Invalid price percentage' })
          continue
        }

        // Get old price for Telegram notification
        const existingPrice = await prisma.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: variation.id,
              locationId: location.id,
            },
          },
          select: {
            sellingPrice: true,
          },
        })

        const oldPrice = Number(existingPrice?.sellingPrice || 0)
        const newPrice = parsedPrice !== null ? parsedPrice : oldPrice

        // Update or create variation location details
        const locationDetails = await prisma.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId: variation.id,
              locationId: location.id,
            },
          },
          update: {
            sellingPrice: parsedPrice,
            pricePercentage: parsedPercentage,
            lastPriceUpdate: now,
            lastPriceUpdatedBy: userId,
          },
          create: {
            productId: variation.product.id,
            productVariationId: variation.id,
            locationId: location.id,
            qtyAvailable: 0,
            sellingPrice: parsedPrice,
            pricePercentage: parsedPercentage,
            lastPriceUpdate: now,
            lastPriceUpdatedBy: userId,
          },
          select: {
            id: true,
            productVariationId: true,
            locationId: true,
            sellingPrice: true,
            pricePercentage: true,
          },
        })

        results.push({
          row: i + 2,
          sku,
          locationName,
          sellingPrice: parsedPrice,
          pricePercentage: parsedPercentage,
        })

        // Track price change for Telegram notification (only if price actually changed)
        if (parsedPrice !== null && oldPrice !== newPrice) {
          priceChanges.push({
            productName: variation.product.name || 'Unknown Product',
            productSku: sku,
            locationName: locationName,
            oldPrice,
            newPrice,
          })
        }
      } catch (error) {
        console.error(`Error processing row ${i + 2}:`, error)
        errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Send Telegram notifications for price changes
    if (priceChanges.length > 0) {
      try {
        const changedBy = session.user.name || session.user.username || 'Unknown User'

        // For imports, always send bulk summary since it's typically many products
        await sendTelegramBulkPriceChangeAlert({
          changedBy,
          totalProducts: priceChanges.length,
          changeType: 'Price Import',
          timestamp: now,
          sampleChanges: priceChanges.slice(0, 5),
        })
      } catch (telegramError) {
        // Log but don't fail the request if Telegram fails
        console.error('Failed to send Telegram notification:', telegramError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${results.length} prices. ${errors.length} errors.`,
      data: {
        imported: results,
        errors,
        summary: {
          totalRows: data.length,
          successCount: results.length,
          errorCount: errors.length,
        },
      },
    })
  } catch (error) {
    console.error('Import prices error:', error)
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
 * GET /api/products/import-prices/template
 * Download Excel template for price import
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create sample template
    const template = [
      {
        'SKU': 'PROD-001',
        'Location': 'Main Warehouse',
        'Selling Price': 1500.00,
        'Price Percentage': 10.00,
      },
      {
        'SKU': 'PROD-002',
        'Location': 'Branch A',
        'Selling Price': 2500.00,
        'Price Percentage': 5.00,
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(template)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Price Import Template')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="price-import-template.xlsx"',
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
