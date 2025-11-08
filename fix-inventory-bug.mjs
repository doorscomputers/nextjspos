import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixInventoryBug() {
  try {
    console.log('\n=== FIXING INVENTORY BUG (6000 → 20) ===\n')

    // Find the Sample UTP CABLE product
    const product = await prisma.product.findFirst({
      where: {
        name: { contains: 'Sample UTP CABLE' },
        businessId: 1
      },
      include: {
        variations: true
      }
    })

    if (!product) {
      console.log('❌ Product not found')
      return
    }

    console.log(`✅ Found product: ${product.name} (ID: ${product.id})`)

    const variation = product.variations[0]
    if (!variation) {
      console.log('❌ No variation found')
      return
    }

    console.log(`✅ Variation: ${variation.name} (ID: ${variation.id})`)

    // Main Warehouse location (ID 1)
    const locationId = 1

    // Get current stock
    const currentStock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variation.id,
          locationId
        }
      }
    })

    if (!currentStock) {
      console.log('❌ No stock record found')
      return
    }

    console.log(`\n📊 Current Stock: ${currentStock.qtyAvailable}`)
    console.log(`Expected: 20`)
    console.log(`Bug: System added 6000 instead of 20 (20 × 300 multiplier)`)

    // Calculate correct quantity
    const correctQuantity = 20
    const buggyQuantity = Number(currentStock.qtyAvailable)
    const correction = correctQuantity - buggyQuantity

    console.log(`\n🔧 Correction needed: ${correction}`)

    // Update stock to correct value
    await prisma.variationLocationDetails.update({
      where: { id: currentStock.id },
      data: {
        qtyAvailable: correctQuantity
      }
    })

    console.log(`\n✅ Stock corrected: ${buggyQuantity} → ${correctQuantity}`)

    // Also update stock transactions
    console.log(`\n🔍 Finding related stock transaction...`)

    const stockTx = await prisma.stockTransaction.findFirst({
      where: {
        productVariationId: variation.id,
        locationId,
        type: 'purchase'
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (stockTx) {
      console.log(`Found transaction ID: ${stockTx.id}, Quantity: ${stockTx.quantity}`)

      if (Number(stockTx.quantity) === 6000) {
        await prisma.stockTransaction.update({
          where: { id: stockTx.id },
          data: {
            quantity: 20,
            balanceQty: 20
          }
        })
        console.log(`✅ Stock transaction corrected: 6000 → 20`)
      }
    }

    // Update product history
    console.log(`\n🔍 Finding related product history...`)

    const history = await prisma.productHistory.findFirst({
      where: {
        productVariationId: variation.id,
        locationId,
        transactionType: 'purchase'
      },
      orderBy: {
        transactionDate: 'desc'
      }
    })

    if (history) {
      console.log(`Found history ID: ${history.id}, Quantity Change: ${history.quantityChange}`)

      if (Number(history.quantityChange) === 6000) {
        await prisma.productHistory.update({
          where: { id: history.id },
          data: {
            quantityChange: 20,
            balanceQuantity: 20
          }
        })
        console.log(`✅ Product history corrected: 6000 → 20`)
      }
    }

    console.log(`\n=== FIX COMPLETE ===`)
    console.log(`✅ Inventory now shows correct quantity: 20 units`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixInventoryBug()
