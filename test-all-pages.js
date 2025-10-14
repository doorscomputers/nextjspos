const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const realErrors = [];
  page.on('pageerror', err => {
    if (!err.message.includes('Hydration') && !err.message.includes('doubleInvoke')) {
      realErrors.push(err.message);
    }
  });

  try {
    console.log('Logging in...');
    await page.goto('http://localhost:3001/login');
    await page.fill('[name=username]', 'superadmin');
    await page.fill('[name=password]', 'password');
    await page.click('[type=submit]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('✅ Login successful\n');

    const tests = [
      { name: 'Purchases List', url: '/dashboard/purchases' },
      { name: 'Accounts Payable', url: '/dashboard/accounts-payable' },
      { name: 'Payments List', url: '/dashboard/payments' },
      { name: 'Payment Form', url: '/dashboard/payments/new' },
      { name: 'Post-Dated Cheques', url: '/dashboard/post-dated-cheques' }
    ];

    let allPassed = true;

    for (const test of tests) {
      console.log(`Testing: ${test.name}`);
      console.log('─'.repeat(50));

      await page.goto('http://localhost:3001' + test.url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const hasTable = await page.locator('table').count() > 0;
      const errorElements = await page.locator('text=/Runtime TypeError|can.*t access/i').count();
      const heading = await page.locator('h1').first().textContent().catch(() => '');

      const passed = errorElements === 0;
      allPassed = allPassed && passed;

      console.log(`  Heading: ${heading}`);
      console.log(`  Has Table: ${hasTable}`);
      console.log(`  Errors: ${errorElements}`);
      console.log(`  Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log('');
    }

    console.log('='.repeat(50));
    if (allPassed) {
      console.log('✅ ALL 5 PAGES WORKING!');
      process.exit(0);
    } else {
      console.log('❌ SOME PAGES HAVE ERRORS');
      process.exit(1);
    }

  } catch (e) {
    console.log('❌ Fatal error:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
