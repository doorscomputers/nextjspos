const fetch = require('node-fetch')

async function testAPI() {
  try {
    console.log('1. Logging in as superadmin...')

    // Login
    const loginRes = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'username=superadmin&password=password'
    })

    if (!loginRes.ok) {
      console.error('Login failed:', loginRes.status)
      return
    }

    const cookies = loginRes.headers.raw()['set-cookie'] || []
    console.log('✓ Login successful')
    console.log('  Cookies received:', cookies.length, 'cookies\n')

    // Test the API
    console.log('2. Testing Purchase Items API...')
    const headers = cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {}
    const apiRes = await fetch('http://localhost:3000/api/reports/purchases/items?page=1&limit=10', {
      headers
    })

    console.log('Status:', apiRes.status)

    if (!apiRes.ok) {
      const errorText = await apiRes.text()
      console.error('API Error:', errorText)
      return
    }

    const data = await apiRes.json()
    console.log('✓ API Response received\n')

    console.log('Summary:')
    console.log('  Total Items:', data.summary?.totalItems || 0)
    console.log('  Total Quantity Ordered:', data.summary?.totalQuantityOrdered || 0)
    console.log('  Total Value:', data.summary?.totalValue || 0)

    console.log('\nFirst 3 items:')
    if (data.items && data.items.length > 0) {
      data.items.slice(0, 3).forEach((item, idx) => {
        console.log(`\n  Item ${idx + 1}:`)
        console.log('    Product:', item.productName)
        console.log('    PO:', item.purchaseOrderNumber)
        console.log('    Location:', item.location)
        console.log('    Quantity:', item.quantityOrdered)
        console.log('    Unit Cost:', item.unitCost)
        console.log('    Total:', item.itemTotal)
      })
    } else {
      console.log('  No items found')
    }

  } catch (error) {
    console.error('Test failed:', error.message)
  }
}

testAPI()
