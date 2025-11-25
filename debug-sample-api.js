// Debug: Check what the ACTUAL API returns for Sample products
const { PrismaClient } = require('@prisma/client')

async function debugSampleProducts() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
      }
    },
    log: ['error']
  })

  try {
    console.log('🔍 Replicating EXACT API query from /api/products?forTransaction=true...\n')

    // This is the EXACT Prisma query from the API
    const products = await prisma.product.findMany({
      where: {
        businessId: 1,
        deletedAt: null,
        isActive: true
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        tax: true,
        variations: {
          where: { deletedAt: null },
          include: {
            variationLocationDetails: true
          }
        },
        unitPrices: {
          select: {
            unitId: true,
            purchasePrice: true,
            sellingPrice: true,
            unit: {
              select: {
                id: true,
                name: true,
                shortName: true,
                allowDecimal: true,
                baseUnitId: true,
                baseUnitMultiplier: true,
              }
            }
          }
        },
        unitLocationPrices: {
          select: {
            locationId: true,
            unitId: true,
            purchasePrice: true,
            sellingPrice: true,
            unit: {
              select: {
                id: true,
                name: true,
                shortName: true,
                allowDecimal: true,
                baseUnitId: true,
                baseUnitMultiplier: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10000
    })

    console.log(`📦 Total products returned: ${products.length}\n`)

    // Filter for Sample products
    const sampleProducts = products.filter(p => p.name?.toLowerCase().includes('sample'))

    console.log(`🔍 Products containing "sample": ${sampleProducts.length}\n`)

    sampleProducts.forEach(product => {
      console.log(`📦 ${product.name} (SKU: ${product.sku})`)
      console.log(`   - ID: ${product.id}`)
      console.log(`   - Name (raw): "${product.name}"`)
      console.log(`   - Name (lowercase): "${product.name?.toLowerCase()}"`)
      console.log(`   - Contains "sample": ${product.name?.toLowerCase().includes('sample')}`)
      console.log(`   - Variations: ${product.variations?.length || 0}`)

      if (product.variations && product.variations.length > 0) {
        console.log(`   ✅ HAS VARIATIONS - Would pass filter`)
        product.variations.forEach(v => {
          console.log(`     • ${v.name} (SKU: ${v.sku})`)
        })
      } else {
        console.log(`   ❌ NO VARIATIONS - Would be filtered out!`)
      }
      console.log('')
    })

    // Apply the same filter as page.tsx line 183
    const filteredProducts = sampleProducts.filter(p => p.variations && p.variations.length > 0)
    console.log(`\n📊 After .filter(p => p.variations && p.variations.length > 0):`)
    console.log(`   ${filteredProducts.length} / ${sampleProducts.length} Sample products would be loaded\n`)

    // Simulate client-side search
    const searchTerm = 'sample'
    console.log(`🔍 Simulating client-side search for "${searchTerm}"...\n`)

    const matches = filteredProducts.filter((p) => {
      const trimmed = searchTerm.toLowerCase()

      // Exact SKU match
      if (p.sku?.toLowerCase() === trimmed) return true
      if (p.variations?.some((v) => v.sku?.toLowerCase() === trimmed)) return true

      // Partial SKU match
      if (p.sku?.toLowerCase().includes(trimmed)) return true
      if (p.variations?.some((v) => v.sku?.toLowerCase().includes(trimmed))) return true

      // Product name match
      if (p.name?.toLowerCase().includes(trimmed)) return true

      // Variation name match
      if (p.variations?.some((v) => v.name?.toLowerCase().includes(trimmed))) return true

      return false
    })

    console.log(`✅ Search matches: ${matches.length} products\n`)
    matches.forEach(p => console.log(`  ✅ ${p.name}`))

    const notMatched = filteredProducts.filter(p => !matches.includes(p))
    if (notMatched.length > 0) {
      console.log(`\n❌ Not matched (${notMatched.length}):`)
      notMatched.forEach(p => {
        console.log(`  ❌ ${p.name} (SKU: ${p.sku})`)
        console.log(`     - Name contains "sample": ${p.name?.toLowerCase().includes('sample')}`)
        console.log(`     - Variations: ${p.variations?.length}`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

debugSampleProducts()
