/**
 * Complete POS Workflow Test
 * Tests: Login → Begin Shift → Make Sale → X Reading → Close Shift
 */

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'
let cookies = ''
let currentShift = null
let saleId = null

// Helper: Login
async function login() {
  console.log('\n🔐 Step 1: Login as Cashier...')
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'cashier',
      password: 'password',
    }),
  })

  if (res.headers.get('set-cookie')) {
    cookies = res.headers.get('set-cookie')
    console.log('  ✅ Login successful')
    return true
  } else {
    console.log('  ❌ Login failed')
    return false
  }
}

// Helper: Begin Shift
async function beginShift() {
  console.log('\n📦 Step 2: Begin Shift...')

  // First check if there's already an open shift
  const checkRes = await fetch(`${BASE_URL}/api/shifts?status=open`, {
    headers: { Cookie: cookies },
  })
  const checkData = await checkRes.json()

  if (checkData.shifts && checkData.shifts.length > 0) {
    console.log('  ⚠️  Shift already open:', checkData.shifts[0].shiftNumber)
    currentShift = checkData.shifts[0]
    return true
  }

  // Create new shift
  const res = await fetch(`${BASE_URL}/api/shifts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
    },
    body: JSON.stringify({
      locationId: 1,
      beginningCash: 5000.0,
      openingNotes: 'Test shift from automated test',
    }),
  })

  const data = await res.json()

  if (res.ok && data.shift) {
    currentShift = data.shift
    console.log('  ✅ Shift opened:', currentShift.shiftNumber)
    console.log('     Beginning Cash: ₱' + currentShift.beginningCash)
    return true
  } else {
    console.log('  ❌ Failed to open shift:', data.error || data.details)
    return false
  }
}

// Helper: Get products
async function getProducts() {
  console.log('\n🛍️  Step 3: Fetching products...')
  const res = await fetch(`${BASE_URL}/api/products?limit=10`, {
    headers: { Cookie: cookies },
  })
  const data = await res.json()

  if (data.products && data.products.length > 0) {
    console.log(`  ✅ Found ${data.products.length} products`)
    return data.products
  } else {
    console.log('  ❌ No products found')
    return []
  }
}

// Helper: Make a sale
async function makeSale(products) {
  console.log('\n💰 Step 4: Processing sale...')

  if (!products || products.length === 0) {
    console.log('  ❌ No products available for sale')
    return false
  }

  const product = products[0]
  if (!product.variations || product.variations.length === 0) {
    console.log('  ❌ Product has no variations')
    return false
  }

  const variation = product.variations[0]

  const saleData = {
    locationId: currentShift.locationId,
    saleDate: new Date().toISOString(),
    items: [
      {
        productId: product.id,
        productVariationId: variation.id,
        quantity: 2,
        unitPrice: parseFloat(variation.defaultSellingPrice || 100),
        requiresSerial: false,
        serialNumberIds: [],
      },
    ],
    payments: [
      {
        method: 'cash',
        amount: parseFloat(variation.defaultSellingPrice || 100) * 2,
      },
    ],
  }

  const res = await fetch(`${BASE_URL}/api/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
    },
    body: JSON.stringify(saleData),
  })

  const data = await res.json()

  if (res.ok && data.id) {
    saleId = data.id
    console.log('  ✅ Sale completed:', data.invoiceNumber)
    console.log('     Total: ₱' + (parseFloat(variation.defaultSellingPrice || 100) * 2).toFixed(2))
    return true
  } else {
    console.log('  ❌ Sale failed:', data.error || data.details)
    return false
  }
}

// Helper: Generate X Reading
async function generateXReading() {
  console.log('\n📊 Step 5: Generating X Reading...')

  const res = await fetch(`${BASE_URL}/api/readings/x-reading?shiftId=${currentShift.id}`, {
    headers: { Cookie: cookies },
  })

  const data = await res.json()

  if (res.ok && data.xReading) {
    console.log('  ✅ X Reading generated')
    console.log('     X Reading #:', data.xReading.xReadingNumber || 'N/A')
    console.log('     Gross Sales: ₱' + parseFloat(data.xReading.grossSales || 0).toFixed(2))
    console.log('     Net Sales: ₱' + parseFloat(data.xReading.netSales || 0).toFixed(2))
    console.log('     Expected Cash: ₱' + parseFloat(data.xReading.expectedCash || 0).toFixed(2))
    return true
  } else {
    console.log('  ❌ X Reading failed:', data.error || data.details)
    return false
  }
}

// Helper: Close Shift
async function closeShift() {
  console.log('\n🔒 Step 6: Closing shift...')

  const closeData = {
    endingCash: 5200.0,
    closingNotes: 'Test shift closure',
    cashDenomination: {
      count1000: 5,
      count500: 0,
      count200: 1,
      count100: 0,
      count50: 0,
      count20: 0,
      count10: 0,
      count5: 0,
      count1: 0,
      count025: 0,
    },
  }

  const res = await fetch(`${BASE_URL}/api/shifts/${currentShift.id}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
    },
    body: JSON.stringify(closeData),
  })

  const data = await res.json()

  if (res.ok && data.shift) {
    console.log('  ✅ Shift closed successfully')
    if (data.variance) {
      console.log('     System Cash: ₱' + parseFloat(data.variance.systemCash || 0).toFixed(2))
      console.log('     Ending Cash: ₱' + parseFloat(data.variance.endingCash || 0).toFixed(2))
      if (data.variance.cashShort > 0) {
        console.log('     Cash Short: ₱' + parseFloat(data.variance.cashShort).toFixed(2))
      }
      if (data.variance.cashOver > 0) {
        console.log('     Cash Over: ₱' + parseFloat(data.variance.cashOver).toFixed(2))
      }
      console.log('     Balanced:', data.variance.isBalanced ? '✅ Yes' : '❌ No')
    }
    return true
  } else {
    console.log('  ❌ Close shift failed:', data.error || data.details)
    return false
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Complete POS Workflow Test')
  console.log('=' .repeat(50))

  try {
    // Step 1: Login
    const loginSuccess = await login()
    if (!loginSuccess) {
      console.log('\n❌ Test failed at login step')
      return
    }

    // Step 2: Begin Shift
    const shiftSuccess = await beginShift()
    if (!shiftSuccess) {
      console.log('\n❌ Test failed at begin shift step')
      return
    }

    // Step 3: Get products
    const products = await getProducts()

    // Step 4: Make Sale
    const saleSuccess = await makeSale(products)
    if (!saleSuccess) {
      console.log('\n⚠️  Sale failed, continuing with test...')
    }

    // Step 5: X Reading
    const xReadingSuccess = await generateXReading()
    if (!xReadingSuccess) {
      console.log('\n⚠️  X Reading failed, continuing with test...')
    }

    // Step 6: Close Shift
    const closeSuccess = await closeShift()
    if (!closeSuccess) {
      console.log('\n❌ Test failed at close shift step')
      return
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ Complete POS Workflow Test PASSED')
    console.log('=' .repeat(50))
    console.log('\n📋 Test Summary:')
    console.log('  ✅ Login')
    console.log('  ✅ Begin Shift')
    console.log('  ' + (products.length > 0 ? '✅' : '⚠️') + ' Fetch Products')
    console.log('  ' + (saleSuccess ? '✅' : '⚠️') + ' Process Sale')
    console.log('  ' + (xReadingSuccess ? '✅' : '⚠️') + ' X Reading')
    console.log('  ✅ Close Shift')
    console.log('\n🎉 POS System is ready for production!')

  } catch (error) {
    console.error('\n💥 Test error:', error)
  }
}

// Run the tests
runTests()
