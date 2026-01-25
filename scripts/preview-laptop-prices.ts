/**
 * Preview Script: Check laptop products and show price differences (DRY RUN)
 * Run with: DATABASE_URL="postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" npx tsx scripts/preview-laptop-prices.ts
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
  console.log('PREVIEW: Laptop Price Update (DRY RUN - No changes will be made)')
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
  let notFoundCount = 0
  const notFoundProducts: string[] = []
  const matchedProducts: Array<{
    excelName: string
    dbName: string
    oldCost: number
    newCost: number
    oldSRP: number
    newSRP: number
    variationId: number
  }> = []

  for (const row of data) {
    const productName = row.Product?.trim()
    const newCost = row['Cost Price']
    const newSRP = row.SRP

    if (!productName || newCost === undefined || newSRP === undefined) {
      console.log(`SKIP: Missing data - Name=${productName}, Cost=${newCost}, SRP=${newSRP}`)
      continue
    }

    // Try to find product by name (case-insensitive contains search)
    // First try exact match, then try partial match with model number
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

    // If not found, try matching with just the model number (after brand name)
    if (!product) {
      // Extract model number pattern (e.g., "AL14-32P-34RE" from "ACER AL14-32P-34RE | ...")
      const parts = productName.split(' | ')[0].split(' ')
      if (parts.length > 1) {
        const modelNumber = parts.slice(1).join(' ') // Skip brand name
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

    if (product && product.variations.length > 0) {
      foundCount++
      const v = product.variations[0]
      const oldCost = Number(v.purchasePrice || 0)
      const oldSRP = Number(v.sellingPrice || 0)

      matchedProducts.push({
        excelName: productName.split(' | ')[0],
        dbName: product.name.substring(0, 50),
        oldCost,
        newCost,
        oldSRP,
        newSRP,
        variationId: v.id
      })

      const costDiff = newCost - oldCost
      const srpDiff = newSRP - oldSRP
      const costArrow = costDiff > 0 ? '↑' : costDiff < 0 ? '↓' : '='
      const srpArrow = srpDiff > 0 ? '↑' : srpDiff < 0 ? '↓' : '='

      console.log(`FOUND: ${productName.split(' | ')[0]}`)
      console.log(`  DB Name: ${product.name.substring(0, 60)}...`)
      console.log(`  Cost: ${oldCost.toLocaleString()} → ${newCost.toLocaleString()} (${costArrow}${Math.abs(costDiff).toLocaleString()})`)
      console.log(`  SRP:  ${oldSRP.toLocaleString()} → ${newSRP.toLocaleString()} (${srpArrow}${Math.abs(srpDiff).toLocaleString()})`)
      console.log('')
    } else {
      notFoundCount++
      notFoundProducts.push(productName.split(' | ')[0])
      console.log(`NOT FOUND: ${productName.split(' | ')[0]}`)
      console.log('')
    }
  }

  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total in Excel: ${data.length}`)
  console.log(`Found in DB:    ${foundCount}`)
  console.log(`Not Found:      ${notFoundCount}`)
  console.log('')

  if (notFoundProducts.length > 0) {
    console.log('Products NOT found in database:')
    notFoundProducts.forEach((p) => console.log(`  - ${p}`))
    console.log('')
  }

  if (matchedProducts.length > 0) {
    console.log('Price changes summary:')
    let totalCostIncrease = 0
    let totalSRPIncrease = 0
    matchedProducts.forEach(p => {
      totalCostIncrease += p.newCost - p.oldCost
      totalSRPIncrease += p.newSRP - p.oldSRP
    })
    console.log(`  Total Cost change: ${totalCostIncrease >= 0 ? '+' : ''}${totalCostIncrease.toLocaleString()}`)
    console.log(`  Total SRP change:  ${totalSRPIncrease >= 0 ? '+' : ''}${totalSRPIncrease.toLocaleString()}`)
  }

  console.log('')
  console.log('='.repeat(80))
  console.log('THIS WAS A DRY RUN - NO CHANGES WERE MADE')
  console.log('Run scripts/update-laptop-prices.ts to apply these changes')
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
