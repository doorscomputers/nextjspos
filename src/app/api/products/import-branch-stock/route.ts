import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, isSuperAdmin } from '@/lib/rbac'

interface CSVRow {
  'Item Code': string
  'Item Name': string
  'Supplier': string
  'Category ID': string  // Changed to ID
  'Brand ID': string      // Changed to ID
  'Last Delivery Date': string
  'Last Qty Delivered': string
  '?Cost': string
  '?Price': string
  'Warehouse': string
  'Main Store': string
  'Bambang': string
  'Tuguegarao': string
  'Total Stocks': string
  '?Total Cost': string
  '?Total Price': string
  'Active': string
}

// Helper function to get column value with fallback for different column name variations
function getColumnValue(row: any, ...columnNames: string[]): string | undefined {
  for (const name of columnNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name]
    }
  }
  return undefined
}

// Helper function to parse currency values (remove ₱, ?, and commas)
function parseCurrency(value: string | undefined): number {
  if (!value || value === '') return 0
  const cleaned = value.replace(/₱|\?|,/g, '').trim()
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

// Helper function to parse boolean
function parseBoolean(value: string): boolean {
  return value?.toUpperCase() === 'TRUE'
}

// Helper function to ensure non-negative stock
function parseStock(value: string): number {
  const stock = parseFloat(value)
  return isNaN(stock) || stock < 0 ? 0 : stock
}

// Location name mapping
const LOCATION_MAPPING: Record<string, string> = {
  'Warehouse': 'Main Warehouse',
  'Main Store': 'Main Store',
  'Bambang': 'Bambang',
  'Tuguegarao': 'Tuguegarao'
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user
    const businessId = parseInt(String(user.businessId))

    // Check permission - Super Admin only
    if (!isSuperAdmin(user)) {
      return NextResponse.json({
        error: 'Forbidden: This feature is only available to Super Administrators'
      }, { status: 403 })
    }

    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products to import' }, { status: 400 })
    }

    // Quick validation log
    console.log(`Starting import of ${products.length} products...`)

    // Fetch all business locations upfront
    const locations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true, name: true }
    })

    const locationMap = new Map(locations.map(loc => [loc.name, loc.id]))

    // Validate all required locations exist
    const requiredLocations = Object.values(LOCATION_MAPPING)
    const missingLocations = requiredLocations.filter(name => !locationMap.has(name))

    if (missingLocations.length > 0) {
      return NextResponse.json({
        error: `Missing required locations: ${missingLocations.join(', ')}. Please create these locations first.`
      }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      totalInventoryRecords: 0,
      errors: [] as Array<{ row: number; sku: string; error: string }>
    }

    // Get default unit if needed
    let defaultUnit = await prisma.unit.findFirst({
      where: { businessId, name: 'Piece' }
    })

    if (!defaultUnit) {
      defaultUnit = await prisma.unit.create({
        data: {
          name: 'Piece',
          shortName: 'PC',
          allowDecimal: false,
          businessId
        }
      })
    }

    // Process each product in a transaction
    for (let i = 0; i < products.length; i++) {
      const product = products[i] as CSVRow
      const rowNumber = i + 2 // Account for header row

      try {
        // Validate required fields
        if (!product['Item Code'] || !product['Item Name']) {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            sku: product['Item Code'] || 'N/A',
            error: 'Missing Item Code or Item Name'
          })
          continue
        }

        const sku = product['Item Code'].trim()
        const name = product['Item Name'].trim()

        // Check if product already exists
        const existingProduct = await prisma.product.findFirst({
          where: {
            businessId,
            sku
          }
        })

        if (existingProduct) {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            sku,
            error: 'Product with this SKU already exists'
          })
          continue
        }

        // Parse prices - try multiple column name variations
        const costRaw = getColumnValue(product, '?Cost', 'Cost', '﻿?Cost', 'Purchase Price', 'Unit Cost')
        const priceRaw = getColumnValue(product, '?Price', 'Price', '﻿?Price', 'Selling Price', 'Unit Price')

        const purchasePrice = parseCurrency(costRaw)
        const sellingPrice = parseCurrency(priceRaw)
        const isActive = parseBoolean(product['Active'])

        // Log progress every 100 products
        if (i % 100 === 0) {
          console.log(`Processing ${i + 1}/${products.length}...`)
        }

        // Get Brand ID (must already exist)
        let brandId: number | null = null
        if (product['Brand ID'] && product['Brand ID'].trim()) {
          const parsedBrandId = parseInt(product['Brand ID'].trim())
          if (!isNaN(parsedBrandId)) {
            const brand = await prisma.brand.findFirst({
              where: { id: parsedBrandId, businessId }
            })
            if (brand) {
              brandId = brand.id
            } else {
              throw new Error(`Brand ID ${parsedBrandId} not found. Please import brands first.`)
            }
          }
        }

        // Get Category ID (must already exist)
        let categoryId: number | null = null
        if (product['Category ID'] && product['Category ID'].trim()) {
          const parsedCategoryId = parseInt(product['Category ID'].trim())
          if (!isNaN(parsedCategoryId)) {
            const category = await prisma.category.findFirst({
              where: { id: parsedCategoryId, businessId }
            })
            if (category) {
              categoryId = category.id
            } else {
              throw new Error(`Category ID ${parsedCategoryId} not found. Please import categories first.`)
            }
          }
        }

        // Use transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          // Create product
          const newProduct = await tx.product.create({
            data: {
              name,
              sku,
              type: 'single',
              businessId,
              unitId: defaultUnit!.id,
              brandId,
              categoryId,
              purchasePrice,
              sellingPrice,
              barcodeType: 'C128',
              enableStock: true,
              isActive
              // Note: Product model doesn't have createdBy field, only createdAt (auto-set)
            }
          })

          // Create default variation for single product
          const variation = await tx.productVariation.create({
            data: {
              productId: newProduct.id,
              name: 'Default',
              sku: sku, // Use the same SKU as the product
              purchasePrice: purchasePrice || 0,
              sellingPrice: sellingPrice || 0,
              isDefault: true,
              businessId
              // Note: ProductVariation doesn't have isActive field
            }
          })

          // Process stock for each location
          const stockColumns = ['Warehouse', 'Main Store', 'Bambang', 'Tuguegarao'] as const

          for (const columnName of stockColumns) {
            const stockValue = parseStock(product[columnName])
            const dbLocationName = LOCATION_MAPPING[columnName]
            const locationId = locationMap.get(dbLocationName)

            if (!locationId) continue

            // Create VariationLocationDetails entry with selling price
            await tx.variationLocationDetails.create({
              data: {
                productId: newProduct.id,
                productVariationId: variation.id,
                locationId,
                qtyAvailable: stockValue,
                sellingPrice: sellingPrice || 0  // Set location selling price from CSV
                // Note: VariationLocationDetails doesn't have businessId field
              }
            })

            // Create StockTransaction entry for beginning inventory (CRITICAL for inventory tracking)
            if (stockValue > 0) {
              await tx.stockTransaction.create({
                data: {
                  businessId,
                  locationId,
                  productId: newProduct.id,
                  productVariationId: variation.id,
                  type: 'opening_stock',
                  quantity: stockValue,
                  unitCost: purchasePrice || 0,
                  refNo: `CSV-IMPORT-${newProduct.id}`,
                  notes: `Opening stock from Branch Stock Pivot CSV import`,
                  createdBy: parseInt(String(user.id))
                }
              })

              // Create ProductHistory entry for beginning inventory
              await tx.productHistory.create({
                data: {
                  businessId,
                  locationId,
                  productId: newProduct.id,
                  productVariationId: variation.id,
                  transactionType: 'opening_stock',
                  transactionDate: new Date(),
                  referenceType: 'csv_import',
                  referenceId: newProduct.id,
                  referenceNumber: `CSV-IMPORT-${newProduct.id}`,
                  quantityChange: stockValue,
                  balanceQuantity: stockValue,
                  unitCost: purchasePrice || 0,
                  totalValue: (purchasePrice || 0) * stockValue,
                  createdBy: parseInt(String(user.id)),
                  createdByName: user.username,
                  reason: `Opening stock from Branch Stock Pivot CSV import`
                }
              })

              results.totalInventoryRecords++
            }
          }
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          sku: product['Item Code'] || 'N/A',
          error: error.message
        })
      }
    }

    console.log(`Import completed: ${results.success} successful, ${results.failed} failed, ${results.skipped} skipped`)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Import branch stock error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import branch stock' },
      { status: 500 }
    )
  }
}
