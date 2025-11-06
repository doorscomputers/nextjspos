import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, isSuperAdmin } from '@/lib/rbac'

interface CSVRow {
  'Item Code': string
  'Item Name': string
  'Supplier': string
  'Category ID': string
  'Brand ID': string
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

// Helper function to get column value with fallback
function getColumnValue(row: any, ...columnNames: string[]): string | undefined {
  for (const name of columnNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name]
    }
  }
  return undefined
}

// Helper function to parse currency values
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
  const startTime = Date.now()

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

    console.log(`[${Date.now() - startTime}ms] Starting OPTIMIZED import of ${products.length} products...`)

    // OPTIMIZATION 1: Fetch all data upfront (4 queries instead of 1529 * 3)
    const [locations, brands, categories, defaultUnit, existingProducts] = await Promise.all([
      // Fetch locations
      prisma.businessLocation.findMany({
        where: { businessId },
        select: { id: true, name: true }
      }),
      // Fetch ALL brands once
      prisma.brand.findMany({
        where: { businessId },
        select: { id: true, name: true }
      }),
      // Fetch ALL categories once
      prisma.category.findMany({
        where: { businessId },
        select: { id: true, name: true }
      }),
      // Get or create default unit
      prisma.unit.upsert({
        where: {
          businessId_name: { businessId, name: 'Piece' }
        },
        create: {
          name: 'Piece',
          shortName: 'PC',
          allowDecimal: false,
          businessId
        },
        update: {},
        select: { id: true }
      }),
      // Fetch ALL existing product SKUs once
      prisma.product.findMany({
        where: { businessId },
        select: { sku: true }
      })
    ])

    console.log(`[${Date.now() - startTime}ms] Fetched reference data`)

    const locationMap = new Map(locations.map(loc => [loc.name, loc.id]))
    const brandMap = new Map(brands.map(b => [b.id, b]))
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const existingSKUs = new Set(existingProducts.map(p => p.sku))

    // Validate all required locations exist
    const requiredLocations = Object.values(LOCATION_MAPPING)
    const missingLocations = requiredLocations.filter(name => !locationMap.has(name))

    if (missingLocations.length > 0) {
      return NextResponse.json({
        error: `Missing required locations: ${missingLocations.join(', ')}`
      }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      totalInventoryRecords: 0,
      errors: [] as Array<{ row: number; sku: string; error: string }>
    }

    // OPTIMIZATION 2: Validate ALL products upfront (in-memory, no DB queries)
    interface ValidatedProduct {
      rowNumber: number
      sku: string
      name: string
      brandId: number | null
      categoryId: number | null
      purchasePrice: number
      sellingPrice: number
      isActive: boolean
      stocks: Array<{
        locationName: string
        locationId: number
        quantity: number
      }>
    }

    const validProducts: ValidatedProduct[] = []

    console.log(`[${Date.now() - startTime}ms] Validating products...`)

    for (let i = 0; i < products.length; i++) {
      const product = products[i] as CSVRow
      const rowNumber = i + 2

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

        // Check if SKU already exists (in-memory check)
        if (existingSKUs.has(sku)) {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            sku,
            error: 'Product with this SKU already exists'
          })
          continue
        }

        // Validate Brand ID (in-memory check)
        let brandId: number | null = null
        if (product['Brand ID'] && product['Brand ID'].trim()) {
          const parsedBrandId = parseInt(product['Brand ID'].trim())
          if (!isNaN(parsedBrandId) && brandMap.has(parsedBrandId)) {
            brandId = parsedBrandId
          } else {
            throw new Error(`Brand ID ${parsedBrandId} not found`)
          }
        }

        // Validate Category ID (in-memory check)
        let categoryId: number | null = null
        if (product['Category ID'] && product['Category ID'].trim()) {
          const parsedCategoryId = parseInt(product['Category ID'].trim())
          if (!isNaN(parsedCategoryId) && categoryMap.has(parsedCategoryId)) {
            categoryId = parsedCategoryId
          } else {
            throw new Error(`Category ID ${parsedCategoryId} not found`)
          }
        }

        // Parse prices
        const costRaw = getColumnValue(product, '?Cost', 'Cost', '﻿?Cost')
        const priceRaw = getColumnValue(product, '?Price', 'Price', '﻿?Price')
        const purchasePrice = parseCurrency(costRaw)
        const sellingPrice = parseCurrency(priceRaw)
        const isActive = parseBoolean(product['Active'])

        // Parse stocks for each location
        const stockColumns = ['Warehouse', 'Main Store', 'Bambang', 'Tuguegarao'] as const
        const stocks: ValidatedProduct['stocks'] = []

        for (const columnName of stockColumns) {
          const quantity = parseStock(product[columnName])
          const dbLocationName = LOCATION_MAPPING[columnName]
          const locationId = locationMap.get(dbLocationName)

          if (locationId) {
            stocks.push({
              locationName: dbLocationName,
              locationId,
              quantity
            })
          }
        }

        validProducts.push({
          rowNumber,
          sku,
          name,
          brandId,
          categoryId,
          purchasePrice,
          sellingPrice,
          isActive,
          stocks
        })

      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          sku: product['Item Code'] || 'N/A',
          error: error.message
        })
      }
    }

    console.log(`[${Date.now() - startTime}ms] Validated ${validProducts.length} products`)

    if (validProducts.length === 0) {
      return NextResponse.json({
        success: true,
        results
      })
    }

    // OPTIMIZATION 3: Bulk insert using RAW SQL
    console.log(`[${Date.now() - startTime}ms] Starting bulk insert...`)

    // Create all products in one transaction with bulk inserts
    await prisma.$transaction(async (tx) => {
      // Bulk insert products
      const productValues = validProducts.map(p => {
        const brandVal = p.brandId !== null ? p.brandId : 'NULL'
        const catVal = p.categoryId !== null ? p.categoryId : 'NULL'
        return `(${businessId}, '${p.name.replace(/'/g, "''")}', '${p.sku}', 'single', ${defaultUnit.id}, ${brandVal}, ${catVal}, ${p.purchasePrice}, ${p.sellingPrice}, 'C128', true, ${p.isActive}, NOW(), NOW())`
      }).join(',\n')

      const productInsertSQL = `
        INSERT INTO products
          (business_id, name, sku, type, unit_id, brand_id, category_id, purchase_price, selling_price, barcode_type, enable_stock, is_active, created_at, updated_at)
        VALUES ${productValues}
        RETURNING id, sku
      `

      const insertedProducts = await tx.$queryRawUnsafe<Array<{ id: number; sku: string }>>(productInsertSQL)

      console.log(`[${Date.now() - startTime}ms] Inserted ${insertedProducts.length} products`)

      // Create SKU to ID map
      const skuToProductMap = new Map(insertedProducts.map(p => [p.sku, p.id]))

      // Bulk insert variations
      const variationValues = validProducts.map(p => {
        const productId = skuToProductMap.get(p.sku)!
        return `(${productId}, 'Default', '${p.sku}', ${p.purchasePrice}, ${p.sellingPrice}, true, ${businessId}, NOW(), NOW())`
      }).join(',\n')

      const variationInsertSQL = `
        INSERT INTO product_variations
          (product_id, name, sku, purchase_price, selling_price, is_default, business_id, created_at, updated_at)
        VALUES ${variationValues}
        RETURNING id, product_id
      `

      const insertedVariations = await tx.$queryRawUnsafe<Array<{ id: number; product_id: number }>>(variationInsertSQL)

      console.log(`[${Date.now() - startTime}ms] Inserted ${insertedVariations.length} variations`)

      // Create product_id to variation_id map
      const productToVariationMap = new Map(insertedVariations.map(v => [v.product_id, v.id]))

      // Bulk insert variation_location_details, stock_transactions, and product_history
      const vldValues: string[] = []
      const stockTransValues: string[] = []
      const historyValues: string[] = []

      for (const validProduct of validProducts) {
        const productId = skuToProductMap.get(validProduct.sku)!
        const variationId = productToVariationMap.get(productId)!

        for (const stock of validProduct.stocks) {
          // Variation location details
          vldValues.push(
            `(${productId}, ${variationId}, ${stock.locationId}, ${stock.quantity}, ${validProduct.sellingPrice}, NOW(), NOW())`
          )

          // Stock transactions (only if quantity > 0)
          if (stock.quantity > 0) {
            const notes = `Opening stock from Branch Stock Pivot CSV import`
            stockTransValues.push(
              `(${businessId}, ${stock.locationId}, ${productId}, ${variationId}, 'opening_stock', ${stock.quantity}, ${validProduct.purchasePrice}, 'CSV-IMPORT-${productId}', '${notes.replace(/'/g, "''")}', ${user.id}, NOW())`
            )

            // Product history
            const totalValue = validProduct.purchasePrice * stock.quantity
            historyValues.push(
              `(${businessId}, ${stock.locationId}, ${productId}, ${variationId}, 'opening_stock', NOW(), 'csv_import', ${productId}, 'CSV-IMPORT-${productId}', ${stock.quantity}, ${stock.quantity}, ${validProduct.purchasePrice}, ${totalValue}, ${user.id}, '${user.username}', '${notes.replace(/'/g, "''")}', NOW())`
            )

            results.totalInventoryRecords++
          }
        }
      }

      // Execute bulk inserts
      if (vldValues.length > 0) {
        await tx.$executeRawUnsafe(`
          INSERT INTO variation_location_details
            (product_id, product_variation_id, location_id, qty_available, selling_price, created_at, updated_at)
          VALUES ${vldValues.join(',\n')}
        `)
        console.log(`[${Date.now() - startTime}ms] Inserted ${vldValues.length} variation location details`)
      }

      if (stockTransValues.length > 0) {
        await tx.$executeRawUnsafe(`
          INSERT INTO stock_transactions
            (business_id, location_id, product_id, product_variation_id, type, quantity, unit_cost, ref_no, notes, created_by, created_at)
          VALUES ${stockTransValues.join(',\n')}
        `)
        console.log(`[${Date.now() - startTime}ms] Inserted ${stockTransValues.length} stock transactions`)
      }

      if (historyValues.length > 0) {
        await tx.$executeRawUnsafe(`
          INSERT INTO product_history
            (business_id, location_id, product_id, product_variation_id, transaction_type, transaction_date, reference_type, reference_id, reference_number, quantity_change, balance_quantity, unit_cost, total_value, created_by, created_by_name, reason, created_at)
          VALUES ${historyValues.join(',\n')}
        `)
        console.log(`[${Date.now() - startTime}ms] Inserted ${historyValues.length} product history records`)
      }

      results.success = validProducts.length
    })

    const elapsedMs = Date.now() - startTime
    console.log(`[${elapsedMs}ms] Import completed: ${results.success} successful, ${results.failed} failed, ${results.skipped} skipped`)

    return NextResponse.json({
      success: true,
      results,
      performanceMs: elapsedMs
    })

  } catch (error: any) {
    const elapsedMs = Date.now() - startTime
    console.error(`[${elapsedMs}ms] Import error:`, error)
    return NextResponse.json(
      { error: error.message || 'Failed to import branch stock' },
      { status: 500 }
    )
  }
}
