const fetch = require('node-fetch');

async function testSearch() {
  const searchTerm = 'Gene';
  const url = `http://localhost:3005/api/products/search?q=${encodeURIComponent(searchTerm)}&limit=20`;

  console.log(`Testing search for: "${searchTerm}"`);
  console.log(`URL: ${url}\n`);

  try {
    const response = await fetch(url, {
      headers: {
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN_HERE'
      }
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    const data = await response.json();
    console.log('\nResponse Data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.products && data.products.length > 0) {
      console.log(`\nFound ${data.products.length} products`);
      data.products.forEach(product => {
        console.log(`\nProduct: ${product.name}`);
        console.log(`  Variations: ${product.variations.length}`);
        product.variations.forEach(v => {
          console.log(`    - ${v.name} (SKU: ${v.sku})`);
        });
      });
    } else {
      console.log('\nNo products found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSearch();
