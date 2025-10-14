/**
 * Playwright Test: Purchase Order Product Search
 *
 * This test debugs the "Failed to search products" error
 * by logging in as the specified user and testing the product search functionality.
 */

const { chromium } = require('playwright');

async function testProductSearch() {
  console.log('🚀 Starting Product Search Test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Enable console logging from the browser
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log(`❌ Browser Console Error: ${text}`);
    } else if (type === 'warning') {
      console.log(`⚠️  Browser Console Warning: ${text}`);
    } else if (text.includes('Failed') || text.includes('Error')) {
      console.log(`🔍 Browser Console: ${text}`);
    }
  });

  // Listen to all network responses
  page.on('response', async response => {
    const url = response.url();

    // Log API calls to products/search
    if (url.includes('/api/products/search')) {
      const status = response.status();
      console.log(`\n📡 API Call: ${url}`);
      console.log(`   Status: ${status} ${response.statusText()}`);

      try {
        const responseBody = await response.json();
        console.log(`   Response:`, JSON.stringify(responseBody, null, 2));
      } catch (e) {
        console.log(`   Response: (Unable to parse as JSON)`);
      }
    }

    // Log any failed API calls
    if (url.includes('/api/') && !response.ok()) {
      console.log(`\n❌ Failed API Call: ${url}`);
      console.log(`   Status: ${response.status()} ${response.statusText()}`);
      try {
        const errorBody = await response.json();
        console.log(`   Error:`, JSON.stringify(errorBody, null, 2));
      } catch (e) {
        console.log(`   Error: (Unable to parse response)`);
      }
    }
  });

  try {
    // Step 1: Navigate to login page
    console.log('📍 Step 1: Navigating to login page...');
    await page.goto('http://localhost:3005/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Step 2: Login
    console.log('📍 Step 2: Logging in as Jheirone...');
    await page.fill('input[name="username"]', 'Jheirone');
    await page.fill('input[name="password"]', 'newpass123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('✅ Login successful!\n');
    await page.waitForTimeout(2000);

    // Step 3: Navigate to Create Purchase Order page
    console.log('📍 Step 3: Navigating to Create Purchase Order page...');
    await page.goto('http://localhost:3005/dashboard/purchases/create', {
      waitUntil: 'networkidle'
    });
    await page.waitForTimeout(2000);

    // Check if page loaded
    const pageTitle = await page.textContent('h1');
    console.log(`   Page Title: "${pageTitle}"`);

    // Step 4: Check for product search input
    console.log('\n📍 Step 4: Looking for product search field...');
    const searchInput = await page.locator('input[placeholder*="Scan barcode"]').first();
    const isVisible = await searchInput.isVisible();
    console.log(`   Search input visible: ${isVisible}`);

    if (!isVisible) {
      console.log('❌ Product search input not found!');
      await page.screenshot({ path: 'error-no-search-input.png' });
      throw new Error('Product search input not found');
    }

    // Step 5: Test search with a simple term
    console.log('\n📍 Step 5: Testing product search...');
    console.log('   Typing "test" into search field...');
    await searchInput.fill('test');

    // Wait for debounce (300ms) + API call
    console.log('   Waiting for search results (debounce + API)...');
    await page.waitForTimeout(1000);

    // Step 6: Check if dropdown appears or error is shown
    console.log('\n📍 Step 6: Checking for results or errors...');

    // Check for dropdown
    const dropdown = page.locator('.absolute.z-50').first();
    const dropdownVisible = await dropdown.isVisible().catch(() => false);
    console.log(`   Dropdown visible: ${dropdownVisible}`);

    if (dropdownVisible) {
      const dropdownText = await dropdown.textContent();
      console.log(`   Dropdown content: "${dropdownText.substring(0, 100)}..."`);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-search-result.png', fullPage: true });
    console.log('   📸 Screenshot saved as test-search-result.png');

    // Step 7: Check session/permissions
    console.log('\n📍 Step 7: Checking user session and permissions...');
    const sessionData = await page.evaluate(() => {
      return fetch('/api/auth/session')
        .then(r => r.json())
        .catch(e => ({ error: e.message }));
    });
    console.log('   Session data:', JSON.stringify(sessionData, null, 2));

    // Step 8: Try to call the API directly
    console.log('\n📍 Step 8: Testing API directly from browser context...');
    const directAPICall = await page.evaluate(() => {
      return fetch('/api/products/search?q=test&limit=20')
        .then(async r => {
          const data = await r.json();
          return {
            status: r.status,
            statusText: r.statusText,
            ok: r.ok,
            data: data
          };
        })
        .catch(e => ({ error: e.message }));
    });
    console.log('   Direct API call result:', JSON.stringify(directAPICall, null, 2));

    // Step 9: Check database has products
    console.log('\n📍 Step 9: Verifying products exist in database...');
    // We'll need to check via API
    const productsCheck = await page.evaluate(() => {
      return fetch('/api/products?limit=5')
        .then(async r => {
          const data = await r.json();
          return {
            status: r.status,
            count: data.products?.length || 0,
            hasProducts: (data.products?.length || 0) > 0,
            firstProduct: data.products?.[0] || null
          };
        })
        .catch(e => ({ error: e.message }));
    });
    console.log('   Products check:', JSON.stringify(productsCheck, null, 2));

    console.log('\n✅ Test completed!');
    console.log('📸 Check test-search-result.png for visual confirmation');

    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    console.log('📸 Error screenshot saved as test-error.png');
    throw error;
  } finally {
    await browser.close();
    console.log('\n👋 Browser closed');
  }
}

// Run the test
testProductSearch()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
