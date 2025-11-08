import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProduct() {
  try {
    console.log('\n=== CHECKING "Another Sample 1" ===\n')
    
    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'Another Sample 1',
          mode: 'insensitive'
        }
      },
      include: {
        variations: {
          include: {
            variationLocationDetails: true
          }
        }
      }
    })
    
    if (!product) {
      console.log('❌ Product "Another Sample 1" NOT FOUND in database')
      console.log('\nSearching for similar names...')
      const similar = await prisma.product.findMany({
        where: {
          name: {
            contains: 'Sample',
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          deletedAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
      console.log('Recent products with "Sample" in name:')
      console.table(similar)
      return
    }
    
    console.log('✅ Product Found!')
    console.log(`Product ID: ${product.id}`)
    console.log(`Name: ${product.name}`)
    console.log(`SKU: ${product.sku}`)
    console.log(`Is Active: ${product.isActive}`)
    console.log(`Deleted At: ${product.deletedAt}`)
    console.log(`Business ID: ${product.businessId}`)
    console.log(`Enable Stock: ${product.enableStock}`)
    
    console.log('\n--- Variations ---')
    for (const variation of product.variations) {
      console.log(`\nVariation ID: ${variation.id}`)
      console.log(`  Name: ${variation.name}`)
      console.log(`  SKU: ${variation.sku}`)
      console.log(`  Deleted At: ${variation.deletedAt}`)
      
      console.log(`  Stock at locations:`)
      for (const stock of variation.variationLocationDetails) {
        console.log(`    Location ${stock.locationId}: ${stock.qtyAvailable} units`)
      }
    }
    
    // Check in materialized view
    console.log('\n--- Materialized View Check ---')
    const viewData = await prisma.$queryRaw`
      SELECT 
        product_id,
        product_name,
        variation_id,
        variation_name,
        total_stock,
        loc_1_qty,
        loc_2_qty,
        loc_3_qty
      FROM stock_pivot_view
      WHERE product_id = ${product.id}
    `
    
    if (viewData.length === 0) {
      console.log('❌ NOT FOUND in stock_pivot_view materialized view!')
      console.log('\n🔧 Possible Issues:')
      console.log('1. Product is_active =', product.isActive, '(should be true)')
      console.log('2. Product deleted_at =', product.deletedAt, '(should be null)')
      console.log('3. Variation deleted_at =', product.variations[0]?.deletedAt, '(should be null)')
      console.log('\n💡 Running refresh_stock_pivot_view()...')
      
      await prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`
      
      const viewDataAfter = await prisma.$queryRaw`
        SELECT 
          product_id,
          product_name,
          variation_id,
          variation_name,
          total_stock
        FROM stock_pivot_view
        WHERE product_id = ${product.id}
      `
      
      if (viewDataAfter.length > 0) {
        console.log('✅ Product NOW appears in view after refresh!')
        console.table(viewDataAfter)
      } else {
        console.log('❌ Still NOT in view after refresh - check is_active and deleted_at')
      }
    } else {
      console.log('✅ FOUND in stock_pivot_view!')
      console.table(viewData)
    }
    
    // Check product history
    console.log('\n--- Product History ---')
    const history = await prisma.productHistory.findMany({
      where: {
        productId: product.id
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
    
    console.log(`Found ${history.length} history entries:`)
    console.table(history.map(h => ({
      id: h.id,
      type: h.transactionType,
      qty: h.quantityChange.toString(),
      balance: h.balanceQuantity.toString(),
      location: h.locationId,
      date: h.transactionDate
    })))
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProduct()
