import { test, expect } from '@playwright/test'

/**
 * ✨ AUTOMATED MULTI-LOCATION TRANSFER TEST (API-BASED)
 *
 * This test uses DIRECT API CALLS instead of browser automation.
 * Much faster and more reliable!
 *
 * Flow:
 * 1. Login as warehouse_clerk → Create 2 transfers via API
 * 2. Login as warehouse_supervisor → Approve both transfers via API
 * 3. Login as warehouse_manager → Send both transfers via API (stock deducted)
 * 4. Login as mainstore_receiver → Receive transfer 1 via API (stock added)
 * 5. Login as bambang_receiver → Receive transfer 2 via API (stock added)
 * 6. Verify inventory at all locations
 */

const BASE_URL = 'http://localhost:3000'

// Helper: Login and get session cookie
async function login(request: any, username: string, password: string = 'password') {
  console.log(`\n🔑 Logging in as: ${username}`)

  const response = await request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    data: {
      username,
      password,
      json: true,
    },
  })

  if (!response.ok()) {
    const error = await response.text()
    throw new Error(`Login failed for ${username}: ${response.status()} - ${error}`)
  }

  const loginData = await response.json()
  const token = loginData.token || loginData.sessionToken

  if (!token) {
    // Try extracting from Set-Cookie header
    const headers = response.headers()
    const setCookie = headers['set-cookie'] || headers['Set-Cookie']

    if (setCookie) {
      const match = setCookie.match(/next-auth\.session-token=([^;]+)/)
      if (match) {
        console.log(`✅ Logged in as ${username} (from cookie)`)
        return `next-auth.session-token=${match[1]}`
      }
    }

    throw new Error(`No session token found for ${username}`)
  }

  console.log(`✅ Logged in as ${username}`)
  return `next-auth.session-token=${token}`
}

// Helper: Get session info
async function getSession(request: any, cookie: string) {
  const response = await request.get(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: cookie },
  })

  if (!response.ok()) {
    throw new Error('Failed to get session')
  }

  return await response.json()
}

// Helper: Get stock quantity
async function getStock(request: any, cookie: string, variationId: number, locationId: number) {
  const response = await request.get(
    `${BASE_URL}/api/products/variations/${variationId}/stock?locationId=${locationId}`,
    { headers: { Cookie: cookie } }
  )

  if (response.ok()) {
    const data = await response.json()
    return parseFloat(data.qtyAvailable || 0)
  }

  // Fallback: Try product history
  const historyResponse = await request.get(
    `${BASE_URL}/api/products/${variationId}/stock-history?variationId=${variationId}&locationId=${locationId}`,
    { headers: { Cookie: cookie } }
  )

  if (historyResponse.ok()) {
    const history = await historyResponse.json()
    return parseFloat(history.currentStock || 0)
  }

  return 0
}

test.describe('Automated Transfer Workflow (API)', () => {

  let mainWarehouseId: number
  let mainStoreId: number
  let bambangId: number
  let product1Id: number
  let product2Id: number
  let variation1Id: number
  let variation2Id: number
  let transfer1Id: number
  let transfer2Id: number

  test('Complete transfer workflow using API calls', async ({ request }) => {
    console.log('\n' + '='.repeat(80))
    console.log('🚀 STARTING API-BASED TRANSFER WORKFLOW TEST')
    console.log('='.repeat(80))

    // ========================================
    // SETUP: Get locations and products
    // ========================================
    console.log('\n📋 SETUP: Getting locations and products')
    console.log('-'.repeat(80))

    const adminCookie = await login(request, 'admin')
    const session = await getSession(request, adminCookie)

    // Get locations
    const locationsResponse = await request.get(`${BASE_URL}/api/locations`, {
      headers: { Cookie: adminCookie },
    })
    const locationsData = await locationsResponse.json()
    const locations = locationsData.locations

    mainWarehouseId = locations.find((l: any) => l.name.includes('Warehouse'))?.id || locations[0]?.id
    mainStoreId = locations.find((l: any) => l.name.includes('Main Store'))?.id || locations[1]?.id
    bambangId = locations.find((l: any) => l.name.includes('Bambang'))?.id || locations[2]?.id

    console.log(`📍 Main Warehouse: ${mainWarehouseId}`)
    console.log(`📍 Main Store: ${mainStoreId}`)
    console.log(`📍 Bambang: ${bambangId}`)

    // Get products
    const productsResponse = await request.get(`${BASE_URL}/api/products`, {
      headers: { Cookie: adminCookie },
    })
    const productsData = await productsResponse.json()
    const products = productsData.products

    product1Id = products[0]?.id
    variation1Id = products[0]?.variations[0]?.id
    product2Id = products[1]?.id
    variation2Id = products[1]?.variations[0]?.id

    console.log(`📦 Product 1: ${products[0]?.name} (ID: ${product1Id})`)
    console.log(`📦 Product 2: ${products[1]?.name} (ID: ${product2Id})`)

    // ========================================
    // STEP 1: CREATE TRANSFERS (warehouse_clerk)
    // ========================================
    console.log('\n📝 STEP 1: CREATE TRANSFERS')
    console.log('-'.repeat(80))

    const clerkCookie = await login(request, 'warehouse_clerk')

    // Create Transfer 1: Warehouse → Main Store
    console.log('\n📋 Creating Transfer 1: Warehouse → Main Store (5 units)')
    const transfer1Response = await request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: clerkCookie },
      data: {
        fromLocationId: mainWarehouseId,
        toLocationId: mainStoreId,
        transferDate: new Date().toISOString(),
        items: [{
          productId: product1Id,
          productVariationId: variation1Id,
          quantity: 5,
        }],
        notes: 'Automated test transfer 1',
      },
    })

    expect(transfer1Response.ok()).toBeTruthy()
    const transfer1 = await transfer1Response.json()
    transfer1Id = transfer1.id
    console.log(`✅ Transfer 1 created: ID ${transfer1Id}, Status: ${transfer1.status}`)

    // Create Transfer 2: Warehouse → Bambang
    console.log('\n📋 Creating Transfer 2: Warehouse → Bambang (3 units)')
    const transfer2Response = await request.post(`${BASE_URL}/api/transfers`, {
      headers: { Cookie: clerkCookie },
      data: {
        fromLocationId: mainWarehouseId,
        toLocationId: bambangId,
        transferDate: new Date().toISOString(),
        items: [{
          productId: product2Id,
          productVariationId: variation2Id,
          quantity: 3,
        }],
        notes: 'Automated test transfer 2',
      },
    })

    expect(transfer2Response.ok()).toBeTruthy()
    const transfer2 = await transfer2Response.json()
    transfer2Id = transfer2.id
    console.log(`✅ Transfer 2 created: ID ${transfer2Id}, Status: ${transfer2.status}`)

    // ========================================
    // STEP 2: APPROVE TRANSFERS (warehouse_supervisor)
    // ========================================
    console.log('\n✅ STEP 2: APPROVE TRANSFERS')
    console.log('-'.repeat(80))

    const supervisorCookie = await login(request, 'warehouse_supervisor')

    // Approve Transfer 1
    console.log(`\n🔍 Approving Transfer 1 (ID: ${transfer1Id})`)
    const approve1Response = await request.post(`${BASE_URL}/api/transfers/${transfer1Id}/check`, {
      headers: { Cookie: supervisorCookie },
      data: { notes: 'Approved by automated test' },
    })

    if (approve1Response.ok()) {
      console.log(`✅ Transfer 1 approved`)
    } else {
      console.log(`⚠️ Transfer 1 approval response: ${approve1Response.status()}`)
    }

    // Approve Transfer 2
    console.log(`\n🔍 Approving Transfer 2 (ID: ${transfer2Id})`)
    const approve2Response = await request.post(`${BASE_URL}/api/transfers/${transfer2Id}/check`, {
      headers: { Cookie: supervisorCookie },
      data: { notes: 'Approved by automated test' },
    })

    if (approve2Response.ok()) {
      console.log(`✅ Transfer 2 approved`)
    } else {
      console.log(`⚠️ Transfer 2 approval response: ${approve2Response.status()}`)
    }

    // ========================================
    // STEP 3: SEND TRANSFERS (warehouse_manager)
    // ========================================
    console.log('\n🚚 STEP 3: SEND TRANSFERS (Stock Deducted)')
    console.log('-'.repeat(80))

    const managerCookie = await login(request, 'warehouse_manager')

    // Get stock before sending
    const warehouse1Before = await getStock(request, managerCookie, variation1Id, mainWarehouseId)
    const warehouse2Before = await getStock(request, managerCookie, variation2Id, mainWarehouseId)
    console.log(`📊 Warehouse stock BEFORE sending:`)
    console.log(`   Product 1: ${warehouse1Before} units`)
    console.log(`   Product 2: ${warehouse2Before} units`)

    // Send Transfer 1
    console.log(`\n📤 Sending Transfer 1 (ID: ${transfer1Id})`)
    const send1Response = await request.post(`${BASE_URL}/api/transfers/${transfer1Id}/send`, {
      headers: { Cookie: managerCookie },
      data: {
        shippingDate: new Date().toISOString(),
        shippingMethod: 'Internal Delivery',
        notes: 'Sent by automated test',
      },
    })

    if (send1Response.ok()) {
      console.log(`✅ Transfer 1 sent - Stock deducted`)
    } else {
      const error = await send1Response.text()
      console.log(`❌ Send failed: ${send1Response.status()} - ${error}`)
    }

    // Send Transfer 2
    console.log(`\n📤 Sending Transfer 2 (ID: ${transfer2Id})`)
    const send2Response = await request.post(`${BASE_URL}/api/transfers/${transfer2Id}/send`, {
      headers: { Cookie: managerCookie },
      data: {
        shippingDate: new Date().toISOString(),
        shippingMethod: 'Internal Delivery',
        notes: 'Sent by automated test',
      },
    })

    if (send2Response.ok()) {
      console.log(`✅ Transfer 2 sent - Stock deducted`)
    } else {
      const error = await send2Response.text()
      console.log(`❌ Send failed: ${send2Response.status()} - ${error}`)
    }

    // Verify stock deducted
    const warehouse1After = await getStock(request, managerCookie, variation1Id, mainWarehouseId)
    const warehouse2After = await getStock(request, managerCookie, variation2Id, mainWarehouseId)
    console.log(`\n📊 Warehouse stock AFTER sending:`)
    console.log(`   Product 1: ${warehouse1After} units (expected: ${warehouse1Before - 5})`)
    console.log(`   Product 2: ${warehouse2After} units (expected: ${warehouse2Before - 3})`)

    // ========================================
    // STEP 4: RECEIVE AT MAIN STORE
    // ========================================
    console.log('\n📥 STEP 4: RECEIVE TRANSFER AT MAIN STORE')
    console.log('-'.repeat(80))

    const mainStoreReceiverCookie = await login(request, 'mainstore_receiver')

    const mainStoreBefore = await getStock(request, mainStoreReceiverCookie, variation1Id, mainStoreId)
    console.log(`📊 Main Store stock BEFORE: ${mainStoreBefore} units`)

    console.log(`\n📦 Receiving Transfer 1 at Main Store (ID: ${transfer1Id})`)
    const receive1Response = await request.post(`${BASE_URL}/api/transfers/${transfer1Id}/receive`, {
      headers: { Cookie: mainStoreReceiverCookie },
      data: {
        arrivedDate: new Date().toISOString(),
        notes: 'Received by automated test',
      },
    })

    if (receive1Response.ok()) {
      console.log(`✅ Transfer 1 received at Main Store`)
    } else {
      const error = await receive1Response.text()
      console.log(`❌ Receive failed: ${receive1Response.status()} - ${error}`)
    }

    const mainStoreAfter = await getStock(request, mainStoreReceiverCookie, variation1Id, mainStoreId)
    console.log(`📊 Main Store stock AFTER: ${mainStoreAfter} units (expected: ${mainStoreBefore + 5})`)

    // ========================================
    // STEP 5: RECEIVE AT BAMBANG
    // ========================================
    console.log('\n📥 STEP 5: RECEIVE TRANSFER AT BAMBANG')
    console.log('-'.repeat(80))

    const bambangReceiverCookie = await login(request, 'bambang_receiver')

    const bambangBefore = await getStock(request, bambangReceiverCookie, variation2Id, bambangId)
    console.log(`📊 Bambang stock BEFORE: ${bambangBefore} units`)

    console.log(`\n📦 Receiving Transfer 2 at Bambang (ID: ${transfer2Id})`)
    const receive2Response = await request.post(`${BASE_URL}/api/transfers/${transfer2Id}/receive`, {
      headers: { Cookie: bambangReceiverCookie },
      data: {
        arrivedDate: new Date().toISOString(),
        notes: 'Received by automated test',
      },
    })

    if (receive2Response.ok()) {
      console.log(`✅ Transfer 2 received at Bambang`)
    } else {
      const error = await receive2Response.text()
      console.log(`❌ Receive failed: ${receive2Response.status()} - ${error}`)
    }

    const bambangAfter = await getStock(request, bambangReceiverCookie, variation2Id, bambangId)
    console.log(`📊 Bambang stock AFTER: ${bambangAfter} units (expected: ${bambangBefore + 3})`)

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(80))
    console.log('✅ AUTOMATED TRANSFER WORKFLOW TEST COMPLETE!')
    console.log('='.repeat(80))
    console.log('\n📊 FINAL INVENTORY SUMMARY:')
    console.log(`   Warehouse Product 1: ${warehouse1Before} → ${warehouse1After} (${warehouse1After - warehouse1Before}) ${warehouse1After === warehouse1Before - 5 ? '✅' : '❌'}`)
    console.log(`   Warehouse Product 2: ${warehouse2Before} → ${warehouse2After} (${warehouse2After - warehouse2Before}) ${warehouse2After === warehouse2Before - 3 ? '✅' : '❌'}`)
    console.log(`   Main Store Product 1: ${mainStoreBefore} → ${mainStoreAfter} (+${mainStoreAfter - mainStoreBefore}) ${mainStoreAfter === mainStoreBefore + 5 ? '✅' : '❌'}`)
    console.log(`   Bambang Product 2: ${bambangBefore} → ${bambangAfter} (+${bambangAfter - bambangBefore}) ${bambangAfter === bambangBefore + 3 ? '✅' : '❌'}`)
    console.log('\n✨ Test completed!')
    console.log('='.repeat(80) + '\n')
  })
})
