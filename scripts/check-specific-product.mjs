import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProduct() {
  try {
    const sku = '6908620061125'

    console.log(`\n🔍 Checking product: ${sku}\n`)

    // Find product
    const product = await prisma.product.findFirst({
      where: { sku },
      include: {
        variations: {
          include: {
            variationLocationDetails: true
          }
        }
      }
    })

    if (!product) {
      console.log('❌ Product not found')
      return
    }

    console.log(`✅ Product found: ${product.name} (ID: ${product.id})`)

    // Check variation location details
    const mainStoreLocation = await prisma.businessLocation.findFirst({
      where: { name: 'Main Store' }
    })

    if (mainStoreLocation) {
      console.log(`📍 Main Store Location ID: ${mainStoreLocation.id}`)

      const variation = product.variations[0]
      if (variation) {
        const locationDetail = variation.variationLocationDetails.find(
          d => d.locationId === mainStoreLocation.id
        )

        if (locationDetail) {
          console.log(`\n📦 Main Store Stock:`)
          console.log(`  Quantity: ${locationDetail.qtyAvailable}`)
          console.log(`  Selling Price: ${locationDetail.sellingPrice}`)
        }
      }
    }

    // Check ProductHistory
    console.log(`\n📜 Product History Records:`)
    const history = await prisma.productHistory.findMany({
      where: {
        productId: product.id
      },
      orderBy: { id: 'asc' }
    })

    console.log(`Total records: ${history.length}`)

    if (history.length > 0) {
      console.log(`\nFirst 5 records:`)
      history.slice(0, 5).forEach((h, i) => {
        console.log(`${i+1}. Type: ${h.transactionType}, Location: ${h.locationId}, Qty: ${h.quantityChange}, Date: ${h.transactionDate}`)
      })
    } else {
      console.log('❌ No ProductHistory records found!')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProduct()
