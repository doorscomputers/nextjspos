// Simple check using project's prisma instance
const { PrismaClient } = require('@prisma/client')

async function checkSampleProducts() {
  const prisma = new PrismaClient({
    log: ['error']
  })

  try {
    console.log('🔍 Checking Sample products...\n')

    // Raw SQL query to avoid Prisma schema issues
    const products = await prisma.$queryRaw`
      SELECT id, name, sku, is_active
      FROM products
      WHERE name LIKE '%Sample Item%'
      AND deleted_at IS NULL
      ORDER BY name
    `

    console.log(`Found ${products.length} Sample products:\n`)

    for (const product of products) {
      console.log(`📦 ${product.name} (SKU: ${product.sku})`)
      console.log(`   - ID: ${product.id}`)
      console.log(`   - Active: ${product.is_active ? '✅ YES' : '❌ NO'}`)

      // Get variations
      const variations = await prisma.$queryRaw`
        SELECT id, name, sku, deleted_at
        FROM product_variations
        WHERE product_id = ${product.id}
        ORDER BY name
      `

      console.log(`   - Total Variations: ${variations.length}`)

      if (variations.length === 0) {
        console.log('   ⚠️  NO VARIATIONS FOUND!')
      } else {
        const activeVariations = variations.filter(v => v.deleted_at === null)
        const deletedVariations = variations.filter(v => v.deleted_at !== null)

        console.log(`   - Active Variations: ${activeVariations.length}`)
        console.log(`   - Deleted Variations: ${deletedVariations.length}`)

        variations.forEach(variation => {
          const status = variation.deleted_at ? `❌ DELETED (${variation.deleted_at})` : '✅ ACTIVE'
          console.log(`     • ${variation.name} (SKU: ${variation.sku}) - ${status}`)
        })
      }
      console.log('')
    }

    // Summary
    console.log('\n📊 SUMMARY - Products visible in Purchase Search:\n')

    const summary = await prisma.$queryRaw`
      SELECT p.name, COUNT(pv.id) as active_variations
      FROM products p
      LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
      WHERE p.name LIKE '%Sample Item%'
      AND p.deleted_at IS NULL
      AND p.is_active = true
      GROUP BY p.id, p.name
      ORDER BY p.name
    `

    summary.forEach(p => {
      const count = Number(p.active_variations)
      if (count > 0) {
        console.log(`✅ ${p.name} - ${count} active variation(s)`)
      } else {
        console.log(`❌ ${p.name} - NO active variations (won't appear in search)`)
      }
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSampleProducts()
