import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigate() {
  // Find the product
  const product = await prisma.product.findFirst({
    where: { name: { contains: 'ACER ANV16-71-524U' } },
    include: {
      variations: { where: { deletedAt: null } }
    }
  })

  console.log('=== PRODUCT INFO ===')
  console.log('Product ID:', product?.id)
  console.log('Product SKU:', product?.sku)
  console.log('Variation ID:', product?.variations[0]?.id)
  console.log('Variation SKU:', product?.variations[0]?.sku)

  // Find any purchase items for this product variation
  if (product?.variations[0]) {
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: { productVariationId: product.variations[0].id },
      include: {
        purchase: {
          select: {
            purchaseOrderNumber: true,
            status: true,
            purchaseDate: true,
            businessId: true
          }
        },
        productVariation: {
          select: {
            sku: true,
            product: {
              select: {
                sku: true,
                name: true
              }
            }
          }
        }
      }
    })

    console.log('')
    console.log('=== PURCHASE ITEMS FOR THIS VARIATION ===')
    console.log('Found:', purchaseItems.length, 'purchase items')
    purchaseItems.forEach(item => {
      console.log('- PO:', item.purchase.purchaseOrderNumber, '| Status:', item.purchase.status, '| Date:', item.purchase.purchaseDate)
      console.log('  Product SKU:', item.productVariation.product.sku)
      console.log('  Variation SKU:', item.productVariation.sku)
    })
  }

  // Also search for any purchase items with SKU containing 524U or 4711474233172
  console.log('')
  console.log('=== SEARCH BY SKU IN PURCHASE ITEMS ===')

  const itemsBySku = await prisma.purchaseItem.findMany({
    where: {
      productVariation: {
        OR: [
          { sku: { contains: '524U' } },
          { sku: { contains: '4711474233172' } },
          { product: { sku: { contains: '4711474233172' } } }
        ]
      }
    },
    include: {
      purchase: {
        select: {
          purchaseOrderNumber: true,
          status: true,
          purchaseDate: true
        }
      },
      productVariation: {
        select: {
          id: true,
          sku: true,
          product: {
            select: {
              id: true,
              sku: true,
              name: true
            }
          }
        }
      }
    }
  })

  console.log('Found by SKU search:', itemsBySku.length, 'items')
  itemsBySku.forEach(item => {
    console.log('- PO:', item.purchase.purchaseOrderNumber)
    console.log('  Product:', item.productVariation.product.name)
    console.log('  Product SKU:', item.productVariation.product.sku)
    console.log('  Variation SKU:', item.productVariation.sku)
    console.log('  Variation ID:', item.productVariation.id)
  })

  await prisma.$disconnect()
}

investigate()
