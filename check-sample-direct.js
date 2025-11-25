// Direct SQL query to check Sample products
const mysql = require('mysql2/promise')
require('dotenv').config()

async function checkSampleProducts() {
  let connection

  try {
    // Parse DATABASE_URL
    const dbUrl = process.env.DATABASE_URL
    const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)

    if (!match) {
      console.error('❌ Could not parse DATABASE_URL')
      return
    }

    const [, user, password, host, port, database] = match

    connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password,
      database
    })

    console.log('🔍 Checking Sample products and their variations...\n')

    // Get all Sample products
    const [products] = await connection.execute(
      `SELECT id, name, sku, is_active
       FROM products
       WHERE name LIKE '%Sample Item%'
       AND deleted_at IS NULL
       ORDER BY name`
    )

    console.log(`Found ${products.length} Sample products:\n`)

    for (const product of products) {
      console.log(`📦 ${product.name} (SKU: ${product.sku})`)
      console.log(`   - ID: ${product.id}`)
      console.log(`   - Active: ${product.is_active ? '✅ YES' : '❌ NO'}`)

      // Get variations for this product
      const [variations] = await connection.execute(
        `SELECT id, name, sku, deleted_at
         FROM product_variations
         WHERE product_id = ?
         ORDER BY name`,
        [product.id]
      )

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

    // Summary: Which products would appear in purchase search
    console.log('\n📊 SUMMARY - Products visible in Purchase Search:\n')

    const [visibleProducts] = await connection.execute(
      `SELECT p.name, COUNT(pv.id) as active_variations
       FROM products p
       LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
       WHERE p.name LIKE '%Sample Item%'
       AND p.deleted_at IS NULL
       AND p.is_active = 1
       GROUP BY p.id, p.name
       ORDER BY p.name`
    )

    visibleProducts.forEach(p => {
      if (p.active_variations > 0) {
        console.log(`✅ ${p.name} - ${p.active_variations} active variation(s)`)
      } else {
        console.log(`❌ ${p.name} - NO active variations (won't appear in search)`)
      }
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

checkSampleProducts()
