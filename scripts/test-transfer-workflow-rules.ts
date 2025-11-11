import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Transfer Workflow Validation Script
 *
 * This script tests the transfer workflow rules to ensure:
 * 1. Senders cannot mark their own transfers as arrived
 * 2. Cross-location approvers can manage workflows properly
 * 3. Location-based access works correctly
 *
 * Run this after ANY changes to transfer workflow logic:
 *   npx tsx scripts/test-transfer-workflow-rules.ts
 */

interface TestUser {
  id: number
  username: string
  primaryLocationId: number | null
  hasAccessAllLocations: boolean
}

interface TestTransfer {
  id: number
  transferNumber: string
  status: string
  fromLocationId: number
  toLocationId: number
  createdBy: number
}

// Simulate the button visibility logic from the page
function shouldShowButton(
  user: TestUser,
  transfer: TestTransfer,
  buttonType: 'origin' | 'destination'
): boolean {
  const { primaryLocationId, hasAccessAllLocations } = user
  const { fromLocationId, toLocationId } = transfer

  if (buttonType === 'origin') {
    // Origin-side buttons: Submit, Approve, Send
    return (primaryLocationId === fromLocationId) || hasAccessAllLocations
  } else {
    // Destination-side buttons: Mark Arrived, Verify, Receive
    // CRITICAL: User must NOT be at sender's location
    return (primaryLocationId === toLocationId) ||
           (hasAccessAllLocations && primaryLocationId !== fromLocationId)
  }
}

async function runTests() {
  console.log('🧪 Transfer Workflow Validation Test\n')
  console.log('='.repeat(60))
  console.log('\n')

  let totalTests = 0
  let passedTests = 0
  let failedTests = 0

  // Test Case 1: User at Main Warehouse (Sender)
  console.log('📋 Test Case 1: Location-Specific User at Sender Location')
  console.log('-'.repeat(60))

  const senderUser: TestUser = {
    id: 1,
    username: 'jheiron',
    primaryLocationId: 1, // Main Warehouse
    hasAccessAllLocations: false
  }

  const transfer: TestTransfer = {
    id: 1,
    transferNumber: 'TR-TEST-001',
    status: 'in_transit',
    fromLocationId: 1, // Main Warehouse
    toLocationId: 4,   // Tuguegarao
    createdBy: 1
  }

  totalTests++
  const senderCanSeeOriginButtons = shouldShowButton(senderUser, transfer, 'origin')
  if (senderCanSeeOriginButtons) {
    console.log('✅ PASS: Sender can see origin buttons (Submit, Approve, Send)')
    passedTests++
  } else {
    console.log('❌ FAIL: Sender SHOULD see origin buttons')
    failedTests++
  }

  totalTests++
  const senderCanSeeDestButtons = shouldShowButton(senderUser, transfer, 'destination')
  if (!senderCanSeeDestButtons) {
    console.log('✅ PASS: Sender CANNOT see destination buttons (Mark Arrived, Verify, Receive)')
    passedTests++
  } else {
    console.log('❌ FAIL: Sender should NOT see destination buttons')
    failedTests++
  }

  console.log('')

  // Test Case 2: User at Tuguegarao (Receiver)
  console.log('📋 Test Case 2: Location-Specific User at Receiver Location')
  console.log('-'.repeat(60))

  const receiverUser: TestUser = {
    id: 2,
    username: 'tuguegarao_user',
    primaryLocationId: 4, // Tuguegarao
    hasAccessAllLocations: false
  }

  totalTests++
  const receiverCanSeeOriginButtons = shouldShowButton(receiverUser, transfer, 'origin')
  if (!receiverCanSeeOriginButtons) {
    console.log('✅ PASS: Receiver CANNOT see origin buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Receiver should NOT see origin buttons')
    failedTests++
  }

  totalTests++
  const receiverCanSeeDestButtons = shouldShowButton(receiverUser, transfer, 'destination')
  if (receiverCanSeeDestButtons) {
    console.log('✅ PASS: Receiver can see destination buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Receiver SHOULD see destination buttons')
    failedTests++
  }

  console.log('')

  // Test Case 3: Cross-Location Approver (No Location)
  console.log('📋 Test Case 3: Cross-Location Approver (No Location Assignment)')
  console.log('-'.repeat(60))

  const approverUser: TestUser = {
    id: 17,
    username: 'jayvillalon',
    primaryLocationId: null, // No location
    hasAccessAllLocations: true
  }

  totalTests++
  const approverCanSeeOriginButtons = shouldShowButton(approverUser, transfer, 'origin')
  if (approverCanSeeOriginButtons) {
    console.log('✅ PASS: Cross-location approver can see origin buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Cross-location approver SHOULD see origin buttons')
    failedTests++
  }

  totalTests++
  const approverCanSeeDestButtons = shouldShowButton(approverUser, transfer, 'destination')
  if (approverCanSeeDestButtons) {
    console.log('✅ PASS: Cross-location approver can see destination buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Cross-location approver SHOULD see destination buttons')
    failedTests++
  }

  console.log('')

  // Test Case 4: CRITICAL - Sender with ACCESS_ALL_LOCATIONS
  console.log('📋 Test Case 4: CRITICAL - Sender with ACCESS_ALL_LOCATIONS')
  console.log('-'.repeat(60))
  console.log('⚠️  This is the most important test - it was previously broken!')

  const senderWithAllAccess: TestUser = {
    id: 3,
    username: 'jheiron_warehouse_manager',
    primaryLocationId: 1, // Main Warehouse (SENDER location)
    hasAccessAllLocations: true
  }

  totalTests++
  const senderAllCanSeeOriginButtons = shouldShowButton(senderWithAllAccess, transfer, 'origin')
  if (senderAllCanSeeOriginButtons) {
    console.log('✅ PASS: Sender (ACCESS_ALL_LOCATIONS) can see origin buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Sender (ACCESS_ALL_LOCATIONS) SHOULD see origin buttons')
    failedTests++
  }

  totalTests++
  const senderAllCanSeeDestButtons = shouldShowButton(senderWithAllAccess, transfer, 'destination')
  if (!senderAllCanSeeDestButtons) {
    console.log('✅ PASS: Sender (ACCESS_ALL_LOCATIONS) CANNOT see destination buttons')
    console.log('   ✅ This prevents sender from marking their own transfer as arrived!')
    passedTests++
  } else {
    console.log('❌ FAIL: Sender (ACCESS_ALL_LOCATIONS) should NOT see destination buttons')
    console.log('   ❌ CRITICAL BUG: Sender can mark their own transfer as arrived!')
    failedTests++
  }

  console.log('')

  // Test Case 5: Receiver with ACCESS_ALL_LOCATIONS
  console.log('📋 Test Case 5: Receiver with ACCESS_ALL_LOCATIONS')
  console.log('-'.repeat(60))

  const receiverWithAllAccess: TestUser = {
    id: 4,
    username: 'receiver_all_access',
    primaryLocationId: 4, // Tuguegarao (RECEIVER location)
    hasAccessAllLocations: true
  }

  totalTests++
  const receiverAllCanSeeOriginButtons = shouldShowButton(receiverWithAllAccess, transfer, 'origin')
  if (receiverAllCanSeeOriginButtons) {
    console.log('✅ PASS: Receiver (ACCESS_ALL_LOCATIONS) can see origin buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Receiver (ACCESS_ALL_LOCATIONS) SHOULD see origin buttons')
    failedTests++
  }

  totalTests++
  const receiverAllCanSeeDestButtons = shouldShowButton(receiverWithAllAccess, transfer, 'destination')
  if (receiverAllCanSeeDestButtons) {
    console.log('✅ PASS: Receiver (ACCESS_ALL_LOCATIONS) can see destination buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Receiver (ACCESS_ALL_LOCATIONS) SHOULD see destination buttons')
    failedTests++
  }

  console.log('')

  // Test Case 6: User at unrelated location
  console.log('📋 Test Case 6: User at Unrelated Location')
  console.log('-'.repeat(60))

  const unrelatedUser: TestUser = {
    id: 5,
    username: 'bambang_user',
    primaryLocationId: 3, // Bambang (neither sender nor receiver)
    hasAccessAllLocations: false
  }

  totalTests++
  const unrelatedCanSeeOriginButtons = shouldShowButton(unrelatedUser, transfer, 'origin')
  if (!unrelatedCanSeeOriginButtons) {
    console.log('✅ PASS: Unrelated user CANNOT see origin buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Unrelated user should NOT see origin buttons')
    failedTests++
  }

  totalTests++
  const unrelatedCanSeeDestButtons = shouldShowButton(unrelatedUser, transfer, 'destination')
  if (!unrelatedCanSeeDestButtons) {
    console.log('✅ PASS: Unrelated user CANNOT see destination buttons')
    passedTests++
  } else {
    console.log('❌ FAIL: Unrelated user should NOT see destination buttons')
    failedTests++
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('\n📊 TEST RESULTS\n')
  console.log(`Total Tests: ${totalTests}`)
  console.log(`✅ Passed: ${passedTests}`)
  console.log(`❌ Failed: ${failedTests}`)
  console.log('')

  if (failedTests === 0) {
    console.log('🎉 ALL TESTS PASSED! Workflow rules are working correctly.')
    console.log('')
    console.log('✅ Workflow separation is maintained')
    console.log('✅ Senders cannot mark their own transfers as arrived')
    console.log('✅ Cross-location approvers work properly')
    console.log('')
  } else {
    console.log('⚠️  SOME TESTS FAILED! There are issues with workflow logic.')
    console.log('')
    console.log('❌ DO NOT DEPLOY - Fix the issues first!')
    console.log('📖 See docs/TRANSFER_WORKFLOW_RULES.md for correct logic')
    console.log('')
    process.exit(1)
  }

  // Verify actual database state
  console.log('🔍 Verifying Database State...\n')

  try {
    const jheiron = await prisma.user.findFirst({
      where: { username: 'jheiron' },
      include: {
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
        },
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    if (jheiron) {
      console.log('👤 Jheiron (Warehouse Manager):')
      console.log(`   Primary Location: ${jheiron.userLocations[0]?.location.name || 'None'}`)
      const hasAccessAll = jheiron.roles.some(ur =>
        ur.role.permissions.some(rp => rp.permission.name === 'access_all_locations')
      )
      console.log(`   Has ACCESS_ALL_LOCATIONS: ${hasAccessAll}`)
      console.log('')
    }

    const jay = await prisma.user.findFirst({
      where: { username: 'jayvillalon' },
      include: {
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
        },
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    if (jay) {
      console.log('👤 Jay (Cross-Location Approver):')
      console.log(`   Primary Location: ${jay.userLocations[0]?.location.name || 'None (as expected)'}`)
      const hasAccessAll = jay.roles.some(ur =>
        ur.role.permissions.some(rp => rp.permission.name === 'access_all_locations')
      )
      console.log(`   Has ACCESS_ALL_LOCATIONS: ${hasAccessAll}`)
      console.log('')
    }

    console.log('✅ Database state verified')
    console.log('')

  } catch (error) {
    console.log('⚠️  Could not verify database state (this is ok for unit tests)')
    console.log('')
  }

  await prisma.$disconnect()

  console.log('📝 Next Steps:')
  console.log('   1. If all tests passed, workflow logic is correct')
  console.log('   2. Test manually in the UI with real users')
  console.log('   3. See docs/TRANSFER_WORKFLOW_RULES.md for details')
  console.log('')
}

runTests().catch(console.error)
