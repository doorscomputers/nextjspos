/**
 * Script to update TRANSCEND product costs and selling prices from Excel
 * Run with: DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" npx tsx scripts/update-transcend-prices.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()
const EXCEL_FILE_PATH = 'c:/Users/Warenski/Downloads/TRANSCEND FOR NEW PRICING (UPDATED TO SYSTEM PRICING2.xlsx'

interface PriceUpdateRow {
  'Item Code': string | number
  'Item Name': string
  'New COST': number
  'New SRP': number
}

async function main() {
  console.log('Reading Excel file...')
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data: PriceUpdateRow[] = XLSX.utils.sheet_to_json(sheet)

  console.log(`Found ${data.length} products in Excel file (Sheet: ${sheetName})`)

  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })
  console.log(`Found ${locations.length} active locations:`, locations.map(l => l.name).join(', '))

  let successCount = 0
  let notFoundCount = 0
  const notFoundProducts: string[] = []

  for (const row of data) {
    const sku = String(row['Item Code']).trim()
    const itemName = row['Item Name']?.trim()
    const newCost = row['New COST']
    const newPrice = row['New SRP']

    if (!sku || !newPrice || !newCost) {
      console.log(`Skipping row - missing data: SKU=${sku}, Cost=${newCost}, Price=${newPrice}`)
      continue
    }

    // Find product variation by SKU
    let variation = await prisma.productVariation.findFirst({
      where: { sku: sku },
      include: { product: true },
    })

    // If not found by SKU, try by product name
    if (!variation && itemName) {
      const product = await prisma.product.findFirst({
        where: {
          name: { contains: itemName, mode: 'insensitive' },
        },
        include: { variations: true },
      })
      if (product && product.variations.length > 0) {
        variation = { ...product.variations[0], product }
      }
    }

    if (!variation) {
      notFoundCount++
      notFoundProducts.push(`${sku} - ${itemName}`)
      continue
    }

    // Update ProductVariation (cost and selling price)
    await prisma.productVariation.update({
      where: { id: variation.id },
      data: {
        purchasePrice: newCost,
        sellingPrice: newPrice,
      },
    })

    // Update VariationLocationDetails for all active locations
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

    successCount++
    console.log(`Updated: ${variation.product.name} | Cost: ${newCost} | SRP: ${newPrice}`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Successfully updated: ${successCount} products`)
  console.log(`Not found: ${notFoundCount} products`)

  if (notFoundProducts.length > 0) {
    console.log('\nProducts not found in database:')
    notFoundProducts.forEach((p) => console.log(`  - ${p}`))
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
