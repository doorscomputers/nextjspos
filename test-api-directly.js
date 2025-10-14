const fetch = require('node-fetch');

async function testDashboardAPI() {
  try {
    console.log('Testing Dashboard API directly...\n');

    // Note: This will fail without authentication, but we can check the code is being executed
    const response = await fetch('http://localhost:3000/api/dashboard/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Response Status:', response.status);
    console.log('Response Status Text:', response.statusText);

    const data = await response.json();
    console.log('\nResponse Data:', JSON.stringify(data, null, 2));

    if (data.metrics) {
      console.log('\n=== METRICS ===');
      console.log('Total Purchase:', data.metrics.totalPurchase);
      console.log('Purchase Due:', data.metrics.purchaseDue);
      console.log('Purchase Count:', data.metrics.purchaseCount);
    }

    if (data.tables && data.tables.purchasePaymentDue) {
      console.log('\n=== PURCHASE PAYMENT DUE TABLE ===');
      console.log('Records:', data.tables.purchasePaymentDue.length);
      data.tables.purchasePaymentDue.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.purchaseOrderNumber} - ${item.supplier} - ${item.amount}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDashboardAPI();
