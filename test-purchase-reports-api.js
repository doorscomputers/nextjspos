async function testReports() {
  const baseUrl = 'http://localhost:3009';

  // First login
  console.log('🔐 Logging in as Jheirone...');
  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'Jheirone',
      password: 'newpass123',
    }),
  });

  const cookies = loginResponse.headers.get('set-cookie');
  console.log('Cookies:', cookies ? 'Received' : 'None');

  // Test each report
  const reports = [
    {
      name: 'Item Purchase Summary',
      url: `/api/reports/purchases/item-summary?period=month&year=2025&month=10`
    },
    {
      name: 'Supplier Purchase Summary',
      url: `/api/reports/purchases/supplier-summary?period=month&year=2025&month=10`
    },
    {
      name: 'Purchase Trend Analysis',
      url: `/api/reports/purchases/trend-analysis?period=month&year=2025`
    },
    {
      name: 'Payment Status Report',
      url: `/api/reports/purchases/payment-status?period=month&year=2025&month=10`
    }
  ];

  for (const report of reports) {
    console.log(`\n📊 Testing ${report.name}...`);
    try {
      const response = await fetch(`${baseUrl}${report.url}`, {
        headers: {
          'Cookie': cookies || '',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.log(`❌ ERROR: ${data.error}`);
        console.log(`   Details: ${data.details || 'No details'}`);
      } else {
        console.log(`✅ SUCCESS`);
        console.log(`   Data:`, JSON.stringify(data, null, 2).substring(0, 500) + '...');
      }
    } catch (error) {
      console.log(`❌ EXCEPTION: ${error.message}`);
    }
  }
}

testReports().catch(console.error);
