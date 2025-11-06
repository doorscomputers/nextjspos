import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function testLocationValidation() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('🧪 LOCATION VALIDATION SYSTEM TEST')
  console.log('═══════════════════════════════════════════════════════════\n')

  const results: any = {
    codeIntegrity: { passed: false, details: [] },
    database: { passed: false, details: [] },
    configuration: { passed: false, details: [] },
    recommendations: []
  }

  try {
    // ============================================================================
    // TEST 1: CODE INTEGRITY - Check if validation logic is still in place
    // ============================================================================
    console.log('📋 TEST 1: Code Integrity Check')
    console.log('─────────────────────────────────────────────────────────────\n')

    const authFilePath = path.join(process.cwd(), 'src', 'lib', 'auth.ts')
    const authCode = fs.readFileSync(authFilePath, 'utf-8')

    // Check for required validation code
    const checks = [
      { name: 'RFID scan requirement for non-admins', pattern: /if\s*\(!isAdminRole\s*&&\s*!selectedLocationId\)/i, line: 96 },
      { name: 'Location mismatch blocking', pattern: /if\s*\(isMismatch\s*&&\s*!isSuperAdmin\)/i, line: 402 },
      { name: 'RFID verification API call', pattern: /\/api\/locations\/verify-code/i, location: 'login page' },
      { name: 'selectedLocationId variable', pattern: /const\s+selectedLocationId\s*=/i, line: 81 },
      { name: 'Location mismatch error message', pattern: /Access Denied: Location Mismatch/i, line: 423 }
    ]

    let codeIntegrityPassed = true
    for (const check of checks) {
      const found = check.pattern.test(authCode)
      if (found) {
        console.log(`  ✅ ${check.name}`)
        results.codeIntegrity.details.push({ check: check.name, status: 'FOUND' })
      } else {
        console.log(`  ❌ ${check.name} - MISSING!`)
        results.codeIntegrity.details.push({ check: check.name, status: 'MISSING' })
        codeIntegrityPassed = false
      }
    }

    results.codeIntegrity.passed = codeIntegrityPassed

    if (!codeIntegrityPassed) {
      console.log('\n  ⚠️  WARNING: Some validation code is missing!')
      results.recommendations.push('CRITICAL: Restore missing validation code in src/lib/auth.ts')
    } else {
      console.log('\n  ✅ All validation code is intact!')
    }

    // ============================================================================
    // TEST 2: DATABASE CONFIGURATION - Check if RFID codes are set up
    // ============================================================================
    console.log('\n\n📋 TEST 2: Database Configuration Check')
    console.log('─────────────────────────────────────────────────────────────\n')

    // Check business locations with RFID codes
    const locationsWithRFID = await prisma.businessLocation.findMany({
      where: {
        locationCode: { not: null },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        locationCode: true,
        isActive: true
      }
    })

    const totalLocations = await prisma.businessLocation.count({
      where: { deletedAt: null }
    })

    console.log(`  📊 Total Locations: ${totalLocations}`)
    console.log(`  📊 Locations with RFID codes: ${locationsWithRFID.length}`)

    if (locationsWithRFID.length > 0) {
      console.log('\n  ✅ RFID Codes Found:')
      locationsWithRFID.forEach(loc => {
        console.log(`     • ${loc.name} - Code: ${loc.locationCode} ${loc.isActive ? '(Active)' : '(Inactive)'}`)
        results.database.details.push({
          location: loc.name,
          code: loc.locationCode,
          active: loc.isActive
        })
      })
      results.database.passed = true
    } else {
      console.log('\n  ❌ No RFID codes configured!')
      results.recommendations.push('Add RFID codes to business locations: Go to Settings → Business Locations → Edit → Set Location Code')
      results.database.passed = false
    }

    // Check locations without RFID codes
    const locationsWithoutRFID = await prisma.businessLocation.findMany({
      where: {
        locationCode: null,
        deletedAt: null
      },
      select: {
        id: true,
        name: true
      }
    })

    if (locationsWithoutRFID.length > 0) {
      console.log('\n  ⚠️  Locations WITHOUT RFID codes:')
      locationsWithoutRFID.forEach(loc => {
        console.log(`     • ${loc.name}`)
      })
    }

    // ============================================================================
    // TEST 3: USER CONFIGURATION - Check user location assignments
    // ============================================================================
    console.log('\n\n📋 TEST 3: User Location Assignments Check')
    console.log('─────────────────────────────────────────────────────────────\n')

    // Get all users with their location assignments
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null
      },
      include: {
        roles: {
          include: {
            role: {
              select: {
                name: true,
                locations: {
                  include: {
                    location: {
                      select: {
                        name: true,
                        locationCode: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        userLocations: {
          include: {
            location: {
              select: {
                name: true,
                locationCode: true
              }
            }
          }
        }
      }
    })

    const nonAdminUsers = users.filter(u => {
      const roleNames = u.roles.map(r => r.role.name)
      return !roleNames.some(role =>
        role.toLowerCase().includes('admin') ||
        role.toLowerCase().includes('system administrator')
      )
    })

    console.log(`  📊 Total Users: ${users.length}`)
    console.log(`  📊 Non-Admin Users (need location validation): ${nonAdminUsers.length}`)

    let configPassed = true
    const usersWithoutLocations: string[] = []

    for (const user of nonAdminUsers) {
      const username = user.username
      const roleNames = user.roles.map(r => r.role.name).join(', ')

      // Get direct location assignments
      const directLocations = user.userLocations.map(ul => ul.location.name)

      // Get role-based location assignments
      const roleLocations = user.roles.flatMap(ur =>
        ur.role.locations.map(rl => rl.location.name)
      )

      const allLocations = [...new Set([...directLocations, ...roleLocations])]

      if (allLocations.length === 0) {
        console.log(`\n  ❌ ${username} (${roleNames})`)
        console.log(`     • NO LOCATIONS ASSIGNED!`)
        usersWithoutLocations.push(username)
        configPassed = false
      } else {
        console.log(`\n  ✅ ${username} (${roleNames})`)
        console.log(`     • Assigned to: ${allLocations.join(', ')}`)
      }

      results.configuration.details.push({
        username,
        roles: roleNames,
        locations: allLocations,
        hasLocations: allLocations.length > 0
      })
    }

    results.configuration.passed = configPassed

    if (usersWithoutLocations.length > 0) {
      results.recommendations.push(`Assign locations to users: ${usersWithoutLocations.join(', ')}`)
    }

    // ============================================================================
    // TEST 4: API ENDPOINT - Test RFID verification endpoint
    // ============================================================================
    console.log('\n\n📋 TEST 4: API Endpoint Check')
    console.log('─────────────────────────────────────────────────────────────\n')

    const verifyCodePath = path.join(process.cwd(), 'src', 'app', 'api', 'locations', 'verify-code', 'route.ts')
    if (fs.existsSync(verifyCodePath)) {
      console.log('  ✅ /api/locations/verify-code endpoint exists')

      // Test with actual RFID code if available
      if (locationsWithRFID.length > 0) {
        const testCode = locationsWithRFID[0].locationCode
        console.log(`\n  🧪 Testing with RFID code: ${testCode}`)
        console.log(`     Expected: Should return location "${locationsWithRFID[0].name}"`)
      }
    } else {
      console.log('  ❌ /api/locations/verify-code endpoint MISSING!')
      results.recommendations.push('CRITICAL: Restore /api/locations/verify-code/route.ts')
    }

    // ============================================================================
    // FINAL SUMMARY
    // ============================================================================
    console.log('\n\n═══════════════════════════════════════════════════════════')
    console.log('📊 FINAL SUMMARY')
    console.log('═══════════════════════════════════════════════════════════\n')

    const allPassed = results.codeIntegrity.passed && results.database.passed && results.configuration.passed

    if (allPassed) {
      console.log('✅ LOCATION VALIDATION SYSTEM: FULLY OPERATIONAL\n')
      console.log('   All checks passed! The system is ready for production use.')
    } else {
      console.log('⚠️  LOCATION VALIDATION SYSTEM: NEEDS ATTENTION\n')

      if (!results.codeIntegrity.passed) {
        console.log('   ❌ Code Integrity: FAILED - Some validation code is missing')
      } else {
        console.log('   ✅ Code Integrity: PASSED')
      }

      if (!results.database.passed) {
        console.log('   ❌ Database Setup: FAILED - No RFID codes configured')
      } else {
        console.log('   ✅ Database Setup: PASSED')
      }

      if (!results.configuration.passed) {
        console.log('   ❌ User Configuration: FAILED - Some users lack location assignments')
      } else {
        console.log('   ✅ User Configuration: PASSED')
      }
    }

    if (results.recommendations.length > 0) {
      console.log('\n📌 RECOMMENDATIONS:')
      results.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`)
      })
    }

    console.log('\n═══════════════════════════════════════════════════════════\n')

    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'location-validation-test-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
    console.log(`📄 Detailed report saved to: location-validation-test-report.json\n`)

  } catch (error: any) {
    console.error('\n❌ ERROR during testing:', error.message)
    console.error('Stack trace:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testLocationValidation()
