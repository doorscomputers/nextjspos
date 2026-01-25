/**
 * Update SRP from price-comparison-report-for-price-update.xlsx
 * Only updates products that have a "New SRP" value in the Excel file
 *
 * Run with: DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" npx tsx scripts/update-srp-from-comparison.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()
const EXCEL_FILE = 'C:/Users/Warenski/Downloads/price-comparison-report-for-price-update.xlsx'

interface ExcelRow {
  Product: string
  SKU: string
  'OLD BEST Price'?: number
  'New SRP'?: number
  Category?: string
  Brand?: string
  'Cost Price'?: number
}

async function main() {
  console.log('='.repeat(80))
  console.log('UPDATE SRP from Price Comparison Report')
  console.log('='.repeat(80))
  console.log('')

  // Read Excel file
  console.log('Reading Excel file...')
  const workbook = XLSX.readFile(EXCEL_FILE)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(sheet)

  // Filter to only products with New SRP
  const toUpdate = data.filter(r => r['New SRP'] !== undefined && r['New SRP'] !== null && r['New SRP'] !== '')
  console.log(`Found ${toUpdate.length} products with New SRP values`)
  console.log('')

  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })
  console.log(`Active locations: ${locations.map(l => l.name).join(', ')}`)
  console.log('')
  console.log('-'.repeat(80))

  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0
  const notFoundProducts: string[] = []
  const updatedProducts: string[] = []
  const skippedProducts: string[] = []

  for (const row of toUpdate) {
    const productName = row.Product?.trim()
    const sku = row.SKU?.toString().trim()
    const newSRP = row['New SRP']
    const oldPrice = row['OLD BEST Price']

    if (!sku || newSRP === undefined) {
      console.log(`SKIP: Missing SKU or New SRP - ${productName}`)
      skippedCount++
      continue
    }

    // Find ProductVariation by SKU
    const variation = await prisma.productVariation.findFirst({
      where: { sku: sku },
      include: {
        product: { select: { name: true } }
      }
    })

    if (!variation) {
      notFoundCount++
      notFoundProducts.push(`${productName} (SKU: ${sku})`)
      console.log(`NOT FOUND: ${productName} (SKU: ${sku})`)
      continue
    }

    const currentSRP = Number(variation.sellingPrice || 0)

    // Check if update is needed
    if (Math.abs(currentSRP - newSRP) < 0.01) {
      skippedCount++
      skippedProducts.push(productName)
      console.log(`NO CHANGE: ${productName} - SRP already ${newSRP}`)
      continue
    }

    // Update ProductVariation selling price
    await prisma.productVariation.update({
      where: { id: variation.id },
      data: { sellingPrice: newSRP },
    })

    // Update VariationLocationDetails for all active locations
    for (const location of locations) {
      await prisma.variationLocationDetails.updateMany({
        where: {
          productVariationId: variation.id,
          locationId: location.id,
        },
        data: {
          sellingPrice: newSRP,
          lastPriceUpdate: new Date(),
        },
      })
    }

    updatedCount++
    const arrow = newSRP > currentSRP ? '↑' : '↓'
    const diff = Math.abs(newSRP - currentSRP)
    updatedProducts.push(`${productName.substring(0, 50)}... (${currentSRP} → ${newSRP} ${arrow}${diff})`)

    console.log(`UPDATED: ${productName.substring(0, 60)}...`)
    console.log(`  SKU: ${sku}`)
    console.log(`  SRP: ${currentSRP.toLocaleString()} → ${newSRP.toLocaleString()} (${arrow}${diff.toLocaleString()})`)
    console.log('')
  }

  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total with New SRP: ${toUpdate.length}`)
  console.log(`Updated:            ${updatedCount}`)
  console.log(`No changes needed:  ${skippedCount}`)
  console.log(`Not found:          ${notFoundCount}`)
  console.log('')

  if (updatedProducts.length > 0) {
    console.log('Products updated:')
    updatedProducts.forEach((p) => console.log(`  ✓ ${p}`))
    console.log('')
  }

  if (notFoundProducts.length > 0) {
    console.log('Products NOT found in database:')
    notFoundProducts.forEach((p) => console.log(`  ✗ ${p}`))
    console.log('')
  }

  console.log('='.repeat(80))
  console.log('UPDATE COMPLETE')
  console.log('='.repeat(80))
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
