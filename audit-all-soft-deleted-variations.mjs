import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function auditSoftDeletedVariations() {
  try {
    console.log('🔍 COMPREHENSIVE AUDIT: Soft-Deleted Variations\n')
    console.log('=' .repeat(80))

    // 1. Get ALL variations (including soft-deleted)
    const allVariations = await prisma.productVariation.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            type: true,
            isActive: true,
            businessId: true,
            updatedAt: true
          }
        }
      },
      orderBy: [
        { deletedAt: 'desc' },
        { updatedAt: 'desc' }
      ]
    })

    const activeVariations = allVariations.filter(v => v.deletedAt === null)
    const deletedVariations = allVariations.filter(v => v.deletedAt !== null)

    console.log(`\n📊 OVERALL STATISTICS:`)
    console.log(`   Total Variations: ${allVariations.length}`)
    console.log(`   Active: ${activeVariations.length}`)
    console.log(`   Soft-Deleted: ${deletedVariations.length}`)
    console.log(`   Deletion Rate: ${((deletedVariations.length / allVariations.length) * 100).toFixed(2)}%`)

    if (deletedVariations.length === 0) {
      console.log('\n✅ Excellent! No soft-deleted variations found.')
      return
    }

    // 2. Analyze deletion patterns
    console.log(`\n\n🗑️  SOFT-DELETED VARIATIONS ANALYSIS:`)
    console.log('=' .repeat(80))

    // Group by deletion date
    const byDate = {}
    deletedVariations.forEach(v => {
      const dateKey = v.deletedAt.toLocaleDateString()
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(v)
    })

    console.log(`\n📅 Deletions by Date:`)
    Object.keys(byDate).sort().reverse().forEach(date => {
      console.log(`   ${date}: ${byDate[date].length} variation(s)`)
    })

    // Group by product type
    const byProductType = {}
    deletedVariations.forEach(v => {
      const type = v.product.type
      if (!byProductType[type]) byProductType[type] = []
      byProductType[type].push(v)
    })

    console.log(`\n📦 Deletions by Product Type:`)
    Object.keys(byProductType).forEach(type => {
      console.log(`   ${type}: ${byProductType[type].length} variation(s)`)
    })

    // Find products without ANY active variations
    console.log(`\n\n⚠️  CRITICAL: Products Without Active Variations:`)
    console.log('=' .repeat(80))

    const allProducts = await prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        variations: {
          where: { deletedAt: null }
        }
      }
    })

    const productsWithoutVariations = allProducts.filter(p => p.variations.length === 0)

    if (productsWithoutVariations.length === 0) {
      console.log('✅ All active products have active variations')
    } else {
      console.log(`❌ Found ${productsWithoutVariations.length} product(s) without active variations:\n`)

      for (const product of productsWithoutVariations) {
        // Check if it has soft-deleted variations
        const deletedVars = await prisma.productVariation.findMany({
          where: {
            productId: product.id,
            deletedAt: { not: null }
          },
          orderBy: { deletedAt: 'desc' }
        })

        console.log(`   ${product.id}. ${product.name} (SKU: ${product.sku})`)
        console.log(`      Type: ${product.type} | Active: ${product.isActive}`)
        console.log(`      Last Updated: ${product.updatedAt.toLocaleString()}`)

        if (deletedVars.length > 0) {
          console.log(`      🗑️  Has ${deletedVars.length} soft-deleted variation(s):`)
          deletedVars.forEach((v, i) => {
            const timeSinceDelete = Math.floor((new Date() - v.deletedAt) / (1000 * 60 * 60)) // hours
            console.log(`         ${i + 1}. "${v.name}" - Deleted ${timeSinceDelete}h ago (${v.deletedAt.toLocaleString()})`)
          })
        } else {
          console.log(`      ❌ No variations at all (never created)`)
        }
        console.log('')
      }
    }

    // 3. Timeline Analysis
    console.log(`\n📈 DELETION TIMELINE (Last 10):`)
    console.log('=' .repeat(80))

    const recentDeletions = deletedVariations.slice(0, 10)
    recentDeletions.forEach((v, i) => {
      const hoursAgo = Math.floor((new Date() - v.deletedAt) / (1000 * 60 * 60))
      console.log(`${i + 1}. ${v.deletedAt.toLocaleString()} (${hoursAgo}h ago)`)
      console.log(`   Product: ${v.product.name} (ID: ${v.product.id})`)
      console.log(`   Variation: ${v.name} (SKU: ${v.sku})`)
      console.log(`   Product Last Updated: ${v.product.updatedAt.toLocaleString()}`)
      console.log('')
    })

    // 4. Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`)
    console.log('=' .repeat(80))

    if (productsWithoutVariations.length > 0) {
      console.log(`\n⚠️  Action Required: ${productsWithoutVariations.length} product(s) need attention`)
      console.log(`\n   Option 1 - Restore All Soft-Deleted Variations:`)
      console.log(`   └─ Run: node restore-all-soft-deleted-variations.mjs`)
      console.log(`\n   Option 2 - Create Missing Variations:`)
      console.log(`   └─ Run: node create-missing-default-variations.mjs`)
      console.log(`\n   Option 3 - Mark Products as Inactive:`)
      console.log(`   └─ If these products are no longer used`)
    }

    // 5. Potential Causes
    console.log(`\n\n🔍 POTENTIAL CAUSES OF SOFT-DELETION:`)
    console.log('=' .repeat(80))
    console.log(`\n1. Product Edit Form Bug:`)
    console.log(`   └─ Frontend might be sending empty variations array`)
    console.log(`   └─ Check: src/app/dashboard/products/[id]/edit/page.tsx`)
    console.log(`\n2. Product Type Change:`)
    console.log(`   └─ Changing product type soft-deletes all variations`)
    console.log(`   └─ Now prevented by validation (line 228 in route.ts)`)
    console.log(`\n3. Bulk Edit Operation:`)
    console.log(`   └─ Bulk edit might not preserve variations`)
    console.log(`\n4. API Client Bug:`)
    console.log(`   └─ External API calls might send incomplete data`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

auditSoftDeletedVariations()
