import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { addStock, StockTransactionType } from '@/lib/stockOperations'
import { Prisma } from '@prisma/client'

/**
 * Helper to create bulk opening stock transactions
 * This is much faster than individual addStock() calls
 */
async function createBulkOpeningStock(
  tx: Prisma.TransactionClient,
  openingStockData: Array<{
    businessId: number
    productId: number
    productVariationId: number
    locationId: number
    quantity: number
    unitCost: number | null
    userId: number
    notes: string
  }>
) {
  if (openingStockData.length === 0) return

  const now = new Date()

  // Prepare bulk data for variation_location_details
  const vldUpserts = openingStockData.map(data => ({
    productId: data.productId,
    productVariationId: data.productVariationId,
    locationId: data.locationId,
    qtyAvailable: new Prisma.Decimal(data.quantity),
  }))

  // Upsert variation_location_details in bulk
  for (const vld of vldUpserts) {
    await tx.variationLocationDetails.upsert({
      where: {
        productVariationId_locationId: {
          productVariationId: vld.productVariationId,
          locationId: vld.locationId,
        }
      },
      create: vld,
      update: {
        qtyAvailable: vld.qtyAvailable,
        updatedAt: now,
      }
    })
  }

  // Prepare bulk data for stock_transactions using raw SQL for maximum performance
  const stockTransactionValues = openingStockData.map(data => {
    const unitCostStr = data.unitCost !== null ? data.unitCost.toString() : 'NULL'
    const quantityStr = data.quantity.toString()
    const notesEscaped = data.notes.replace(/'/g, "''")

    return `(${data.businessId}, ${data.productId}, ${data.productVariationId}, ${data.locationId}, 'opening_stock', ${quantityStr}, ${unitCostStr}, ${quantityStr}, 'product_import', ${data.productId}, ${data.userId}, '${notesEscaped}', '${now.toISOString()}')`
  }).join(',\n    ')

  // Bulk insert stock transactions using raw SQL
  await tx.$executeRawUnsafe(`
    INSERT INTO stock_transactions
      (business_id, product_id, product_variation_id, location_id, type, quantity, unit_cost, balance_qty, reference_type, reference_id, created_by, notes, created_at)
    VALUES
      ${stockTransactionValues}
  `)

  // Prepare bulk data for product_history
  const productHistoryValues = openingStockData.map(data => {
    const unitCostStr = data.unitCost !== null ? data.unitCost.toString() : 'NULL'
    const totalValue = data.unitCost !== null ? (data.unitCost * data.quantity).toString() : 'NULL'
    const quantityStr = data.quantity.toString()
    const notesEscaped = data.notes.replace(/'/g, "''")

    return `(${data.businessId}, ${data.locationId}, ${data.productId}, ${data.productVariationId}, 'opening_stock', '${now.toISOString()}', 'product_import', ${data.productId}, '${data.productId}', ${quantityStr}, ${quantityStr}, ${unitCostStr}, ${totalValue}, ${data.userId}, 'System', '${notesEscaped}', '${now.toISOString()}')`
  }).join(',\n    ')

  // Bulk insert product history using raw SQL
  await tx.$executeRawUnsafe(`
    INSERT INTO product_history
      (business_id, location_id, product_id, product_variation_id, transaction_type, transaction_date, reference_type, reference_id, reference_number, quantity_change, balance_quantity, unit_cost, total_value, created_by, created_by_name, reason, created_at)
    VALUES
      ${productHistoryValues}
  `)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user
    const businessId = parseInt(String(user.businessId))

    // Validate businessId
    if (isNaN(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions.includes(PERMISSIONS.PRODUCT_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products to import' }, { status: 400 })
    }

    // Get all business locations upfront for opening stock
    const allLocations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' }
    })

    if (allLocations.length === 0) {
      return NextResponse.json(
        { error: 'No business locations found. Please create at least one location first.' },
        { status: 400 }
      )
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data?: any }>
    }

    // Collect all opening stock data for bulk insert
    const bulkOpeningStockData: Array<{
      businessId: number
      productId: number
      productVariationId: number
      locationId: number
      quantity: number
      unitCost: number | null
      userId: number
      notes: string
    }> = []

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      const rowNumber = i + 2 // Account for header row

      try {
        // Validate required fields
        if (!product.name) {
          throw new Error('Product name is required')
        }

        if (!product.unit) {
          throw new Error('Unit is required')
        }

        if (!product.productType) {
          throw new Error('Product type is required')
        }

        if (!['single', 'variable'].includes(product.productType)) {
          throw new Error('Product type must be "single" or "variable"')
        }

        // Find or create brand
        let brandId = null
        if (product.brand) {
          let brand = await prisma.brand.findFirst({
            where: {
              name: product.brand,
              businessId
            }
          })

          if (!brand) {
            brand = await prisma.brand.create({
              data: {
                name: product.brand,
                businessId
              }
            })
          }
          brandId = brand.id
        }

        // Find or create unit
        let unit = await prisma.unit.findFirst({
          where: {
            name: product.unit,
            businessId
          }
        })

        if (!unit) {
          unit = await prisma.unit.create({
            data: {
              name: product.unit,
              shortName: product.unit.substring(0, 3).toUpperCase(),
              allowDecimal: true,
              businessId
            }
          })
        }

        // Find or create category
        let categoryId = null
        if (product.category) {
          let category = await prisma.category.findFirst({
            where: {
              name: product.category,
              businessId
            }
          })

          if (!category) {
            category = await prisma.category.create({
              data: {
                name: product.category,
                businessId
              }
            })
          }
          categoryId = category.id
        }

        // Find or create subcategory
        let subCategoryId = null
        if (product.subCategory && categoryId) {
          let subCategory = await prisma.category.findFirst({
            where: {
              name: product.subCategory,
              parentId: categoryId,
              businessId
            }
          })

          if (!subCategory) {
            subCategory = await prisma.category.create({
              data: {
                name: product.subCategory,
                parentId: categoryId,
                businessId
              }
            })
          }
          subCategoryId = subCategory.id
        }

        // Create product
        const createdProduct = await prisma.product.create({
          data: {
            name: product.name,
            sku: product.sku || `PROD-${Date.now()}`,
            barcodeType: product.barcodeType || 'C128',
            type: product.productType || 'single',
            unitId: unit.id,
            brandId,
            categoryId: subCategoryId || categoryId,
            enableStock: product.manageStock === '1' || product.manageStock === 1 || true,
            alertQuantity: product.alertQuantity ? parseFloat(product.alertQuantity) : null,
            weight: product.weight ? parseFloat(product.weight) : null,
            productDescription: product.productDescription || null,
            businessId
          }
        })

        // Handle variations for variable products
        if (product.productType === 'variable' && product.variationName && product.variationValues) {
          const variationTemplate = await prisma.variationTemplate.create({
            data: {
              name: product.variationName,
              businessId
            }
          })

          const variationValueNames = product.variationValues.split('|').map((v: string) => v.trim())
          const variationValues = await Promise.all(
            variationValueNames.map((name: string) =>
              prisma.variationTemplateValue.create({
                data: {
                  name,
                  templateId: variationTemplate.id,
                  businessId
                }
              })
            )
          )

          // Create product variations
          const skus = product.variationSKUs ? product.variationSKUs.split('|').map((s: string) => s.trim()) : []
          const purchasePricesIncl = product.purchasePriceInclTax ? product.purchasePriceInclTax.split('|').map((p: string) => p.trim()) : []
          const purchasePricesExcl = product.purchasePriceExclTax ? product.purchasePriceExclTax.split('|').map((p: string) => p.trim()) : []
          const profitMargins = product.profitMargin ? product.profitMargin.split('|').map((p: string) => p.trim()) : []
          const sellingPrices = product.sellingPrice ? product.sellingPrice.split('|').map((p: string) => p.trim()) : []

          for (let j = 0; j < variationValues.length; j++) {
            await prisma.productVariation.create({
              data: {
                productId: createdProduct.id,
                name: variationValues[j].name,
                sku: skus[j] || `VAR-${createdProduct.id}-${j}`,
                purchasePrice: purchasePricesIncl[j] ? parseFloat(purchasePricesIncl[j]) : 0,
                sellingPrice: sellingPrices[j] ? parseFloat(sellingPrices[j]) : 0,
                businessId,
                isDefault: j === 0
              }
            })
          }
        } else if (product.productType === 'single') {
          // Create single variation
          await prisma.productVariation.create({
            data: {
              productId: createdProduct.id,
              name: 'Default',
              sku: product.sku || `VAR-${Date.now()}`,
              purchasePrice: product.purchasePriceInclTax ? parseFloat(product.purchasePriceInclTax) : 0,
              sellingPrice: product.sellingPrice ? parseFloat(product.sellingPrice) : 0,
              businessId,
              isDefault: true
            }
          })
        }

        // Collect opening stock data for bulk insert
        // Get all product variations (could be single or multiple for variable products)
        const variations = await prisma.productVariation.findMany({
          where: {
            productId: createdProduct.id
          },
          orderBy: {
            id: 'asc'
          }
        })

        if (variations.length > 0) {
          // Parse opening stock quantities (split by | for variable products)
          const quantities = product.openingStock
            ? product.openingStock.split('|').map((q: string) => q.trim()).filter((q: string) => q)
            : []

          // Determine location(s)
          let targetLocationIds: number[] = []

          if (product.openingStockLocation) {
            const locationNames = product.openingStockLocation.split('|').map((l: string) => l.trim()).filter((l: string) => l)

            // Map location names to IDs
            for (const locName of locationNames) {
              const loc = allLocations.find(l => l.name === locName)
              if (loc) {
                targetLocationIds.push(loc.id)
              }
            }
          }

          // If no locations specified or none found, use ALL business locations
          if (targetLocationIds.length === 0) {
            targetLocationIds = allLocations.map(l => l.id)
          }

          // For single products: one variation, possibly multiple locations
          // For variable products: multiple variations, typically one location (or match variation count)
          if (product.productType === 'single') {
            const variation = variations[0]
            const unitCost = variation.purchasePrice
              ? parseFloat(variation.purchasePrice.toString())
              : null

            // Create opening stock for each target location
            for (let j = 0; j < targetLocationIds.length; j++) {
              const locationId = targetLocationIds[j]
              const quantity = quantities[j] ? parseFloat(quantities[j]) : 0

              if (isNaN(quantity)) continue

              bulkOpeningStockData.push({
                businessId,
                productId: createdProduct.id,
                productVariationId: variation.id,
                locationId,
                quantity,
                unitCost,
                userId: user.id,
                notes: `Opening stock from CSV import - ${product.name} (Location ${locationId})`
              })
            }
          } else if (product.productType === 'variable') {
            // For variable products: each quantity corresponds to a variation
            const locationId = targetLocationIds[0] // Use first location for all variations

            for (let j = 0; j < variations.length; j++) {
              const variation = variations[j]
              const quantity = quantities[j] ? parseFloat(quantities[j]) : 0

              if (isNaN(quantity)) continue

              const unitCost = variation.purchasePrice
                ? parseFloat(variation.purchasePrice.toString())
                : null

              bulkOpeningStockData.push({
                businessId,
                productId: createdProduct.id,
                productVariationId: variation.id,
                locationId,
                quantity,
                unitCost,
                userId: user.id,
                notes: `Opening stock from CSV import - ${product.name} (Variation ${j + 1})`
              })
            }
          }
        }

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          error: error.message,
          data: product
        })
      }
    }

    // Bulk insert all opening stock transactions in one go
    if (bulkOpeningStockData.length > 0) {
      console.log(`Creating ${bulkOpeningStockData.length} opening stock transactions in bulk...`)
      await prisma.$transaction(async (tx) => {
        await createBulkOpeningStock(tx, bulkOpeningStockData)
      })
      console.log(`Bulk opening stock creation complete!`)
    }

    return NextResponse.json({
      success: true,
      results: {
        ...results,
        openingStockTransactionsCreated: bulkOpeningStockData.length
      }
    })

  } catch (error: any) {
    console.error('Import products error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import products' },
      { status: 500 }
    )
  }
}
