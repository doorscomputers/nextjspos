import { test, expect } from '@playwright/test';

test.describe('Browse UltimatePOS UI', () => {
  test('Login and explore UI design', async ({ page }) => {
    // Navigate to the site
    await page.goto('http://ultimatepos.test/');

    // Take screenshot of login page
    await page.screenshot({ path: 'screenshots/ultimatepos-login.png', fullPage: true });

    // Login
    await page.fill('input[name="username"], input[type="text"]', 'warrenhud');
    await page.fill('input[name="password"], input[type="password"]', '111111');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot of dashboard/home page
    await page.screenshot({ path: 'screenshots/ultimatepos-dashboard.png', fullPage: true });

    // Explore different sections
    const menuItems = [
      { selector: 'a[href*="products"], a:has-text("Products")', name: 'products' },
      { selector: 'a[href*="sales"], a:has-text("Sales")', name: 'sales' },
      { selector: 'a[href*="purchases"], a:has-text("Purchases")', name: 'purchases' },
      { selector: 'a[href*="inventory"], a:has-text("Inventory")', name: 'inventory' },
      { selector: 'a[href*="customers"], a:has-text("Customers")', name: 'customers' },
      { selector: 'a[href*="reports"], a:has-text("Reports")', name: 'reports' },
    ];

    for (const item of menuItems) {
      try {
        const element = await page.locator(item.selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `screenshots/ultimatepos-${item.name}.png`, fullPage: true });
        }
      } catch (error) {
        console.log(`Could not access ${item.name}: ${error}`);
      }
    }

    console.log('Screenshots saved to screenshots/ directory');
  });
});
