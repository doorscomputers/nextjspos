import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProductStatus() {
  try {
    console.log('\n=== CHECKING SAMPLE UTP CABLE STATUS ===\n')

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

    console.log(`Product: ${product.name}`)
    console.log(`Product ID: ${product.id}`)
    console.log(`is_active: ${product.isActive}`)
    console.log(`deleted_at: ${product.deletedAt}`)

    console.log(`\nVariations:`)
    for (const variation of product.variations) {
      console.log(`  - ${variation.name} (ID: ${variation.id})`)
      console.log(`    deleted_at: ${variation.deletedAt}`)
    }

    if (!product.isActive) {
      console.log(`\n❌ FOUND THE PROBLEM: Product is_active = false`)
      console.log(`This is why it doesn't appear in the materialized view!`)

      // Fix it
      await prisma.product.update({
        where: { id: product.id },
        data: { isActive: true }
      })

      console.log(`\n✅ Fixed: Set is_active = true`)
      console.log(`Now refresh the materialized view...`)

      await prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`

      console.log(`✅ View refreshed! Sample UTP CABLE should now appear in reports.`)
    } else {
      console.log(`\n✅ Product is active. The problem is elsewhere.`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProductStatus()
