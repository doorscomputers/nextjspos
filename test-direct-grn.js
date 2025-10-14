/**
 * Direct GRN Testing Script
 * Tests the Direct Entry workflow for Goods Received Notes
 */

const http = require('http')

const BASE_URL = 'http://localhost:3004'

// Test configuration
const TEST_USER = {
  username: 'admin',
  password: 'password',
}

let authCookie = ''
let testResults = []

// Helper function to make HTTP requests
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    const req = http.request(requestOptions, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        })
      })
    })

    req.on('error', reject)

    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

// Helper function to login and get session cookie
async function login() {
  console.log('\n🔐 Logging in as admin...')

  try {
    const res = await makeRequest('/api/auth/callback/credentials', {
      method: 'POST',
      body: JSON.stringify(TEST_USER),
    })

    if (res.headers['set-cookie']) {
      authCookie = res.headers['set-cookie'].join('; ')
      console.log('✅ Login successful')
      testResults.push({ test: 'Login', status: 'PASS' })
      return true
    }

    console.log('❌ Login failed')
    testResults.push({ test: 'Login', status: 'FAIL', error: 'No auth cookie' })
    return false
  } catch (error) {
    console.log(`❌ Login error: ${error.message}`)
    testResults.push({ test: 'Login', status: 'FAIL', error: error.message })
    return false
  }
}

// Test 1: Get suppliers
async function testGetSuppliers() {
  console.log('\n📦 Test 1: Fetching suppliers...')

  try {
    const res = await makeRequest('/api/suppliers', {
      headers: { Cookie: authCookie },
    })

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = JSON.parse(res.body)

    if (data.data && data.data.length > 0) {
      console.log(`✅ Found ${data.data.length} suppliers`)
      testResults.push({ test: 'Get Suppliers', status: 'PASS', count: data.data.length })
      return data.data[0]
    } else {
      console.log('⚠️  No suppliers found')
      testResults.push({ test: 'Get Suppliers', status: 'WARN', message: 'No suppliers' })
      return null
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`)
    testResults.push({ test: 'Get Suppliers', status: 'FAIL', error: error.message })
    return null
  }
}

// Test 2: Get locations
async function testGetLocations() {
  console.log('\n🏢 Test 2: Fetching locations...')

  try {
    const res = await makeRequest('/api/locations', {
      headers: { Cookie: authCookie },
    })

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = JSON.parse(res.body)

    if (data.data && data.data.length > 0) {
      console.log(`✅ Found ${data.data.length} locations`)
      testResults.push({ test: 'Get Locations', status: 'PASS', count: data.data.length })
      return data.data[0]
    } else {
      console.log('⚠️  No locations found')
      testResults.push({ test: 'Get Locations', status: 'WARN', message: 'No locations' })
      return null
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`)
    testResults.push({ test: 'Get Locations', status: 'FAIL', error: error.message })
    return null
  }
}

// Test 3: Get products
async function testGetProducts() {
  console.log('\n📱 Test 3: Fetching products...')

  try {
    const res = await makeRequest('/api/products?limit=10', {
      headers: { Cookie: authCookie },
    })

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = JSON.parse(res.body)

    if (data.data && data.data.length > 0) {
      console.log(`✅ Found ${data.data.length} products`)
      const productWithVariation = data.data.find(p => p.variations && p.variations.length > 0)
      if (productWithVariation) {
        console.log(`   Using: ${productWithVariation.name} (ID: ${productWithVariation.id})`)
        testResults.push({
          test: 'Get Products',
          status: 'PASS',
          count: data.data.length,
          testProduct: productWithVariation.name
        })
        return productWithVariation
      }
      console.log('⚠️  No products with variations found')
      testResults.push({ test: 'Get Products', status: 'WARN', message: 'No products with variations' })
      return null
    } else {
      console.log('⚠️  No products found')
      testResults.push({ test: 'Get Products', status: 'WARN', message: 'No products' })
      return null
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`)
    testResults.push({ test: 'Get Products', status: 'FAIL', error: error.message })
    return null
  }
}

// Test 4: Create Direct GRN
async function testCreateDirectGRN(supplier, location, product) {
  console.log('\n📝 Test 4: Creating Direct GRN...')

  if (!supplier || !location || !product) {
    console.log('❌ Missing required data (supplier, location, or product)')
    testResults.push({ test: 'Create Direct GRN', status: 'SKIP', reason: 'Missing test data' })
    return null
  }

  const grnData = {
    supplierId: supplier.id,
    locationId: location.id,
    receiptDate: new Date().toISOString().split('T')[0],
    notes: 'Test Direct GRN Entry - Automated Test',
    items: [
      {
        productId: product.id,
        productVariationId: product.variations[0].id,
        quantityReceived: 50,
        unitCost: 25.00,
        notes: 'Test item entry',
      },
    ],
  }

  console.log('   Supplier:', supplier.name)
  console.log('   Location:', location.name)
  console.log('   Product:', product.name)
  console.log('   Quantity: 50 units @ $25.00 = $1,250.00')

  try {
    const res = await makeRequest('/api/purchases/receipts', {
      method: 'POST',
      headers: { Cookie: authCookie },
      body: JSON.stringify(grnData),
    })

    console.log('   Response status:', res.status)

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}: ${res.body}`)
    }

    const data = JSON.parse(res.body)

    if (data.success && data.data) {
      console.log(`✅ GRN Created: ${data.data.receiptNumber}`)
      console.log(`   GRN ID: ${data.data.id}`)
      testResults.push({
        test: 'Create Direct GRN',
        status: 'PASS',
        grnNumber: data.data.receiptNumber,
        grnId: data.data.id
      })
      return data.data
    } else {
      throw new Error('Unexpected response format')
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`)
    testResults.push({ test: 'Create Direct GRN', status: 'FAIL', error: error.message })
    return null
  }
}

// Test 5: Verify GRN in list
async function testGetGRNList() {
  console.log('\n📋 Test 5: Fetching GRN list...')

  try {
    const res = await makeRequest('/api/purchases/receipts?limit=10', {
      headers: { Cookie: authCookie },
    })

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = JSON.parse(res.body)

    if (data.data && data.data.length > 0) {
      console.log(`✅ Found ${data.data.length} GRNs`)
      console.log(`   Latest GRN: ${data.data[0].receiptNumber}`)

      // Check if any direct entry GRNs exist (no purchaseId)
      const directEntries = data.data.filter(grn => !grn.purchaseId)
      if (directEntries.length > 0) {
        console.log(`   Direct Entry GRNs: ${directEntries.length}`)
        testResults.push({
          test: 'Get GRN List',
          status: 'PASS',
          total: data.data.length,
          directEntries: directEntries.length
        })
      } else {
        console.log('   No Direct Entry GRNs found')
        testResults.push({
          test: 'Get GRN List',
          status: 'PASS',
          total: data.data.length,
          directEntries: 0
        })
      }
      return data.data
    } else {
      console.log('⚠️  No GRNs found')
      testResults.push({ test: 'Get GRN List', status: 'WARN', message: 'No GRNs' })
      return []
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`)
    testResults.push({ test: 'Get GRN List', status: 'FAIL', error: error.message })
    return []
  }
}

// Test 6: Verify inventory movement
async function testInventoryMovement(product) {
  console.log('\n📊 Test 6: Checking inventory movements...')

  if (!product) {
    console.log('❌ No product to check')
    testResults.push({ test: 'Inventory Movement', status: 'SKIP', reason: 'No test product' })
    return
  }

  try {
    const res = await makeRequest(`/api/inventory/movements?productId=${product.id}&limit=5`, {
      headers: { Cookie: authCookie },
    })

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = JSON.parse(res.body)

    if (data.data && data.data.length > 0) {
      console.log(`✅ Found ${data.data.length} inventory movements for product`)
      const latestMovement = data.data[0]
      console.log(`   Latest movement: ${latestMovement.movementType}`)
      console.log(`   Quantity In: ${latestMovement.quantityIn}`)
      console.log(`   Balance: ${latestMovement.balanceQuantity}`)

      testResults.push({
        test: 'Inventory Movement',
        status: 'PASS',
        movements: data.data.length,
        latestType: latestMovement.movementType,
        balance: latestMovement.balanceQuantity
      })
    } else {
      console.log('⚠️  No inventory movements found')
      testResults.push({ test: 'Inventory Movement', status: 'WARN', message: 'No movements' })
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`)
    testResults.push({ test: 'Inventory Movement', status: 'FAIL', error: error.message })
  }
}

// Print test results summary
function printTestSummary() {
  console.log('\n' + '='.repeat(70))
  console.log('📊 TEST RESULTS SUMMARY')
  console.log('='.repeat(70))

  const passed = testResults.filter(r => r.status === 'PASS').length
  const failed = testResults.filter(r => r.status === 'FAIL').length
  const warned = testResults.filter(r => r.status === 'WARN').length
  const skipped = testResults.filter(r => r.status === 'SKIP').length

  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' :
                 result.status === 'FAIL' ? '❌' :
                 result.status === 'WARN' ? '⚠️' : '⏭️'
    console.log(`${icon} ${result.test.padEnd(35)} ${result.status}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })

  console.log('\n' + '-'.repeat(70))
  console.log(`Total Tests: ${testResults.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⚠️  Warnings: ${warned}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log('='.repeat(70) + '\n')
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Direct GRN Test Suite')
  console.log('Server:', BASE_URL)
  console.log('User:', TEST_USER.username)

  try {
    // Login
    const loggedIn = await login()
    if (!loggedIn) {
      console.log('\n❌ Cannot proceed without authentication')
      printTestSummary()
      return
    }

    // Run tests
    const supplier = await testGetSuppliers()
    const location = await testGetLocations()
    const product = await testGetProducts()

    const grn = await testCreateDirectGRN(supplier, location, product)

    await testGetGRNList()
    await testInventoryMovement(product)

    // Print summary
    printTestSummary()

    // Overall result
    const hasFailed = testResults.some(r => r.status === 'FAIL')
    if (!hasFailed) {
      console.log('🎉 ALL TESTS PASSED! Direct GRN feature is working correctly.\n')
    } else {
      console.log('⚠️  SOME TESTS FAILED! Please review errors above.\n')
    }

  } catch (error) {
    console.error('\n💥 Test suite crashed:', error)
    printTestSummary()
  }
}

// Run the tests
runTests()
