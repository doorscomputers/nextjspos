import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating test product with opening stock...\n')

  // Get the first business and user
  const business = await prisma.business.findFirst()
  const user = await prisma.user.findFirst({
    where: { businessId: business.id }
  })
  const location = await prisma.businessLocation.findFirst({
    where: { businessId: business.id }
  })

  console.log(`Business ID: ${business.id}`)
  console.log(`User ID: ${user.id}`)
  console.log(`Location ID: ${location.id}`)

  // Create a test product
  const product = await prisma.product.create({
    data: {
      businessId: business.id,
      name: 'Test Product via Script',
      type: 'single',
      sku: 'TEST-SCRIPT-001',
      enableStock: true,
      purchasePrice: 50,
      sellingPrice: 75
    }
  })

  console.log(`\nCreated product ID: ${product.id}`)

  // Create default variation
  const variation = await prisma.productVariation.create({
    data: {
      productId: product.id,
      name: 'DUMMY',
      sku: product.sku,
      purchasePrice: 50,
      sellingPrice: 75,
      isDefault: true
    }
  })

  console.log(`Created variation ID: ${variation.id}`)

  // Create variation location details
  const variationLocation = await prisma.variationLocationDetails.create({
    data: {
      productId: product.id,
      productVariationId: variation.id,
      locationId: location.id,
      qtyAvailable: 200
    }
  })

  console.log(`Created variation location detail ID: ${variationLocation.id}`)

  // Create stock transaction
  const transaction = await prisma.stockTransaction.create({
    data: {
      businessId: business.id,
      productId: product.id,
      productVariationId: variation.id,
      locationId: location.id,
      type: 'opening_stock',
      quantity: 200,
      unitCost: 50,
      balanceQty: 200,
      createdBy: user.id,
      notes: 'Opening stock via script'
    }
  })

  console.log(`Created stock transaction ID: ${transaction.id}`)

  console.log('\n=== VERIFICATION ===\n')

  // Verify the stock transaction was created
  const transactions = await prisma.stockTransaction.findMany({
    where: { productId: product.id },
    include: {
      product: { select: { name: true } },
      productVariation: { select: { name: true } }
    }
  })

  console.log(`Found ${transactions.length} stock transactions for this product`)
  transactions.forEach(t => {
    console.log(`- Type: ${t.type}, Qty: ${t.quantity}, Balance: ${t.balanceQty}`)
  })

  console.log('\nSuccess! Test product created with stock transaction.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
