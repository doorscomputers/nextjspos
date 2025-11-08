import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyInView() {
  try {
    console.log('\n=== VERIFYING SAMPLE UTP CABLE IN MATERIALIZED VIEW ===\n')

    // Query the materialized view directly
    const result = await prisma.$queryRaw`
      SELECT
        product_name,
        variation_name,
        product_sku,
        variation_sku,
        total_stock,
        loc_1_qty,
        loc_2_qty,
        loc_3_qty,
        loc_4_qty
      FROM stock_pivot_view
      WHERE product_name ILIKE '%UTP CABLE%'
    `

    console.log('Results from stock_pivot_view:')
    console.log(JSON.stringify(result, null, 2))

    if (result.length === 0) {
      console.log('\n❌ Sample UTP CABLE NOT FOUND in materialized view!')
      console.log('The view needs to be refreshed again.')
    } else {
      console.log(`\n✅ Found ${result.length} matching product(s) in view`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyInView()
