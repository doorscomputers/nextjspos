import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyzeDeletedVariations() {
  try {
    console.log('🔍 Analyzing all soft-deleted variations...\n')

    // Get all soft-deleted variations
    const deletedVariations = await prisma.productVariation.findMany({
      where: { deletedAt: { not: null } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            type: true,
            businessId: true
          }
        }
      },
      orderBy: { deletedAt: 'desc' }
    })

    console.log(`📊 Total soft-deleted variations: ${deletedVariations.length}\n`)

    if (deletedVariations.length === 0) {
      console.log('✅ No soft-deleted variations found!')
      return
    }

    // Group by deletion date
    const deletionGroups = {}
    deletedVariations.forEach(v => {
      const dateKey = v.deletedAt.toLocaleDateString()
      if (!deletionGroups[dateKey]) {
        deletionGroups[dateKey] = []
      }
      deletionGroups[dateKey].push(v)
    })

    console.log('📅 Deletions by Date:\n')
    Object.keys(deletionGroups).forEach(date => {
      console.log(`${date}: ${deletionGroups[date].length} variation(s)`)
    })

    console.log('\n📋 Detailed List of Soft-Deleted Variations:\n')
    deletedVariations.forEach((v, i) => {
      console.log(`${i + 1}. Product: ${v.product.name} (ID: ${v.product.id})`)
      console.log(`   Product SKU: ${v.product.sku}`)
      console.log(`   Variation: ${v.name} (SKU: ${v.sku})`)
      console.log(`   Deleted At: ${v.deletedAt.toLocaleString()}`)
      console.log(`   Business ID: ${v.businessId}`)
      console.log('')
    })

    // Check if these products have other active variations
    console.log('⚠️  Checking if parent products have other active variations...\n')

    const productIds = [...new Set(deletedVariations.map(v => v.product.id))]

    for (const productId of productIds) {
      const activeVariations = await prisma.productVariation.findMany({
        where: {
          productId: productId,
          deletedAt: null
        }
      })

      const product = deletedVariations.find(v => v.product.id === productId).product

      if (activeVariations.length === 0) {
        console.log(`❌ Product "${product.name}" (ID: ${productId}) has NO active variations!`)
      } else {
        console.log(`✅ Product "${product.name}" (ID: ${productId}) has ${activeVariations.length} active variation(s)`)
      }
    }

    // Check for patterns (same time, same business, etc.)
    console.log('\n\n🔎 Pattern Analysis:\n')

    // Same deletion time (within 1 minute)
    const timeGroups = {}
    deletedVariations.forEach(v => {
      const timeKey = v.deletedAt.toISOString().slice(0, 16) // Group by minute
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = []
      }
      timeGroups[timeKey].push(v)
    })

    const bulkDeletions = Object.values(timeGroups).filter(group => group.length > 1)
    if (bulkDeletions.length > 0) {
      console.log('⚠️  Possible BULK DELETION detected:')
      bulkDeletions.forEach(group => {
        console.log(`   ${group[0].deletedAt.toLocaleString()}: ${group.length} variations deleted`)
      })
    } else {
      console.log('ℹ️  No bulk deletion patterns detected')
    }

    // Same business
    const businessGroups = {}
    deletedVariations.forEach(v => {
      if (!businessGroups[v.businessId]) {
        businessGroups[v.businessId] = []
      }
      businessGroups[v.businessId].push(v)
    })

    console.log('\n📊 Deletions by Business:')
    Object.keys(businessGroups).forEach(businessId => {
      console.log(`   Business ID ${businessId}: ${businessGroups[businessId].length} variation(s)`)
    })

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeDeletedVariations()
