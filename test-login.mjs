import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to login page
  await page.goto('http://localhost:3000/login');

  // Fill in credentials
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'password');

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  // Click sign in
  await page.click('button[type="submit"]');

  // Wait for navigation or error
  await page.waitForTimeout(3000);

  // Check current URL
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);

  // Take screenshot
  await page.screenshot({ path: 'login-test.png' });

  if (currentUrl.includes('/dashboard')) {
    console.log('✅ Login successful!');
  } else {
    console.log('❌ Login failed - still on:', currentUrl);
  }

  await browser.close();
})();
