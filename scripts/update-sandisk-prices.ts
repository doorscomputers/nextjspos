/**
 * Script to update SANDISK product costs and selling prices from Excel
 * Run with: DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" npx tsx scripts/update-sandisk-prices.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

const EXCEL_FILE_PATH = 'c:/Users/Warenski/Downloads/SANDISK FOR NEW PRICING2.xlsx'

interface PriceUpdateRow {
  'Item Code': string | number
  'Item Name': string
  'New Cost': number
  'NEW Selling Price': number
  Status: string
}

async function main() {
  console.log('=== SANDISK Price & Cost Update ===\n')

  // Read Excel file
  console.log(`Reading: ${EXCEL_FILE_PATH}`)
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data: PriceUpdateRow[] = XLSX.utils.sheet_to_json(sheet)

  console.log(`Total rows: ${data.length}\n`)

  const businessId = 1

  // Get all ACTIVE locations
  const locations = await prisma.businessLocation.findMany({
    where: {
      businessId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, name: true },
  })

  console.log(`Active locations: ${locations.map(l => l.name).join(', ')}\n`)

  let updatedCount = 0
  let notFoundCount = 0
  const notFound: { sku: string; name: string }[] = []
  const updated: { name: string; oldCost: number; newCost: number; oldPrice: number; newPrice: number }[] = []

  for (const row of data) {
    const sku = String(row['Item Code'] || '').trim()
    const productName = String(row['Item Name'] || '').trim()
    const newCost = row['New Cost']
    const newPrice = row['NEW Selling Price']

    if (!sku || !newCost || !newPrice) {
      console.log(`Skipping: ${productName} - Missing data`)
      continue
    }

    // Find variation by SKU first
    let variation = await prisma.productVariation.findFirst({
      where: {
        businessId,
        sku: sku,
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    })

    // If not found by SKU, try by product name
    if (!variation) {
      const product = await prisma.product.findFirst({
        where: {
          businessId,
          name: { equals: productName, mode: 'insensitive' },
        },
        include: {
          variations: {
            take: 1,
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (product && product.variations.length > 0) {
        variation = product.variations[0]
      }
    }

    if (!variation) {
      notFoundCount++
      notFound.push({ sku, name: productName })
      console.log(`❌ Not found: [${sku}] ${productName}`)
      continue
    }

    const oldCost = Number(variation.purchasePrice) || 0
    const oldPrice = Number(variation.sellingPrice) || 0

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

    updatedCount++
    updated.push({
      name: variation.product.name,
      oldCost,
      newCost,
      oldPrice,
      newPrice,
    })
    console.log(`✅ ${variation.product.name}`)
    console.log(`   Cost: ₱${oldCost.toLocaleString()} → ₱${newCost.toLocaleString()}`)
    console.log(`   SRP:  ₱${oldPrice.toLocaleString()} → ₱${newPrice.toLocaleString()}`)
  }

  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(`✅ Updated: ${updatedCount} products`)
  console.log(`❌ Not found: ${notFoundCount} products`)

  if (notFound.length > 0) {
    console.log('\n--- Products NOT FOUND ---')
    notFound.forEach(item => console.log(`  [${item.sku}] ${item.name}`))
  }

  console.log('\nDone!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
