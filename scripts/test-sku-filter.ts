import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testSkuFilter() {
  const businessId = 1
  const skuSearch = '4711474233172'
  const startDate = '2025-12-16'
  const endDate = '2025-12-17'

  console.log('=== Testing with filters ===')
  console.log('Business ID:', businessId)
  console.log('SKU Search:', skuSearch)
  console.log('Date Range:', startDate, '-', endDate)

  const purchaseWhere: any = {
    businessId,
    deletedAt: null,
    status: { not: 'cancelled' },
    purchaseDate: {
      gte: new Date(startDate + 'T00:00:00'),
      lte: new Date(endDate + 'T23:59:59.999')
    }
  }

  const items = await prisma.purchaseItem.findMany({
    where: {
      purchase: purchaseWhere
    },
    include: {
      purchase: {
        select: {
          purchaseOrderNumber: true,
          purchaseDate: true,
          status: true
        }
      },
      productVariation: {
        select: {
          id: true,
          sku: true,
          name: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          }
        }
      }
    }
  })

  console.log('')
  console.log('=== All items in date range ===')
  console.log('Total items:', items.length)

  // Current filter logic (variation.sku only)
  const filteredByVariationSku = items.filter(item =>
    item.productVariation.sku.toLowerCase().includes(skuSearch.toLowerCase())
  )
  console.log('')
  console.log('=== Filtered by variation.sku ===')
  console.log('Found:', filteredByVariationSku.length)
  filteredByVariationSku.forEach(item => {
    console.log('- PO:', item.purchase.purchaseOrderNumber, '| Variation SKU:', item.productVariation.sku)
  })

  // Better filter (check both product.sku and variation.sku)
  const filteredByBothSku = items.filter(item =>
    item.productVariation.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
    item.productVariation.product.sku.toLowerCase().includes(skuSearch.toLowerCase())
  )
  console.log('')
  console.log('=== Filtered by BOTH product.sku OR variation.sku ===')
  console.log('Found:', filteredByBothSku.length)
  filteredByBothSku.forEach(item => {
    console.log('- PO:', item.purchase.purchaseOrderNumber)
    console.log('  Product SKU:', item.productVariation.product.sku)
    console.log('  Variation SKU:', item.productVariation.sku)
  })

  // Check what the ACER item looks like
  console.log('')
  console.log('=== Direct check for ACER product ===')
  const acerItem = items.find(item => item.productVariation.product.name.includes('ACER ANV16-71-524U'))
  if (acerItem) {
    console.log('Found ACER item!')
    console.log('PO:', acerItem.purchase.purchaseOrderNumber)
    console.log('Product Name:', acerItem.productVariation.product.name)
    console.log('Product SKU:', acerItem.productVariation.product.sku)
    console.log('Variation SKU:', acerItem.productVariation.sku)
  } else {
    console.log('ACER item NOT FOUND in date range!')
  }

  await prisma.$disconnect()
}

testSkuFilter()
