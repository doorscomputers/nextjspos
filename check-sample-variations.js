const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSampleProducts() {
  try {
    console.log('🔍 Checking Sample products and their variations...\n')

    const products = await prisma.product.findMany({
      where: {
        name: {
          contains: 'Sample Item',
          mode: 'insensitive'
        }
      },
      include: {
        variations: true // Include ALL variations (even deleted)
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log(`Found ${products.length} Sample products:\n`)

    products.forEach(product => {
      console.log(`📦 ${product.name} (SKU: ${product.sku})`)
      console.log(`   - ID: ${product.id}`)
      console.log(`   - Active: ${product.isActive}`)
      console.log(`   - Total Variations: ${product.variations.length}`)

      if (product.variations.length === 0) {
        console.log('   ⚠️  NO VARIATIONS FOUND!')
      } else {
        product.variations.forEach(variation => {
          console.log(`   - Variation: ${variation.name} (SKU: ${variation.sku})`)
          console.log(`     - ID: ${variation.id}`)
          console.log(`     - Deleted: ${variation.deletedAt ? '❌ YES (deletedAt: ' + variation.deletedAt + ')' : '✅ NO'}`)
        })
      }
      console.log('')
    })

    // Check with API filter (deletedAt: null)
    console.log('\n📊 Checking with API filter (deletedAt: null)...\n')

    const productsWithActiveVariations = await prisma.product.findMany({
      where: {
        name: {
          contains: 'Sample Item',
          mode: 'insensitive'
        },
        isActive: true
      },
      include: {
        variations: {
          where: { deletedAt: null }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    const filtered = productsWithActiveVariations.filter(p => p.variations && p.variations.length > 0)

    console.log(`Products that would appear in purchase search: ${filtered.length}`)
    filtered.forEach(p => {
      console.log(`  ✅ ${p.name} - ${p.variations.length} active variation(s)`)
    })

    const missing = productsWithActiveVariations.filter(p => !p.variations || p.variations.length === 0)
    if (missing.length > 0) {
      console.log(`\nProducts MISSING from purchase search: ${missing.length}`)
      missing.forEach(p => {
        console.log(`  ❌ ${p.name} - No active variations`)
      })
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSampleProducts()
