import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testApi() {
  // Simulate what the API does
  const items = await prisma.purchaseItem.findMany({
    where: {
      purchase: {
        deletedAt: null,
        businessId: 1  // Assuming business ID 1
      }
    },
    include: {
      purchase: {
        select: {
          id: true,
          purchaseOrderNumber: true,
          purchaseDate: true,
          expectedDeliveryDate: true,
          status: true,
          locationId: true,
          supplier: {
            select: {
              id: true,
              name: true
            }
          }
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
              sku: true,
              category: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      id: 'desc'
    },
    take: 20
  })

  // Filter for items containing the ACER product
  const acerItems = items.filter(item =>
    item.productVariation.product.name.includes('ACER ANV16-71-524U') ||
    item.productVariation.product.sku.includes('4711474233172') ||
    item.productVariation.sku.includes('4711474233172')
  )

  console.log('=== ACER ITEMS IN QUERY RESULT ===')
  console.log('Total items returned:', items.length)
  console.log('ACER items found:', acerItems.length)

  acerItems.forEach(item => {
    console.log('')
    console.log('PO:', item.purchase.purchaseOrderNumber)
    console.log('Product Name:', item.productVariation.product.name)
    console.log('Product SKU (product.sku):', item.productVariation.product.sku)
    console.log('Variation SKU (variation.sku):', item.productVariation.sku)
    console.log('Status:', item.purchase.status)
  })

  // Check if item exists at all
  console.log('')
  console.log('=== DIRECT CHECK FOR VARIATION 695 ===')
  const directCheck = await prisma.purchaseItem.findFirst({
    where: {
      productVariationId: 695
    },
    include: {
      purchase: true,
      productVariation: {
        include: {
          product: true
        }
      }
    }
  })

  if (directCheck) {
    console.log('Found! PO:', directCheck.purchase.purchaseOrderNumber)
    console.log('Business ID:', directCheck.purchase.businessId)
    console.log('Deleted At:', directCheck.purchase.deletedAt)
  } else {
    console.log('Not found!')
  }

  await prisma.$disconnect()
}

testApi()
