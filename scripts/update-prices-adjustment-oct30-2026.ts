/**
 * Script to update product prices from Excel file (matched by product name)
 * Run with: npx tsx scripts/update-prices-adjustment-oct30-2026.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// Paths to the Excel files
const EXCEL_FILE_PATHS = [
  'C:/Users/Warenski/Downloads/PRICEADJUSTMENTVENTION.xlsx',
  'C:/Users/Warenski/Downloads/PRICEADJUSTMENTTECNO.xlsx',
]

// Sheet has no header row: column A = product name, column B = new SRP
type PriceUpdateRow = [string, number | string]

async function main() {
  console.log('=== Price Adjustment from Excel (Vention + Tecno) ===\n')

  const data: PriceUpdateRow[] = []
  for (const filePath of EXCEL_FILE_PATHS) {
    console.log(`Reading Excel file: ${filePath}`)
    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    data.push(...XLSX.utils.sheet_to_json<PriceUpdateRow>(sheet, { header: 1, defval: '' }))
  }

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
    // Collapse repeated spaces
    const itemName = String(row[0] || '').trim().replace(/\s+/g, ' ')
    const newSrpRaw = row[1]

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
