/**
 * Update Script: Apply laptop price updates to production database
 * Run with: DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" npx tsx scripts/update-laptop-prices.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()
const EXCEL_FILE_PATH = 'C:/Users/Warenski/Downloads/BATCH UPDATE COST AND PRICE LAPTOP 26DEC2025.xlsx'

interface ExcelRow {
  Product: string
  Category: string
  'Cost Price': number
  SRP: number
}

async function main() {
  console.log('='.repeat(80))
  console.log('UPDATE: Laptop Price Update (PRODUCTION)')
  console.log('='.repeat(80))
  console.log('')

  // Read Excel file
  console.log('Reading Excel file...')
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(sheet)

  console.log(`Found ${data.length} products in Excel file (Sheet: ${sheetName})`)
  console.log('')

  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })
  console.log(`Active locations: ${locations.map(l => l.name).join(', ')}`)
  console.log('')
  console.log('-'.repeat(80))

  let foundCount = 0
  let updatedCount = 0
  let notFoundCount = 0
  const notFoundProducts: string[] = []
  const updatedProducts: string[] = []
  const skippedProducts: string[] = []

  for (const row of data) {
    const productName = row.Product?.trim()
    const newCost = row['Cost Price']
    const newSRP = row.SRP

    if (!productName || newCost === undefined || newSRP === undefined) {
      console.log(`SKIP: Missing data - Name=${productName}, Cost=${newCost}, SRP=${newSRP}`)
      continue
    }

    // Try to find product by name (case-insensitive contains search)
    let product = await prisma.product.findFirst({
      where: {
        name: { contains: productName, mode: 'insensitive' }
      },
      include: {
        variations: {
          select: {
            id: true,
            sku: true,
            purchasePrice: true,
            sellingPrice: true
          }
        }
      },
    })

    // If not found, try matching with just the model number
    if (!product) {
      const parts = productName.split(' | ')[0].split(' ')
      if (parts.length > 1) {
        const modelNumber = parts.slice(1).join(' ')
        product = await prisma.product.findFirst({
          where: {
            name: { contains: modelNumber, mode: 'insensitive' }
          },
          include: {
            variations: {
              select: {
                id: true,
                sku: true,
                purchasePrice: true,
                sellingPrice: true
              }
            }
          },
        })
      }
    }

    if (!product || product.variations.length === 0) {
      notFoundCount++
      notFoundProducts.push(productName.split(' | ')[0])
      console.log(`NOT FOUND: ${productName.split(' | ')[0]}`)
      continue
    }

    foundCount++
    const v = product.variations[0]
    const oldCost = Number(v.purchasePrice || 0)
    const oldSRP = Number(v.sellingPrice || 0)

    // Check if update is needed
    const costNeedsUpdate = Math.abs(oldCost - newCost) > 0.01
    const srpNeedsUpdate = Math.abs(oldSRP - newSRP) > 0.01

    if (!costNeedsUpdate && !srpNeedsUpdate) {
      skippedProducts.push(productName.split(' | ')[0])
      console.log(`NO CHANGE: ${productName.split(' | ')[0]} - Prices already match`)
      continue
    }

    // Update ProductVariation
    await prisma.productVariation.update({
      where: { id: v.id },
      data: {
        purchasePrice: newCost,
        sellingPrice: newSRP,
      },
    })

    // Update VariationLocationDetails for all active locations
    for (const location of locations) {
      await prisma.variationLocationDetails.updateMany({
        where: {
          productVariationId: v.id,
          locationId: location.id,
        },
        data: {
          sellingPrice: newSRP,
          lastPriceUpdate: new Date(),
        },
      })
    }

    updatedCount++
    updatedProducts.push(`${productName.split(' | ')[0]} (Cost: ${oldCost} → ${newCost}, SRP: ${oldSRP} → ${newSRP})`)

    const costArrow = costNeedsUpdate ? (newCost > oldCost ? '↑' : '↓') : '='
    const srpArrow = srpNeedsUpdate ? (newSRP > oldSRP ? '↑' : '↓') : '='

    console.log(`UPDATED: ${productName.split(' | ')[0]}`)
    console.log(`  Cost: ${oldCost.toLocaleString()} → ${newCost.toLocaleString()} ${costArrow}`)
    console.log(`  SRP:  ${oldSRP.toLocaleString()} → ${newSRP.toLocaleString()} ${srpArrow}`)
    console.log(`  Updated ${locations.length} location prices`)
    console.log('')
  }

  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total in Excel:  ${data.length}`)
  console.log(`Found in DB:     ${foundCount}`)
  console.log(`Updated:         ${updatedCount}`)
  console.log(`No changes:      ${skippedProducts.length}`)
  console.log(`Not Found:       ${notFoundCount}`)
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
