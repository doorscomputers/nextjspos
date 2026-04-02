/**
 * Script to update product prices from "NOTEBOOK WITH PRICE CHANGES.xlsx"
 * Updates selling price on ProductVariation AND all active location prices (VariationLocationDetails)
 *
 * DRY RUN (preview only):
 *   npx tsx scripts/update-notebook-prices.ts
 *
 * LIVE RUN (actually update DB):
 *   npx tsx scripts/update-notebook-prices.ts --live
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

const EXCEL_FILE_PATH = 'C:/Users/Warenski/Downloads/NOTEBOOK WITH PRICE CHANGES.xlsx'
const IS_LIVE = process.argv.includes('--live')

interface PriceRow {
  'Item Code': string | number
  'Item Name': string
  'NEW PRICE': number | string
}

async function main() {
  console.log(`=== Notebook Price Update ${IS_LIVE ? '(LIVE RUN)' : '(DRY RUN - no changes will be made)'} ===\n`)

  // Read Excel file
  console.log(`Reading: ${EXCEL_FILE_PATH}`)
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data: PriceRow[] = XLSX.utils.sheet_to_json(sheet)
  console.log(`Total rows: ${data.length}\n`)

  const businessId = 1

  // Get all ACTIVE locations
  const locations = await prisma.businessLocation.findMany({
    where: { businessId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  })

  console.log(`Active locations (${locations.length}):`)
  locations.forEach(loc => console.log(`  - ${loc.name} (ID: ${loc.id})`))
  console.log('')

  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0
  const notFound: string[] = []
  const skipped: { code: string; reason: string }[] = []
  const updated: { code: string; name: string; oldPrice: number; newPrice: number }[] = []

  for (const row of data) {
    const itemCode = String(row['Item Code'] || '').trim()
    const itemName = String(row['Item Name'] || '').trim()
    const newPriceRaw = row['NEW PRICE']

    if (!itemCode) {
      skippedCount++
      skipped.push({ code: '', reason: 'Empty item code' })
      continue
    }

    // Parse price
    let newPrice: number
    if (typeof newPriceRaw === 'number') {
      newPrice = newPriceRaw
    } else {
      const parsed = parseFloat(String(newPriceRaw).replace(/,/g, ''))
      if (isNaN(parsed) || parsed <= 0) {
        skippedCount++
        skipped.push({ code: itemCode, reason: `Invalid price: ${newPriceRaw}` })
        console.log(`  SKIP: ${itemCode} - Invalid price: ${newPriceRaw}`)
        continue
      }
      newPrice = parsed
    }

    // Find product by SKU (exact match, case-insensitive)
    const product = await prisma.product.findFirst({
      where: {
        businessId,
        sku: { equals: itemCode, mode: 'insensitive' },
      },
      include: {
        variations: { select: { id: true, sellingPrice: true } },
      },
    })

    if (!product) {
      notFoundCount++
      notFound.push(`${itemCode} - ${itemName}`)
      console.log(`  NOT FOUND: ${itemCode} (${itemName})`)
      continue
    }

    const oldPrice = product.variations[0]?.sellingPrice
      ? Number(product.variations[0].sellingPrice)
      : Number(product.sellingPrice || 0)

    if (IS_LIVE) {
      // Update product base selling price
      await prisma.product.update({
        where: { id: product.id },
        data: { sellingPrice: newPrice },
      })

      // Update all variations
      for (const v of product.variations) {
        await prisma.productVariation.update({
          where: { id: v.id },
          data: { sellingPrice: newPrice },
        })

        // Update location prices for ALL active locations
        for (const location of locations) {
          await prisma.variationLocationDetails.updateMany({
            where: {
              productVariationId: v.id,
              locationId: location.id,
            },
            data: { sellingPrice: newPrice },
          })
        }
      }
    }

    updatedCount++
    updated.push({ code: itemCode, name: product.name, oldPrice, newPrice })
    const priceChange = oldPrice !== newPrice ? `P${oldPrice.toLocaleString()} -> P${newPrice.toLocaleString()}` : `P${newPrice.toLocaleString()} (no change)`
    console.log(`  ${IS_LIVE ? 'UPDATED' : 'WILL UPDATE'}: ${itemCode} | ${product.name} | ${priceChange}`)
  }

  // Summary
  console.log(`\n=== SUMMARY ${IS_LIVE ? '(LIVE)' : '(DRY RUN)'} ===`)
  console.log(`  ${IS_LIVE ? 'Updated' : 'Will update'}: ${updatedCount} products across ${locations.length} active locations`)
  console.log(`  Skipped: ${skippedCount} rows`)
  console.log(`  Not found: ${notFoundCount} products`)

  if (notFound.length > 0) {
    console.log('\n--- Products NOT FOUND ---')
    notFound.forEach((item, i) => console.log(`  ${i + 1}. ${item}`))
  }

  if (skipped.length > 0) {
    console.log('\n--- Skipped rows ---')
    skipped.forEach(s => console.log(`  - ${s.code}: ${s.reason}`))
  }

  if (!IS_LIVE && updatedCount > 0) {
    console.log('\n>>> To apply these changes, run:')
    console.log('>>>   npx tsx scripts/update-notebook-prices.ts --live')
  }

  console.log('\nDone!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
