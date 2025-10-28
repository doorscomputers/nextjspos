/**
 * User Location Assignment Verification Script
 *
 * This script verifies the integrity of user location assignments in the database.
 * Run this script to ensure there are no inconsistencies.
 *
 * Usage: npx tsx scripts/verify-user-locations.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface VerificationResult {
  status: 'pass' | 'warning' | 'fail'
  message: string
  count?: number
  data?: any[]
}

async function verifyUserLocations() {
  console.log('🔍 Starting User Location Assignment Verification...\n')

  const results: VerificationResult[] = []

  try {
    // Test 1: Check for users without locations (excluding admins)
    console.log('Test 1: Checking for non-admin users without locations...')
    const usersWithoutLocations = await prisma.user.findMany({
      where: {
        deletedAt: null,
        businessId: { not: null },
        userLocations: { none: {} }
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    const adminRoles = ['Super Admin', 'Branch Admin', 'All Branch Admin']
    const nonAdminsWithoutLocation = usersWithoutLocations.filter(user => {
      const userRoles = user.roles.map(ur => ur.role.name)
      return !userRoles.some(role => adminRoles.includes(role))
    })

    if (nonAdminsWithoutLocation.length > 0) {
      results.push({
        status: 'warning',
        message: `Found ${nonAdminsWithoutLocation.length} non-admin user(s) without location assignments`,
        count: nonAdminsWithoutLocation.length,
        data: nonAdminsWithoutLocation.map(u => ({
          id: u.id,
          username: u.username,
          name: `${u.firstName} ${u.surname}`,
          roles: u.roles.map(ur => ur.role.name).join(', ')
        }))
      })
    } else {
      results.push({
        status: 'pass',
        message: 'All non-admin users have location assignments',
        count: 0
      })
    }

    // Test 2: Check for duplicate location assignments
    console.log('Test 2: Checking for duplicate location assignments...')
    const duplicates = await prisma.$queryRaw<any[]>`
      SELECT user_id, location_id, COUNT(*) as count
      FROM user_locations
      GROUP BY user_id, location_id
      HAVING COUNT(*) > 1
    `

    if (duplicates.length > 0) {
      results.push({
        status: 'fail',
        message: `Found ${duplicates.length} duplicate location assignment(s)`,
        count: duplicates.length,
        data: duplicates
      })
    } else {
      results.push({
        status: 'pass',
        message: 'No duplicate location assignments found',
        count: 0
      })
    }

    // Test 3: Check for orphaned location assignments
    console.log('Test 3: Checking for orphaned location assignments...')
    const orphanedAssignments = await prisma.userLocation.findMany({
      where: {
        OR: [
          { user: { deletedAt: { not: null } } },
          { location: { deletedAt: { not: null } } }
        ]
      },
      include: {
        user: true,
        location: true
      }
    })

    if (orphanedAssignments.length > 0) {
      results.push({
        status: 'fail',
        message: `Found ${orphanedAssignments.length} orphaned location assignment(s) pointing to deleted users/locations`,
        count: orphanedAssignments.length,
        data: orphanedAssignments.map(a => ({
          userId: a.userId,
          locationId: a.locationId,
          userDeleted: a.user.deletedAt !== null,
          locationDeleted: a.location.deletedAt !== null
        }))
      })
    } else {
      results.push({
        status: 'pass',
        message: 'No orphaned location assignments found',
        count: 0
      })
    }

    // Test 4: Check for users with multiple locations (should be acceptable but log it)
    console.log('Test 4: Checking for users with multiple locations...')
    const usersWithMultipleLocations = await prisma.$queryRaw<any[]>`
      SELECT u.id, u.username, u.first_name, u.surname, COUNT(ul.location_id) as location_count
      FROM users u
      INNER JOIN user_locations ul ON ul.user_id = u.id
      WHERE u.deleted_at IS NULL
      GROUP BY u.id, u.username, u.first_name, u.surname
      HAVING COUNT(ul.location_id) > 1
    `

    if (usersWithMultipleLocations.length > 0) {
      results.push({
        status: 'warning',
        message: `Found ${usersWithMultipleLocations.length} user(s) with multiple location assignments`,
        count: usersWithMultipleLocations.length,
        data: usersWithMultipleLocations
      })
    } else {
      results.push({
        status: 'pass',
        message: 'All users have single location assignments (as expected)',
        count: 0
      })
    }

    // Test 5: Location assignment statistics
    console.log('Test 5: Gathering location assignment statistics...')
    const stats = await prisma.$queryRaw<any[]>`
      SELECT
        bl.name as location_name,
        COUNT(ul.user_id) as user_count
      FROM business_locations bl
      LEFT JOIN user_locations ul ON ul.location_id = bl.id
      WHERE bl.deleted_at IS NULL
      GROUP BY bl.id, bl.name
      ORDER BY user_count DESC
    `

    results.push({
      status: 'pass',
      message: `Location assignment distribution`,
      data: stats
    })

    // Print Results
    console.log('\n' + '='.repeat(60))
    console.log('📊 VERIFICATION RESULTS')
    console.log('='.repeat(60) + '\n')

    let hasFailures = false
    let hasWarnings = false

    results.forEach((result, index) => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
      console.log(`${icon} Test ${index + 1}: ${result.message}`)

      if (result.data && result.data.length > 0 && result.status !== 'pass') {
        console.log('   Details:')
        result.data.forEach((item, i) => {
          console.log(`   ${i + 1}.`, JSON.stringify(item, null, 2))
        })
      }

      if (result.status === 'fail') hasFailures = true
      if (result.status === 'warning') hasWarnings = true

      console.log()
    })

    console.log('='.repeat(60))

    if (hasFailures) {
      console.log('❌ VERIFICATION FAILED - Critical issues found!')
      console.log('   Please review and fix the issues above.')
      process.exit(1)
    } else if (hasWarnings) {
      console.log('⚠️  VERIFICATION PASSED WITH WARNINGS')
      console.log('   System is functional but review warnings above.')
      process.exit(0)
    } else {
      console.log('✅ ALL VERIFICATIONS PASSED')
      console.log('   User location assignments are consistent and healthy!')
      process.exit(0)
    }

  } catch (error) {
    console.error('❌ Error during verification:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run verification
verifyUserLocations()
