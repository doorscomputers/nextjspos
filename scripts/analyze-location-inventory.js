/**
 * Analyze Location and Inventory Distribution
 *
 * This script examines:
 * 1. Active vs Inactive locations
 * 2. Which locations have product variations/inventory
 * 3. Readiness for future location expansion
 *
 * Usage:
 *   node scripts/analyze-location-inventory.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function analyzeLocations() {
  console.log('\n' + '='.repeat(80))
  console.log('📍 LOCATION & INVENTORY ANALYSIS')
  console.log('='.repeat(80))
  console.log('')

  try {
    // 1. Get all locations (active and inactive)
    const allLocations = await prisma.businessLocation.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        locationCode: true,
        isActive: true,
        businessId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    })

    console.log('📊 LOCATIONS SUMMARY:')
    console.log('─'.repeat(80))
    console.log(`Total Locations: ${allLocations.length}`)
    console.log(`Active: ${allLocations.filter(l => l.isActive).length}`)
    console.log(`Inactive: ${allLocations.filter(l => !l.isActive).length}`)
    console.log('')

    // 2. Check inventory for each location
    console.log('📦 INVENTORY DISTRIBUTION BY LOCATION:')
    console.log('─'.repeat(80))
    console.log('')

    const locationInventory = []

    for (const location of allLocations) {
      // Count variation location details (inventory records)
      const inventoryCount = await prisma.variationLocationDetails.count({
        where: { locationId: location.id }
      })

      // Count products with stock
      const productsWithStock = await prisma.variationLocationDetails.count({
        where: {
          locationId: location.id,
          qtyAvailable: { gt: 0 }
        }
      })

      // Count total quantity
      const totalQtyResult = await prisma.variationLocationDetails.aggregate({
        where: { locationId: location.id },
        _sum: { qtyAvailable: true }
      })

      // Get sales count for this location
      const salesCount = await prisma.sale.count({
        where: {
          locationId: location.id,
          status: { notIn: ['voided', 'cancelled'] }
        }
      })

      // Get recent sales
      const recentSale = await prisma.sale.findFirst({
        where: {
          locationId: location.id,
          status: { notIn: ['voided', 'cancelled'] }
        },
        orderBy: { saleDate: 'desc' },
        select: { saleDate: true }
      })

      // Get stock transfers FROM this location
      const transfersFrom = await prisma.stockTransfer.count({
        where: { fromLocationId: location.id }
      })

      // Get stock transfers TO this location
      const transfersTo = await prisma.stockTransfer.count({
        where: { toLocationId: location.id }
      })

      const locationData = {
        id: location.id,
        name: location.name,
        code: location.locationCode,
        isActive: location.isActive,
        inventoryRecords: inventoryCount,
        productsWithStock: productsWithStock,
        totalQty: parseFloat(totalQtyResult._sum.qtyAvailable?.toString() || '0'),
        salesCount: salesCount,
        lastSaleDate: recentSale?.saleDate,
        transfersFrom: transfersFrom,
        transfersTo: transfersTo,
        hasActivity: inventoryCount > 0 || salesCount > 0 || transfersFrom > 0 || transfersTo > 0
      }

      locationInventory.push(locationData)

      // Display
      const statusIcon = location.isActive ? '✅' : '❌'
      const activityIcon = locationData.hasActivity ? '📊' : '⚪'

      console.log(`${statusIcon} ${activityIcon} ${location.name} (${location.locationCode})`)
      console.log(`   Status: ${location.isActive ? 'ACTIVE' : 'INACTIVE'}`)
      console.log(`   Inventory Records: ${inventoryCount.toLocaleString()}`)
      console.log(`   Products with Stock: ${productsWithStock.toLocaleString()}`)
      console.log(`   Total Quantity: ${locationData.totalQty.toLocaleString()}`)
      console.log(`   Sales Transactions: ${salesCount.toLocaleString()}`)
      if (recentSale) {
        console.log(`   Last Sale: ${recentSale.saleDate.toISOString().split('T')[0]}`)
      }
      console.log(`   Transfers: ${transfersFrom} out, ${transfersTo} in`)
      console.log('')
    }

    // 3. Identify inactive locations with data
    console.log('⚠️  INACTIVE LOCATIONS WITH DATA:')
    console.log('─'.repeat(80))

    const inactiveWithData = locationInventory.filter(l => !l.isActive && l.hasActivity)

    if (inactiveWithData.length === 0) {
      console.log('✅ No inactive locations have inventory or transaction data.')
      console.log('   This is ideal! Inactive locations are truly inactive.')
      console.log('')
    } else {
      console.log(`Found ${inactiveWithData.length} inactive location(s) with data:\n`)

      inactiveWithData.forEach(loc => {
        console.log(`❌ ${loc.name} (${loc.code})`)
        console.log(`   - Inventory Records: ${loc.inventoryRecords.toLocaleString()}`)
        console.log(`   - Products with Stock: ${loc.productsWithStock.toLocaleString()}`)
        console.log(`   - Total Quantity: ${loc.totalQty.toLocaleString()}`)
        console.log(`   - Sales: ${loc.salesCount.toLocaleString()}`)
        console.log(`   - Transfers: ${loc.transfersFrom} out, ${loc.transfersTo} in`)
        console.log('')
      })

      console.log('💡 RECOMMENDATIONS:')
      console.log('   Option 1: Reactivate these locations if they should be in use')
      console.log('   Option 2: Transfer inventory to active locations')
      console.log('   Option 3: Archive/clear data if truly not needed')
      console.log('')
    }

    // 4. Check product coverage across locations
    console.log('📦 PRODUCT COVERAGE ANALYSIS:')
    console.log('─'.repeat(80))

    const totalProducts = await prisma.product.count({
      where: { deletedAt: null }
    })

    const totalVariations = await prisma.productVariation.count()

    console.log(`Total Products: ${totalProducts}`)
    console.log(`Total Variations: ${totalVariations}`)
    console.log('')

    // Check how many products are in each location
    const activeLocations = locationInventory.filter(l => l.isActive)

    console.log('Product Distribution in ACTIVE Locations:')
    activeLocations.forEach(loc => {
      const coverage = totalVariations > 0 ? ((loc.inventoryRecords / totalVariations) * 100).toFixed(1) : 0
      console.log(`   ${loc.name}: ${loc.inventoryRecords}/${totalVariations} (${coverage}% coverage)`)
    })
    console.log('')

    // 5. Analyze ease of adding new locations
    console.log('🆕 NEW LOCATION READINESS ASSESSMENT:')
    console.log('─'.repeat(80))
    console.log('')

    console.log('✅ WHAT\'S ALREADY IN PLACE:')
    console.log('   1. VariationLocationDetails table - Ready for new locations')
    console.log('   2. Stock Transfer system - Can move inventory to new locations')
    console.log('   3. Opening stock mechanism - Can set initial inventory')
    console.log('   4. Multi-location sales support - Already built')
    console.log('')

    console.log('📋 PROCESS TO ADD A NEW LOCATION:')
    console.log('')
    console.log('   Step 1: Create Business Location')
    console.log('      - Add via Admin Panel → Settings → Business Locations')
    console.log('      - Set location name, code, address, etc.')
    console.log('      - Mark as Active')
    console.log('')
    console.log('   Step 2: Set Up Initial Inventory (Choose One):')
    console.log('')
    console.log('      Option A: Transfer from Existing Location')
    console.log('         - Use Stock Transfer feature')
    console.log('         - Transfer products from main warehouse/existing location')
    console.log('         - System automatically creates VariationLocationDetails')
    console.log('         - Maintains proper inventory tracking and history')
    console.log('')
    console.log('      Option B: Manual Opening Stock')
    console.log('         - Use Products → Manage Stock → Set Opening Stock')
    console.log('         - Enter quantities for each product variation')
    console.log('         - System creates VariationLocationDetails records')
    console.log('')
    console.log('      Option C: Purchase Order to New Location')
    console.log('         - Create Purchase Order for the new location')
    console.log('         - Upon GRN approval, inventory auto-created')
    console.log('         - Best for brand new inventory')
    console.log('')
    console.log('   Step 3: Assign Users to Location')
    console.log('      - Assign cashiers/staff to the new location')
    console.log('      - Set permissions via RBAC')
    console.log('')
    console.log('   Step 4: Start Operations')
    console.log('      - Location is now operational')
    console.log('      - Can process sales, transfers, reports')
    console.log('')

    console.log('⚡ AUTOMATION RECOMMENDATION:')
    console.log('─'.repeat(80))
    console.log('For FUTURE locations, consider:')
    console.log('')
    console.log('   1. "Clone Location" Feature:')
    console.log('      - Copy inventory setup from existing location')
    console.log('      - Auto-create VariationLocationDetails with qty = 0')
    console.log('      - Then transfer actual stock as needed')
    console.log('')
    console.log('   2. "New Location Wizard":')
    console.log('      - Step-by-step guide for setting up new location')
    console.log('      - Automatically creates inventory placeholders')
    console.log('      - Prompts for initial stock transfer or opening stock')
    console.log('')

    // 6. Database Query Performance Check
    console.log('🎯 DASHBOARD QUERY IMPACT:')
    console.log('─'.repeat(80))
    console.log('')

    const activeLocationIds = activeLocations.map(l => l.id)
    const inactiveLocationIds = locationInventory.filter(l => !l.isActive).map(l => l.id)

    console.log('Current Dashboard Configuration:')
    console.log(`   - Active location IDs: [${activeLocationIds.join(', ')}]`)
    console.log(`   - Inactive location IDs: [${inactiveLocationIds.join(', ')}]`)
    console.log('')

    if (inactiveWithData.length > 0) {
      console.log('⚠️  IMPACT: Inactive locations with data')
      console.log('   - Dashboard queries may include inactive location data')
      console.log('   - Recommended: Filter by isActive = true in queries')
      console.log('   - Alternative: Exclude specific inactive location IDs')
      console.log('')
    } else {
      console.log('✅ OPTIMAL: No inactive locations have data')
      console.log('   - Dashboard queries are clean')
      console.log('   - No need to filter inactive locations')
      console.log('')
    }

    console.log('💡 RECOMMENDATION FOR DASHBOARDS:')
    console.log('   Current approach: Queries already filter by user\'s accessible locations')
    console.log('   Additional filter: Add isActive check for safety')
    console.log('   Example: WHERE location_id IN (activeLocationIds) AND is_active = true')
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
analyzeLocations()
  .finally(async () => {
    await prisma.$disconnect()
  })
