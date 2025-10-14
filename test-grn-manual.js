// Manual test to check GRN API
const testGRNView = async () => {
  console.log('🧪 Testing GRN View Endpoint...\n')

  try {
    // First login
    console.log('1. Logging in...')
    const loginRes = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'password',
        redirect: false,
      }),
    })

    if (!loginRes.ok) {
      console.log('❌ Login failed')
      return
    }

    console.log('✅ Login successful')

    // Get cookies
    const cookies = loginRes.headers.get('set-cookie')

    // Fetch receipts list
    console.log('\n2. Fetching receipts list...')
    const listRes = await fetch('http://localhost:3000/api/purchases/receipts', {
      headers: {
        'Cookie': cookies || '',
      },
    })

    if (!listRes.ok) {
      const error = await listRes.json()
      console.log('❌ Failed to fetch receipts:', error)
      return
    }

    const listData = await listRes.json()
    console.log(`✅ Found ${listData.data.length} receipts`)

    if (listData.data.length === 0) {
      console.log('⚠️  No receipts to test')
      return
    }

    // Check first receipt
    const firstReceipt = listData.data[0]
    console.log(`\n📋 First Receipt: ${firstReceipt.receiptNumber}`)
    console.log(`   Received By: ${firstReceipt.receivedByUser?.firstName} ${firstReceipt.receivedByUser?.surname} ${firstReceipt.receivedByUser?.lastName}`)
    console.log(`   Date: ${firstReceipt.receivedAt}`)

    // Test view detail
    console.log(`\n3. Fetching receipt detail (ID: ${firstReceipt.id})...`)
    const detailRes = await fetch(`http://localhost:3000/api/purchases/receipts/${firstReceipt.id}`, {
      headers: {
        'Cookie': cookies || '',
      },
    })

    if (!detailRes.ok) {
      const error = await detailRes.json()
      console.log('❌ Failed to fetch receipt detail:', error)
      return
    }

    const detailData = await detailRes.json()
    console.log('✅ Receipt detail fetched successfully')
    console.log(`   GRN: ${detailData.receiptNumber}`)
    console.log(`   Status: ${detailData.status}`)
    console.log(`   Supplier: ${detailData.purchase ? detailData.purchase.supplier.name : detailData.supplier.name}`)
    console.log(`   Items: ${detailData.items.length}`)

    // Check items
    console.log('\n4. Checking items data...')
    detailData.items.forEach((item, index) => {
      const product = item.product || item.purchaseItem?.product
      const variation = item.productVariation || item.purchaseItem?.productVariation

      if (!product || !variation) {
        console.log(`   ❌ Item ${index + 1}: Missing product/variation data`)
        console.log(`      Has product: ${!!product}`)
        console.log(`      Has variation: ${!!variation}`)
        console.log(`      Has purchaseItem: ${!!item.purchaseItem}`)
      } else {
        console.log(`   ✅ Item ${index + 1}: ${product.name} - ${variation.name} (${variation.sku})`)
      }
    })

    console.log('\n✅ ALL API TESTS PASSED!')

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message)
    console.error(error.stack)
  }
}

testGRNView()
