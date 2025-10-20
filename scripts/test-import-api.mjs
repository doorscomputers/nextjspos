/**
 * Test the CSV import API with sample data
 */

import fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('========================================')
  console.log('Testing CSV Import API Fix')
  console.log('========================================\n')

  // Get user and business info
  const user = await prisma.user.findFirst({
    where: { username: 'superadmin' },
    include: {
      business: true,
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user) {
    console.error('❌ No superadmin user found. Please run seed first.')
    return
  }

  console.log(`User: ${user.username} (${user.firstName} ${user.lastName})`)
  console.log(`Business: ${user.business.name} (ID: ${user.businessId})`)
  console.log()

  // Prepare test data
  const testProducts = [
    {
      name: 'Test Widget A',
      unit: 'Piece',
      productType: 'single',
      sku: 'TWA001',
      brand: 'TestBrand',
      category: 'Electronics',
      purchasePriceInclTax: '10.00',
      sellingPrice: '15.00',
      openingStock: '100',
      openingStockLocation: 'Main Store',
      manageStock: 1
    },
    {
      name: 'Test Widget B',
      unit: 'Piece',
      productType: 'single',
      sku: 'TWB002',
      brand: 'TestBrand',
      category: 'Electronics',
      purchasePriceInclTax: '5.00',
      sellingPrice: '8.00',
      openingStock: '50',
      openingStockLocation: 'Main Store',
      manageStock: 1
    },
    {
      name: 'Test Widget C',
      unit: 'Piece',
      productType: 'single',
      sku: 'TWC003',
      brand: 'TestBrand',
      category: 'Electronics',
      purchasePriceInclTax: '7.50',
      sellingPrice: '12.00',
      openingStock: '75',
      openingStockLocation: 'Main Warehouse',
      manageStock: 1
    },
    {
      name: 'Multi-Location Widget',
      unit: 'Piece',
      productType: 'single',
      sku: 'MLW004',
      brand: 'TestBrand',
      category: 'Electronics',
      purchasePriceInclTax: '20.00',
      sellingPrice: '30.00',
      openingStock: '10|20|30',
      openingStockLocation: 'Main Store|Main Warehouse|Bambang',
      manageStock: 1
    },
    {
      name: 'Zero Stock Widget',
      unit: 'Piece',
      productType: 'single',
      sku: 'ZSW005',
      brand: 'TestBrand',
      category: 'Electronics',
      purchasePriceInclTax: '15.00',
      sellingPrice: '25.00',
      openingStock: '0',
      openingStockLocation: 'Main Store',
      manageStock: 1
    }
  ]

  console.log(`Importing ${testProducts.length} test products...\n`)

  // Simulate the import API call by directly calling the logic
  const results = {
    success: 0,
    failed: 0,
    errors: []
  }

  // Get all business locations
  const allLocations = await prisma.businessLocation.findMany({
    where: { businessId: user.businessId },
    select: { id: true, name: true },
    orderBy: { id: 'asc' }
  })

  console.log(`Found ${allLocations.length} business locations`)

  // Collect all opening stock data for bulk insert
  const bulkOpeningStockData = []

  for (let i = 0; i < testProducts.length; i++) {
    const product = testProducts[i]

    try {
      // Find or create brand
      let brand = await prisma.brand.findFirst({
        where: {
          name: product.brand,
          businessId: user.businessId
        }
      })

      if (!brand) {
        brand = await prisma.brand.create({
          data: {
            name: product.brand,
            businessId: user.businessId
          }
        })
      }

      // Find or create unit
      let unit = await prisma.unit.findFirst({
        where: {
          name: product.unit,
          businessId: user.businessId
        }
      })

      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            name: product.unit,
            shortName: product.unit.substring(0, 3).toUpperCase(),
            allowDecimal: true,
            businessId: user.businessId
          }
        })
      }

      // Find or create category
      let category = await prisma.category.findFirst({
        where: {
          name: product.category,
          businessId: user.businessId
        }
      })

      if (!category) {
        category = await prisma.category.create({
          data: {
            name: product.category,
            businessId: user.businessId
          }
        })
      }

      // Create product
      const createdProduct = await prisma.product.create({
        data: {
          name: product.name,
          sku: product.sku,
          barcodeType: 'C128',
          type: product.productType,
          unitId: unit.id,
          brandId: brand.id,
          categoryId: category.id,
          enableStock: product.manageStock === 1,
          businessId: user.businessId
        }
      })

      // Create single variation
      const variation = await prisma.productVariation.create({
        data: {
          productId: createdProduct.id,
          name: 'Default',
          sku: product.sku,
          purchasePrice: parseFloat(product.purchasePriceInclTax),
          sellingPrice: parseFloat(product.sellingPrice),
          businessId: user.businessId,
          isDefault: true
        }
      })

      console.log(`✓ Created product: ${product.name} (ID: ${createdProduct.id}, Variation: ${variation.id})`)

      // Collect opening stock data
      const quantities = product.openingStock
        ? product.openingStock.split('|').map(q => q.trim()).filter(q => q)
        : []

      let targetLocationIds = []

      if (product.openingStockLocation) {
        const locationNames = product.openingStockLocation.split('|').map(l => l.trim()).filter(l => l)

        for (const locName of locationNames) {
          const loc = allLocations.find(l => l.name === locName)
          if (loc) {
            targetLocationIds.push(loc.id)
          }
        }
      }

      // If no locations specified, use ALL business locations
      if (targetLocationIds.length === 0) {
        targetLocationIds = allLocations.map(l => l.id)
      }

      const unitCost = parseFloat(product.purchasePriceInclTax)

      for (let j = 0; j < targetLocationIds.length; j++) {
        const locationId = targetLocationIds[j]
        const quantity = quantities[j] ? parseFloat(quantities[j]) : 0

        if (isNaN(quantity)) continue

        bulkOpeningStockData.push({
          businessId: user.businessId,
          productId: createdProduct.id,
          productVariationId: variation.id,
          locationId,
          quantity,
          unitCost,
          userId: user.id,
          notes: `Opening stock from CSV import - ${product.name} (Location ${locationId})`
        })
      }

      results.success++
    } catch (error) {
      results.failed++
      results.errors.push({
        row: i + 2,
        error: error.message,
        data: product
      })
      console.error(`✗ Failed to create product ${i + 1}: ${error.message}`)
    }
  }

  // Now simulate the bulk insert
  if (bulkOpeningStockData.length > 0) {
    console.log(`\nCreating ${bulkOpeningStockData.length} opening stock transactions in bulk...`)

    try {
      await prisma.$transaction(async (tx) => {
        const now = new Date()

        // Upsert variation_location_details in bulk
        for (const data of bulkOpeningStockData) {
          await tx.variationLocationDetails.upsert({
            where: {
              productVariationId_locationId: {
                productVariationId: data.productVariationId,
                locationId: data.locationId,
              }
            },
            create: {
              productId: data.productId,
              productVariationId: data.productVariationId,
              locationId: data.locationId,
              qtyAvailable: data.quantity,
            },
            update: {
              qtyAvailable: data.quantity,
              updatedAt: now,
            }
          })
        }

        // Prepare bulk SQL for stock_transactions
        const stockTransactionValues = bulkOpeningStockData.map(data => {
          const unitCostStr = data.unitCost !== null ? data.unitCost.toString() : 'NULL'
          const quantityStr = data.quantity.toString()
          const notesEscaped = data.notes.replace(/'/g, "''")

          return `(${data.businessId}, ${data.productId}, ${data.productVariationId}, ${data.locationId}, 'opening_stock', ${quantityStr}, ${unitCostStr}, ${quantityStr}, 'product_import', ${data.productId}, ${data.userId}, '${notesEscaped}', '${now.toISOString()}')`
        }).join(',\n    ')

        // Bulk insert stock transactions
        await tx.$executeRawUnsafe(`
          INSERT INTO stock_transactions
            (business_id, product_id, product_variation_id, location_id, type, quantity, unit_cost, balance_qty, reference_type, reference_id, created_by, notes, created_at)
          VALUES
            ${stockTransactionValues}
        `)

        // Prepare bulk SQL for product_history
        const productHistoryValues = bulkOpeningStockData.map(data => {
          const unitCostStr = data.unitCost !== null ? data.unitCost.toString() : 'NULL'
          const totalValue = data.unitCost !== null ? (data.unitCost * data.quantity).toString() : 'NULL'
          const quantityStr = data.quantity.toString()
          const notesEscaped = data.notes.replace(/'/g, "''")

          return `(${data.businessId}, ${data.locationId}, ${data.productId}, ${data.productVariationId}, 'opening_stock', '${now.toISOString()}', 'product_import', ${data.productId}, '${data.productId}', ${quantityStr}, ${quantityStr}, ${unitCostStr}, ${totalValue}, ${data.userId}, 'System', '${notesEscaped}', '${now.toISOString()}')`
        }).join(',\n    ')

        // Bulk insert product history
        await tx.$executeRawUnsafe(`
          INSERT INTO product_history
            (business_id, location_id, product_id, product_variation_id, transaction_type, transaction_date, reference_type, reference_id, reference_number, quantity_change, balance_quantity, unit_cost, total_value, created_by, created_by_name, reason, created_at)
          VALUES
            ${productHistoryValues}
        `)
      })

      console.log(`✅ Bulk opening stock creation complete!`)
    } catch (error) {
      console.error(`❌ Bulk insert failed: ${error.message}`)
      throw error
    }
  }

  console.log('\n========================================')
  console.log('Import Results:')
  console.log('========================================')
  console.log(`Success: ${results.success}`)
  console.log(`Failed: ${results.failed}`)
  console.log(`Opening Stock Transactions Created: ${bulkOpeningStockData.length}`)

  if (results.errors.length > 0) {
    console.log('\nErrors:')
    results.errors.forEach(err => {
      console.log(`  Row ${err.row}: ${err.error}`)
    })
  }

  // Verify the results
  console.log('\n========================================')
  console.log('Verification:')
  console.log('========================================')

  const transactionCount = await prisma.stockTransaction.count({
    where: {
      businessId: user.businessId,
      type: 'opening_stock'
    }
  })

  const vldCount = await prisma.variationLocationDetails.count({
    where: {
      product: {
        businessId: user.businessId
      }
    }
  })

  const historyCount = await prisma.productHistory.count({
    where: {
      businessId: user.businessId,
      transactionType: 'opening_stock'
    }
  })

  console.log(`Stock Transactions: ${transactionCount}`)
  console.log(`Variation Location Details: ${vldCount}`)
  console.log(`Product History Records: ${historyCount}`)

  // Show sample transactions
  const sampleTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId: user.businessId,
      type: 'opening_stock'
    },
    include: {
      product: {
        select: { name: true }
      }
    },
    take: 10
  })

  console.log('\nSample Transactions:')
  sampleTransactions.forEach((txn, idx) => {
    console.log(`  ${idx + 1}. ${txn.product.name} (Location ID: ${txn.locationId})`)
    console.log(`     Qty: ${txn.quantity}, Balance: ${txn.balanceQty}, Unit Cost: ${txn.unitCost}`)
  })

  console.log('\n========================================')
  console.log('✅ TEST COMPLETE!')
  console.log('========================================\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
