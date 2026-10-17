/**
 * Script to update product prices from Excel file (matched by product name)
 * Run with: npx tsx scripts/update-prices-batch-increase-oct2026.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// Path to the Excel file
const EXCEL_FILE_PATH = 'C:/Users/Warenski/Downloads/batch price increase.xlsx'

interface PriceUpdateRow {
  'Item Name': string
  'New SRP': number | string
}

async function main() {
  console.log('=== Batch Price Increase from Excel ===\n')

  console.log(`Reading Excel file: ${EXCEL_FILE_PATH}`)
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data: PriceUpdateRow[] = XLSX.utils.sheet_to_json(sheet)

  console.log(`Total rows in Excel: ${data.length}\n`)

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
  const notFound: string[] = []
  const skipped: { name: string; reason: string }[] = []

  for (const row of data) {
    const itemName = String(row['Item Name'] || '').trim()
    const newSrpRaw = row['New SRP']

    if (!itemName) {
      skipped.push({ name: '', reason: 'Empty item name' })
      continue
    }

    const newPrice = typeof newSrpRaw === 'number'
      ? newSrpRaw
      : parseFloat(String(newSrpRaw).replace(/,/g, ''))
    if (isNaN(newPrice) || newPrice <= 0) {
      skipped.push({ name: itemName, reason: `Invalid price: ${newSrpRaw}` })
      continue
    }

    // Find product by exact name (case-insensitive)
    const products = await prisma.product.findMany({
      where: {
        businessId,
        deletedAt: null,
        name: { equals: itemName, mode: 'insensitive' },
      },
      include: {
        variations: { select: { id: true, sellingPrice: true } },
      },
    })

    if (products.length === 0) {
      notFound.push(itemName)
      console.log(`Not found: ${itemName}`)
      continue
    }
    if (products.length > 1) {
      skipped.push({ name: itemName, reason: `${products.length} products share this name` })
      continue
    }

    const product = products[0]
    const oldPrices = product.variations.map(v => Number(v.sellingPrice)).join(',')

    await prisma.$transaction(async (tx) => {
      for (const v of product.variations) {
        await tx.productVariation.update({
          where: { id: v.id },
          data: { sellingPrice: newPrice },
        })

        await tx.variationLocationDetails.updateMany({
          where: {
            productVariationId: v.id,
            locationId: { in: locations.map(l => l.id) },
          },
          data: {
            sellingPrice: newPrice,
            lastPriceUpdate: new Date(),
          },
        })
      }
    })

    updatedCount++
    console.log(`Updated: ${product.sku} (${product.name}) P${oldPrices} -> P${newPrice.toLocaleString()}`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`✅ Updated: ${updatedCount} products across ${locations.length} active locations`)
  console.log(`⏭️  Skipped: ${skipped.length} rows`)
  console.log(`❌ Not found: ${notFound.length} products`)

  notFound.forEach((n, i) => console.log(`  NOT FOUND ${i + 1}. ${n}`))
  skipped.forEach(s => console.log(`  SKIPPED ${s.name}: ${s.reason}`))

  console.log('\nPrice update complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
