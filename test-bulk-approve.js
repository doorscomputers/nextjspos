/**
 * Test script to verify bulk approve functionality
 * This will help diagnose if the issue is in the API or frontend
 */

const baseUrl = 'http://localhost:3000'

async function login() {
  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'password'
    })
  })

  // Get session cookie
  const cookies = res.headers.get('set-cookie')
  return cookies
}

async function testBulkApprove() {
  console.log('🔐 Logging in...')
  const cookies = await login()

  if (!cookies) {
    console.error('❌ Login failed')
    return
  }

  console.log('✅ Logged in successfully\n')

  // Step 1: Get pending corrections
  console.log('📋 Fetching pending corrections...')
  const correctionsRes = await fetch(`${baseUrl}/api/inventory-corrections?status=pending&limit=5`, {
    headers: { Cookie: cookies }
  })

  const correctionsData = await correctionsRes.json()
  const pendingCorrections = correctionsData.corrections || []

  console.log(`Found ${pendingCorrections.length} pending corrections`)

  if (pendingCorrections.length === 0) {
    console.log('ℹ️  No pending corrections to test with')
    return
  }

  const correctionIds = pendingCorrections.map(c => c.id).slice(0, 2) // Test with 2
  console.log(`\n📦 Testing bulk approve with IDs: ${correctionIds.join(', ')}\n`)

  // Log before state
  console.log('BEFORE:')
  pendingCorrections.slice(0, 2).forEach(c => {
    console.log(`  ID ${c.id}: status="${c.status}", product="${c.product.name}"`)
  })

  // Step 2: Bulk approve
  console.log('\n🔄 Calling bulk approve API...')
  const approveRes = await fetch(`${baseUrl}/api/inventory-corrections/bulk-approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies
    },
    body: JSON.stringify({ correctionIds })
  })

  const approveData = await approveRes.json()
  console.log('\n✅ Bulk approve response:')
  console.log(JSON.stringify(approveData, null, 2))

  // Step 3: Wait a moment for transactions to commit
  console.log('\n⏳ Waiting 2 seconds for database to commit...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Step 4: Fetch corrections again to verify
  console.log('🔍 Verifying updates by fetching corrections again...\n')
  const verifyRes = await fetch(`${baseUrl}/api/inventory-corrections?status=all&limit=50`, {
    headers: { Cookie: cookies }
  })

  const verifyData = await verifyRes.json()
  const verifiedCorrections = verifyData.corrections.filter(c => correctionIds.includes(c.id))

  console.log('AFTER:')
  verifiedCorrections.forEach(c => {
    const statusChanged = c.status === 'approved' ? '✅' : '❌'
    console.log(`  ${statusChanged} ID ${c.id}: status="${c.status}", approvedBy=${c.approvedByUser?.username || 'null'}`)
  })

  // Summary
  const approvedCount = verifiedCorrections.filter(c => c.status === 'approved').length
  console.log(`\n📊 Summary: ${approvedCount}/${correctionIds.length} corrections successfully approved`)

  if (approvedCount < correctionIds.length) {
    console.error('\n⚠️  BUG CONFIRMED: Some corrections did not update!')
  } else {
    console.log('\n✅ All corrections updated successfully')
  }
}

testBulkApprove().catch(console.error)
