const fetch = require('node-fetch');

async function testProductsAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/products?limit=1000', {
      headers: {
        'Cookie': '' // Will fail auth but show response structure
      }
    });

    const status = response.status;
    const data = await response.json();

    console.log('Status:', status);
    console.log('Response structure:', JSON.stringify(data, null, 2).substring(0, 500));

    if (data.products) {
      console.log('\n✅ Response has .products array with', data.products.length, 'items');
    } else if (Array.isArray(data)) {
      console.log('\n✅ Response is array with', data.length, 'items');
    } else if (data.data) {
      console.log('\n✅ Response has .data with', data.data.length, 'items');
    } else {
      console.log('\n❌ Unknown response structure');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testProductsAPI();
