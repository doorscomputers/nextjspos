const https = require('https');
const http = require('http');

// Test the inventory ledger API
async function testInventoryLedger() {
  console.log('Testing Inventory Ledger API...\n');

  // First login to get session cookie
  const loginData = JSON.stringify({
    username: 'superadmin',
    password: 'password'
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/auth/callback/credentials',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  };

  return new Promise((resolve, reject) => {
    const loginReq = http.request(loginOptions, (loginRes) => {
      let sessionCookie = '';
      if (loginRes.headers['set-cookie']) {
        sessionCookie = loginRes.headers['set-cookie'].join('; ');
      }

      console.log('Login Status:', loginRes.statusCode);
      console.log('Session Cookie:', sessionCookie ? 'Obtained' : 'Not found');

      // Now test the inventory ledger API
      const testOptions = {
        hostname: 'localhost',
        port: 3003,
        path: '/api/reports/inventory-ledger?productId=1&variationId=1&locationId=2',
        method: 'GET',
        headers: {
          'Cookie': sessionCookie
        }
      };

      const testReq = http.request(testOptions, (testRes) => {
        let data = '';

        testRes.on('data', (chunk) => {
          data += chunk;
        });

        testRes.on('end', () => {
          console.log('\n================== API TEST RESULT ==================');
          console.log('Status Code:', testRes.statusCode);
          console.log('Status:', testRes.statusCode === 200 ? '✅ SUCCESS' : '❌ FAILED');

          try {
            const jsonData = JSON.parse(data);
            console.log('\nResponse:');
            console.log(JSON.stringify(jsonData, null, 2));

            if (jsonData.success) {
              console.log('\n✅ Inventory Ledger API is working correctly!');
              console.log('Transactions count:', jsonData.data?.summary?.transactionCount || 0);
            } else {
              console.log('\n❌ API returned error:', jsonData.message);
              if (jsonData.error) {
                console.log('Error details:', jsonData.error);
              }
            }
          } catch (err) {
            console.log('\nRaw Response:', data);
          }

          console.log('=====================================================\n');
          resolve();
        });
      });

      testReq.on('error', (error) => {
        console.error('❌ Test Request Error:', error.message);
        reject(error);
      });

      testReq.end();
    });

    loginReq.on('error', (error) => {
      console.error('❌ Login Error:', error.message);
      reject(error);
    });

    loginReq.write(loginData);
    loginReq.end();
  });
}

testInventoryLedger().catch(console.error);
