/**
 * Test AR Payment API directly to see detailed error
 * Run: node test-ar-payment.js
 */

const fetch = require('node-fetch');

async function testARPayment() {
  console.log('🧪 Testing AR Payment API...\n');

  const baseUrl = 'http://localhost:3000';
  const saleId = 31; // The invoice ID from the screenshot

  // Test data
  const paymentData = {
    amount: 100,
    paymentMethod: 'cash',
    referenceNumber: null,
    shiftId: 12, // You'll need to update this with actual shift ID
  };

  console.log('📝 Payment Data:', JSON.stringify(paymentData, null, 2));
  console.log(`🎯 Target: POST ${baseUrl}/api/sales/${saleId}/payment\n`);

  try {
    const response = await fetch(`${baseUrl}/api/sales/${saleId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'YOUR_SESSION_COOKIE_HERE' // Replace with actual session cookie
      },
      body: JSON.stringify(paymentData)
    });

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Status Text:', response.statusText);

    const data = await response.json();
    console.log('📊 Response Data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('\n❌ Error Details:', data);
    } else {
      console.log('\n✅ Payment recorded successfully!');
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testARPayment();
