/**
 * Script to update product prices from Excel file
 * Run with: DATABASE_URL="your-connection-string" npx tsx scripts/update-prices-from-excel.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// Path to the Excel file - Updated for Book1Updated.xlsx
const EXCEL_FILE_PATH = 'c:/Users/Warenski/Downloads/Book1Updated.xlsx'
const SHEET_NAME = 'PriceUpdates'

interface PriceUpdateRow {
  Product: string
  Category: string
  SKU: string
  'New SRP': number | string
}

async function main() {
  console.log('=== Price Update from Excel ===\n')

  // Read Excel file
  console.log(`Reading Excel file: ${EXCEL_FILE_PATH}`)
  console.log(`Sheet: ${SHEET_NAME}`)
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheet = workbook.Sheets[SHEET_NAME]
  const data: PriceUpdateRow[] = XLSX.utils.sheet_to_json(sheet)

  console.log(`Total rows in Excel: ${data.length}\n`)

  // Get businessId 1
  const businessId = 1

  // Get all ACTIVE locations only
  const locations = await prisma.businessLocation.findMany({
    where: {
      businessId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, name: true },
  })

  console.log(`Found ${locations.length} active locations:`)
  locations.forEach(loc => console.log(`  - ${loc.name} (ID: ${loc.id})`))
  console.log('')

  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0
  const notFound: { sku: string; name: string }[] = []
  const skipped: { sku: string; name: string; reason: string }[] = []

  for (const row of data) {
    const sku = String(row.SKU || '').trim()
    const productName = String(row.Product || '').trim()
    const newSrpRaw = row['New SRP']

    // Parse price - handle both number and string formats
    let newPrice: number
    if (typeof newSrpRaw === 'number') {
      newPrice = newSrpRaw
    } else {
      // Try to parse string price (remove commas if any)
      const parsed = parseFloat(String(newSrpRaw).replace(/,/g, ''))
      if (isNaN(parsed)) {
        skippedCount++
        skipped.push({ sku, name: productName, reason: `Invalid price: ${newSrpRaw}` })
        console.log(`⏭️  Skipping: [${sku}] ${productName} - Invalid SRP: ${newSrpRaw}`)
        continue
      }
      newPrice = parsed
    }

    if (!sku) {
      skippedCount++
      skipped.push({ sku: '', name: productName, reason: 'No SKU' })
      continue
    }

    // Find variation by SKU (variations have SKUs, not products)
    const variation = await prisma.productVariation.findFirst({
      where: {
        businessId,
        sku: sku,
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    })

    if (!variation) {
      // Try to find by product SKU as fallback
      const product = await prisma.product.findFirst({
        where: {
          businessId,
          sku: sku,
        },
        include: {
          variations: { select: { id: true } },
        },
      })

      if (!product) {
        // Try to find by product name as third fallback (exact match, case-insensitive)
        const productByName = await prisma.product.findFirst({
          where: {
            businessId,
            name: { equals: productName, mode: 'insensitive' },
          },
          include: {
            variations: { select: { id: true } },
          },
        })

        if (!productByName) {
          notFoundCount++
          notFound.push({ sku, name: productName })
          console.log(`❌ Not found: [${sku}] ${productName}`)
          continue
        }

        // Update all variations for this product (found by name)
        for (const v of productByName.variations) {
          await prisma.productVariation.update({
            where: { id: v.id },
            data: { sellingPrice: newPrice },
          })

          for (const location of locations) {
            await prisma.variationLocationDetails.updateMany({
              where: {
                productVariationId: v.id,
                locationId: location.id,
              },
              data: {
                sellingPrice: newPrice,
                lastPriceUpdate: new Date(),
              },
            })
          }
        }

        updatedCount++
        console.log(`✅ Updated: ${productByName.name} -> ₱${newPrice.toLocaleString()} (matched by Product Name)`)
        continue
      }

      // Update all variations for this product (found by Product SKU)
      for (const v of product.variations) {
        // Update base price on variation
        await prisma.productVariation.update({
          where: { id: v.id },
          data: { sellingPrice: newPrice },
        })

        // Update location prices
        for (const location of locations) {
          await prisma.variationLocationDetails.updateMany({
            where: {
              productVariationId: v.id,
              locationId: location.id,
            },
            data: {
              sellingPrice: newPrice,
              lastPriceUpdate: new Date(),
            },
          })
        }
      }

      updatedCount++
      console.log(`✅ Updated: ${product.name} -> ₱${newPrice.toLocaleString()} (matched by Product SKU)`)
      continue
    }

    // Update base price on variation
    await prisma.productVariation.update({
      where: { id: variation.id },
      data: { sellingPrice: newPrice },
    })

    // Update location prices for all active locations
    for (const location of locations) {
      await prisma.variationLocationDetails.updateMany({
        where: {
          productVariationId: variation.id,
          locationId: location.id,
        },
        data: {
          sellingPrice: newPrice,
          lastPriceUpdate: new Date(),
        },
      })
    }

    updatedCount++
    console.log(`✅ Updated: ${variation.product.name} -> ₱${newPrice.toLocaleString()} (matched by Variation SKU)`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`✅ Updated: ${updatedCount} products across ${locations.length} active locations`)
  console.log(`⏭️  Skipped: ${skippedCount} rows (invalid data)`)
  console.log(`❌ Not found: ${notFoundCount} products`)

  if (notFound.length > 0) {
    console.log('\n--- Products NOT FOUND in database ---')
    notFound.forEach(item => console.log(`  - [${item.sku}] ${item.name}`))
  }

  if (skipped.length > 0) {
    console.log('\n--- Skipped rows ---')
    skipped.forEach(item => console.log(`  - [${item.sku}] ${item.name}: ${item.reason}`))
  }

  console.log('\nPrice update complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
