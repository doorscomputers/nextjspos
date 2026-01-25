import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

const MAX_ROWS = 20

/**
 * Helper function to parse file data
 */
async function parseFileData(file: File): Promise<any[]> {
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
    return result.data || []
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json(worksheet) || []
  } else {
    throw new Error('Invalid file type. Please upload CSV or XLSX file.')
  }
}

/**
 * Helper function to extract SKU from row
 */
function getSku(row: any): string | null {
  const value = (
    row['SKU'] || row['sku'] || row['Sku'] ||
    row['Item Code'] || row['item code'] || row['ITEM CODE'] ||
    row[' SKU '] || row[' Item Code ']
  )
  return value?.toString().trim() || null
}

/**
 * Helper function to extract item name from row
 */
function getItemName(row: any): string | null {
  const value = (
    row['Item Name'] || row['item name'] || row['ITEM NAME'] ||
    row['Product Name'] || row['product name'] || row['PRODUCT NAME'] ||
    row['Name'] || row['name'] || row['NAME'] ||
    row[' PRODUCT '] || row[' Item Name ']
  )
  return value?.toString().trim() || null
}

/**
 * Helper function to extract cost from row
 */
function getNewCost(row: any): number | null {
  const rawValue = (
    row['New Cost'] || row['new cost'] || row['NEW COST'] ||
    row['New COST'] || row['Cost'] || row['cost'] || row['COST'] ||
    row[' NEW COST '] || row[' New Cost ']
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
 * Helper function to extract selling price from row
 */
function getNewPrice(row: any): number | null {
  const rawValue = (
    row['New SRP'] || row['new srp'] || row['NEW SRP'] ||
    row['New Selling Price'] || row['new selling price'] || row['NEW SELLING PRICE'] ||
    row['Selling Price'] || row['selling price'] || row['SELLING PRICE'] ||
    row['SRP'] || row['srp'] || row['Price'] || row['price'] ||
    row[' NEW SRP '] || row[' New SRP ']
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
 * POST /api/products/cost-price-import
 * Import product costs and prices from CSV/XLSX file (max 20 rows)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Row limit validation
    if (data.length > MAX_ROWS) {
      return NextResponse.json({
        error: `Maximum ${MAX_ROWS} rows allowed per upload. Your file has ${data.length} rows. Please split your file into smaller batches.`
      }, { status: 400 })
    }

    const now = new Date()

    // Get only ACTIVE locations for this business
    const allLocations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        isActive: true,
      },
      select: { id: true, name: true },
    })

    if (allLocations.length === 0) {
      return NextResponse.json({ error: 'No business locations found' }, { status: 400 })
    }

    // Process rows
    const errors: Array<{ row: number; itemName?: string; error: string }> = []
    const previewItems: Array<{
      row: number
      sku: string
      itemName: string
      oldCost: number
      newCost: number
      oldPrice: number
      newPrice: number
      costDifference: number
      priceDifference: number
      variationId: number
      status: 'will_update' | 'no_change'
    }> = []

    const toUpdate: Array<{
      variation: any
      product: any
      newCost: number
      newPrice: number
      row: number
      oldCost: number
      oldPrice: number
    }> = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // Excel rows start at 1, plus header row
      const sku = getSku(row)
      const itemName = getItemName(row)
      const newCost = getNewCost(row)
      const newPrice = getNewPrice(row)

      if (!sku && !itemName) {
        errors.push({ row: rowNum, error: 'SKU or Item Name is required' })
        continue
      }

      if (newCost === null && newPrice === null) {
        errors.push({ row: rowNum, itemName: itemName || sku || '', error: 'At least one of New Cost or New SRP is required' })
        continue
      }

      // Find product variation by SKU first
      let variation = await prisma.productVariation.findFirst({
        where: { sku: sku || undefined },
        include: {
          product: true,
          variationLocationDetails: {
            where: { locationId: { in: allLocations.map(l => l.id) } },
            select: { id: true, locationId: true, sellingPrice: true },
          },
        },
      })

      // Fallback to product name if SKU not found
      if (!variation && itemName) {
        const product = await prisma.product.findFirst({
          where: {
            businessId,
            name: { equals: itemName, mode: 'insensitive' },
          },
          include: {
            variations: {
              include: {
                variationLocationDetails: {
                  where: { locationId: { in: allLocations.map(l => l.id) } },
                  select: { id: true, locationId: true, sellingPrice: true },
                },
              },
            },
          },
        })
        if (product && product.variations.length > 0) {
          variation = { ...product.variations[0], product }
        }
      }

      if (!variation) {
        errors.push({ row: rowNum, itemName: itemName || sku || '', error: 'Product not found' })
        continue
      }

      const oldCost = Number(variation.purchasePrice || 0)
      const oldPrice = Number(variation.sellingPrice || 0)
      const finalNewCost = newCost !== null ? newCost : oldCost
      const finalNewPrice = newPrice !== null ? newPrice : oldPrice
      const costDiff = finalNewCost - oldCost
      const priceDiff = finalNewPrice - oldPrice

      if (isPreview) {
        previewItems.push({
          row: rowNum,
          sku: sku || variation.sku || '',
          itemName: variation.product.name,
          oldCost,
          newCost: finalNewCost,
          oldPrice,
          newPrice: finalNewPrice,
          costDifference: costDiff,
          priceDifference: priceDiff,
          variationId: variation.id,
          status: costDiff !== 0 || priceDiff !== 0 ? 'will_update' : 'no_change',
        })
      } else {
        toUpdate.push({
          variation,
          product: variation.product,
          newCost: finalNewCost,
          newPrice: finalNewPrice,
          row: rowNum,
          oldCost,
          oldPrice,
        })
      }
    }

    // PREVIEW MODE
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

    // ACTUAL UPDATE MODE
    const results: Array<{
      row: number
      sku: string
      itemName: string
      newCost: number
      newPrice: number
      locationsUpdated: number
    }> = []

    await prisma.$transaction(async (tx) => {
      for (const { variation, product, newCost, newPrice, row, oldCost, oldPrice } of toUpdate) {
        // Skip if no changes
        if (newCost === oldCost && newPrice === oldPrice) {
          continue
        }

        // Update ProductVariation (cost and selling price)
        await tx.productVariation.update({
          where: { id: variation.id },
          data: {
            purchasePrice: newCost,
            sellingPrice: newPrice,
          },
        })

        // Update VariationLocationDetails for all active locations
        for (const location of allLocations) {
          await tx.variationLocationDetails.updateMany({
            where: {
              productVariationId: variation.id,
              locationId: location.id,
            },
            data: {
              sellingPrice: newPrice,
              lastPriceUpdate: now,
            },
          })
        }

        results.push({
          row,
          sku: variation.sku || '',
          itemName: product.name,
          newCost,
          newPrice,
          locationsUpdated: allLocations.length,
        })
      }
    })

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
    console.error('Cost-price import error:', error)
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
 * GET /api/products/cost-price-import
 * Download template for cost-price import
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create sample template
    const template = [
      { 'SKU': '760557828112', 'Item Name': 'TRANSCEND 1TB STOREJET', 'New Cost': 4325.00, 'New SRP': 5630.00 },
      { 'SKU': '4711085936417', 'Item Name': 'ADATA 8GB DDR5 4800', 'New Cost': 3270.00, 'New SRP': 4260.00 },
      { 'SKU': '', 'Item Name': 'SANDISK 32GB ULTRA FLAIR', 'New Cost': 350.00, 'New SRP': 455.00 },
    ]

    const worksheet = XLSX.utils.json_to_sheet(template)
    worksheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Price Import')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="cost-price-import-template.xlsx"',
      },
    })
  } catch (error) {
    console.error('Template download error:', error)
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    )
  }
}
