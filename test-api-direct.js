/**
 * Direct API Test - Test the product search endpoint directly
 */

async function testAPI() {
  const baseURL = 'http://localhost:3000';

  console.log('Testing Product Search API...\n');

  // First, login to get cookies
  console.log('1. Logging in...');
  const loginResponse = await fetch(`${baseURL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: 'Jheirone',
      password: 'newpass123',
      json: 'true',
    }),
  });

  const cookies = loginResponse.headers.get('set-cookie');
  console.log('Login status:', loginResponse.status);
  console.log('Cookies:', cookies ? 'Present' : 'None');

  // Get session
  console.log('\n2. Getting session...');
  const sessionResponse = await fetch(`${baseURL}/api/auth/session`, {
    headers: {
      Cookie: cookies || '',
    },
  });
  const session = await sessionResponse.json();
  console.log('Session:', JSON.stringify(session, null, 2));

  // Test regular products API
  console.log('\n3. Testing regular /api/products...');
  const productsResponse = await fetch(`${baseURL}/api/products?limit=2`, {
    headers: {
      Cookie: cookies || '',
    },
  });
  const productsData = await productsResponse.json();
  console.log('Status:', productsResponse.status);
  console.log('Products:', JSON.stringify(productsData, null, 2).substring(0, 500));

  // Test search API
  console.log('\n4. Testing /api/products/search...');
  const searchResponse = await fetch(`${baseURL}/api/products/search?q=test`, {
    headers: {
      Cookie: cookies || '',
    },
  });

  console.log('Search Status:', searchResponse.status);
  const searchData = await searchResponse.json();
  console.log('Search Response:', JSON.stringify(searchData, null, 2));
}

testAPI().catch(console.error);
