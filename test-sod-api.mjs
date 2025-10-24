import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testSODAPI() {
  console.log('Testing SOD Rules API...\n')

  try {
    // Test 1: Verify the table exists and has data
    console.log('1. Checking if business_sod_settings table exists...')
    const settings = await prisma.businessSODSettings.findMany()
    console.log(`✓ Found ${settings.length} SOD settings record(s)`)
    console.log('   Current settings:', settings[0])

    // Test 2: Try to fetch settings for business ID 1
    console.log('\n2. Fetching SOD settings for business ID 1...')
    const businessSettings = await prisma.businessSODSettings.findUnique({
      where: { businessId: 1 }
    })

    if (businessSettings) {
      console.log('✓ Successfully retrieved settings for business ID 1')
      console.log('   Transfer SOD Enforcement:', businessSettings.enforceTransferSOD)
      console.log('   Purchase SOD Enforcement:', businessSettings.enforcePurchaseSOD)
      console.log('   Return SOD Enforcement:', businessSettings.enforceReturnSOD)
      console.log('   Exempt Roles:', businessSettings.exemptRoles)
    } else {
      console.log('✗ No settings found for business ID 1')
    }

    // Test 3: Try to update settings
    console.log('\n3. Testing update operation...')
    const updated = await prisma.businessSODSettings.update({
      where: { businessId: 1 },
      data: {
        allowCreatorToCheck: true // Enable this just for testing
      }
    })
    console.log('✓ Successfully updated settings')
    console.log('   allowCreatorToCheck changed to:', updated.allowCreatorToCheck)

    // Test 4: Revert the change
    console.log('\n4. Reverting test change...')
    await prisma.businessSODSettings.update({
      where: { businessId: 1 },
      data: {
        allowCreatorToCheck: false // Revert back to default
      }
    })
    console.log('✓ Reverted test change')

    console.log('\n✅ All tests passed! The BusinessSODSettings API is working correctly.')
    console.log('\n📝 Next steps:')
    console.log('   1. Start your dev server: npm run dev')
    console.log('   2. Navigate to: http://localhost:3000/dashboard/settings/sod-rules')
    console.log('   3. The page should now load without errors')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testSODAPI()
