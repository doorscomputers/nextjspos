const fetch = require('node-fetch')

async function testPurchaseItemsAPI() {
  try {
    console.log('Testing Purchase Items API...')

    // First login to get session cookie
    const loginRes = await fetch('http://localhost:3003/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'username=superadmin&password=password'
    })

    const cookies = loginRes.headers.raw()['set-cookie']
    console.log('Login successful')

    // Test the purchase items API
    const apiRes = await fetch('http://localhost:3003/api/reports/purchases/items?page=1&limit=50', {
      headers: {
        'Cookie': cookies.join('; ')
      }
    })

    console.log('API Status:', apiRes.status)

    const data = await apiRes.json()
    console.log('API Response:', JSON.stringify(data, null, 2))

  } catch (error) {
    console.error('Test failed:', error.message)
  }
}

testPurchaseItemsAPI()
