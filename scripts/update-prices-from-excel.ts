/**
 * Script to update product prices from Excel file
 * Run with: DATABASE_URL="your-connection-string" npx tsx scripts/update-prices-from-excel.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// Path to the Excel file
const EXCEL_FILE_PATH = 'c:/Users/Warenski/Downloads/UpdatePrices2.xlsx'

interface PriceUpdateRow {
  'Item Code': string
  'Item Name': string
  'New Selling Price': number
}

async function main() {
  console.log('=== Price Update from Excel ===\n')

  // Read Excel file
  console.log(`Reading Excel file: ${EXCEL_FILE_PATH}`)
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
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
  let notFoundCount = 0
  const notFound: { code: string; name: string }[] = []
  const updated: { name: string; price: number; matchedBy: string }[] = []

  for (const row of data) {
    const itemCode = String(row['Item Code'] || '').trim()
    const itemName = String(row['Item Name'] || '').trim()
    const newPrice = Number(row['New Selling Price'])

    if (!itemName || isNaN(newPrice)) {
      console.log(`Skipping invalid row: ${JSON.stringify(row)}`)
      continue
    }

    // Try to find product by SKU first
    let product = await prisma.product.findFirst({
      where: {
        businessId,
        sku: itemCode,
      },
      include: {
        variations: {
          select: { id: true },
        },
      },
    })

    let matchedBy = 'SKU'

    // If not found by SKU, try by name (case-insensitive)
    if (!product) {
      product = await prisma.product.findFirst({
        where: {
          businessId,
          name: {
            equals: itemName,
            mode: 'insensitive',
          },
        },
        include: {
          variations: {
            select: { id: true },
          },
        },
      })
      matchedBy = 'Name'
    }

    if (!product) {
      notFoundCount++
      notFound.push({ code: itemCode, name: itemName })
      continue
    }

    // Update all variations for all active locations
    for (const variation of product.variations) {
      for (const location of locations) {
        await prisma.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId: variation.id,
              locationId: location.id,
            },
          },
          update: {
            sellingPrice: newPrice,
            lastPriceUpdate: new Date(),
          },
          create: {
            productId: product.id,
            productVariationId: variation.id,
            locationId: location.id,
            qtyAvailable: 0,
            sellingPrice: newPrice,
            lastPriceUpdate: new Date(),
          },
        })
      }
    }

    updatedCount++
    updated.push({ name: product.name, price: newPrice, matchedBy })
    console.log(`✓ Updated: ${product.name} -> ₱${newPrice.toLocaleString()} (matched by ${matchedBy})`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Updated: ${updatedCount} products across ${locations.length} active locations`)
  console.log(`Not found: ${notFoundCount} products`)

  if (notFound.length > 0) {
    console.log('\n--- Products NOT FOUND in database ---')
    notFound.forEach(item => console.log(`  - [${item.code}] ${item.name}`))
  }

  console.log('\nPrice update complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
