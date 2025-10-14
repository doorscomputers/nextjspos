const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://ultimatepos.test/...');
    await page.goto('http://ultimatepos.test/', { waitUntil: 'networkidle' });

    // Take screenshot of landing page
    await page.screenshot({ path: 'screenshots/00-landing-page.png', fullPage: true });
    console.log('✓ Landing page screenshot saved');

    // Click "Sign In" button
    console.log('Clicking Sign In...');
    await page.locator('a:has-text("Sign In"), button:has-text("Sign In")').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/01-login-page.png', fullPage: true });
    console.log('✓ Login page screenshot saved');

    // Find and fill login form
    console.log('Logging in as warrenhud...');

    // Fill username
    await page.fill('input[name="username"]', 'warrenhud');

    // Fill password
    await page.fill('input[name="password"]', '111111');

    await page.screenshot({ path: 'screenshots/02-login-filled.png', fullPage: true });

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/03-dashboard.png', fullPage: true });
    console.log('✓ Dashboard screenshot saved');

    // Navigate through different sections
    const sections = [
      { selector: 'a:has-text("Home")', file: '04-home', name: 'Home' },
      { selector: 'a:has-text("POS")', file: '05-pos', name: 'POS' },
      { selector: 'a:has-text("Products")', file: '06-products', name: 'Products' },
      { selector: 'a:has-text("Purchases")', file: '07-purchases', name: 'Purchases' },
      { selector: 'a:has-text("Sell")', file: '08-sell', name: 'Sell' },
      { selector: 'a:has-text("Stock")', file: '09-stock', name: 'Stock Transfers' },
      { selector: 'a:has-text("Expenses")', file: '10-expenses', name: 'Expenses' },
      { selector: 'a:has-text("Reports")', file: '11-reports', name: 'Reports' },
      { selector: 'a:has-text("Users")', file: '12-users', name: 'Users' },
      { selector: 'a:has-text("Settings")', file: '13-settings', name: 'Settings' },
    ];

    for (const section of sections) {
      try {
        const menuItem = page.locator(section.selector).first();

        if (await menuItem.isVisible({ timeout: 2000 })) {
          console.log(`\nNavigating to ${section.name}...`);
          await menuItem.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1500);
          await page.screenshot({ path: `screenshots/${section.file}.png`, fullPage: true });
          console.log(`✓ ${section.name} screenshot saved`);
        }
      } catch (error) {
        console.log(`✗ Could not access ${section.name}: ${error.message}`);
      }
    }

    console.log('\n✓ All screenshots saved to screenshots/ directory');
    console.log('\nBrowser will stay open for 30 seconds for manual exploration...');

    // Keep browser open for exploration
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'screenshots/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
