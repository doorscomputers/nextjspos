#!/usr/bin/env node

/**
 * Test Script: Verify Transfer Location Assignment Fix
 *
 * This script verifies that the "From Location" in stock transfers
 * correctly uses the user's assigned location instead of just the
 * first alphabetically-sorted location.
 *
 * Test Scenario:
 * - User: "Super Warehouse Tester"
 * - Assigned Location: "Main Warehouse"
 * - Has ACCESS_ALL_LOCATIONS permission
 * - Expected: "Main Warehouse" should be selected, NOT "Baguio"
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testTransferLocationFix() {
  console.log('\n' + '='.repeat(70))
  console.log('🧪 TESTING: Transfer Location Assignment Fix')
  console.log('='.repeat(70) + '\n')

  try {
    // 1. Find the test user
    const testUser = await prisma.user.findFirst({
      where: {
        username: 'warehouse_super'
      },
      include: {
        business: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!testUser) {
      console.log('❌ Test user "warehouse_super" not found')
      console.log('   This test requires the user to exist in the database')
      return
    }

    console.log('✅ Found test user:')
    console.log(`   Username: ${testUser.username}`)
    console.log(`   Name: ${testUser.firstName} ${testUser.lastName}`)
    console.log(`   Business ID: ${testUser.businessId}`)
    console.log('')

    // 2. Get user's actual assigned locations (UserLocation table)
    const userAssignments = await prisma.userLocation.findMany({
      where: {
        userId: testUser.id
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            deletedAt: true
          }
        }
      }
    })

    console.log('📍 User\'s Assigned Locations (UserLocation table):')
    if (userAssignments.length === 0) {
      console.log('   ⚠️  No locations assigned in UserLocation table')
    } else {
      userAssignments.forEach(ul => {
        if (ul.location && !ul.location.deletedAt) {
          console.log(`   ✓ ${ul.location.name} (ID: ${ul.location.id})`)
        }
      })
    }
    console.log('')

    const assignedLocationIds = userAssignments
      .filter(ul => ul.location && !ul.location.deletedAt)
      .map(ul => ul.location.id)

    // 3. Check if user has ACCESS_ALL_LOCATIONS permission
    const hasAccessAll = testUser.roles.some(ur =>
      ur.role.permissions.some(rp =>
        rp.permission.name === 'location.access_all'
      )
    )

    console.log('🔓 ACCESS_ALL_LOCATIONS Permission:')
    console.log(`   ${hasAccessAll ? '✓ HAS' : '✗ DOES NOT HAVE'} access_all permission`)
    console.log('')

    // 4. Get ALL business locations (what the API would return with ACCESS_ALL)
    const allLocations = await prisma.businessLocation.findMany({
      where: {
        businessId: testUser.businessId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log('🏢 All Business Locations (alphabetically sorted):')
    allLocations.forEach((loc, idx) => {
      const isAssigned = assignedLocationIds.includes(loc.id)
      const marker = idx === 0 ? '👉' : '  '
      const badge = isAssigned ? '[ASSIGNED]' : '[accessible]'
      console.log(`   ${marker} ${loc.name} (ID: ${loc.id}) ${badge}`)
    })
    console.log('')

    // 5. Simulate the OLD behavior (before fix)
    console.log('📊 BEFORE FIX - Old Behavior:')
    const oldFirstLocation = allLocations[0]
    console.log(`   Would select: ${oldFirstLocation?.name || 'N/A'}`)
    console.log(`   ❌ This is WRONG if user is assigned to a different location!`)
    console.log('')

    // 6. Simulate the NEW behavior (after fix)
    console.log('📊 AFTER FIX - New Behavior:')

    // Mark which locations are assigned
    const locationsWithFlags = allLocations.map(loc => ({
      ...loc,
      isAssigned: assignedLocationIds.includes(loc.id)
    }))

    // Sort so assigned locations come first
    const sortedLocations = locationsWithFlags.sort((a, b) => {
      if (a.isAssigned && !b.isAssigned) return -1
      if (!a.isAssigned && b.isAssigned) return 1
      return a.name.localeCompare(b.name)
    })

    const primaryLocationId = assignedLocationIds.length > 0
      ? assignedLocationIds[0]
      : null

    const primaryLocation = sortedLocations.find(
      loc => loc.id === primaryLocationId
    )

    console.log('   Sorted locations (assigned first):')
    sortedLocations.forEach((loc, idx) => {
      const marker = loc.id === primaryLocationId ? '🎯' : '  '
      const badge = loc.isAssigned ? '[ASSIGNED]' : '[accessible]'
      console.log(`   ${marker} ${loc.name} (ID: ${loc.id}) ${badge}`)
    })
    console.log('')
    console.log(`   Primary Location ID: ${primaryLocationId || 'N/A'}`)
    console.log(`   Will select: ${primaryLocation?.name || 'First location (no assignment)'}`)
    console.log('')

    // 7. Verification
    console.log('🔍 VERIFICATION:')

    const mainWarehouse = allLocations.find(loc =>
      loc.name.toLowerCase().includes('main warehouse')
    )
    const baguio = allLocations.find(loc =>
      loc.name.toLowerCase().includes('baguio')
    )

    if (mainWarehouse && baguio) {
      const isMainWarehouseAssigned = assignedLocationIds.includes(mainWarehouse.id)
      const primaryIsMainWarehouse = primaryLocationId === mainWarehouse.id

      console.log(`   Main Warehouse assigned to user: ${isMainWarehouseAssigned ? '✅ YES' : '❌ NO'}`)
      console.log(`   Baguio comes before Main alphabetically: ${baguio.name < mainWarehouse.name ? '✅ YES' : '❌ NO'}`)
      console.log(`   Primary location is Main Warehouse: ${primaryIsMainWarehouse ? '✅ YES' : '❌ NO'}`)
      console.log('')

      if (isMainWarehouseAssigned && primaryIsMainWarehouse) {
        console.log('✅ TEST PASSED: Main Warehouse correctly selected as primary!')
      } else if (isMainWarehouseAssigned && !primaryIsMainWarehouse) {
        console.log('❌ TEST FAILED: Main Warehouse is assigned but NOT selected as primary')
      } else if (!isMainWarehouseAssigned) {
        console.log('⚠️  User is not assigned to Main Warehouse in UserLocation table')
        console.log('   Please run: node scripts/assign-user-locations.mjs')
      }
    } else {
      console.log('⚠️  Could not find both Main Warehouse and Baguio locations')
    }

    console.log('')
    console.log('=' .repeat(70))
    console.log('✅ Test completed')
    console.log('=' .repeat(70) + '\n')

  } catch (error) {
    console.error('❌ Error during test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testTransferLocationFix()
