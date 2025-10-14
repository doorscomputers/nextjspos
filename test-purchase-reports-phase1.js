const { chromium } = require('playwright');

async function testPurchaseReports() {
  console.log('🚀 Starting Purchase Reports Phase 1 Testing...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('📝 Logging in as Super Admin...');
    await page.goto('http://localhost:3003/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    console.log('✅ Login successful\n');

    // Test 1: Item Purchase Summary Report
    console.log('📊 TEST 1: Item Purchase Summary Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto('http://localhost:3003/dashboard/reports/purchases/item-summary');
    await page.waitForTimeout(2000);

    // Check if filters are visible
    const periodType = await page.locator('select').first().isVisible();
    console.log(`  Period Type dropdown: ${periodType ? '✅' : '❌'}`);

    // Click Generate Report
    console.log('  Clicking Generate Report button...');
    await page.click('button:has-text("Generate Report")');
    await page.waitForTimeout(3000);

    // Check for error
    const error1 = await page.locator('text=/error|failed|unexpected/i').first().isVisible().catch(() => false);
    if (error1) {
      const errorText = await page.locator('text=/error|failed|unexpected/i').first().textContent();
      console.log(`  ❌ ERROR: ${errorText}`);

      // Take screenshot
      await page.screenshot({ path: 'test-item-summary-error.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-item-summary-error.png');
    } else {
      // Check if data is loaded
      const hasData = await page.locator('table tbody tr').count().catch(() => 0);
      const summary = await page.locator('text=/Total Items|Total Quantity/i').count().catch(() => 0);

      console.log(`  Summary cards found: ${summary > 0 ? '✅' : '❌'}`);
      console.log(`  Data rows: ${hasData}`);

      if (summary > 0) {
        console.log('  ✅ Item Purchase Summary Report is WORKING');
      } else {
        console.log('  ⚠️  Report loaded but no data displayed');
      }

      await page.screenshot({ path: 'test-item-summary-success.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-item-summary-success.png');
    }
    console.log('');

    // Test 2: Supplier Purchase Summary Report
    console.log('📊 TEST 2: Supplier Purchase Summary Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto('http://localhost:3003/dashboard/reports/purchases/supplier-summary');
    await page.waitForTimeout(2000);

    // Click Generate Report
    console.log('  Clicking Generate Report button...');
    await page.click('button:has-text("Generate Report")');
    await page.waitForTimeout(3000);

    // Check for error
    const error2 = await page.locator('text=/error|failed|unexpected/i').first().isVisible().catch(() => false);
    if (error2) {
      const errorText = await page.locator('text=/error|failed|unexpected/i').first().textContent();
      console.log(`  ❌ ERROR: ${errorText}`);

      await page.screenshot({ path: 'test-supplier-summary-error.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-supplier-summary-error.png');
    } else {
      const hasData = await page.locator('table tbody tr').count().catch(() => 0);
      const summary = await page.locator('text=/Total Suppliers|Total Purchase Value/i').count().catch(() => 0);

      console.log(`  Summary cards found: ${summary > 0 ? '✅' : '❌'}`);
      console.log(`  Data rows: ${hasData}`);

      if (summary > 0) {
        console.log('  ✅ Supplier Purchase Summary Report is WORKING');
      } else {
        console.log('  ⚠️  Report loaded but no data displayed');
      }

      await page.screenshot({ path: 'test-supplier-summary-success.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-supplier-summary-success.png');
    }
    console.log('');

    // Test 3: Purchase Trend Analysis Report
    console.log('📊 TEST 3: Purchase Trend Analysis Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto('http://localhost:3003/dashboard/reports/purchases/trend-analysis');
    await page.waitForTimeout(2000);

    // Click Generate Report
    console.log('  Clicking Generate Report button...');
    await page.click('button:has-text("Generate Report")');
    await page.waitForTimeout(3000);

    // Check for error
    const error3 = await page.locator('text=/error|failed|unexpected/i').first().isVisible().catch(() => false);
    if (error3) {
      const errorText = await page.locator('text=/error|failed|unexpected/i').first().textContent();
      console.log(`  ❌ ERROR: ${errorText}`);

      await page.screenshot({ path: 'test-trend-analysis-error.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-trend-analysis-error.png');
    } else {
      const hasData = await page.locator('table tbody tr, .chart, canvas').count().catch(() => 0);
      const summary = await page.locator('text=/Total Amount|Peak Period/i').count().catch(() => 0);

      console.log(`  Summary cards found: ${summary > 0 ? '✅' : '❌'}`);
      console.log(`  Chart/Data elements: ${hasData}`);

      if (summary > 0) {
        console.log('  ✅ Purchase Trend Analysis Report is WORKING');
      } else {
        console.log('  ⚠️  Report loaded but no data displayed');
      }

      await page.screenshot({ path: 'test-trend-analysis-success.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-trend-analysis-success.png');
    }
    console.log('');

    // Test 4: Payment Status Report
    console.log('📊 TEST 4: Payment Status Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await page.goto('http://localhost:3003/dashboard/reports/purchases/payment-status');
    await page.waitForTimeout(2000);

    // Click Generate Report
    console.log('  Clicking Generate Report button...');
    await page.click('button:has-text("Generate Report")');
    await page.waitForTimeout(3000);

    // Check for error
    const error4 = await page.locator('text=/error|failed|unexpected/i').first().isVisible().catch(() => false);
    if (error4) {
      const errorText = await page.locator('text=/error|failed|unexpected/i').first().textContent();
      console.log(`  ❌ ERROR: ${errorText}`);

      await page.screenshot({ path: 'test-payment-status-error.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-payment-status-error.png');
    } else {
      const hasData = await page.locator('table tbody tr').count().catch(() => 0);
      const summary = await page.locator('text=/Total Purchases|Total Amount|Fully Paid/i').count().catch(() => 0);

      console.log(`  Summary cards found: ${summary > 0 ? '✅' : '❌'}`);
      console.log(`  Data rows: ${hasData}`);

      if (summary > 0) {
        console.log('  ✅ Payment Status Report is WORKING');
      } else {
        console.log('  ⚠️  Report loaded but no data displayed');
      }

      await page.screenshot({ path: 'test-payment-status-success.png', fullPage: true });
      console.log('  📸 Screenshot saved: test-payment-status-success.png');
    }
    console.log('');

    // Final Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 FINAL SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('All Phase 1 Purchase Reports have been tested.');
    console.log('Check the screenshots for detailed results.');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: test-error.png');
  } finally {
    await browser.close();
    console.log('✅ Test completed. Browser closed.');
  }
}

testPurchaseReports();
