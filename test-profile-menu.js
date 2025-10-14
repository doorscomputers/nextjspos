const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Testing profile menu visibility...\n');

    // Login
    console.log('1. Logging in as superadmin...');
    await page.goto('http://localhost:3002/login');
    await page.fill('[name=username]', 'superadmin');
    await page.fill('[name=password]', 'password');
    await page.click('[type=submit]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('✅ Login successful\n');

    // Wait for sidebar to load
    await page.waitForTimeout(2000);

    // Check for "My Profile" menu item
    console.log('2. Checking for "My Profile" menu item...');
    const profileMenuExists = await page.locator('text="My Profile"').count() > 0;

    if (profileMenuExists) {
      console.log('✅ "My Profile" menu item found in sidebar');

      // Click on it
      await page.click('text="My Profile"');
      await page.waitForURL('**/profile**', { timeout: 5000 });
      console.log('✅ Successfully navigated to profile page');

      // Take a screenshot
      await page.screenshot({ path: 'profile-page-screenshot.png' });
      console.log('✅ Screenshot saved as profile-page-screenshot.png');
    } else {
      console.log('❌ "My Profile" menu item NOT found in sidebar');

      // Take screenshot for debugging
      await page.screenshot({ path: 'sidebar-debug-no-profile.png' });
      console.log('📸 Debug screenshot saved as sidebar-debug-no-profile.png');

      // List all menu items
      const menuItems = await page.locator('nav a').allTextContents();
      console.log('\nFound menu items:');
      menuItems.forEach(item => console.log(`  - ${item}`));
    }

  } catch (e) {
    console.log('❌ Test failed:', e.message);
    await page.screenshot({ path: 'error-screenshot.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
