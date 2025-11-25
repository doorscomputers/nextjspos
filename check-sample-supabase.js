// Check Sample products on Supabase (production database)
const { PrismaClient } = require('@prisma/client')

async function checkSampleProducts() {
  // Use Supabase database URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
      }
    },
    log: ['error']
  })

  try {
    console.log('🔍 Checking Sample products on Supabase (production)...\n')

    const sampleProducts = await prisma.$queryRaw`
      SELECT id, name, sku, is_active
      FROM products
      WHERE name ILIKE '%Sample%'
      AND deleted_at IS NULL
      ORDER BY name
    `

    console.log(`Found ${sampleProducts.length} products with "Sample" in name:\n`)

    for (const product of sampleProducts) {
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

      const activeVars = variations.filter(v => v.deleted_at === null)
      const deletedVars = variations.filter(v => v.deleted_at !== null)

      console.log(`   - Total Variations: ${variations.length}`)
      console.log(`   - Active Variations: ${activeVars.length}`)
      console.log(`   - Deleted Variations: ${deletedVars.length}`)

      if (activeVars.length === 0 && variations.length > 0) {
        console.log('   ⚠️  ALL VARIATIONS ARE DELETED!')
      } else if (activeVars.length > 0) {
        activeVars.forEach(v => {
          console.log(`     ✅ ${v.name} (SKU: ${v.sku})`)
        })
      }

      if (deletedVars.length > 0) {
        console.log('   ❌ Deleted variations:')
        deletedVars.forEach(v => {
          console.log(`     • ${v.name} (SKU: ${v.sku}) - Deleted at: ${v.deleted_at}`)
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
      WHERE p.name ILIKE '%Sample%'
      AND p.deleted_at IS NULL
      AND p.is_active = true
      GROUP BY p.id, p.name
      ORDER BY p.name
    `

    summary.forEach(p => {
      const count = Number(p.active_variations)
      if (count > 0) {
        console.log(`✅ ${p.name} - ${count} active variation(s) - WILL APPEAR`)
      } else {
        console.log(`❌ ${p.name} - NO active variations - WON'T APPEAR`)
      }
    })

    console.log(`\n📊 Expected in search: ${summary.filter(p => Number(p.active_variations) > 0).length} products`)
    console.log(`📊 Missing from search: ${summary.filter(p => Number(p.active_variations) === 0).length} products`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSampleProducts()
