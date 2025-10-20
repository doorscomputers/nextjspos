import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testSupplierReturn() {
  try {
    console.log('Testing Supplier Return Data Fetch...\n')

    // Find a supplier return with items
    const supplierReturn = await prisma.supplierReturn.findFirst({
      include: {
        items: true,
        supplier: true
      }
    })

    if (!supplierReturn) {
      console.log('No supplier returns found in database')
      return
    }

    console.log('Found Supplier Return:')
    console.log('  Return Number:', supplierReturn.returnNumber)
    console.log('  Status:', supplierReturn.status)
    console.log('  Items Count:', supplierReturn.items.length)
    console.log()

    if (supplierReturn.items.length > 0) {
      const item = supplierReturn.items[0]

      // Fetch product details
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })

      // Fetch variation details
      const variation = await prisma.productVariation.findUnique({
        where: { id: item.productVariationId }
      })

      console.log('First Item Details:')
      console.log('  Product ID:', item.productId)
      console.log('  Product Name:', product?.name || 'NOT FOUND')
      console.log('  Variation ID:', item.productVariationId)
      console.log('  Variation Name:', variation?.name || 'NOT FOUND')
      console.log('  Quantity:', item.quantity)
      console.log()

      // Test the API format
      console.log('API Response Format (simulated):')
      const apiItem = {
        ...item,
        product: product ? { id: product.id, name: product.name } : { id: item.productId, name: 'Unknown Product' },
        productVariation: variation ? { id: variation.id, name: variation.name } : { id: item.productVariationId, name: 'Standard' }
      }
      console.log('  Product Display:', apiItem.product.name)
      console.log('  Variation Display:', apiItem.productVariation.name)
    }

    // Check for any DUMMY variations still in the database
    const dummyCount = await prisma.productVariation.count({
      where: { name: 'DUMMY' }
    })

    const defaultCount = await prisma.productVariation.count({
      where: { name: 'Default' }
    })

    console.log('\nVariation Name Statistics:')
    console.log('  DUMMY variations:', dummyCount)
    console.log('  Default variations:', defaultCount)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSupplierReturn()
