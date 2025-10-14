/**
 * Simple Test: Just test if product search API works after manual login
 */

const { chromium } = require('playwright');

async function testProductSearch() {
  console.log('🚀 Simple Product Search Test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Failed') || text.includes('Error') || text.includes('search')) {
      console.log(`🔍 Browser: ${text}`);
    }
  });

  // Log API responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/products/search')) {
      const status = response.status();
      console.log(`\n📡 Search API: ${url}`);
      console.log(`   Status: ${status}`);

      try {
        const data = await response.json();
        console.log(`   Response:`, JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(`   (Could not parse response)`);
      }
    }
  });

  try {
    console.log('Step 1: Go to login page...');
    await page.goto('http://localhost:3005/login');
    await page.waitForTimeout(2000);

    console.log('Step 2: Fill login form...');
    await page.fill('input[name="username"]', 'Jheirone');
    await page.fill('input[name="password"]', 'newpass123');

    console.log('Step 3: Click login button...');
    await page.click('button[type="submit"]');

    // Wait a bit for redirect
    await page.waitForTimeout(5000);

    console.log('Step 4: Navigate directly to Create Purchase Order...');
    await page.goto('http://localhost:3005/dashboard/purchases/create');
    await page.waitForTimeout(3000);

    console.log('\nStep 5: Test product search...');
    const searchInput = await page.locator('input[placeholder*="Scan"]').first();

    console.log('Typing "Generic" into search...');
    await searchInput.fill('Generic');

    console.log('Waiting 2 seconds for API call...');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'test-search-simple.png', fullPage: true });
    console.log('📸 Screenshot saved: test-search-simple.png');

    console.log('\n✅ Test complete! Check screenshot and console output above.');
    console.log('Browser will stay open for 20 seconds...\n');
    await page.waitForTimeout(20000);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ path: 'test-error-simple.png' });
  } finally {
    await browser.close();
  }
}

testProductSearch();
