/**
 * Script to update product prices from Excel file
 * Run with: DATABASE_URL="your-connection-string" npx tsx scripts/update-prices-from-excel.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// Path to the Excel file
const EXCEL_FILE_PATH = 'C:/Users/Warenski/Downloads/SRP UPDATES 6 FEB 2026.xlsx'

interface PriceUpdateRow {
  'CODE': string
  'NEW RETAIL PRICE': number | string
}

async function main() {
  console.log('=== Price Update from CSV ===\n')

  // Read Excel file
  console.log(`Reading Excel file: ${EXCEL_FILE_PATH}`)
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
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
  const notFound: { name: string }[] = []
  const skipped: { name: string; reason: string }[] = []

  for (const row of data) {
    const itemCode = String(row['CODE'] || '').trim()
    const newSrpRaw = row['NEW RETAIL PRICE']

    if (!itemCode) {
      skippedCount++
      skipped.push({ name: '', reason: 'Empty item code' })
      continue
    }

    // Parse price - handle both number and string formats
    let newPrice: number
    if (typeof newSrpRaw === 'number') {
      newPrice = newSrpRaw
    } else {
      // Try to parse string price (remove commas if any)
      const parsed = parseFloat(String(newSrpRaw).replace(/,/g, ''))
      if (isNaN(parsed)) {
        skippedCount++
        skipped.push({ name: itemCode, reason: `Invalid price: ${newSrpRaw}` })
        console.log(`Skipping: ${itemCode} - Invalid SRP: ${newSrpRaw}`)
        continue
      }
      newPrice = parsed
    }

    // Find product by SKU/code (exact match, case-insensitive)
    const product = await prisma.product.findFirst({
      where: {
        businessId,
        sku: { equals: itemCode, mode: 'insensitive' },
      },
      include: {
        variations: { select: { id: true } },
      },
    })

    if (!product) {
      notFoundCount++
      notFound.push({ name: itemCode })
      console.log(`Not found: ${itemCode}`)
      continue
    }

    // Update all variations for this product
    for (const v of product.variations) {
      await prisma.productVariation.update({
        where: { id: v.id },
        data: { sellingPrice: newPrice },
      })

      // Update location prices for all active locations
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
    console.log(`Updated: ${itemCode} (${product.name}) -> P${newPrice.toLocaleString()}`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`✅ Updated: ${updatedCount} products across ${locations.length} active locations`)
  console.log(`⏭️  Skipped: ${skippedCount} rows (invalid data)`)
  console.log(`❌ Not found: ${notFoundCount} products`)

  if (notFound.length > 0) {
    console.log('\n--- Products NOT FOUND in database ---')
    notFound.forEach((item, i) => console.log(`  ${i+1}. ${item.name}`))
  }

  if (skipped.length > 0) {
    console.log('\n--- Skipped rows ---')
    skipped.forEach(item => console.log(`  - ${item.name}: ${item.reason}`))
  }

  console.log('\nPrice update complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
