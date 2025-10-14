import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setAllProductsActive() {
  console.log('Setting all existing products to active...')

  try {
    const result = await prisma.product.updateMany({
      where: {
        deletedAt: null
      },
      data: {
        isActive: true
      }
    })

    console.log(`✓ Successfully set ${result.count} products to active`)
    console.log('Migration completed!')
  } catch (error) {
    console.error('Error setting products to active:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setAllProductsActive()
