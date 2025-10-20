/**
 * Manual test to create a product and add opening stock via API
 * This simulates what the UI does when a user creates a product and adds opening stock
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Manual Opening Stock Test ===\n')

  // Get business, user, and location
  const business = await prisma.business.findFirst()
  const user = await prisma.user.findFirst({
    where: { businessId: business.id }
  })
  const location = await prisma.businessLocation.findFirst({
    where: { businessId: business.id }
  })

  console.log(`Business: ${business.name} (ID: ${business.id})`)
  console.log(`User: ${user.username} (ID: ${user.id})`)
  console.log(`Location: ${location.name} (ID: ${location.id})`)

  // STEP 1: Create a product (simulating the POST /api/products endpoint)
  console.log('\n--- STEP 1: Creating Product ---')

  const product = await prisma.product.create({
    data: {
      businessId: business.id,
      name: `Manual Test Product ${Date.now()}`,
      type: 'single',
      sku: `MAN-${Date.now()}`,
      enableStock: true,
      purchasePrice: 50,
      sellingPrice: 75
    }
  })

  console.log(`Created product: ${product.name} (ID: ${product.id})`)

  // Create default variation (simulating what the product POST endpoint does)
  const variation = await prisma.productVariation.create({
    data: {
      productId: product.id,
      name: 'Default',
      sku: product.sku,
      purchasePrice: 50,
      sellingPrice: 75,
      isDefault: true
    }
  })

  console.log(`Created variation: ${variation.name} (ID: ${variation.id})`)

  // STEP 2: Add opening stock (simulating the POST /api/products/[id]/opening-stock endpoint)
  console.log('\n--- STEP 2: Adding Opening Stock ---')

  const stockEntry = {
    locationId: location.id.toString(),
    quantity: '150',
    purchasePrice: '50',
    sellingPrice: '75'
  }

  console.log(`Stock entry:`, stockEntry)

  // This simulates the opening stock API route logic
  // Create variation location details
  const variationLocation = await prisma.variationLocationDetails.create({
    data: {
      productId: product.id,
      productVariationId: variation.id,
      locationId: location.id,
      qtyAvailable: parseFloat(stockEntry.quantity),
      sellingPrice: stockEntry.sellingPrice ? parseFloat(stockEntry.sellingPrice) : null
    }
  })

  console.log(`Created variation location detail (ID: ${variationLocation.id})`)

  // Create stock transaction
  const transaction = await prisma.stockTransaction.create({
    data: {
      businessId: business.id,
      productId: product.id,
      productVariationId: variation.id,
      locationId: location.id,
      type: 'opening_stock',
      quantity: parseFloat(stockEntry.quantity),
      unitCost: stockEntry.purchasePrice ? parseFloat(stockEntry.purchasePrice) : null,
      balanceQty: parseFloat(stockEntry.quantity),
      createdBy: user.id,
      notes: 'Opening stock added via manual test'
    }
  })

  console.log(`Created stock transaction (ID: ${transaction.id})`)

  // STEP 3: Verify stock history
  console.log('\n--- STEP 3: Verifying Stock History ---')

  const stockTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId: business.id,
      productId: product.id,
      productVariationId: variation.id,
      locationId: location.id
    },
    include: {
      createdByUser: {
        select: {
          username: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log(`Found ${stockTransactions.length} stock transaction(s)`)

  stockTransactions.forEach(t => {
    console.log(`\nTransaction ID: ${t.id}`)
    console.log(`  Type: ${t.type}`)
    console.log(`  Quantity: ${t.quantity}`)
    console.log(`  Balance: ${t.balanceQty}`)
    console.log(`  Unit Cost: ${t.unitCost}`)
    console.log(`  Created By: ${t.createdByUser.firstName} ${t.createdByUser.lastName}`)
    console.log(`  Notes: ${t.notes}`)
    console.log(`  Date: ${t.createdAt}`)
  })

  // Verify variation location details
  const variationDetails = await prisma.variationLocationDetails.findFirst({
    where: {
      productId: product.id,
      productVariationId: variation.id,
      locationId: location.id
    }
  })

  console.log(`\nVariation Location Details:`)
  console.log(`  Quantity Available: ${variationDetails.qtyAvailable}`)
  console.log(`  Selling Price: ${variationDetails.sellingPrice}`)

  console.log('\n✅ SUCCESS: Product created with opening stock and stock transaction recorded!')
  console.log(`\nYou can now view this product's stock history at:`)
  console.log(`/dashboard/products/${product.id}/stock-history`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
