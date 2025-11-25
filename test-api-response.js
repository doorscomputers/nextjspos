// Simulate what the API returns for Sample products
const { PrismaClient } = require('@prisma/client')

async function testAPIResponse() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
      }
    },
    log: ['error']
  })

  try {
    console.log('🔍 Simulating API response for Sample products...\n')

    // This mimics the API query with forTransaction=true
    const products = await prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.is_active,
        p.business_id,
        json_agg(
          json_build_object(
            'id', pv.id,
            'name', pv.name,
            'sku', pv.sku,
            'deletedAt', pv.deleted_at
          ) ORDER BY pv.name
        ) FILTER (WHERE pv.id IS NOT NULL AND pv.deleted_at IS NULL) as variations
      FROM products p
      LEFT JOIN product_variations pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
      WHERE p.name ILIKE '%Sample Item%'
      AND p.deleted_at IS NULL
      AND p.is_active = true
      GROUP BY p.id, p.name, p.sku, p.is_active, p.business_id
      ORDER BY p.name
    `

    console.log(`API would return ${products.length} products:\n`)

    products.forEach(product => {
      const variations = product.variations || []
      const variationCount = Array.isArray(variations) ? variations.length : 0

      console.log(`📦 ${product.name} (SKU: ${product.sku})`)
      console.log(`   - ID: ${product.id}`)
      console.log(`   - Business ID: ${product.business_id}`)
      console.log(`   - Variations: ${variationCount}`)

      if (variationCount === 0) {
        console.log(`   ⚠️  NO VARIATIONS - WILL BE FILTERED OUT!`)
      } else {
        console.log(`   ✅ Would appear in purchase search`)
        if (Array.isArray(variations)) {
          variations.forEach(v => {
            console.log(`     • ${v.name} (SKU: ${v.sku})`)
          })
        }
      }
      console.log('')
    })

    // Apply the same filter as the client-side code
    const filteredProducts = products.filter(p => p.variations && p.variations.length > 0)

    console.log('\n📊 AFTER CLIENT-SIDE FILTER (.filter(p => p.variations && p.variations.length > 0)):\n')
    console.log(`✅ Would appear: ${filteredProducts.length} products`)
    console.log(`❌ Would be filtered out: ${products.length - filteredProducts.length} products\n`)

    filteredProducts.forEach(p => {
      console.log(`  ✅ ${p.name}`)
    })

    const filtered = products.filter(p => !p.variations || p.variations.length === 0)
    if (filtered.length > 0) {
      console.log('\nFiltered out:')
      filtered.forEach(p => {
        console.log(`  ❌ ${p.name} - No variations`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

testAPIResponse()
