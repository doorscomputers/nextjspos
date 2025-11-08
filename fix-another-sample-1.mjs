import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixProduct() {
  try {
    console.log('\n=== FIXING "Another Sample 1" VARIATION ===\n')
    
    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'Another Sample 1',
          mode: 'insensitive'
        }
      },
      include: {
        variations: true
      }
    })
    
    if (!product) {
      console.log('❌ Product not found')
      return
    }
    
    console.log(`Found product ID: ${product.id}`)
    console.log(`Variations to fix: ${product.variations.length}`)
    
    // Restore all variations
    for (const variation of product.variations) {
      if (variation.deletedAt) {
        console.log(`\n🔧 Restoring variation ${variation.id} (${variation.name})...`)
        await prisma.productVariation.update({
          where: { id: variation.id },
          data: { deletedAt: null }
        })
        console.log('✅ Variation restored!')
      } else {
        console.log(`\n✓ Variation ${variation.id} (${variation.name}) already active`)
      }
    }
    
    // Refresh materialized view
    console.log('\n📊 Refreshing stock_pivot_view...')
    const result = await prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`
    console.log('✅ View refreshed!')
    console.log('Rows affected:', result[0].rows_affected.toString())
    
    // Verify it's now in the view
    console.log('\n🔍 Verifying product is now in materialized view...')
    const viewData = await prisma.$queryRaw`
      SELECT 
        product_id,
        product_name,
        variation_name,
        total_stock,
        loc_1_qty
      FROM stock_pivot_view
      WHERE product_id = ${product.id}
    `
    
    if (viewData.length > 0) {
      console.log('\n🎉 SUCCESS! Product now appears in inventory reports!')
      console.table(viewData)
    } else {
      console.log('\n❌ Still not appearing - please check manually')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixProduct()
