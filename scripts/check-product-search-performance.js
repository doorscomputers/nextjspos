/**
 * Check Product Search Performance Impact from Inactive Locations
 *
 * This script:
 * 1. Analyzes how many records exist in inactive locations
 * 2. Measures the performance impact on product searches
 * 3. Provides recommendations for optimization
 *
 * Usage:
 *   node scripts/check-product-search-performance.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function analyzeProductSearchPerformance() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 PRODUCT SEARCH PERFORMANCE ANALYSIS')
  console.log('='.repeat(80))
  console.log('')

  try {
    // 1. Get location statistics
    const activeLocations = await prisma.businessLocation.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true }
    })

    const inactiveLocations = await prisma.businessLocation.findMany({
      where: { isActive: false, deletedAt: null },
      select: { id: true, name: true }
    })

    const allLocations = await prisma.businessLocation.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, isActive: true }
    })

    console.log('📊 LOCATION SUMMARY:')
    console.log('─'.repeat(80))
    console.log(`Active Locations: ${activeLocations.length}`)
    console.log(`Inactive Locations: ${inactiveLocations.length}`)
    console.log(`Total Locations: ${allLocations.length}`)
    console.log('')

    // 2. Count inventory records
    const activeLocationIds = activeLocations.map(l => l.id)
    const inactiveLocationIds = inactiveLocations.map(l => l.id)

    const startTime = Date.now()

    const [
      totalInventoryRecords,
      activeInventoryRecords,
      inactiveInventoryRecords,
      totalProducts,
      totalVariations
    ] = await Promise.all([
      prisma.variationLocationDetails.count(),
      activeLocationIds.length > 0
        ? prisma.variationLocationDetails.count({ where: { locationId: { in: activeLocationIds } } })
        : Promise.resolve(0),
      inactiveLocationIds.length > 0
        ? prisma.variationLocationDetails.count({ where: { locationId: { in: inactiveLocationIds } } })
        : Promise.resolve(0),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.productVariation.count()
    ])

    console.log('📦 INVENTORY RECORDS (VariationLocationDetails):')
    console.log('─'.repeat(80))
    console.log(`Total Records: ${totalInventoryRecords.toLocaleString()}`)
    console.log(`Active Locations: ${activeInventoryRecords.toLocaleString()} (${((activeInventoryRecords/totalInventoryRecords)*100).toFixed(1)}%)`)
    console.log(`Inactive Locations: ${inactiveInventoryRecords.toLocaleString()} (${((inactiveInventoryRecords/totalInventoryRecords)*100).toFixed(1)}%)`)
    console.log('')

    if (inactiveInventoryRecords > 0) {
      const wastedPercentage = ((inactiveInventoryRecords / totalInventoryRecords) * 100).toFixed(1)
      console.log(`⚠️  PERFORMANCE IMPACT:`)
      console.log(`   ${wastedPercentage}% of inventory records are in INACTIVE locations!`)
      console.log(`   This means product searches are querying ${inactiveInventoryRecords.toLocaleString()} unnecessary records.`)
      console.log('')
    } else {
      console.log(`✅ OPTIMAL: No inventory records in inactive locations.`)
      console.log('')
    }

    // 3. Simulate product search queries
    console.log('⚡ SIMULATING PRODUCT SEARCH QUERIES:')
    console.log('─'.repeat(80))
    console.log('')

    // Test 1: Search WITHOUT location filter (current issue)
    console.log('Test 1: Product Search WITHOUT Location Filter (SLOW)')
    const test1Start = Date.now()
    const unfiltered = await prisma.variationLocationDetails.findMany({
      where: {
        product: {
          name: { contains: 'a', mode: 'insensitive' } // Common letter
        }
      },
      include: {
        product: { select: { name: true, sku: true } },
        productVariation: { select: { name: true } },
        location: { select: { name: true, isActive: true } }
      },
      take: 50
    })
    const test1Time = Date.now() - test1Start
    const test1Inactive = unfiltered.filter(v => !v.location.isActive).length
    console.log(`   ⏱️  Time: ${test1Time}ms`)
    console.log(`   📊 Results: ${unfiltered.length} records`)
    console.log(`   ❌ Inactive: ${test1Inactive} records (${((test1Inactive/unfiltered.length)*100).toFixed(1)}%)`)
    console.log('')

    // Test 2: Search WITH active location filter (optimized)
    console.log('Test 2: Product Search WITH Active Location Filter (FAST)')
    const test2Start = Date.now()
    const filtered = await prisma.variationLocationDetails.findMany({
      where: {
        locationId: { in: activeLocationIds },
        product: {
          name: { contains: 'a', mode: 'insensitive' }
        }
      },
      include: {
        product: { select: { name: true, sku: true } },
        productVariation: { select: { name: true } },
        location: { select: { name: true, isActive: true } }
      },
      take: 50
    })
    const test2Time = Date.now() - test2Start
    console.log(`   ⏱️  Time: ${test2Time}ms`)
    console.log(`   📊 Results: ${filtered.length} records`)
    console.log(`   ✅ All Active: 100%`)
    console.log('')

    // Test 3: Search with location.isActive filter (alternative)
    console.log('Test 3: Product Search WITH isActive Filter (ALTERNATIVE)')
    const test3Start = Date.now()
    const activeFiltered = await prisma.variationLocationDetails.findMany({
      where: {
        location: { isActive: true },
        product: {
          name: { contains: 'a', mode: 'insensitive' }
        }
      },
      include: {
        product: { select: { name: true, sku: true } },
        productVariation: { select: { name: true } },
        location: { select: { name: true, isActive: true } }
      },
      take: 50
    })
    const test3Time = Date.now() - test3Start
    console.log(`   ⏱️  Time: ${test3Time}ms`)
    console.log(`   📊 Results: ${activeFiltered.length} records`)
    console.log(`   ✅ All Active: 100%`)
    console.log('')

    // Performance comparison
    console.log('📈 PERFORMANCE COMPARISON:')
    console.log('─'.repeat(80))
    const improvement1 = ((test1Time - test2Time) / test1Time * 100).toFixed(1)
    const improvement2 = ((test1Time - test3Time) / test1Time * 100).toFixed(1)
    console.log(`Without Filter (Baseline):     ${test1Time}ms`)
    console.log(`With locationId IN filter:     ${test2Time}ms  (${improvement1}% faster) ⚡`)
    console.log(`With isActive filter:          ${test3Time}ms  (${improvement2}% faster) ⚡`)
    console.log('')

    // 4. Check which queries need fixing
    console.log('🔧 QUERIES THAT NEED OPTIMIZATION:')
    console.log('─'.repeat(80))
    console.log('')
    console.log('These endpoints likely search across ALL locations:')
    console.log('   1. /api/products (Product list/search)')
    console.log('   2. /api/products/search (Product search autocomplete)')
    console.log('   3. /api/inventory/* (Inventory queries)')
    console.log('   4. /api/dashboard/* (Dashboard queries)')
    console.log('   5. /api/sales/create (When selecting products)')
    console.log('')

    // 5. Recommendations
    console.log('💡 OPTIMIZATION RECOMMENDATIONS:')
    console.log('─'.repeat(80))
    console.log('')

    if (inactiveInventoryRecords > 0) {
      console.log('🚨 HIGH PRIORITY (Immediate Action):')
      console.log('')
      console.log('   1. Add Location Filter to Product Search:')
      console.log('      WHERE locationId IN (activeLocationIds)')
      console.log('      OR location.isActive = true')
      console.log('')
      console.log('   2. Update Product Search API:')
      console.log('      File: src/app/api/products/route.ts')
      console.log('      Add: where: { locationId: { in: activeLocationIds } }')
      console.log('')
      console.log('   3. Update Dashboard Queries:')
      console.log('      Add isActive check to all location-based queries')
      console.log('')
      console.log('📊 EXPECTED IMPROVEMENT:')
      console.log(`   - Product search: ${improvement1}% faster`)
      console.log(`   - Dashboard queries: 20-40% faster`)
      console.log(`   - Reduced database load: ${wastedPercentage}% less records scanned`)
      console.log('')
    } else {
      console.log('✅ No optimization needed - no inactive location data found.')
      console.log('')
    }

    console.log('🆕 FOR FUTURE NEW LOCATIONS:')
    console.log('─'.repeat(80))
    console.log('')
    console.log('Option A: "Lazy Inventory Creation" (RECOMMENDED)')
    console.log('   - Don\'t create VariationLocationDetails until needed')
    console.log('   - Only create records when:')
    console.log('     * Stock transfer TO the location')
    console.log('     * Opening stock set for the location')
    console.log('     * Purchase order received at the location')
    console.log('   - Benefits:')
    console.log('     ✓ No bloat in database')
    console.log('     ✓ Faster queries')
    console.log('     ✓ Cleaner data')
    console.log('')
    console.log('Option B: "Pre-populate with Zero Stock"')
    console.log('   - Create all VariationLocationDetails with qty = 0')
    console.log('   - Benefits:')
    console.log('     ✓ Easier to see "all products" at new location')
    console.log('     ✓ Can filter/search products at that location')
    console.log('   - Drawbacks:')
    console.log('     ✗ More database records')
    console.log('     ✗ Slower queries if location becomes inactive')
    console.log('')
    console.log('💡 BEST PRACTICE:')
    console.log('   Use Option A (Lazy Creation) + Product Search by Active Locations Only')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  }

  console.log('='.repeat(80))
  console.log('Analysis Complete!')
  console.log('='.repeat(80))
  console.log('')
}

// Run the analysis
analyzeProductSearchPerformance()
  .finally(async () => {
    await prisma.$disconnect()
  })
