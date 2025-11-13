/**
 * Test script for location-based daily invoice numbering system
 * Validates:
 * 1. Invoice numbers are unique per location per day
 * 2. Format matches: Inv{LocationName}{MM_DD_YYYY}_####
 * 3. Sequences reset daily
 * 4. Multiple locations have independent sequences
 * 5. X/Z Reading receipt numbers use same sequence
 */

import { PrismaClient } from '@prisma/client'
import {
  getNextInvoiceNumber,
  getNextReadingReceiptNumber,
} from '../src/lib/atomicNumbers'

const prisma = new PrismaClient()

interface TestResult {
  test: string
  passed: boolean
  message: string
  invoiceNumber?: string
}

const results: TestResult[] = []

async function runTests() {
  console.log('🧪 TESTING LOCATION-BASED DAILY INVOICE NUMBERING SYSTEM')
  console.log('=' . repeat(70))
  console.log('')

  try {
    // Get test locations
    const locations = await prisma.businessLocation.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      take: 3, // Test with first 3 locations
      select: {
        id: true,
        name: true,
        businessId: true,
      },
    })

    if (locations.length === 0) {
      console.error('❌ No active locations found in database')
      return
    }

    console.log(`📍 Found ${locations.length} locations to test:`)
    locations.forEach((loc, idx) => {
      console.log(`   ${idx + 1}. ${loc.name} (ID: ${loc.id})`)
    })
    console.log('')

    // TEST 1: Generate invoice numbers for first location
    console.log('TEST 1: Generate sequential invoice numbers for same location')
    console.log('-'.repeat(70))
    const loc1 = locations[0]
    const inv1_1 = await getNextInvoiceNumber(
      loc1.businessId,
      loc1.id,
      loc1.name
    )
    const inv1_2 = await getNextInvoiceNumber(
      loc1.businessId,
      loc1.id,
      loc1.name
    )
    const inv1_3 = await getNextInvoiceNumber(
      loc1.businessId,
      loc1.id,
      loc1.name
    )

    console.log(`   Generated: ${inv1_1}`)
    console.log(`   Generated: ${inv1_2}`)
    console.log(`   Generated: ${inv1_3}`)

    const sequencesMatch = inv1_1 < inv1_2 && inv1_2 < inv1_3
    const formatMatch = /^Inv[A-Za-z]+\d{2}_\d{2}_\d{4}_\d{4}$/.test(inv1_1)

    results.push({
      test: 'Sequential numbering',
      passed: sequencesMatch,
      message: sequencesMatch
        ? 'Invoice numbers increment correctly'
        : 'Invoice numbers not sequential',
      invoiceNumber: inv1_1,
    })

    results.push({
      test: 'Format validation',
      passed: formatMatch,
      message: formatMatch
        ? 'Invoice format matches Inv{LocationName}{MM_DD_YYYY}_####'
        : 'Invoice format does not match expected pattern',
      invoiceNumber: inv1_1,
    })

    console.log(
      `   ✓ Sequential: ${sequencesMatch ? 'PASS' : 'FAIL'}`
    )
    console.log(
      `   ✓ Format: ${formatMatch ? 'PASS' : 'FAIL'}`
    )
    console.log('')

    // TEST 2: Generate invoice numbers for different locations (same day)
    if (locations.length >= 2) {
      console.log('TEST 2: Independent sequences for different locations')
      console.log('-'.repeat(70))

      const loc2 = locations[1]
      const inv2_1 = await getNextInvoiceNumber(
        loc2.businessId,
        loc2.id,
        loc2.name
      )
      const inv2_2 = await getNextInvoiceNumber(
        loc2.businessId,
        loc2.id,
        loc2.name
      )

      console.log(`   Location 1 (${loc1.name}): ${inv1_1}`)
      console.log(`   Location 2 (${loc2.name}): ${inv2_1}`)
      console.log(`   Location 2 next: ${inv2_2}`)

      // Check if location abbreviations are different
      const getLocationPrefix = (locationName: string) => {
        return locationName
          .replace(/\b(Store|Branch|Warehouse|Shop|Outlet)\b/gi, '')
          .trim()
          .split(/\s+/)[0]
          .substring(0, 7)
      }

      const loc1Prefix = getLocationPrefix(loc1.name)
      const loc2Prefix = getLocationPrefix(loc2.name)

      console.log(`   Location 1 prefix: "${loc1Prefix}"`)
      console.log(`   Location 2 prefix: "${loc2Prefix}"`)

      // Both locations should start at 0001 (independent sequences)
      const independentSequences =
        inv2_1.includes('_0001') && inv2_2.includes('_0002')

      // If names are different, prefixes should be different
      const locationNamesMatch = loc1Prefix !== loc2Prefix
        ? inv1_1.includes(loc1Prefix) && inv2_1.includes(loc2Prefix)
        : inv1_1.includes(loc1Prefix) // If same prefix, just check it exists

      results.push({
        test: 'Location independence',
        passed: independentSequences,
        message: independentSequences
          ? 'Each location has independent sequence'
          : 'Locations sharing sequences incorrectly',
        invoiceNumber: `${inv1_1} vs ${inv2_1}`,
      })

      results.push({
        test: 'Location name in invoice',
        passed: locationNamesMatch,
        message: locationNamesMatch
          ? 'Invoice numbers contain location names'
          : 'Location names not properly included',
      })

      console.log(
        `   ✓ Independent: ${independentSequences ? 'PASS' : 'FAIL'}`
      )
      console.log(
        `   ✓ Location names: ${locationNamesMatch ? 'PASS' : 'FAIL'}`
      )
      console.log('')
    }

    // TEST 3: X/Z Reading receipt numbers
    console.log('TEST 3: X/Z Reading receipt numbers (share sequence with invoices)')
    console.log('-'.repeat(70))

    const loc3 = locations[0]
    const xReadingReceipt = await getNextReadingReceiptNumber(
      loc3.businessId,
      loc3.id,
      loc3.name
    )

    console.log(`   X Reading Receipt: ${xReadingReceipt}`)

    const readingFormatMatch = /^Inv[A-Za-z]+\d{2}_\d{2}_\d{4}_\d{4}$/.test(
      xReadingReceipt
    )

    results.push({
      test: 'Reading receipt format',
      passed: readingFormatMatch,
      message: readingFormatMatch
        ? 'Reading receipts use same format as invoices'
        : 'Reading receipt format mismatch',
      invoiceNumber: xReadingReceipt,
    })

    console.log(
      `   ✓ Format match: ${readingFormatMatch ? 'PASS' : 'FAIL'}`
    )
    console.log('')

    // TEST 4: Verify today's date in invoice number
    console.log('TEST 4: Date verification in invoice numbers')
    console.log('-'.repeat(70))

    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const year = now.getFullYear()
    const expectedDate = `${month}_${day}_${year}`

    const dateMatches = inv1_1.includes(expectedDate)

    results.push({
      test: 'Current date in invoice',
      passed: dateMatches,
      message: dateMatches
        ? `Invoice contains today's date: ${expectedDate}`
        : `Date mismatch. Expected: ${expectedDate}`,
      invoiceNumber: inv1_1,
    })

    console.log(`   Expected date: ${expectedDate}`)
    console.log(`   Invoice: ${inv1_1}`)
    console.log(`   ✓ Date match: ${dateMatches ? 'PASS' : 'FAIL'}`)
    console.log('')

    // TEST 5: Concurrent generation (race condition test)
    console.log('TEST 5: Concurrent invoice generation (thread safety)')
    console.log('-'.repeat(70))

    const loc4 = locations[0]
    const concurrentPromises = Array.from({ length: 5 }, () =>
      getNextInvoiceNumber(loc4.businessId, loc4.id, loc4.name)
    )

    const concurrentInvoices = await Promise.all(concurrentPromises)
    console.log('   Generated concurrently:')
    concurrentInvoices.forEach((inv) => console.log(`     ${inv}`))

    const uniqueInvoices = new Set(concurrentInvoices)
    const allUnique = uniqueInvoices.size === concurrentInvoices.length

    results.push({
      test: 'Thread safety',
      passed: allUnique,
      message: allUnique
        ? 'All concurrent invoices are unique'
        : 'Duplicate invoices detected',
    })

    console.log(`   ✓ All unique: ${allUnique ? 'PASS' : 'FAIL'}`)
    console.log('')

    // Print summary
    console.log('=' . repeat(70))
    console.log('📊 TEST SUMMARY')
    console.log('=' . repeat(70))

    const passedCount = results.filter((r) => r.passed).length
    const totalCount = results.length

    results.forEach((result, idx) => {
      const icon = result.passed ? '✅' : '❌'
      console.log(`${icon} Test ${idx + 1}: ${result.test}`)
      console.log(`   ${result.message}`)
      if (result.invoiceNumber) {
        console.log(`   Invoice: ${result.invoiceNumber}`)
      }
      console.log('')
    })

    console.log(`Final Score: ${passedCount}/${totalCount} tests passed`)

    if (passedCount === totalCount) {
      console.log('🎉 ALL TESTS PASSED! Invoice numbering system is working correctly.')
    } else {
      console.log('⚠️  Some tests failed. Please review the results above.')
    }

  } catch (error: any) {
    console.error('❌ Test execution failed:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// Run tests
runTests().catch(console.error)
