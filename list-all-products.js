// List all products to see what's in the database
const { PrismaClient } = require('@prisma/client')

async function listProducts() {
  const prisma = new PrismaClient({
    log: ['error']
  })

  try {
    console.log('🔍 Listing all products...\n')

    const products = await prisma.$queryRaw`
      SELECT id, name, sku, is_active, deleted_at
      FROM products
      ORDER BY name
      LIMIT 20
    `

    console.log(`Found ${products.length} products (showing first 20):\n`)

    products.forEach((p, index) => {
      const active = p.is_active ? '✅' : '❌'
      const deleted = p.deleted_at ? ' (DELETED)' : ''
      console.log(`${index + 1}. ${active} ${p.name} (SKU: ${p.sku})${deleted}`)
    })

    console.log('\n🔍 Searching for products containing "Sample"...\n')

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

      const activeVars = variations.filter(v => v.deleted_at === null).length
      console.log(`   - Active Variations: ${activeVars} / ${variations.length}`)

      if (activeVars === 0 && variations.length > 0) {
        console.log('   ⚠️  ALL VARIATIONS ARE DELETED!')
      }
      console.log('')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

listProducts()
