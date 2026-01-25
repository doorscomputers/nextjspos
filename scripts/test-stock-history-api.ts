/**
 * Test what the stock history function would return - replicate the queries
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Testing Stock History Queries ===\n')

  const productId = 321
  const variationId = 321
  const locationId = 4 // Tuguegarao
  const businessId = 1

  const startDate = new Date('2025-12-31')
  const endDate = new Date('2026-01-22T23:59:59.999Z')

  console.log(`Product ID: ${productId}`)
  console.log(`Variation ID: ${variationId}`)
  console.log(`Location ID: ${locationId} (Tuguegarao)`)
  console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

  // Query 1: Sale Items
  console.log('\n=== Query: SaleItems ===')
  const saleItems = await prisma.saleItem.findMany({
    where: {
      productId,
      productVariationId: variationId,
      sale: {
        businessId,
        locationId,
        saleDate: {
          gte: startDate,
          lte: endDate
        }
      }
    },
    include: {
      sale: {
        select: {
          saleDate: true,
          createdAt: true,
          invoiceNumber: true,
          customer: { select: { name: true } }
        }
      }
    }
  })
  console.log(`Found ${saleItems.length} sale items`)
  for (const item of saleItems) {
    console.log(`  ${item.sale.invoiceNumber} | qty: ${item.quantity} | ${item.sale.saleDate}`)
  }

  // Query 2: Inventory Corrections
  console.log('\n=== Query: InventoryCorrections ===')
  const inventoryCorrections = await prisma.inventoryCorrection.findMany({
    where: {
      businessId,
      locationId,
      productId,
      productVariationId: variationId,
      status: 'approved',
      deletedAt: null,
      approvedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      stockTransaction: true
    }
  })
  console.log(`Found ${inventoryCorrections.length} inventory corrections`)
  for (const c of inventoryCorrections) {
    console.log(`  ID: ${c.id} | diff: ${c.difference} | reason: ${c.reason}`)
  }

  // Query 3: Product History
  console.log('\n=== Query: ProductHistory (excluding sales) ===')
  const productHistory = await prisma.productHistory.findMany({
    where: {
      businessId,
      locationId,
      productId,
      productVariationId: variationId,
      transactionDate: {
        gte: startDate,
        lte: endDate
      },
      transactionType: {
        notIn: ['sale']
      }
    }
  })
  console.log(`Found ${productHistory.length} product history records`)
  for (const h of productHistory) {
    console.log(`  ${h.id} | ${h.transactionType} | ${h.referenceType}#${h.referenceId} | qty: ${h.quantityChange}`)
  }

  console.log('\n=== Summary ===')
  console.log(`Total transactions that would be shown: ${saleItems.length + inventoryCorrections.length + productHistory.length}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
