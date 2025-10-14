/**
 * Direct API test for Sales endpoint
 * No browser automation - just HTTP requests
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const BASE_URL = 'http://127.0.0.1:3006'

async function testSalesAPI() {
  try {
    console.log('\n=== Testing Sales API Directly ===\n')

    // Get superadmin user
    const superadmin = await prisma.user.findFirst({
      where: { username: 'superadmin' },
      include: { business: { include: { locations: true } } }
    })

    if (!superadmin) {
      throw new Error('Superadmin not found')
    }

    console.log('✓ Found superadmin:', superadmin.username)
    console.log('✓ Business ID:', superadmin.businessId)
    console.log('✓ Location ID:', superadmin.business.locations[0]?.id)

    // Try to fetch sales (should get 401)
    console.log('\n--- Testing GET /api/sales (no auth) ---')
    const response = await fetch(`${BASE_URL}/api/sales`)
    console.log('Status:', response.status, response.statusText)
    console.log('Expected: 401 Unauthorized')

    if (response.status === 401) {
      console.log('✓ API is responding correctly')
    } else {
      console.log('✗ Unexpected response')
    }

    console.log('\n=== Test Complete ===\n')
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testSalesAPI()
